# शांताई महिला बाजार · Shantai Mahila Bazar

Digital entrepreneurship platform for rural women entrepreneurs.
Sellers and customers use the **app**; the **admin console is a separate site**
and only its API lives here.

Product spec: [`docs/FEATURE-SPEC.md`](docs/FEATURE-SPEC.md)

---

## Layout

```
shared/     TypeScript types + domain rules used by BOTH sides
backend/    Node + Express + TypeScript API  (includes the admin API)
frontend/   React + Vite + TypeScript        (seller + customer only)
docs/       the product specification
```

`shared/` is the point of the TypeScript: the order state machine, slot rules,
FSSAI/UPI validation and the Shantai Mahila Bazar ID generator are written once and imported
by both sides through the `@shared/*` alias. A change there is a compile error on
whichever side has not caught up.

## Run it

```bash
npm install          # installs all three workspaces
npm run dev          # API on :4000, app on :5173
```

Or separately:

```bash
npm run dev:api
npm run dev:web
```

Vite proxies `/api` to `localhost:4000`, so there is nothing to configure in
development. Data lives in `backend/data/db.json`; delete it, or
`POST /api/dev/reset`, to reseed.

## Walk the app

| Flow | How |
|---|---|
| **Landing** | `http://192.168.31.110:5173/` — two doors: sell, or buy |
| **New seller** | "मला विकायचं आहे" → any 10-digit number → **the 6-digit code shown on screen** → the 6-step registration wizard |
| **Existing seller** | Log in with `9822011223` (Sunita, SMB-ANADUR-01) |
| **Customer** | "मला खरेदी करायची आहे" → any number → any 4-digit OTP |
| **Admin** | No UI here by design. `POST /api/auth/admin/login` then call `/api/admin/*` |

Worth clicking through:

- **Registration wizard** — the Shantai Mahila Bazar ID appears live on step 2 as soon
  as the seller picks a village, and the digital score on step 4 as the answers come in.
- **Add Product → step 2** — press the mic and speak the product name.
- **Add Product → step 3** — food asks 4 fields, non-food asks 1.
- **An order → पाठवले → पोहोचले** — it demands the customer's OTP, and the
  check runs on the server, not in the browser.
- **A cart with two sellers** — splits into two orders, two delivery fees,
  two UPI QRs.

---

## What is in `shared/`

| File | What it owns |
|---|---|
| `types.ts` | every shape that crosses the wire |
| `orderFlow.ts` | the locked 6-state machine, and payment as a separate axis |
| `seller.ts` | slots, plan, validation, the UPI intent-link builder |
| `womenbiz.ts` | the Shantai Mahila Bazar ID, village codes, Devanagari transliteration |
| `readiness.ts` | the Digital Readiness Index |

### Shantai Mahila Bazar ID

Format `SMB-<VILLAGE>-<NN>`, e.g. **SMB-ANADUR-01**.

The serial is **per village**, not global, because `SMB-ANADUR-07` tells a field
coordinator which village to visit and `SMB-000431` tells them nothing. The five
survey villages have fixed codes; any other village name is transliterated from
Devanagari (`चिवरी → CHIVARI`, `रुद्रवाडी → RUDRAVADI`).

### Digital Readiness Index

Ten factors, ten marks each. **Six** are answered by the seller at registration as
yes/no taps. The remaining four — branding, packaging, online customer contact,
digital financial management — are **measured by the platform** from what the seller
actually does, because someone who has never done a thing cannot honestly
self-report it.

That split is what makes the before/after comparison meaningful: the six
self-reported answers are the baseline captured on day one, and the four
measured ones move on their own as the seller uses the platform.

Bands: 0-25 प्रारंभिक · 26-50 मूलभूत · 51-75 प्रगत · 76-100 डिजिटल उद्योजिका.

---

## Registration fields

Collected in six steps. New fields taken from the project plan are marked ←.

| Step | Fields |
|---|---|
| 1 · About you | name (voice), **age ←**, **education ←**, WhatsApp number ← |
| 2 · Village | village (from the 6 supported villages, or free text), taluka, district, pincode → **generates the Shantai Mahila Bazar ID** |
| 3 · Business | shop name (voice), business type (individual / SHG / Udyam), SHG name, **years in business ←**, **monthly capacity ←**, about (voice), sells food?, FSSAI number + expiry |
| 4 · Digital use ← | six yes/no questions → **Digital Readiness Index** |
| 5 · Money in | UPI ID, delivery charge, minimum order, dispatch time |
| 6 · Review | everything, plus the ID and score, before submitting |

---

