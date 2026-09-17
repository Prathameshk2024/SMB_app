# Deployment — Cloud Run + two Vercel projects

The shape:

```
       Cloud Run                        Vercel project 1
   ┌──────────────────┐            ┌──────────────────────┐
   │  Express API     │ ◄───────── │  seller + buyer app  │   frontend/
   │  + Firestore     │            └──────────────────────┘
   │  + Cloudinary    │            Vercel project 2
   │                  │ ◄───────── ┌──────────────────────┐
   └──────────────────┘            │  admin site          │   admin/
                                   └──────────────────────┘
```

One backend, two front ends, three deployments — all from this one repository.
Each Vercel project points at a different **Root Directory**, so they build and
deploy independently while still sharing `shared/src/types.ts`.

---

## 1. Cloud Run — the API

The live service:

| | |
|---|---|
| Service | `shantai-api` |
| Region | `asia-south1` (Mumbai) |
| URL | `https://shantai-api-204453348000.asia-south1.run.app` |

**How the container is built is not recorded in this repo.** There is no
Dockerfile and no `cloudbuild.yaml`, so the build lives in someone's shell
history or in the Cloud Console. Whoever deploys next: write the exact command
here. What the repo does say is the build and start step:

```bash
npm ci && npm --workspace @shantai/backend run build
npm --workspace @shantai/backend run start
```

### Two settings that are not Cloud Run's defaults

| Setting | Value | Default | Why |
|---|---|---|---|
| Maximum instances | **1** | 100 | See the warning below. |
| CPU allocation | **Always allocated** | Only during requests | `save()` writes 400 ms *after* the response is sent. With the default, Cloud Run takes the CPU away the moment the response goes, and the write waits for the next request or for shutdown. |

Neither is visible from outside the service, so check them rather than assume:

```bash
gcloud run services describe shantai-api --region asia-south1 --project <PROJECT_ID>
```

Look for `autoscaling.knative.dev/maxScale: '1'` and
`run.googleapis.com/cpu-throttling: 'false'`. To set both:

```bash
gcloud run services update shantai-api --region asia-south1 --project <PROJECT_ID> \
  --max-instances 1 --no-cpu-throttling
```

`<PROJECT_ID>` is the project's name, not the number in the URL — gcloud
refuses the number.

### ⚠ Exactly one instance. Not two.

`backend/src/db/firestore.ts` loads the whole database into memory at boot and
writes changes back. That is deliberate and documented there, and it is correct
for **one** process only. Two instances each hold their own snapshot and
overwrite each other's writes — orders vanish, sellers reappear after deletion,
and nothing in the logs says why.

So: **maximum instances stays at 1.** If you outgrow one instance, the fix is
to convert the route handlers to async per-document Firestore reads first. It
is a real piece of work, not a config change.

**A deploy is the one moment the ceiling does not hold.** Maximum instances is
counted per revision, and a new revision starts and takes traffic before the
old one has finished draining — for a few seconds there are two processes.
Every deploy, and every environment-variable change (which is a deploy), does
this. Do it when nobody is placing orders, not in the evening.

### Environment variables

Set these on the service (Console → *Edit & deploy new revision* → *Variables
& Secrets*). Cloud Run sets `PORT` itself and `config.ts` reads it — do not set
it. The four marked secret belong in Secret Manager rather than as plain
variables, where anyone with viewer access to the project can read them.

