# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

शांताई महिला बाजार / Shantai Mahila Bazar — a digital marketplace for rural women entrepreneurs in Maharashtra. Three user-facing surfaces, one API:

- **frontend/** — the seller + customer app (React/Vite; the Android APK is a React Native WebView that loads it from Vercel — see *Deployment shape*)
- **admin/** — the admin console (React/Vite, deployed separately)
- **backend/** — Express API serving all three, including `/api/admin/*`
- **shared/** — domain types and rules imported by all of the above

Product spec: `docs/FEATURE-SPEC.md`. Deployment: `docs/DEPLOY.md`.
Marathi style: `docs/MARATHI-STYLE.md` — read it before writing any Marathi string.

`README.md` is deliberately short — layout, run, demo logins, links. Rules and architecture live here and in `docs/`, not there; the long README it replaced repeated them and had drifted from the code in more than a dozen places.

## Commands

```bash
npm install            # installs all four workspaces
npm run dev            # API :4000 + seller app :5173
npm run dev:all        # the above + admin console :5174
npm run dev:api        # API only
npm run dev:web        # seller app only
npm run dev:admin      # admin console only

npm test               # backend (283) + frontend (100) + admin (37) tests
npm run typecheck      # all three workspaces
npm run build          # backend tsc + both Vite builds

npm run admin          # interactive admin CLI (backend/scripts/admin.ts)
npm run admin:users -- list          # administrator accounts (create / passwd / disable)
npm run admin:users -- hash          # a password hash for ADMIN_BOOTSTRAP_PASSWORD_HASH
npm run backfill:customers -- --help
npm run purge:demo -- --help
```

Run a single test file — `node:test` via tsx, no framework:

```bash
cd backend && node --import tsx --test tests/session.test.ts
cd admin   && node --import tsx --test tests/i18n.test.ts
```

Vite proxies `/api` to `localhost:4000`, so nothing needs configuring in development. A fresh clone starts with an **empty** database; demo data needs `SEED_DEMO_DATA=true` in `backend/.env`. Reseed by stopping the API and deleting `backend/data/db.json`, or with `POST /api/dev/reset`, which 404s unless `ALLOW_DEV_RESET` is set outside production.

Demo logins: any 10-digit number, and the OTP screen **shows you the 6-digit code** — it is a real code that is really checked, so typing anything else is refused. Seeded seller `9822011223` (Sunita, SMB-ANADUR-01). A customer phone with no name on record is authenticated but *not registered* — the app sends the customer to `/register/customer` to give one.

There is no default admin password any more. Make an account with `npm run admin:users -- create you@example.com "Your Name"`, or set `ADMIN_BOOTSTRAP_EMAIL` + `ADMIN_BOOTSTRAP_PASSWORD_HASH` on a host with no shell.

## Import convention — read this before writing any import

Cross-workspace imports use the `@shared/*` alias **with a `.js` extension on a `.ts` file**:

```ts
import type { Order } from '@shared/types.js'   // resolves to shared/src/types.ts
```

The backend is `module: NodeNext`, which requires the `.js` extension at runtime. The two Vite configs rewrite `@shared/<x>.js` → `shared/src/<x>.ts` with a regex alias. Dropping the `.js`, or writing `.ts`, breaks one side or the other. Local relative imports inside `frontend/` and `admin/` follow the same `.js` convention.

`shared/` is not built — it is consumed as TypeScript source. A change there is a compile error on whichever side has not caught up, which is the point.

`frontend/` and `admin/` still list `"@shantai/shared": "*"` in `dependencies`, although no import names that package. The line is for Vercel, not for the code: it skips deploying a monorepo project whose commit touched nothing it depends on, and it learns the dependencies from `package.json` alone. Without it, a commit that changes only `orderFlow.ts` or `payment.ts` would redeploy neither app, and the live site would keep enforcing the old rule. Do not remove it as unused.

## Architecture

### Persistence: one synchronous interface, two drivers

`backend/src/db/store.ts` exposes a **synchronous** `getDb()` backed by either Firestore or a JSON file, chosen by whether `FIREBASE_*` credentials are present. The entire dataset is loaded into memory at boot; `save()` schedules a diffed, batched write coalesced over 400ms.

Consequences that matter when changing anything in `backend/src/`:

- **`initStore()` must finish before the first request.** `index.ts` awaits it.
- **Writes are diffed, not blanket.** Only changed documents are sent. Do not introduce a code path that rewrites whole collections.
- **No single persist may delete more than half a collection.** `isBulkDelete()` in `firestore.ts` refuses it, keeps the documents, and logs loudly; `ALLOW_BULK_DELETE=true` on the one command that means it is the override. This exists because on 10 September 2026 a persist whose in-memory `sellers` and `products` were empty deleted six real sellers and thirteen products, recovered only from Firestore's one-hour version history. A refusal means memory and the server disagree — find out why before trusting that process.
- **This is correct for exactly ONE server process.** Two instances each hold their own snapshot and silently overwrite each other. Cloud Run is pinned to `--max-instances=1`, and a deploy is the one moment that ceiling does not hold: the new revision starts before the old one has drained, so for a few seconds there are two. Deploy when nobody is placing orders. Outgrowing this means converting route handlers to async per-document reads — real work, not a config change.
- A Firestore connection failure at boot **falls back to the JSON file** and says so loudly. Reads and writes track the same `firestoreLive` flag so they can never disagree.
- An empty database stays empty unless `SEED_DEMO_DATA` is set. Never make seeding automatic — it would put invented sellers in front of real customers.

Firebase is **server-side only**, via `firebase-admin` with a service account. There is no Firebase Web SDK anywhere, and adding one would be an architectural change, not a convenience: `firestore.rules` denies all client-SDK access because every business rule (slot limits, legal order transitions, who may edit what) lives in the API.

### Sessions

`backend/src/auth/` is the whole stack; `middleware/auth.ts` composes it. The token is `base64url({sid, role, iat}).base64url(HMAC(payload))` signed with `SESSION_SECRET`.

**The token carries no identity.** `sid` points at a row in the `sessions` collection, and `req.auth.sellerId` is read from that row on every request — so a token cannot assert an identity the server did not issue, and deleting the row revokes it instantly. That is what makes logout and "the phone was stolen" real.

- `auth/crypto.ts` is the only file that touches `node:crypto`. Every signature is **domain-separated by purpose**, so a registration ticket cannot be presented as a session token.
- **Registration requires a ticket.** `/sellers/register` takes the phone out of a single-use, 15-minute ticket from `/auth/otp/verify` and *ignores the one in the body*. Without it the endpoint minted a seller session for any phone number anybody typed.
- **OTP**: two paths, chosen in `config.ts` by which environment variables are set, and both end at the same `/auth/otp/verify`.
  - **MSG91 widget** (`MSG91_AUTH_KEY` + `MSG91_WIDGET_ID`) — what production uses, because it needs no DLT registration. The browser sends *and* checks the code, then hands back a JWT; `otp.providers.ts` trades that JWT for the number it was issued for and **refuses it unless it matches the phone in the request**. That comparison is the whole security of the path — a token only proves *some* number was verified. The frontend half is `lib/msg91Widget.ts`, using `exposeMethods: true` so the app keeps its own OTP screen rather than MSG91's English modal.
  - **Server-side** (no widget configured) — 6 digits from the CSPRNG, stored as an HMAC, single-use, 5-minute TTL, destroyed after 5 wrong guesses. Demo mode returns the code in the response so the app is walkable; it is a real code that is really checked, and production refuses to boot on this path.
  - `verifyOtp` checks `provider.verify` **before** the six-digit format test — a widget JWT is not six digits, and that ordering is what lets it through. `sendOtp` delivers nothing on the widget path - the SMS already went out from the browser - but the app calls `/auth/otp/send` **before** it asks the widget to send, because that route is where the per-number quota is counted. Skipping it made "three codes a day" a comment rather than a limit.
- **Rate limits** live in `auth/rateLimit.ts`, keyed by *both* subject and IP. This needs `app.set('trust proxy', 1)`; without it Cloud Run's front end makes every request share one address. The send ceiling is **three codes per number per 24h** — an SMS bill, not a security knob. `retryInMr()` in `auth.routes.ts` says that back in days or hours; "1440 मिनिटांनी" is a number rather than an answer, and it inflects for one, because "1 दिवसांनी" tells a woman this was not written for her on the one screen where she is already being told no.
- **Admins** are database records with scrypt hashes (`auth/admins.ts`), managed by `npm run admin:users`. There is no `ADMIN_PASSWORD`.
- **Idle windows, not absolute**: admin 8h, seller/customer 7 days. Different because the risk differs, and because re-issuing a seller's token costs an SMS. There is also an **absolute** ceiling (admin 7d, others 90d) so a copied token cannot be kept alive forever by being used.
- Past halfway through the window the server re-stamps the token onto the **`X-Session-Token`** response header; `frontend/src/lib/api.ts` and `admin/src/lib/api.ts` swap it in. This header must stay in the CORS `exposedHeaders` list or every session expires on a timer regardless of activity.
- **The token is held in memory; `localStorage` only carries it across a reload.** Both api clients keep a `memoryToken` and fall back to storage only when it is empty. Reading storage on every request made the whole app depend on a write that fails silently — blocked site data, private mode, a full quota — and the failure mode was the worst on offer: signed in on screen, because React holds the session, and no credentials on the wire.
- `attachAuth` never rejects — `requireRole(...)` does, so public routes stay public.
- On the seller/customer app the refreshed token must reach **`wb.session`**, not just `wb.token`: `api.ts` publishes `onTokenRefresh`/`onSessionExpired` and `AuthContext` is the only subscriber. The admin console publishes `onSessionExpired` the same way, and its `AuthContext` is likewise the only subscriber — clearing storage alone left React holding a signed-in session, so the shell stayed up and every panel on it re-requested with no token and got another 401. Writing it to `wb.token` alone means the next reload restores the original from `wb.session` and the slide is lost — the window then counts from login rather than from last use.
- **Only two things end a session**: Log out, and a 401. Back, refresh and re-entering `/seller` must never clear one, so the login screens redirect an already-signed-in matching role straight to its home instead of asking for an OTP again.

### Order state machine

`shared/src/orderFlow.ts` is the single source of truth:

```
PLACED → ACCEPTED → PACKED → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
```

Locked at six states. Payment is still a separate axis rather than a seventh state, but it is no longer independent of the walk: **a UPI order stops at `PACKED` until the seller says the money arrived.** The backend validates transitions with `canTransition()`; the frontend draws its buttons from `SELLER_ACTIONS`. Neither hard-codes a status string, and new code should not either.

### Money after acceptance, not before

The buyer used to pay at checkout. Now the order reaches the seller unpaid (`UPI_PENDING`), she accepts if she can deliver, and only then does the buyer pay — because her delivery-area list is a hint rather than a gate, rejection is an ordinary outcome, and a rejected prepaid order leaves the money in her account with no refund path in this app.

Two predicates in `orderFlow.ts` say whose turn it is, and both sides read them rather than comparing statuses:

- `awaitingCustomerPayment()` — UPI + `UPI_PENDING` + `ACCEPTED`. The buyer's order screen draws the QR and the UTR box from this; `POST /orders/:id/pay` refuses anything else.
- `awaitingPaymentConfirmation()` — UPI and not yet `UPI_CONFIRMED`. `POST /orders/:id/advance` refuses `PACKED` on it, and `Orders.tsx` hides the button so she does not discover the rule by being told no.

A typed UTR is a claim, not money: `UPI_SUBMITTED` only means the buyer says so. Only her own `confirm-payment`, made after looking at her UPI app, reaches `UPI_CONFIRMED`. Checkout no longer accepts a `paymentUtr` at all.

### Calling an order off

`shared/src/orderCancel.ts` is the rule; `backend/src/db/orderCancel.ts` applies it and `POST /orders/:id/cancel` is the one route, for both sides — which side is asking comes from the session, never the body. Both land on the existing `CANCELLED` state; the event's `by` says who.

- **The buyer, only while `PLACED`.** Nothing has been paid (UPI is paid after acceptance) and nothing is cooking. After acceptance the button is gone and the screen says to call the seller — "the customer asked to cancel" is on her list for exactly that.
- **The seller, from `ACCEPTED` to `OUT_FOR_DELIVERY`.** Before acceptance she has Reject; `DELIVERED` is not undone by a button. Her Cancel button sits below the content, never in the action bar her thumb lives on.
- **Both sides walk the same three steps** in `CancelOrderSheet`, worded for the reader: "cancel it for certain?" (what it costs the other person), the reason, then "cancel this order?" (it cannot be undone) — only that third button sends it.
- **Then the seller gets a fourth screen: the refund.** The app moves no money, so whatever the buyer paid is in her account and only she can return it. `refundOwed()` reads it off `paymentStatus` — `confirmed`, `claimed` (a UTR, which she is told to check) or `none` (still told to return any cash or advance). It closes only on "I understand", and `RefundNotice` keeps saying it on the cancelled order's screen while money was reported; the buyer's screen says the seller must send it back.
- **A reason is always required, picked from a list.** "Other" is the escape hatch and the only one that needs typed words (5–200 characters). The event stores the reason **code** in `reason`, not a sentence, so each reader sees it in their own language; `note` carries words only for "other". Old rejects kept their translated sentence in `note` and are shown as written.
- `endingEvent()` finds the event that ended an order; both apps' order screens and the admin order panel draw who stopped it and why from it. `backend/tests/order-cancel.test.ts` holds all of this.

### The two numbers nobody can check for her

`shared/src/payment.ts`. There is no gateway and no bank callback in this app,
so both hand-typed numbers on the payment screens fail in opposite directions:
a wrong **UPI ID** sends the money to a stranger, a wrong **UTR** leaves a real
payment with nothing to match it against. The rule on both, on both sides of
both flows, was `length < 6`.

- **A UTR is exactly 12 digits** — the RRN, which is what a bank statement
  shows and therefore the only reference a seller checking by eye can find.
  `normalizeUtr()` strips spaces and hyphens **and nothing else**: stripping
  every non-digit would turn PhonePe's own long transaction id into twelve
  digits that were never an RRN, and truncating it would invent one that looks
  perfect and matches no line anywhere. Wrong input has to stay wrong to be
  reportable.
- **The same UTR may not be claimed on a second order.** One transaction has
  one RRN. Subscription payments flag duplicates for the admin; an order has no
  admin in the loop, so `POST /orders/:id/pay` refuses it outright — re-posting
  it on the *same* order is a woman correcting a digit and is left alone.
- **`upiProblem()` is not an allow-list, on purpose.** `KNOWN_UPI_HANDLES`
  exists to catch a typo in the half of the address she cannot proofread: she
  can read "sunita" back, but "ybll" looks exactly as right as "ybl". A handle
  within one or two edits of a real one is refused *and named* ("तुम्हाला
  "@ybl" म्हणायचे आहे का?"); an unknown handle that is not a near miss is
  **accepted**, because new banks appear and this file does not, and locking a
  seller out of her own real UPI ID costs her every order she takes.
- `isValidUpi()` in `seller.ts` delegates here, so all seven call sites —
  registration, profile edit, the QR screen, both server routes — tightened at
  once and cannot drift apart. A test asserts they agree.
- **The amount is on the screen, not only inside the QR.** The generated link
  carries it and she cannot read a QR; paying the wrong figure into a UPI app
  is the one mistake neither side can undo. `CopyValue` beside it is an icon
  at the 44px floor and no word — labelled, the button was wider than the UPI
  ID it belonged to, and the ID is the thing she is meant to read.
- The submit button is **disabled while the number cannot be right**. A live
  button under a malformed UTR reads as "this is fine, press me", and it is the
  last thing standing between her and an unmatchable payment.

Both validators return **Marathi**, like `sellerProfileProblems` — it is what
each side already puts in `fields`, and a second English table is one more
thing to leave behind.

### One seller per cart

The cart holds **one seller's goods at a time**. The first shop a buyer adds
from owns it until she empties it or orders from it; a product from another
shop is refused on the spot, with the name of the shop that holds the cart and
a button to go and look at it.

`frontend/src/store/cartRules.ts` is the rule — `cartSeller()`, `canAddFrom()`
— and `CartContext.add()` is the only caller, returning `false` instead of
adding. `ProductDetail` in `screens/customer/Browse.tsx` is the one screen
that adds to a cart, so that is where the refusal is drawn.

**Quantity is editable on the cart line**, in both directions. It was
down-only for a while — quantity belongs on the product screen, where the
stock is — which left a buyer who wanted a third jar tapping back into the
catalogue to find the product again. The ceiling came to the cart instead:
`Cart` already loads the catalogue for the seller card, so the `+` stops at
`stock` (or 20 for made-to-order), and a product that has since left the
catalogue keeps what is in the basket and goes no higher. Zero still removes
the line.

**Nothing is ever cleared on her behalf.** Emptying a cart to make room for a
tap is how a woman loses the only record of what she had chosen; the refusal
points at the cart and lets her decide. `CartItem.sellerName` is copied in on
the way so the message can name the shop without waiting for the catalogue.

Grouping by seller stays. Checkout, `POST /orders` and every delivery rule are
built on it, one group is the honest shape of one seller, and a cart saved in
`localStorage` before this rule can still hold two - which is exactly why the
`groups.length > 1` branches in `CartCheckout.tsx` are still there.

Because the cart is locked, what else that seller sells is the most useful
thing on a product screen: **"More from this shop"** shows her three newest
other listings, and `/shop/seller/:sellerId` (`SellerShop`) is the whole
window - seller card, delivery terms, every LIVE product. `/catalog/products`
takes a `sellerId` filter so three products cost three products rather than
the whole catalogue on rural 4G.

### Where an order may go

`isMaharashtraPincode()` in `shared/src/seller.ts` is the only hard geographic gate: 40–44, minus 403 which is Goa. Outside it the order is refused at `POST /orders` before the seller sees it.

**Inside it, her `pincodes` list is a hint, not a gate.** That list is usually one pincode typed at registration, and refusing 413002 because she wrote 413004 threw away orders she would have taken. The order reaches her with `outsideArea: true`, her order screen says so, and Accept means "yes, I can get there". The checkout and `PincodeBar` warn rather than block, for the same reason.

### Nothing goes live until an admin publishes it

`initialListingStatus()` in `shared/src/seller.ts` is the rule, and it never
returns `LIVE`. `POST /products` and `DRAFT`/`REJECTED → LIVE` both land on
`PENDING`; `POST /admin/products/:id/moderate` is the only path to `LIVE`.

Listings published themselves for a while, on the argument that a queue puts a
desk between a seller and her first customer. It does — and that is outweighed
by what a listing carries: a photograph, a price, and on food an ingredients
claim that goes out under this market's name.

What did **not** change: she writes the listing, the slot is spent at
submission (so "save as draft" is not a way round either), a refusal carries
a reason she reads in her own app, and a live listing she edits stays live
rather than going back into the queue.

Her side says "send for checking" rather than "publish", on the button and
under it, because a woman refreshing the shop for a listing nobody has
approved yet has been told nothing by a screen that said "published".

### What the public may see

`publiclyVisible(product, seller)` in `catalog.routes.ts` is the single rule, used by **both** the catalogue list and the by-id lookup: `LIVE` product, `ACTIVE` seller, shop open. The two used to decide it separately, and a listing hidden from the list but readable by id is not hidden — it is findable by anyone who tries the id. Both halves matter: a LIVE product under a BLOCKED seller is still off the shelf, and a shop closed for the afternoon takes its whole window with it.

A hidden listing answers **404, not 403**, and the same 404 as an id that never existed — distinguishing them confirms that a draft she has not finished is there. `backend/tests/catalog-visibility.test.ts` holds the rule.

**A seller leaves the API unauthenticated only as `PublicSeller`**, built by `publicSeller()` in `backend/src/db/publicSeller.ts` and used by the catalogue list, `GET /catalog/products/:id` and `GET /sellers/:id`. It is an **allow-list**: name, photo, shop, SMB ID, village, delivery terms, pincodes, UPI ID/QR, and the rating derived from reviews. It replaced a deny-list (`publicView`) that stripped seven named fields, and the product route, which sent her whole record — phone, admin notices, block reason, readiness answers — to anyone with a product id. Her phone reaches a buyer only on their own order. `backend/tests/public-seller.test.ts` asserts the exact key set, so a new field on the card is a decision, not an accident.

### Editing a published product

`PATCH /products/:id` is the only way a seller changes a listing after it
exists, and **a live listing may be changed twice**. `MAX_EDITS`,
`EDIT_COUNTED_FIELDS`, `countsAsEdit()` and `editsLeft()` in
`shared/src/seller.ts` are the rule; the server enforces it, the edit screen
disables the fields that have run out, and both read the same functions.

A slot is one listing live at a time, so editing never wins a seller a second
listing — but without a limit one paid pack becomes a different product every
season: mango pickle in summer, lemon in winter, for ever. Two edits is the
line between fixing a listing and replacing it.

**Price and stock are outside the count, permanently.** They move with input
costs and with what is left on the shelf, and a seller who cannot correct a
price stops keeping either number honest — which costs the buyer more than a
rotated listing ever costs the platform. `EDIT_COUNTED_FIELDS` is the list:
name, picture, category, ingredients, veg/non-veg, material, unit, MRP,
made-to-order. `countsAsEdit()` compares **values**, because the edit form
posts the whole product on every save and a save that changed nothing must
cost nothing.

`editsAreLimited()` covers `LIVE` and `PAUSED` only. A `DRAFT` has not been
published, and a `REJECTED` listing is being *fixed* — charging an edit to
answer a take-down could leave her unable to repair the very thing she was
told to repair.

The edit limit holds because **she cannot delete a submitted listing** (see
*Slots and subscription*): there is no taking a listing down and putting a
fresh one up in its slot. A lifetime cap on listings per pack
(`publishAllowance`, counted on `seller.listingsPublished`) existed only to
close that route while deleting was allowed, and went with it —
`listingsPublished` is no longer written and old rows still carry it.

`editCount` is optional and reads as zero when absent, so nothing published
before the rule loses an edit to a change made when editing was free.

The screen is `frontend/src/screens/seller/EditProduct.tsx`, and it is
deliberately **not** the wizard: one question per screen is right when the job
is teaching a seller what a listing needs, and wrong when the seller came to
fix one number. `isFood` is immutable — it picks the category set and
which half of the fields apply (ingredients and veg/non-veg, or material), so
changing it would leave an approved listing carrying claims nobody reviewed.

### Scroll position

`ScrollMemory` in `App.tsx` with `lib/scrollMemory.ts`: forward navigation
starts at the top, **POP restores where she was**, keyed on the history entry
rather than the path because the same screen reached twice is two different
places she was reading. It was one `scrollTo(0, 0)` on every route change,
which is right going forward and exactly wrong coming back - she scrolled deep
into the catalogue, opened a product, pressed back, and the list had forgotten
her.

The restore retries for about a second, because every screen fetches its own
data: at the moment she returns the list is one spinner tall and the browser
clamps any scroll past that height.

That same clamp is why **`useAsync` reports `loading` only when it has nothing
to show**. Screens render a spinner *instead of* their content, so flipping
`loading` on a refetch replaced a tall list with a short spinner, the scroll
had nowhere to go, and from the outside the page "jumped to the top when I did
something at the bottom". A refetch now keeps the old data on screen until the
new data lands.

### The upload wizard's draft

A half-filled product is written to `localStorage` so that leaving the screen — most often to change the language from the profile screen — does not throw the work away. `frontend/src/screens/seller/productDraft.ts` owns it.

The key is `wb.draft.product.<sellerId>` and the seller id is **also stored inside the payload**. The first version used one shared key, and on a field coordinator's phone, where seller after seller registers on the same handset, the next woman opened "New product" and found a stranger's photo on step 1. Nothing is written until `hasStarted()` is true, so opening the wizard and walking away leaves no trace, and `readDraft` deletes the old unkeyed `wb.draft.product` on sight.

### Categories

`CATEGORIES` in `backend/src/db/seed.ts`, served by `GET /api/catalog/categories`. It is a constant in code, not a collection: a product stores only `categoryId`, and the label, icon and photograph are all derived from it.

**`other` is the escape hatch, and it carries no `food` flag.** `Category.food` absent means *both halves*, because both wizard screens filter the list by the food question the seller has already answered — flag it either way and half the sellers lose their escape hatch. Twelve categories cannot name everything a village makes, and a woman whose product is not listed otherwise has two choices: file it under something it is not, which poisons the filter for every buyer, or stop. It sorts last and has no entry in `categoryPhoto.ts`, because there is no honest picture of "everything else". `backend/tests/categories.test.ts` holds all of that.

Known gap: **the server never checks `categoryId` against this list** — `products.routes.ts` only requires it to be non-empty, so a junk id is stored and the product then falls out of every category filter. There is at least one such row in production (`pickles`, plural).

### Product photos

**Every upload is compressed on the phone, and nothing over 5MB is accepted.** Product photos, her bank's QR and the payment screenshot all go through `uploadImage()` in `frontend/src/lib/upload.ts`, so anything uploaded later gets the same treatment. Each image is re-encoded as JPEG, small ones included, with quality stepped down until it meets a target size. The numbers are in `lib/compress.ts`: product 1200px and ~350KB; payment screenshot 1800px and ~600KB, because the admin has to *read* the UTR and time on it. The canvas is painted white first, since a transparent PNG pixel encodes as black in JPEG. Cloudinary's signed upload transformation in `uploads.routes.ts` repeats the same size caps, as a backstop for a phone that could not compress. `frontend/tests/compress.test.ts` holds it.

`PhotoPicker` takes **one photo, from the gallery, and nothing else**. The camera button and the emoji fallback grid are both gone, so a photo is now required unless Cloudinary is off — the picker reports that upward through `onUnavailable` and the step stops being a wall the seller cannot pass. Once a photo is in, "choose from gallery" is disabled rather than silently replacing it; the ✕ on the thumbnail is the way to change it. The file input resets its own `value`, or removing a photo and picking the same file again fires no `change` event at all.

A listing that still has no picture — an old one, or Cloudinary off — falls back to a photograph of its **category**, never of a product: `frontend/src/lib/categoryPhoto.ts`, the same bundled files the landing page already ships, so it costs no new bytes. A generic jar of pickle above a seller's name is honest about being a category picture; a specific-looking photo of someone else's pickle is not. Categories with no honest match (beauty, farm produce, jewellery) are absent on purpose and keep the emoji — a wrong photo is worse than none.

### Feedback

`shared/src/review.ts` is the rule, `backend/src/db/reviews.ts` applies it, and `backend/tests/reviews.test.ts` holds it. A village seller has nothing a stranger can check except what her last buyers said, so every rule here is about keeping that worth reading.

- **Only the buyer on a `DELIVERED` order**, through `POST /orders/:id/review`. No order, no review — that is what stops a rival's one-stars and a seller's own five-stars.
- **One order, one voice.** Writing again replaces the review; it never adds a second. Allowed for `REVIEW_WINDOW_DAYS` (30) after delivery, so a quarrel months later cannot reach her rating.
- **Stars required, words optional** (max 500). A tap is a complete review. Every row of stars prints its number and a word (`rev.word.N`) — never stars alone.
- **First name only in public** (`publicName`, copied at write time). Her card already prints her village; a full name beside a village is an address. `toPublicReview` strips `customerId` and every moderation field.
- **The rating is derived, never stored.** `Seller.rating`/`ratingCount` are legacy; the catalogue overwrites them from `reviews` on every answer. A stored average goes stale the moment an admin hides a review.
- **Hide is the only admin action** (`POST /admin/reviews/:id/hide`, reason required and kept). Editing a buyer's words would make every review something the platform might have written. A hidden review leaves the public list and the average; editing it does not put it back up; the buyer sees that it was hidden, the seller stops seeing it.
- **Where it shows:** the buyer's order screen (asks, straight under the timeline) and a "leave a review" pill on their order list · the product page (three, ones mentioning that product first) and the shop page (summary + all) · her home card, `/seller/reviews` and her order screen · the admin **Reviews** screen (low-ratings and hidden filters) and each seller's page. Public reviews are gated like her window: a blocked seller's reviews 404 with her shop, a merely closed shop keeps them.
- `reviews` is a Firestore collection like the others and is **never seeded** — invented praise in front of real customers is the one thing this exists to rule out. `purge:demo` removes reviews on the orders it removes.

### The updates list

`frontend/src/lib/notifications.ts` is **derived, never stored**. Every line comes from `OrderEvent`s already on the order, or from `seller.notices` written by the admin handler that made the change — both already fetched. A `notifications` collection would be a second copy of facts we hold, wrong the first time somebody forgot to write a row. This is not push; the app has to be open.

- **One row per ORDER, not per event.** An order that is accepted, packed, sent out and delivered is one row that changes, named after what is in it (`itemSummary`), wearing its state as a `Pill` drawn from `STATUS_STYLE` — the same colour and icon its order screen uses. Four rows repeating the same total, one per verb, is a history read back rather than an answer to "where is my order".
- **The tag is the order's own `status`, not the last event the other side caused.** On the seller's side those are rarely the same thing — a customer only ever causes `PLACED` and `CANCELLED` — so a tag drawn from the buyer's last move said "new order" on every row for ever, including ones she had packed and delivered herself.
- Timed by the **latest** other-side event, which is what the bell's count compares against, so an order that moves again after she looked counts once rather than once per step. There is no per-row "new" mark: the tag already says where the order is, and a badge beside it is two things competing to be the thing she reads.
- **The other side's actions only** (`e.by !== mine`). A seller does not need telling she accepted an order two seconds ago.
- An admin decision has no order and no product, so it carries no `title` and prints its own sentence instead. `noticeLabelKey` still writes those sentences per side — "Order placed" is a fact about a row, "You have a new order" is a thing to go and do.

### Slots and subscription

`shared/src/seller.ts`. ₹50 = one pack = 5 product slots, no payment gateway — the seller pays the admin's UPI and admin approves by hand. `SLOT_CONSUMING` deliberately excludes `DRAFT`, so a seller can experiment before paying. Validation functions here run on **both** sides: the client for a fast friendly message, the server because the client can lie.

**One product, one slot — and only an admin gives one back.** `SLOT_CONSUMING` is `PENDING`, `LIVE`, `PAUSED`. A seller cannot delete a submitted listing: My Products has no Remove button on one, and `DELETE /products/:id` answers 403 unless `sellerMayDelete()` — a `DRAFT`, which holds no slot and nobody else has seen. Deleting used to free the slot, which made a pack of five a rotating shop of as many products as she liked. The slot comes back when an admin **rejects** a listing or **takes a live one down** (both land on `REJECTED`, which is not in the list), at that moment rather than when the row is swept 48 hours later — five slots, three sent in, the third refused, leaves three free. Her rejected notice says the slot is free again. A woman stuck with a listing she regrets asks an admin to take it down. `backend/tests/slots.test.ts` holds this; `revoke-slots` counts in-use slots by the same rule.

**The ₹50 lasts six months.** `shared/src/subscription.ts` is the rule, `backend/src/db/subscription.ts` applies approvals, `backend/tests/subscription.test.ts` holds both.

- **Only one date is stored: `Seller.subscriptionEndsAt`.** Expiry writes nothing — no product flipped to `PAUSED`, her `isOpen` switch untouched, no slot released. Public routes ask `canSellNow()` (`ACTIVE` and not expired): `publiclyVisible`, serviceability, `GET /sellers/:id`, `POST /orders`, and submitting a listing. So renewal is the date moving, and "everything exactly as before" — same packs, same products, same slots — is true by construction. Orders already in progress carry on: she can still deliver, cancel and refund.
- **Six calendar months from the admin's approval**, counted in IST, clamped at month end (`addMonths`). One date for the whole shop however many packs she has; a **flat ₹50 `RENEWAL`** renews all of them. A `PACK` bought mid-term adds slots and leaves the date alone. A renewal paid in the reminder week adds six months to the *current end*, so no paid days are lost. Any payment approved for an already-paused shop reopens it from the approval.
- **What she may pay for is `payableKinds()`**, sent to her screen as `payable` and enforced on submit: a pack when her slots are full, a renewal from `RENEW_REMINDER_DAYS` (7) before the end, and *only* a renewal once paused. `SubscriptionPayment.kind` records which; a request with no `kind` (an older APK) means the most urgent open one.
- **Every screen is told the state by the API** (`subscriptionView`, on `/sellers/me`, `/products/mine`, `/sellers/me/subscription`, `/admin/sellers[/:id]`) — the server's clock, never the phone's.
- **The reminder is derived, like the rest of her updates list:** `subscriptionFeed()` turns the view into one row (the reminder week, then "paused — renew"); an approved renewal writes a `SUBSCRIPTION_RENEWED` notice carrying the new date. Her home and products screens show `SubscriptionNotice`; a paused shop's live listings read "paused" on her list while their stored status stays `LIVE`.
- **Submitting a payment no longer sets `PAYMENT_SUBMITTED` on an `ACTIVE` seller.** It used to, which hid a paying seller's entire shop from the catalogue while her second pack waited in the queue. The waiting screen settles on her latest payment's status for the same reason.
- **Admin:** a subscription pill (with the date) on every selling seller in the register and on her page, a filter for ending-this-week and expired, the kind and resulting end date on each payment, and `subscriptionsExpiring` / `subscriptionsExpired` on the dashboard. `activeSellers` counts only shops a buyer can reach today. Granted slots start a term for a seller who has none, but never extend one — time is paid.
- **Existing sellers** were given a term once at boot by `backfillSubscriptionTerms`: six months from their last approved payment (or from the deploy, for granted packs), and never fewer than seven days, so no shop closes the morning after the deploy without warning.

**Deleting a draft deletes the document.** `DELETE /products/:id` splices the row and destroys its Cloudinary image (best effort, not awaited — the record is already gone and the seller is waiting on a phone). It used to stamp `ARCHIVED` and keep the row, which nothing ever read again: forty product documents of which eight were visible is what that looks like from the Firebase console. `purgeArchived()` in `db/moderation.ts` clears the tombstones already written, at boot and on `GET /products/mine`, the same way expired rejections are swept.

This is safe because **an order copies what it needs**: `OrderItem` carries the name, emoji, quantity and price from checkout, and nothing dereferences `productId` to draw an order. `backend/tests/product-delete.test.ts` holds that contract — normalising those fields away would quietly empty a year of order history the day listings become deletable again, by her or by an admin.

**Where the ₹50 goes is `ADMIN_PAYMENT_ACCOUNT` in `config.ts`**, env-readable
(`ADMIN_UPI_ID`, `ADMIN_UPI_NAME`, `ADMIN_BANK_NAME`), defaulting to the
college's own account. It used to sit in `db/seed.ts` beside three invented
sellers — the last place a real payee belongs. It is the one string in the app
that moves real money and nothing downstream can catch it being wrong: the QR
is generated FROM it, so a typo makes a perfectly scannable code that pays a
stranger and leaves the seller holding a valid UTR for a payment the programme
never saw. `backend/tests/payment-account.test.ts` asserts it is payable and
is not the old placeholder. No account number or IFSC — she pays by UPI, and a
wrong A/C under a QR is worse than none; the payee NAME is stored exactly as
printed on the poster so she can check it against what her UPI app shows.

Both payment screens (this one and the buyer's order screen) offer a QR, a **Save QR to phone** button, three written steps, the UPI ID with a copy button, and a UTR box, in that order. **A phone cannot scan its own screen**, so the two routes that work from one handset are: save the QR, then scan it from the gallery inside PhonePe or Google Pay; or copy the UPI ID and paste it there. `components/PayFromPhone.tsx` is both. Inside the APK's WebView a download does nothing, so it uses the share sheet there and says "take a screenshot" where even that is missing.

**There is no "Pay" button on a `upi://pay` link, and it must not come back while payees are personal UPI IDs.** It existed twice. The second time it opened PhonePe and Google Pay correctly, and they refused the payment with "declined for security reasons": UPI apps treat a payment that *another app* starts, to a *personal* UPI ID, as the shape of a scam, and every payee here — sellers and the college — is one. Nothing in the link fixes that; the same code scanned from the gallery pays fine (tested on real phones, 14 September 2026). A pay link works again only for business UPI IDs (PhonePe Business, Paytm for Business…), and then only for those accounts. `buildUpiLink()` sends no `tr` for the same reason: a merchant field on a personal ID is one more thing the risk check reads as a fake shop.

The tap after paying is Back, so `lib/useReturnFromApp.ts` is armed when she saves the QR or copies the ID, and on her return (hidden, then visible — never `focus` alone) the screen scrolls the UTR box into view and focuses it, once per arming.

**The ₹50 needs proof, not twelve digits.** Anybody can type a UTR, and approving one grants five slots. So a subscription payment carries three things an admin holds against each other:

- **A screenshot of her UPI app's success screen — required.** A `PhotoPicker` upload (`kind: 'payment'`) into its own signed Cloudinary folder. `screenshotProblem()` in `backend/src/db/payments.ts` accepts only a URL in *this* account's `…/payment/` folder, so a pasted link or a product photo cannot stand in for it. With Cloudinary off there is no way to attach one, so nothing is required, and `/sellers/me/subscription` says so as `screenshotRequired`.
- **When she paid** — `paidAt`, a `datetime-local` pre-filled with now. `paidAtProblem()` in `shared/src/payment.ts` refuses a time in the future (10 minutes' slack for phone clocks) or older than 7 days.
- **The UTR**, as before.

The admin queue shows the screenshot inline and opens it large beside the UTR, the stated time and the amount. **Approve stays disabled until three checks are ticked** — the UTR matches, the date and time match, the money is on the bank statement — and `POST /admin/payments/:id/approve` refuses any request whose `checks` lack one of `PAYMENT_CHECKS`, so the checklist is the rule and not decoration. The CLI takes `approve <id> --verified` and no longer offers `approve all`. Rejecting needs no checklist: refusing an unproven payment is always safe. `backend/tests/payment-proof.test.ts` holds all of it.

Because approval is by hand, **how long she has been waiting is the number that makes somebody act on it**, and the console owns it: `waited()` in `admin/src/lib/format.ts` computes it from `submittedAt` — minutes under the hour, hours to two days, then days — and `Payments.tsx` re-reads the clock every 30 minutes so a console left open on a desk stops showing the age it had at page load. `/admin/payments` deliberately sends no `waitingHours`: a number computed on the server is frozen at the moment of the response, and two sources for one figure is how an admin stops trusting either.

### Sorting the admin lists

Sellers, Products, Orders and Payments each have a **Sort by** menu. `admin/src/lib/sort.ts` holds one option table per list, because "highest" is a different number on each: what she has earned (delivered orders, added to `/admin/sellers` as `earned`), what a product costs, what an order or payment came to. Sorting is client-side, since every list already arrives whole. Names go through an `Intl.Collator` for Marathi and English, so Devanagari and Latin names each sort properly and case is ignored. The choice is remembered per list in `localStorage`, and newest-first is the default everywhere. `admin/tests/sort.test.ts` holds it.

### Other shared modules

- `womenbiz.ts` — the `SMB-<VILLAGE>-<NN>` ID. The serial is **per village**, not global, so the code tells a field coordinator where to go. Non-survey villages are transliterated from Devanagari.
- `readiness.ts` — Digital Readiness Index. Six factors self-reported at registration (the day-one baseline), four **measured by the platform** from what the seller actually does. Keep that split; it is what makes the before/after comparison meaningful.

### Config and graceful degradation

`backend/src/config.ts` reads everything from the environment, and every integration degrades rather than crashing. With an empty `.env`: JSON-file database, emoji instead of photos, and a 6-digit OTP shown on screen. The boot banner (`describeConfig()`) prints what is actually live — check it before debugging a "broken" integration.

`SESSION_SECRET` is the one exception: a fixed development fallback, but the server **refuses to boot in production without it**.

`ALLOW_BULK_DELETE` is the other flag that is not about degradation. Unlike `ALLOW_DEV_RESET` it is honoured in production too, because the one time the guard behind it mattered, it mattered on the live database. Leave it blank in every `.env`; set it inline on the single command that means it (`ALLOW_BULK_DELETE=true npm run purge:demo -- --commit`).

`CORS_ORIGIN` is comma-separated and parsed into a **list**, because two front ends on different origins call one API. Handing a comma-joined string straight to `cors()` matches neither and blocks both.

Photos upload **direct from the browser to Cloudinary** via a short-lived signature from `/api/uploads/signature`; the bytes never pass through the server and the API secret never leaves it.

## Conventions

- **Errors** are `{ error, messageMr, fields? }`. Every user-facing failure carries a Marathi message. `ApiError` in the frontend api client surfaces all three.
- **No screen calls `fetch` directly** — `frontend/src/lib/api.ts` and `admin/src/lib/api.ts` are the only seams to the server.
- **A panel that opens from a long list is a `<dialog>` opened with `showModal()`**, not a card appended to the page — the admin order detail used to render below the fold, and Open looked dead. Never `close()` it in an effect cleanup: StrictMode runs effect, cleanup, effect in development, the `close` event from that cleanup lands after the second `showModal()`, and `onClose` unmounts the dialog it just opened. Guard with `if (!dialog.open)` and let unmounting take it out of the top layer.
- **i18n**: Marathi is the default, English the fallback. Every string goes through `t('key')` from `I18nProvider` — **placeholders included**, which is where they kept being missed: an English UI with a Marathi example inside the input is the same bug as an untranslated label. `frontend/tests/i18n.test.ts` asserts dictionary parity, that each dictionary is in its own language, that no component hard-codes a Devanagari `placeholder=`, and that every `t()` key a component asks for exists — a missing one renders as its own name, on screen, in both languages.
- **Marathi follows one source**: `docs/MARATHI-STYLE.md`, which is the महाराष्ट्र शासन orthography (1972, rev. 2009) — the spelling these women were taught from बालभारती textbooks, and therefore the spelling they recognise. It settles postpositions (joined: `बाजारात`, never `बाजार मध्ये`), gender agreement (**ऑर्डर is neuter** — `ऑर्डर आले`, `माझे ऑर्डर` — भरणा masculine), Marathi word order over translated English (`… हे यावरून ठरते`, never `यावरून ठरते की …`), one word per thing, and `ॲ` as U+0972 rather than the ZWJ sequence. Two colloquial registers are deliberate and must not be "corrected": the landing CTAs (`मला विकायचं आहे`) and her own first-person buttons (`नंतर करते`). `frontend/tests/marathi.test.ts` and `admin/tests/marathi.test.ts` enforce the mechanically checkable half.
- **English is not a translation of Marathi.** The two dictionaries are independent pieces of writing that say the same thing differently, so a Marathi fix never edits the English line beside it — and the reverse. `lp.collegeMr` and `onb.chooseLangSub` are the only two English entries that are Devanagari on purpose.
- **Tests** are `node:test` + `node:assert/strict`, run through tsx. They read as prose explaining *why* a rule exists — match that when adding one.
- Comments here explain reasoning and trade-offs, not mechanics. Follow suit rather than narrating what the code already says.

## Design rules (constraints, not preferences)

From spec section 6, encoded in `frontend/src/styles/theme.css`:

- Status is colour **+ icon + word**, never colour alone. Every icon carries a word.
- 16px minimum text, 56px buttons, 44px touch targets.
- Four bottom tabs, one level deep. **No hamburger menu.**
- One question per screen in wizards, with progress dots. **Editing is not a wizard** — `EditProduct` puts every field on one page, because four taps between the seller and the price the seller came to change is not simplicity.
- Confirmation dialogs state the consequence, never a bare "Are you sure?"
- An empty state never repeats the action already standing in the bar below it. `MyProducts` had "New product" twice, one above the other, and the second read as a different thing rather than the same one.
- Latin digits (₹500, not ५००) — that is what is printed on money.
- **No web fonts.** Android ships Noto Sans Devanagari, so Marathi renders from system fonts at zero network cost.
- `theme.css` opens with a `:root` block marked **THEME SWAP POINT**; every colour, size and radius comes from those tokens, so retheming is a change to that block alone.

Voice input (`frontend/src/lib/useVoiceInput.ts`) wraps the Web Speech API and is an **addition** — the keyboard is never removed, and the mic simply does not render where speech is unsupported. Every `VoiceInput` owns its own mic and dictates into itself; there is no app-wide microphone.

Icons come from `react-icons` through `frontend/src/components/icons.tsx`, which is the only file that names a vendor icon. Emoji that survive are **data** — a seller's avatar, the veg/non-veg marks — not chrome. Category tiles and photo-less product cards are photographs now, not emoji (see *Product photos*).

The brand mark is a portrait of कै. शांताबाई (काकी) सिद्रामप्पा आलुरे, the woman the market is named for. `frontend/src/assets/logo.png` and `admin/src/assets/logo.png` are the same mark; both apps also carry it as a favicon from their `public/` folder. It already contains its own gold ring, so never give it a border or a background — either prints a second ring.

Both landing photo strips are one component, `PhotoRotator`, cross-fading every two seconds and holding on the first frame under `prefers-reduced-motion`.

## Deployment shape

One Cloud Run service (`shantai-api`, `asia-south1` — the API) and two Vercel projects from this same repo, distinguished only by Root Directory (`frontend` and `admin`), plus an Android APK that is not built from this repo at all (below). `VITE_API_URL` is read at **build** time, so changing it means redeploying.

**The app is the `prathamesh2` branch, and both Vercel projects must track it by name.** `main` holds only the initial commit and `prathamesh` — GitHub's default branch — is an older copy from 8 September with no `admin/` and a lockfile missing rollup's Linux binary, so every default Vercel reaches for builds the wrong code or fails outright. The two branches share nothing after the initial commit; do not merge `prathamesh` in.

The service needs two settings that are not Cloud Run's defaults, and neither is visible from the outside:

- **Maximum instances 1.** See *Persistence* above. The default is 100.
- **CPU always allocated** (`--no-cpu-throttling`). `save()` writes 400ms *after* the response has gone, and by default Cloud Run takes the CPU away the moment a response is sent — the write then waits for the next request, or for the `SIGTERM` flush when the instance is stopped.

How the container is built is not recorded in this repo: there is no Dockerfile and no `cloudbuild.yaml`. `docs/DEPLOY.md` says so, and is where that command belongs once somebody writes it down.

**Both apps route in the browser, so both need `vercel.json`** — one catch-all rewrite to `index.html`, already committed in each folder. Without it every URL but the home page 404s on reload, which is the first thing anyone does with a link they were sent.

**Neither Vite config sets `base`, and neither should.** The default absolute `/assets/…` is the only path right at every route depth: a relative one under the SPA rewrite makes `/seller/orders` fetch `/seller/assets/index-xxx.js`, receive `index.html`, and render a blank page. A `--mode capacitor` build with `base: './'` and `cap:*` scripts existed for a Capacitor APK that never shipped, and were removed.

**The Android APK is a React Native WebView, not a build of this repo.** It is an Expo project kept in its own folder (`appgold-main`, outside this repository; `app/index.tsx` is the whole app), and its one screen loads the production frontend, `https://shantai-mahila-bajar-app-frontend.vercel.app/`, over the network. `docs/DEPLOY.md` §6 has the detail; what matters when changing code here:

- **A Vercel deploy of `frontend/` is an APK update.** The APK is rebuilt only when the wrapper changes — or that URL does, because it is hard-coded there.
- **The APK needs the network to open at all.** Nothing is bundled into it, so "works offline in the APK" is never a reason for a choice in `frontend/`.
- **Its origin is that Vercel URL**, so the `CORS_ORIGIN` entry and MSG91's allowed domain for the web app already cover it.
- **It is Android System WebView, not Chrome.** A web API that works in the browser still has to be tried on a phone inside the APK — `navigator.share` is absent there. Voice input and the copy button were checked inside it on 15 September 2026. Its Android permissions, `RECORD_AUDIO` for the mic among them, are declared in the wrapper, not here.
- **The wrapper intercepts some links.** Any scheme other than `http(s)`, `data:`, `blob:` and `about:` (`tel:`, `upi:`, `whatsapp:`) is handed to Android to open another app, and any URL containing `.pdf`, `.csv`, `.xlsx`, `.doc`, `.txt`, `.zip`, `download=`, `export=` or `attachment=` goes to a native downloader instead of loading — so a page link that merely contains one of those never opens in the app.

Do not use Firebase Dynamic Links — it shut down on 25 August 2025. Deferred deep linking, when it is built, will use Android App Links plus the Play Install Referrer API; the wrapper has neither yet.

## Not built yet

Seller replies to reviews · chat · push notifications · disputes · returns and refunds · coupons · real camera capture · QR decoding · courses and certificates · the seller's own address book.