## Admin API — backend only

There is **no admin UI in this repo**, deliberately: the client wants the admin
site built separately. Everything it needs is JSON.

```bash
TOKEN=$(curl -s -X POST localhost:4000/api/auth/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@shantabazar.in","password":"changeme"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['session']['token'])")

curl localhost:4000/api/admin/stats -H "Authorization: Bearer $TOKEN"
```

| Endpoint | Purpose |
|---|---|
| `GET /api/admin/stats` | dashboard, registration funnel, earnings bands, readiness bands |
| `GET /api/admin/payments?status=PENDING` | the ₹50 approvals queue, with `waitingHours` and a duplicate-UTR flag |
| `POST /api/admin/payments/:id/approve` | grants 5 slots and flips the seller to ACTIVE |
| `POST /api/admin/payments/:id/reject` | with a reason |
| `POST /api/admin/sellers/:id/grant-slots` | goodwill / trainee batch |
| `GET /api/admin/products?status=PENDING` | moderation queue |
| `POST /api/admin/products/:id/moderate` | approve/reject — **refuses to publish food without FSSAI** |
| `GET /api/admin/orders` | every order with its full status trail |
| `GET /api/admin/sellers` | sellers with slot usage |
| `POST /api/admin/sellers/:id/block` | suspend |
| `GET /api/admin/impact` | the funder report: women, ₹ earned, villages, readiness |

Set `ADMIN_PASSWORD` in the environment. The default is `changeme`.

---

## Credentials (Firebase + Cloudinary)

Copy `backend/.env.example` to `backend/.env` and fill it in. `.env` is
gitignored; nothing secret belongs in the repo.

**Everything is optional.** With an empty `.env` the app still runs: JSON-file
database, emoji instead of photos, any 4-digit OTP. Each credential switches
one piece on, and the boot banner tells you which are live:

```
  Database       Firestore (your-project)     ← or "JSON file (backend/data/db.json)"
  Images         Cloudinary (your-cloud)      ← or "off - emoji only"
  OTP            MSG91 widget (your-id)       ← or "demo (code shown on screen)"
```

### Firebase

Firebase console → Project settings → Service accounts → **Generate new private
key**. Then either paste the three fields:

```
FIREBASE_PROJECT_ID=...
FIREBASE_CLIENT_EMAIL=...@....iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
MIIE...
-----END PRIVATE KEY-----
"
```

...or drop the whole downloaded JSON (raw or base64) into
`FIREBASE_SERVICE_ACCOUNT` and leave those three blank.

On first boot against an empty project the seed data is written in, so the
collections exist and the app is immediately usable.

Deploy the rules once: `firebase deploy --only firestore:rules`. They deny all
client-SDK access, because every read and write goes through this API, which
holds the real rules — slot limits, FSSAI-on-food, legal order transitions.

> **One-instance limitation.** The API loads the whole dataset into memory and
> writes changed documents back (diffed and batched, so a single order update
> does not rewrite every seller). That keeps all 33 synchronous `getDb()` call
> sites working and keeps read costs near zero — but two server instances would
> each hold their own copy and overwrite each other. Pin the deployment to one
> instance (`--max-instances=1` on Cloud Run). Past that scale, convert the
> route handlers to async per-document reads.

### Cloudinary

Dashboard → Product Environment Credentials → copy the **API environment
variable**:

```
CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
```

Photos upload **straight from the phone to Cloudinary**; the bytes never pass
through this server. The API only issues a short-lived signature scoped to one
folder, so the API secret stays server-side — an unsigned preset would let
anyone on the internet fill your account.

Before upload the browser downscales to 1200px / JPEG 0.75, turning a 4MB
camera shot into roughly 200KB. On a village 4G connection that is the
difference between a few seconds and the point where a seller gives up. On
display, `f_auto,q_auto,c_fill,w_<rendered size>` fetches only the pixels
actually shown, and that transformed URL is the LRU cache key.

---

## Design rules (not preferences)

From section 6 of the spec, baked into `frontend/src/styles/theme.css`:

- Marathi is the **default**, switchable in the landing header and in profile
- Every icon carries a word; status is colour **+ icon + word**, never colour alone
- 16px minimum text, 56px buttons, 44px touch targets
- Four bottom tabs, one level deep. **No hamburger menu.**
- One question per screen in every wizard, with progress dots
- Confirmation dialogs state the consequence, never a bare "Are you sure?"
- Latin digits (₹500, not ५००) — that is what is printed on money
- **No web fonts.** Android ships Noto Sans Devanagari, so Marathi renders from
  system fonts at zero network cost and the APK works offline.