| Variable | Notes |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | **Secret. Required.** The server refuses to boot without it. Generate a fresh one, do not reuse your local value. Changing it later signs every user out. |
| `FIREBASE_SERVICE_ACCOUNT` | **Secret.** The whole service-account JSON on one line. |
| `CLOUDINARY_URL` | **Secret.** `cloudinary://key:secret@cloud` from the Cloudinary dashboard. |
| `CLOUDINARY_FOLDER` | `shanta-mahila-bazar` |
| `CORS_ORIGIN` | Both Vercel URLs, comma-separated. See §3. |
| `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD_HASH` | First sign-in only, while no administrator exists. Make the hash locally with `npm run admin:users -- hash` — Cloud Run has no shell to run it in. Remove both once a real account exists. There is no `ADMIN_PASSWORD`. |
| `MSG91_AUTH_KEY` | **Secret.** The account Auth Key, and the only thing that can check a widget token. Never copy it into a `VITE_*` variable. |
| `MSG91_WIDGET_ID` | The OTP widget's id. With `MSG91_AUTH_KEY` this selects the widget, which needs no DLT registration. |
| `MSG91_TEMPLATE_ID` / `MSG91_SENDER` | Only for your own DLT-approved template. Leave unset while using the widget. |
| `SEED_DEMO_DATA` | Leave unset. Setting it would put invented sellers in front of real customers. |
| `ALLOW_BULK_DELETE` | Leave unset. It is for one command run by hand, never for the service. |

Generate the session secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Cold starts

With minimum instances at 0, Cloud Run stops an idle instance, and the next
request waits while a new one boots — and boot here means loading the **whole
database** from Firestore before the first request is answered. For a seller on
a rural connection that wait reads as a broken app. `--min-instances 1` keeps
one warm and is billed for it.

Stopping itself is safe: Cloud Run sends `SIGTERM` ten seconds before it kills
an instance, and `backend/src/index.ts` flushes pending writes on it, so the
400 ms write-coalescing window is not lost.

---

## 2. Vercel — two projects, one repo

Create **two** Vercel projects from the same repository. The only difference is
the Root Directory.

| | Project 1 | Project 2 |
|---|---|---|
| Root Directory | `frontend` | `admin` |
| Framework preset | Vite | Vite |
| Environment variables | `VITE_API_URL=https://shantai-api-204453348000.asia-south1.run.app`<br>`VITE_MSG91_WIDGET_ID=...`<br>`VITE_MSG91_TOKEN_AUTH=...` | `VITE_API_URL` only |

Vercel detects the npm workspaces and installs from the repo root, so `shared/`
resolves normally. Your local `.env` files are gitignored, so Vercel sees none
of them — every value above is typed into the dashboard.

Two Root Directory settings matter here, and both are in *Settings → Build and
Deployment → Root Directory*:

- **Include source files outside of the Root Directory** must stay **on** (it
  is, by default). Both apps read `../shared/src` straight off disk; with it off
  the build fails because `tsc` cannot find it.
- **Skip deployment** can stay on, because `frontend/package.json` and
  `admin/package.json` both declare `"@shantai/shared": "*"`. That line is how
  Vercel knows a commit to `shared/` alone affects them. Remove it and such a
  commit deploys neither app.

**Production is the branch Vercel is told it is**, and in this repository no
default picks the right one. On import Vercel chooses `main` if it exists,
and here `main` holds only the initial commit; GitHub's default branch is
`prathamesh`, an older copy of the app from 8 September with no `admin/`
folder, and a root `package-lock.json` written on Windows that is missing
rollup's Linux binary. The first deployment built that branch and failed with
`Cannot find module @rollup/rollup-linux-x64-gnu`. The app is `prathamesh2`.

Set it in both projects: *Settings → Environments → Production → Branch
Tracking*, then *Deployments → Create Deployment* with the branch name. Do not
merge `prathamesh` into it — the two branches share nothing after the initial
commit, and its commits are an older version of the same files.

Pushing any other branch makes a preview deployment, on its own URL, which §3
will then block.

### Both projects need their `vercel.json` — it is already in the repo

`frontend/vercel.json` and `admin/vercel.json` each hold one rewrite:

```json
{ "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
```

Both apps route in the browser. Vercel knows nothing about `/seller/orders` or
`/payments`, so without this, **reloading any page other than the home page
returns 404** — the first thing anyone does after being sent a link. Static
files are matched before rewrites, so `/assets/…` still serves the real bundle.

The rewrite only works with absolute asset paths, which is Vite's default and
why neither app sets `base`. A relative base is resolved against the current
directory: reloading `/seller/orders` asks for `/seller/assets/index-xxx.js`,
the rewrite answers with `index.html`, and a script tag receiving HTML is a
blank screen. Nothing to configure in Vercel; the default `npm run build` is
right.

Every `VITE_*` value is read at **build** time, not run time — changing one
means redeploying, not just restarting. The admin console has no login OTP, so
the MSG91 pair belongs to project 1 alone.

The two MSG91 values here are public by design; the browser cannot run the
widget without them. **`MSG91_AUTH_KEY` is not one of them** — it lives on
Cloud Run only. Anything named `VITE_*` is inlined into the JS bundle that
ships to every phone, so putting the auth key here would publish it.

MSG91's widget settings restrict which domains may use it. Add the Vercel URL
there, or the widget loads and then refuses to send.

In development neither app needs it: `vite.config.ts` proxies `/api` to
`localhost:4000`.

---

## 3. CORS — the part that is easy to get wrong

`CORS_ORIGIN` is **comma-separated**, because two different origins call this
API:

```
CORS_ORIGIN=https://shanta-bazar.vercel.app,https://shanta-admin.vercel.app
```

Rules worth knowing:

- **No trailing slashes.** An `Origin` header never carries a path. They are
  stripped for you, but do not rely on it elsewhere.
- **Leaving it blank means any origin.** Fine locally, too open in production —
  the boot banner prints a warning when `NODE_ENV=production` and it is unset.
- **Vercel preview deployments get their own URLs** (`...-git-branch-....vercel.app`)
  and will be blocked. Either add the ones you use, or test previews against a
  separate API.
- **gcloud splits `--update-env-vars` on commas too**, so the obvious command
  sets `CORS_ORIGIN` to the first URL and treats the second as a malformed
  variable. Change the delimiter with gcloud's `^;^` prefix:

  ```bash
  gcloud run services update shantai-api --region asia-south1 --project <PROJECT_ID> \
    --update-env-vars "^;^CORS_ORIGIN=https://shanta-bazar.vercel.app,https://shanta-admin.vercel.app"
  ```

Confirm it on boot — the banner prints what is active, in the service's
*Logs* tab:

```
  Database       Firestore (shantaimahilabajar)
  Images         Cloudinary (wvd4cteq)
  OTP            MSG91 widget (356a4b...)
  CORS           https://shanta-bazar.vercel.app, https://shanta-admin.vercel.app
```

`OTP  demo (code shown on screen)` on a production host means the widget did
not configure and the API should not have booted — check both `MSG91_AUTH_KEY`
and `MSG91_WIDGET_ID` are set, since either alone falls back.

---

## 4. Order of operations

CORS needs the Vercel URLs, and Vercel needs the API URL, so it takes two
passes:

1. Deploy the API to Cloud Run with maximum instances 1 and CPU always
   allocated. Set everything except `CORS_ORIGIN`.
2. Deploy both Vercel projects with `VITE_API_URL` pointing at Cloud Run, and
   the `VITE_MSG91_*` pair on project 1.
3. Set `CORS_ORIGIN` on Cloud Run to the two Vercel URLs (the `^;^` command in
   §3). That makes a new revision — the same quiet-moment rule applies.
4. Add the project-1 Vercel URL to the MSG91 widget's allowed domains.
5. Deploy the Firestore rules: `firebase deploy --only firestore:rules`.
6. Check the boot banner shows Firestore, Cloudinary, the MSG91 widget and both
   origins.
7. Log in once on a real phone. The widget path is the one thing here that
   cannot be verified from the banner alone.

---

## 5. Before real users

- [ ] `SESSION_SECRET` set to a fresh random value — changing it later signs every user out
- [ ] MSG91 configured — **the API refuses to boot in production without it**, because demo mode returns the login code in the HTTP response
- [ ] `VITE_MSG91_WIDGET_ID` + `VITE_MSG91_TOKEN_AUTH` set on the Vercel frontend project, and the Vercel URL added to the widget's allowed domains
- [ ] `MSG91_AUTH_KEY` appears **only** on Cloud Run, never in a `VITE_*` variable
- [ ] The auth key committed in `.env.example` at `a0775b7` has been rotated — deleting the line did not revoke it
- [ ] `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD_HASH` set for the first sign-in (`npm run admin:users -- hash`), then removed once a real administrator exists
- [ ] `CORS_ORIGIN` set to both origins
- [ ] Cloud Run maximum instances is 1
- [ ] Cloud Run CPU is always allocated (`cpu-throttling: 'false'`)
- [ ] `firestore.rules` deployed
- [ ] `SEED_DEMO_DATA` unset
- [ ] `robots.txt` with `Disallow: /` on the admin project