### Theming

`frontend/src/styles/theme.css` starts with a `:root` block marked
**THEME SWAP POINT**. Every colour, size and radius in the app comes from those
tokens, so a new theme is a change to that one block and nothing else.

### Voice typing

`frontend/src/lib/useVoiceInput.ts` wraps the Web Speech API; the `VoiceInput`
component in `components/ui.tsx` renders a text field with a mic beside it. It is
used for the product name, ingredients, material, and the seller's own name,
shop name and "about" text.

The keyboard is never removed — voice is an addition. On a phone without speech
support (iOS Safari) the mic simply does not render. Inside the APK the WebView
needs `RECORD_AUDIO` in `AndroidManifest.xml`.

### Responsive

Phone-first. The app shell is 480px, widening to 760px above 900px; product
grids are `auto-fill minmax(150px, 1fr)` so they go 2-up on a phone and more on
a tablet. The landing page is the one full-width surface, with breakpoints at
560 / 640 / 700 / 900 / 980px.

---

## Wiring up the real backend

### MSG91 — the OTP widget

The widget is what this project uses, because it needs **no DLT registration**:
the template and sender ID are MSG91's, not ours.

| Where | Variable | From |
|---|---|---|
| `backend/.env` | `MSG91_AUTH_KEY` | account menu → API → Auth Key. **Secret.** |
| `backend/.env` | `MSG91_WIDGET_ID` | OTP → Widget |
| `frontend/.env` | `VITE_MSG91_WIDGET_ID` | the same widget id |
| `frontend/.env` | `VITE_MSG91_TOKEN_AUTH` | OTP → Widget → Token Auth |

Both halves are needed: with only the frontend pair the server has no key to
check the token with, and with only the backend pair the browser cannot run the
widget at all and the app stays on the server-side OTP path.

The flow, and why it is safe even though the code is checked in the browser:

```
browser   widget sends the SMS and checks the code  →  access-token (JWT)
browser   POST /api/auth/otp/verify { phone, code: <JWT> }
server    POST verifyAccessToken { authkey, access-token }  →  the number
server    that number must equal the phone in the request, or 401
```

The browser never gets to assert "this number passed" — it carries a token that means
nothing until the server re-checks it with an auth key the bundle does not
have. The last line is the whole security of it: a token proves that *some*
number was verified, so without comparing it to the number in the request,
anyone could verify their own phone and then sign in as somebody else.
See `backend/src/services/otp.providers.ts` and `frontend/src/lib/msg91Widget.ts`.

`VITE_*` values are inlined into the JS bundle. **Never put `MSG91_AUTH_KEY` in
one.**

Leave all four blank and the app runs the server-side path instead: a real
six-digit code, hashed, single-use, five-minute TTL, shown on screen rather
than sent. Set `MSG91_TEMPLATE_ID` there instead if you ever get your own
DLT-approved template; the widget wins when both are configured.

### Firebase (free tier)

- Firestore for the collections in spec section 11
- Storage for product photos, payment screenshots and KYC — put those in a
  **private** bucket behind signed URLs
- Replace `backend/src/db/store.ts`; no route handler touches the file directly
- Replace the token check in `backend/src/middleware/auth.ts` with
  `verifyIdToken`, and gate admin on a custom claim
- **Repeat every rule in Firestore security rules.** The slot limit is enforced
  in `products.routes.ts`, not just by the disabled button — but a rule that
  exists only in the API is one misconfigured client away from being no rule.

### Analytics — do this now, not later

`app_events(user_id, role, event, screen, at)` and
`product_views(product_id, viewer_hash, at)` cannot be backfilled. Without them
the first six months of the platform's growth story does not exist.

---

## Building the APK

```bash
cd frontend
npm i -D @capacitor/cli @capacitor/core
npx cap init Shantai Mahila Bazar in.shantabazar.app --web-dir=dist
npm run cap:add && npm run cap:sync && npm run cap:open
```

`vite.config.ts` already sets `base: './'`, required for a Capacitor WebView.
Set `VITE_API_URL` to the deployed API — inside the APK there is no dev server
to proxy through.

Then for the share QR:
- **Android App Links** verified against your domain
- **Play Install Referrer API** for deferred deep linking, so someone who scans
  a seller's QR without the app installed lands on *that shop* after installing

> Do **not** use Firebase Dynamic Links. It shut down on 25 August 2025.

---

## Not built yet

Reviews · chat · push notifications · disputes · returns and refunds · coupons ·
real camera capture · QR image generation and decoding · courses and
certificates · the seller's own address book.