---

## 6. The Android build

The APK is **not built from this repo**. It is a React Native WebView: an Expo
project (SDK 54) kept in its own folder, `appgold-main`, where `app/index.tsx`
is the whole app. Its one screen loads the production deployment of Vercel
project 1 over the network:

```
https://shantai-mahila-bajar-app-frontend.vercel.app/
```

What follows from that:

- **Deploying `frontend/` updates the app** on every phone the next time it
  loads. A frontend change needs no APK build, and the APK has no
  `VITE_API_URL` of its own — it runs the web build.
- **Rebuild the APK only when the wrapper changes**, or when that URL does. It
  is hard-coded in `app/index.tsx`, so a new Vercel domain without a new APK
  leaves every installed app pointing at the old one.
- **CORS and MSG91 need nothing extra.** The WebView's origin is that Vercel
  URL, which must already be in `CORS_ORIGIN` (§3) and in the widget's allowed
  domains (§2) for the web app to work. If requests fail only inside the APK,
  compare the URL in `app/index.tsx` with those two lists first.
- **No network, no app.** Nothing is bundled into the APK.

The wrapper is Android System WebView, not Chrome, and it does more than
display the page:

- Any link whose scheme is not `http(s)`, `data:`, `blob:` or `about:` —
  `tel:`, `upi:`, `whatsapp:` — is handed to Android to open another app.
- Any URL containing `.pdf`, `.csv`, `.xlsx`, `.xls`, `.doc`, `.txt`, `.zip`,
  `download=`, `export=` or `attachment=` goes to a native downloader instead of
  loading. A page link that merely contains one of those never opens in the app.
- Android Back walks the WebView's history, so it behaves like browser Back.
- The Android permissions the site relies on — `RECORD_AUDIO` for voice input
  among them — are declared in the wrapper's `app.json`.

### The phone's navigation bar

The WebView draws edge to edge, so Android's navigation bar sits on top of the
bottom of the page, and Android System WebView reports
`env(safe-area-inset-bottom)` as 0. `frontend/src/lib/appInsets.ts` therefore
reserves **48px** (the three-button bar) whenever it sees the WebView user
agent. On a gesture-bar phone that leaves a little empty space under the tab
bar.

The wrapper can replace that guess with the real value. In `app/index.tsx`:

```tsx
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const insets = useSafeAreaInsets()
// top: 0 while the wrapper itself keeps the page below the status bar.
const insetsJs = `window.ShantaiInsets = { top: 0, bottom: ${Math.round(insets.bottom)} }; true;`

<WebView
  injectedJavaScriptBeforeContentLoaded={insetsJs}
  /* ...existing props... */
/>
```

If the inset can change while the page is open (rotation), send it again with
`webViewRef.current?.injectJavaScript("window.dispatchEvent(new CustomEvent('shantai:insets', { detail: { top: 0, bottom: N } })); true;")`.

**Do not also wrap the WebView in a bottom `SafeAreaView`** without sending
`{ top: 0, bottom: 0 }`: the page would add its own 48px on top of the
wrapper's padding.

A web API that works in Chrome is not guaranteed there (`navigator.share` is
absent), so anything that touches the phone has to be tried inside the APK —
suite P of `docs/MANUAL-TEST-PLAN.md`.

To build it, from the wrapper's folder: `npm install`, then
`npm run android` (`expo run:android`) for a build on a connected phone. Its
release build type is currently signed with the debug keystore
(`android/app/build.gradle`), which the Play Store refuses; a Play listing
needs its own upload keystore first, and the package name
(`com.siddharam_sutar.mywebviewapp`) cannot change after the first upload.
