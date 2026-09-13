# Shantai Mahila Bazar — Technical README

> **शांताई महिला बाजार** — a digital entrepreneurship platform for rural women in
> Maharashtra. Sellers register, list homemade products (papad, pickles,
> handicrafts), accept orders, and earn directly. Customers browse a catalogue,
> place orders, and pay via UPI or COD. Administrators moderate listings, approve
> subscription payments, and monitor the programme's impact.

---

## 1. Project Overview

Shantai Mahila Bazar is a **monorepo** containing four npm workspaces that
together form three deployable applications and one shared type library:

| Workspace | Package name | Purpose |
|---|---|---|
| `backend/` | `@shantai/backend` | Express REST API — the single source of truth |
| `frontend/` | `@shantai/frontend` | React SPA — seller + customer app (also the Android APK via Capacitor) |
| `admin/` | `@shantai/admin` | React SPA — admin console (separate deployment) |
| `shared/` | `@shantai/shared` | TypeScript types and domain logic shared across all three |

All three applications talk to **one** backend API. The backend integrates with
**Firestore** (database), **Cloudinary** (image hosting), and **MSG91** (OTP /
SMS). Every integration degrades gracefully — the project runs with zero
external accounts using a local JSON file, emoji placeholders, and demo OTPs.

---

## 2. Complete Repository Structure

```
Shantai_mahila_bajar_app/
├── package.json              # Root workspace config (npm workspaces)
├── package-lock.json
├── firestore.rules           # Firestore security rules (deny-all for client SDKs)
├── .gitignore
│
├── shared/                   # @shantai/shared — domain types & logic
│   ├── package.json
│   └── src/
│       ├── index.ts          # Re-exports everything
│       ├── types.ts          # Seller, Product, Order, Customer, Session, etc.
│       ├── seller.ts         # Phone normalisation, slot calculations, plan config
│       ├── orderFlow.ts      # Order state machine transitions
│       ├── readiness.ts      # Digital Readiness Index scoring
│       ├── womenbiz.ts       # WomenBiz ID generation (SMB-VILLAGE-NNN)
│       ├── moderation.ts     # Rejection grace period (48h)
│       └── payment.ts        # Subscription plan & payment account config
│
├── backend/                  # @shantai/backend — Express API
│   ├── package.json
│   ├── tsconfig.json         # rootDir: ".." (compiles shared/ alongside)
│   ├── .env.example          # Template — all variable names, no values
│   ├── data/
│   │   └── db.json           # Local JSON database (gitignored, auto-created)
│   ├── scripts/
│   │   ├── admin.ts          # CLI admin management (legacy)
│   │   ├── admins.ts         # CLI: create/list/hash admin users
│   │   ├── backfill-customers.ts
│   │   └── purge-demo-data.ts
│   ├── src/
│   │   ├── index.ts          # Entry point — Express app, routes, housekeeping
│   │   ├── config.ts         # All env var reading, integration config
│   │   ├── db/
│   │   │   ├── store.ts      # Persistence layer (JSON file ↔ Firestore)
│   │   │   ├── firestore.ts  # Firestore driver — diff-based writes
│   │   │   ├── seed.ts       # Db type definition, demo data seeder
│   │   │   ├── customers.ts  # Customer CRUD
│   │   │   ├── analytics.ts  # Seller weekly growth chart
│   │   │   ├── ids.ts        # ID generation
│   │   │   ├── moderation.ts # Rejection expiry purging
│   │   │   ├── notices.ts    # Admin notices on seller records
│   │   │   └── payments.ts   # Post-rejection status logic
│   │   ├── auth/
│   │   │   ├── admins.ts     # Admin authentication (scrypt hashes)
│   │   │   ├── sessions.ts   # Session registry (create, find, revoke, prune)
│   │   │   ├── tokens.ts     # HMAC bearer tokens (session pointers)
│   │   │   ├── crypto.ts     # HMAC, scrypt, masking, timing-safe compare
│   │   │   ├── tickets.ts    # Single-use registration tickets
│   │   │   ├── rateLimit.ts  # In-memory sliding-window rate limiter
│   │   │   ├── events.ts     # Audit trail writer
│   │   │   └── types.ts      # SessionRecord, AdminUser, AuthEvent
│   │   ├── middleware/
│   │   │   └── auth.ts       # attachAuth, requireRole, callerIp
│   │   ├── routes/
│   │   │   ├── auth.routes.ts      # OTP send/verify, admin login, logout, sessions
│   │   │   ├── sellers.routes.ts   # Registration, profile, subscription
│   │   │   ├── products.routes.ts  # CRUD, slot enforcement, moderation submit
│   │   │   ├── catalog.routes.ts   # Public product/category browsing
│   │   │   ├── customers.routes.ts # Customer record & addresses
│   │   │   ├── orders.routes.ts    # Place, advance, pay, confirm
│   │   │   ├── uploads.routes.ts   # Cloudinary signed upload signatures
│   │   │   └── admin.routes.ts     # Dashboard stats, payment/product moderation
│   │   └── services/
│   │       ├── otp.service.ts      # Code generation, hashing, expiry, attempt cap
│   │       └── otp.providers.ts    # MSG91 widget, MSG91 sender, demo provider
│   └── tests/
│
├── frontend/                 # @shantai/frontend — seller + customer React app
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts        # base: './' (Capacitor), proxy /api → :4000
│   ├── index.html
│   ├── .env.example
│   ├── public/               # Favicons, app icons
│   └── src/
│       ├── main.tsx          # React DOM render
│       ├── App.tsx           # Router — seller, customer, and auth routes
│       ├── vite-env.d.ts     # VITE_API_URL, VITE_MSG91_* type declarations
│       ├── lib/              # API client, uploads, MSG91 widget, voice input
│       ├── store/            # AuthContext, CartContext, ToastContext, PincodeContext
│       ├── screens/          # All seller, customer, auth, landing screens
│       ├── components/       # Reusable UI components, layouts
│       ├── i18n/             # Marathi + English internationalisation
│       ├── styles/           # CSS
│       └── assets/
│
├── admin/                    # @shantai/admin — admin console React app
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts        # port 5174, proxy /api → :4000, no base: './'
│   ├── index.html            # noindex, nofollow
│   └── src/
│       ├── main.tsx
│       ├── App.tsx           # Router — sign-in gate, shell, all admin screens
│       ├── vite-env.d.ts     # VITE_API_URL only
│       ├── lib/              # API client (admin endpoints), formatters
│       ├── store/            # AuthContext (admin sessions), ToastContext
│       ├── screens/          # Home, Today, Payments, Products, Sellers, Orders, Impact
│       ├── components/       # Shell, navigation
│       ├── i18n/
│       └── styles/
│
└── docs/                     # Project documentation
    ├── DEPLOY.md             # Original deployment guide (Render + Vercel)
    ├── FEATURE-SPEC.md       # Full feature specification
    ├── MANUAL-TEST-PLAN.md   # Manual testing checklist
    └── MARATHI-STYLE.md      # Marathi language style guide
```

---

## 3. Application Architecture

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  Android APK            │     │  Admin Website           │
│  (Capacitor WebView)    │     │  (React SPA)             │
│  frontend/ built with   │     │  admin/ built with       │
│  VITE_API_URL set       │     │  VITE_API_URL set        │
└──────────┬──────────────┘     └──────────┬──────────────┘
           │                               │
           │  HTTPS                        │  HTTPS
           │                               │
           ▼                               ▼
┌──────────────────────────────────────────────────────────┐
│                   Express API (backend/)                  │
│                   Port 4000 (dev) / $PORT (prod)         │
│                   /api/*                                  │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  /api/auth/*     ← OTP, admin login, sessions            │
│  /api/sellers/*  ← Registration, profile, subscription   │
│  /api/products/* ← CRUD, slot enforcement                │
│  /api/catalog/*  ← Public browsing (no auth)             │
│  /api/customers/*← Customer record & addresses           │
│  /api/orders/*   ← Place, advance, pay                   │
│  /api/uploads/*  ← Cloudinary signed signatures          │
│  /api/admin/*    ← Dashboard, moderation (admin only)    │
│  /api/analytics/*← Seller growth charts                  │
│  /api/health     ← Health check                          │
│                                                          │
├──────────┬──────────┬──────────────────┬─────────────────┤
│          │          │                  │                  │
│          ▼          ▼                  ▼                  │
│    ┌──────────┐ ┌───────────┐   ┌──────────┐            │
│    │ Firestore│ │Cloudinary │   │  MSG91   │            │
│    │ or JSON  │ │  (images) │   │  (OTP)   │            │
│    └──────────┘ └───────────┘   └──────────┘            │
└──────────────────────────────────────────────────────────┘
```

**Key points:**
- Both front ends (seller/customer app + admin console) call the **same** backend API.
- The admin console authenticates via email + password (`/api/auth/admin/login`).
- The seller/customer app authenticates via phone + OTP (`/api/auth/otp/*`).
- The `shared/` workspace provides TypeScript types so all three applications stay in sync at compile time.

---

## 4. Frontend (Seller + Customer App)

| Aspect | Detail |
|---|---|
| **Framework** | React 18 with react-router-dom v6 |
| **Build tool** | Vite 5 |
| **Language** | TypeScript (strict) |
| **Entry point** | `frontend/src/main.tsx` |
| **Dev command** | `npm run dev` (from `frontend/`) or `npm run dev:web` (from root) |
| **Build command** | `npm run build` (from `frontend/`) — runs `tsc -b && vite build` |
| **Output directory** | `frontend/dist/` |
| **Dev server port** | 5173 (with `host: true` for LAN access) |
| **API proxy** | Dev server proxies `/api` → `http://localhost:4000` |
| **Production API** | Set via `VITE_API_URL` environment variable at **build time** |
| **Capacitor** | Yes — `base: './'` in Vite config for WebView filesystem loading |
| **APK build** | `npm run cap:sync` (builds + syncs to Android), `npm run cap:open` |

**No Capacitor config file** (`capacitor.config.ts`) is committed — the
`android/` directory is gitignored. The Capacitor scripts exist in
`frontend/package.json` and the APK is built by running `cap:sync` followed by
opening Android Studio.

**Environment variables** (build-time, inlined into the JS bundle):

| Variable | Purpose |
|---|---|
| `VITE_API_URL` | API base URL. Unset in dev (proxy). **Must be set for APK builds.** |
| `VITE_MSG91_WIDGET_ID` | MSG91 OTP widget ID (public — needed by the browser) |
| `VITE_MSG91_TOKEN_AUTH` | MSG91 widget token auth (public) |
| `VITE_MSG91_OTP_LENGTH` | OTP digit count, defaults to 6 |

---

## 5. Backend

| Aspect | Detail |
|---|---|
| **Framework** | Express 4 |
| **Language** | TypeScript (ES2022, NodeNext modules) |
| **Runtime** | Node.js (ESM, `"type": "module"`) |
| **Entry point** | `backend/src/index.ts` |
| **Dev command** | `npm run dev` (from `backend/`) — runs `tsx watch` with `.env` |
| **Build command** | `npm run build` — runs `tsc -p tsconfig.json` |
| **Start command** | `npm run start` — runs `node dist/backend/src/index.js` |
| **Output directory** | `backend/dist/` (compiled output, rootDir is `..` so includes shared) |
| **Default port** | 4000 (configurable via `PORT`) |
| **API base path** | `/api` |
| **Health check** | `GET /api/health` → `{ ok: true, service, time }` |

### Important Routes

| Route prefix | Auth | Purpose |
|---|---|---|
| `/api/auth/otp/*` | Public | Send/verify OTP for sellers and customers |
| `/api/auth/admin/login` | Public | Admin email + password login |
| `/api/auth/logout` | Authenticated | End a session server-side |
| `/api/auth/sessions` | Authenticated | List/delete own sessions |
| `/api/sellers/*` | Seller | Registration, profile, subscription, buyers |
| `/api/products/*` | Seller | CRUD (with slot enforcement) |
| `/api/catalog/*` | Public | Browse products, categories, serviceability |
| `/api/customers/*` | Customer | Customer record, addresses |
| `/api/orders/*` | Seller / Customer | Place, advance, pay, confirm, track |
| `/api/uploads/*` | Seller / Admin | Cloudinary upload signatures |
| `/api/admin/*` | Admin only | Stats, payments, products, sellers, orders, impact |
| `/api/analytics/*` | Seller | Growth charts |
| `/api/dev/reset` | Dev only | Wipe database (requires `ALLOW_DEV_RESET=true`) |

### Authentication

- **Sellers & Customers**: Phone + OTP → session record → HMAC-signed bearer token.
- **Admins**: Email + scrypt-hashed password → session record → bearer token.
- **Tokens**: `base64url({sid, role, iat}).HMAC(payload)` — carry only a session pointer, never identity.
- **Session idle timeouts**: Admin 8h, Seller/Customer 7 days. Absolute ceiling: Admin 7 days, Seller/Customer 90 days.
- **Token sliding**: Past halfway through the idle window, a refreshed token is returned via `X-Session-Token` header.

### Authorization

- `requireRole(...roles)` middleware — checks `req.auth.role`.
- 401 for unauthenticated requests; 403 for wrong role.
- Admin routes are all behind `requireRole('admin')`.

### CORS

- `CORS_ORIGIN` is **comma-separated** — two front ends, one API.
- Unset = any origin (development). Must be set in production.
- `X-Session-Token` is in `exposedHeaders` so the browser can read it.

### Security Headers

- `helmet` with HSTS, no CSP (API-only, no HTML), `cross-origin` resource policy.
- `trust proxy: 1` for correct `req.ip` behind a load balancer.
- Global per-IP rate limiting (429 with `Retry-After`).
- Auth body size limited to 8KB; general limit is 2MB.

---

## 6. Shared Code (`shared/`)

The `shared/` workspace is a **TypeScript-only** package with no dependencies and no build step.
Both `frontend/` and `backend/` (and `admin/`) alias `@shared/*` → `../shared/src/*`
in their respective `tsconfig.json` and `vite.config.ts` files.

**Contents:**

| File | Purpose |
|---|---|
| `types.ts` | All domain types: `Seller`, `Product`, `Order`, `Customer`, `Session`, `SubscriptionPayment`, `AdminStats`, etc. |
| `seller.ts` | Phone normalisation (`normalizePhone`, `samePhone`, `isValidPhone`), slot calculations (`slotInfo`), plan config (`PLAN`) |
| `orderFlow.ts` | Order state machine — which status transitions are legal, by which role |
| `readiness.ts` | Digital Readiness Index: scoring formula and band labels |
| `womenbiz.ts` | WomenBiz ID generation algorithm (`SMB-VILLAGE-NNN`) |
| `moderation.ts` | Rejection grace period constant (`REJECT_GRACE_HOURS = 48`) |
| `payment.ts` | Subscription plan pricing, admin payment account config |

**Docker build must include `shared/`**. The backend's `tsconfig.json` has
`rootDir: ".."` and `include: ["src/**/*.ts", "../shared/src/**/*.ts"]`, so the
compiled output in `backend/dist/` contains both `backend/src/` and `shared/src/`
paths. Without `shared/`, the build fails.

---

## 7. Admin Application

The admin console is a **separate React SPA** in the `admin/` directory.

| Aspect | Detail |
|---|---|
| **Source** | `admin/src/` |
| **Framework** | React 18 + react-router-dom v6 |
| **Build tool** | Vite 5 |
| **Dev command** | `npm run dev` (from `admin/`) or `npm run dev:admin` (from root) |
| **Dev server port** | 5174 (intentionally different from frontend's 5173) |
| **Build output** | `admin/dist/` |
| **Production API** | `VITE_API_URL` (build-time env var) |
| **Authentication** | Email + password → `POST /api/auth/admin/login` |
| **Deployment target** | Separate static hosting (e.g., Vercel) |

**Screens:**
- **Home**: Dashboard with key stats
- **Today**: Daily operations view
- **Payments**: Approve/reject subscription payments (₹50 packs)
- **Products**: Moderate pending product listings
- **Sellers**: Seller register, detail view, block/unblock, grant/revoke slots
- **Orders**: Order monitoring with filters
- **Impact**: Programme-wide impact report (women, earnings, villages)

The admin console imports `@shared/*` types directly, so it stays in sync with
the backend at compile time. It calls the same API as the seller app, using the
`/api/admin/*` endpoints.

**It is NOT embedded in the frontend app.** The frontend's `App.tsx` explicitly
states: "there is no /admin route here, and that is deliberate."

---

## 8. Database

The backend uses a **dual-driver persistence layer** chosen at boot based on
whether Firebase credentials are present:

### JSON File (Default / Development)

- **File**: `backend/data/db.json` (gitignored, auto-created)
- **Behaviour**: Entire database held in memory, written synchronously to disk on every mutation.
- **Collections**: `sellers`, `products`, `orders`, `payments`, `customers`, `sessions`, `admins`, `authEvents`
- **Safe for development**: Yes — single process, immediate writes.

### Firestore (Production)

- **Driver**: `backend/src/db/firestore.ts` using `firebase-admin` SDK
- **Behaviour**: Entire database loaded into memory at boot. Writes are **diff-based** and coalesced over 400ms — only changed documents are sent, in batches of 450.
- **Collections**: Same as above (excluding a legacy `addresses` collection)
- **Graceful fallback**: If Firestore connection fails at boot, the backend falls back to `db.json` automatically.

### ⚠ Critical Limitation: Single Instance Only

The in-memory snapshot architecture is **correct for exactly one server process**.
If two instances run simultaneously (e.g., Cloud Run autoscaling), each holds
its own copy of the database and they will **overwrite each other's writes**.
Orders will vanish, sellers will reappear after deletion, and nothing in the
logs will explain it.

**Cloud Run must be deployed with `--max-instances=1`.**

To support multiple instances, the route handlers would need to be rewritten to
use async per-document Firestore reads. This is a significant refactor.

### Bulk Delete Protection

After an incident on 10 September 2026 where all sellers and products were
accidentally deleted, a "dead-man's switch" was added: no single persist may
delete more than half of a collection with more than 5 documents. This can be
overridden with `ALLOW_BULK_DELETE=true` for intentional operations.

---

## 9. Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Secret | Used for |
|---|---|---|---|
| `PORT` | No (default: 4000) | No | Server listen port. Cloud Run injects this. |
| `NODE_ENV` | Yes (production) | No | `production` enables strict checks, disables demo OTP. |
| `SESSION_SECRET` | **Prod: Yes** | **Yes** | HMAC key for session tokens, tickets, phone hashing. Server refuses to boot in production without it. Changing it signs everyone out. |
| `FIREBASE_PROJECT_ID` | No | No | Firestore project ID (used with separate fields or ADC). |
| `FIREBASE_CLIENT_EMAIL` | No | No | Service account email (used with separate fields). |
| `FIREBASE_PRIVATE_KEY` | No | **Yes** | Service account private key (newlines as `\n`). |
| `FIREBASE_SERVICE_ACCOUNT` | No | **Yes** | Entire service account JSON (or base64 of it) — alternative to the three fields above. |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | No | **Yes** | Alias for `FIREBASE_SERVICE_ACCOUNT`. |
| `FIREBASE_USE_ADC` | No | No | `true` to use `gcloud auth application-default login` — **development only**. |
| `FIRESTORE_DATABASE_ID` | No | No | Named (non-default) Firestore database. |
| `CLOUDINARY_URL` | No | **Yes** | `cloudinary://key:secret@cloud` — from the Cloudinary dashboard. |
| `CLOUDINARY_CLOUD_NAME` | No | No | Alternative to URL — cloud name. |
| `CLOUDINARY_API_KEY` | No | No | Alternative to URL — API key. |
| `CLOUDINARY_API_SECRET` | No | **Yes** | Alternative to URL — API secret. |
| `CLOUDINARY_FOLDER` | No (default: `shanta-mahila-bazar`) | No | Upload folder scope. |
| `MSG91_AUTH_KEY` | **Prod: Yes** | **Yes** | MSG91 account auth key. **Must never be in a VITE_* variable.** |
| `MSG91_WIDGET_ID` | Prod: Yes (with auth key) | No | OTP widget ID (widget mode — no DLT needed). |
| `MSG91_TEMPLATE_ID` | No | No | DLT-approved template ID (plain sender mode — alternative to widget). |
| `MSG91_SENDER` | No (default: `WMNBIZ`) | No | Sender ID for plain sender mode. |
| `ADMIN_BOOTSTRAP_EMAIL` | First boot only | No | Email for the first admin (only used when no admins exist). |
| `ADMIN_BOOTSTRAP_NAME` | No | No | Display name for the bootstrap admin. |
| `ADMIN_BOOTSTRAP_PASSWORD_HASH` | First boot only | **Yes** | Scrypt hash (from `npm run admin:users hash`). **Never a plaintext password.** |
| `CORS_ORIGIN` | **Prod: Yes** | No | Comma-separated allowed origins. Blank = any origin. |
| `SEED_DEMO_DATA` | No | No | `true` to load demo data into an empty database. **Never set in production.** |
| `ALLOW_DEV_RESET` | No | No | `true` to enable `POST /api/dev/reset`. Requires non-production `NODE_ENV`. |
| `ALLOW_BULK_DELETE` | No | No | `true` to override the bulk-delete guard. **Never set in .env — pass on the command line.** |

### Frontend (`frontend/.env`)

| Variable | Required | Secret | Used for |
|---|---|---|---|
| `VITE_API_URL` | APK build: Yes | No | API base URL. Unset in dev (Vite proxies). |
| `VITE_MSG91_WIDGET_ID` | Prod: Yes | No | MSG91 widget ID (public — inlined into bundle). |
| `VITE_MSG91_TOKEN_AUTH` | Prod: Yes | No | MSG91 widget token auth (public). |
| `VITE_MSG91_OTP_LENGTH` | No (default: 6) | No | Digit count for OTP entry. |

### Admin (`admin/` — no `.env` file committed)

| Variable | Required | Secret | Used for |
|---|---|---|---|
| `VITE_API_URL` | Prod: Yes | No | API base URL. Unset in dev (Vite proxies). |

---

## 10. Local Development

### Prerequisites

- **Node.js** ≥ 18.19 (for `--env-file-if-exists` flag support)
- **npm** ≥ 7 (for workspaces support)

### Quick Start

```bash
# 1. Clone the repository
git clone <repo-url>
cd Shantai_mahila_bajar_app

# 2. Install all dependencies (root + all workspaces)
npm install

# 3. Set up backend environment
cp backend/.env.example backend/.env
# Edit backend/.env if needed — the app runs with all defaults (JSON db, demo OTP, emoji images)

# 4. Start backend + frontend together
npm run dev          # Starts API on :4000 and frontend on :5173

# OR start them individually:
npm run dev:api      # Backend only (port 4000)
npm run dev:web      # Frontend only (port 5173)
npm run dev:admin    # Admin console only (port 5174)

# OR start all three:
npm run dev:all      # API :4000 + frontend :5173 + admin :5174
```

### How the Frontend Reaches the Backend

In development, Vite proxies `/api` to `http://localhost:4000`, configured in
both `frontend/vite.config.ts` and `admin/vite.config.ts`. No `VITE_API_URL`
is needed locally.

### Testing from Another Device on LAN

Both Vite dev servers run with `host: true`, so they bind to `0.0.0.0`.
From another device on the same network, access `http://<your-ip>:5173`.
The `/api` proxy still works because Vite forwards those requests to `:4000`.

### Admin User Setup (Local)

```bash
# Create an admin user
npm run admin:users -- create admin@example.com "Admin Name"

# Or generate a password hash for bootstrap
npm run admin:users -- hash
```

### Demo Mode

With no MSG91 credentials, the backend runs in **demo OTP mode**: it generates
a real 6-digit code, displays it in the server console and returns it in the
API response. The frontend shows the code on the OTP screen. This is secure
enough for local development but **refused in production**.

---

## 11. Docker Deployment

> **No Dockerfile exists in the repository.** This section describes how to build one.

### What Goes in the Docker Image

The Docker build context must be the **repository root**, because the backend's
TypeScript compilation includes `../shared/src/`:

```
COPY shared/ shared/
COPY backend/ backend/
COPY package.json package-lock.json ./
```

### What Should NOT Be Copied

- `frontend/`, `admin/` — they are separately deployed static sites
- `node_modules/` — install inside the container
- `.env` files — pass at runtime
- `backend/data/db.json` — ephemeral / Firestore in production
- `.git/`, `docs/`, `android/`

### Recommended `.dockerignore`

```
.git
node_modules
frontend
admin
android
docs
*.log
.DS_Store
backend/.env
backend/.env.*
backend/data/db.json
backend/data/recovery
```

### Example Dockerfile

```dockerfile
FROM node:20-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN npm ci --workspace=@shantai/shared --workspace=@shantai/backend --ignore-scripts
COPY shared/ shared/
COPY backend/ backend/
RUN npm --workspace=@shantai/backend run build

FROM node:20-slim
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY backend/package.json backend/
RUN npm ci --workspace=@shantai/shared --workspace=@shantai/backend --omit=dev --ignore-scripts
COPY --from=build /app/backend/dist backend/dist
ENV NODE_ENV=production
EXPOSE 4000
CMD ["npm", "--workspace=@shantai/backend", "run", "start"]
```

### Docker Build & Run

```bash
# Build from repository root
docker build -t shantai-api .

# Run locally
docker run -p 4000:4000 \
  -e NODE_ENV=production \
  -e SESSION_SECRET=<your-secret> \
  -e FIREBASE_SERVICE_ACCOUNT='<json>' \
  -e CLOUDINARY_URL=cloudinary://... \
  -e MSG91_AUTH_KEY=<key> \
  -e MSG91_WIDGET_ID=<id> \
  -e CORS_ORIGIN=https://your-frontend.com,https://your-admin.com \
  shantai-api
```

---

## 12. Docker Hub

```bash
# Build and tag
docker build -t DOCKER_USERNAME/IMAGE_NAME:IMAGE_TAG .

# Push
docker push DOCKER_USERNAME/IMAGE_NAME:IMAGE_TAG

# Pull (on deployment target)
docker pull DOCKER_USERNAME/IMAGE_NAME:IMAGE_TAG

# Run
docker run -p 4000:4000 -e ... DOCKER_USERNAME/IMAGE_NAME:IMAGE_TAG
```

Replace `DOCKER_USERNAME`, `IMAGE_NAME`, and `IMAGE_TAG` with actual values.
Never include credentials in the image — pass them as runtime environment
variables.

---

## 13. Google Cloud Run Deployment

### Build Context

The **repository root** is the build context. The Docker image must contain
`shared/` and `backend/` (see §11).

### Deployment Command

```bash
# Using pre-built image from Docker Hub or Artifact Registry:
gcloud run deploy shantai-api \
  --image=DOCKER_USERNAME/IMAGE_NAME:IMAGE_TAG \
  --region=asia-south1 \
  --port=4000 \
  --allow-unauthenticated \
  --ingress=all \
  --min-instances=0 \
  --max-instances=1 \
  --memory=512Mi \
  --cpu=1 \
  --set-env-vars="NODE_ENV=production" \
  --set-env-vars="CORS_ORIGIN=https://your-frontend.com,https://your-admin.com" \
  --set-env-vars="MSG91_WIDGET_ID=<id>" \
  --set-env-vars="CLOUDINARY_FOLDER=shanta-mahila-bazar" \
  --set-secrets="SESSION_SECRET=SESSION_SECRET:latest" \
  --set-secrets="FIREBASE_SERVICE_ACCOUNT=FIREBASE_SERVICE_ACCOUNT:latest" \
  --set-secrets="CLOUDINARY_URL=CLOUDINARY_URL:latest" \
  --set-secrets="MSG91_AUTH_KEY=MSG91_AUTH_KEY:latest"
```

### ⚠ `--max-instances=1` Is Mandatory

The in-memory database snapshot means **exactly one instance**. Cloud Run's
default autoscaling would create multiple instances that overwrite each other's
data. See §8 for the full explanation.

### Configuration Details

| Setting | Value | Reason |
|---|---|---|
| **Region** | `asia-south1` (Mumbai) | Closest to target users in Maharashtra |
| **Port** | 4000 (or use `PORT` env var that Cloud Run injects) | Cloud Run sets `PORT` automatically |
| **Authentication** | Allow unauthenticated | The API handles its own auth |
| **Ingress** | All | Public API |
| **Min instances** | 0 | Cost savings (cold start is acceptable) |
| **Max instances** | **1** | **CRITICAL — see database limitation** |
| **Billing** | Request-based | Standard Cloud Run billing |

### Secret Manager

Store these in Google Cloud Secret Manager and mount via `--set-secrets`:
- `SESSION_SECRET`
- `FIREBASE_SERVICE_ACCOUNT` (entire JSON)
- `CLOUDINARY_URL`
- `MSG91_AUTH_KEY`
- `ADMIN_BOOTSTRAP_PASSWORD_HASH` (first boot only)

### Health / Startup

Cloud Run can use `GET /api/health` for both startup and liveness probes.
The backend loads the entire database before starting to listen, so a response
from `/api/health` means data is loaded and the server is ready.

### Custom Domain

After deployment, Cloud Run provides a URL like `https://shantai-api-xxxxx-uc.a.run.app`.
Map a custom domain (e.g., `api.shantabazar.in`) through Cloud Run's domain
mapping or a load balancer.

---

## 14. Firestore Production Migration

Firestore support is **fully implemented** in the codebase. Switching from
JSON to Firestore requires only setting Firebase credentials:

### How to Enable

Set **any one** of these credential configurations in environment variables:

1. **Full service account JSON** (recommended for Cloud Run):
   ```
   FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"...","private_key":"...","client_email":"..."}
   ```
   Or base64-encoded: `FIREBASE_SERVICE_ACCOUNT=<base64>`

2. **Three separate fields**:
   ```
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_CLIENT_EMAIL=xxx@your-project.iam.gserviceaccount.com
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```

3. **Application Default Credentials** (development only):
   ```
   FIREBASE_USE_ADC=true
   FIREBASE_PROJECT_ID=your-project-id
   ```
   Requires `gcloud auth application-default login` beforehand.

### What Changes

| Aspect | JSON mode | Firestore mode |
|---|---|---|
| Storage | `backend/data/db.json` | Firestore collections |
| Boot | Read file | `loadAll()` — read all collections into memory |
| Writes | Synchronous file write | Diff-based batched writes (coalesced 400ms) |
| Named database | N/A | Set `FIRESTORE_DATABASE_ID` |
| Fallback | N/A | If Firestore connection fails, falls back to JSON |

### Firestore Security Rules

Deploy the deny-all rules (all access goes through the Admin SDK, which bypasses rules):

```bash
firebase deploy --only firestore:rules
```

### Collections Created

`sellers`, `products`, `orders`, `payments`, `customers`, `sessions`, `admins`, `authEvents`

---

## 15. Cloudinary

### Where It Is Used

- **`backend/src/routes/uploads.routes.ts`** — generates **signed upload signatures**.
- **`backend/src/config.ts`** — reads Cloudinary credentials.
- **`frontend/src/lib/upload.ts`** — client-side direct upload to Cloudinary.

### Upload Flow (Signed Direct Upload)

```
1. Client (authenticated) → POST /api/uploads/signature
2. Server generates a time-limited, folder-scoped signature using API secret
3. Client receives: cloudName, apiKey, signature, folder, timestamp, uploadUrl
4. Client → POST directly to Cloudinary (image bytes never touch the server)
5. Cloudinary returns secure_url
6. Client sends secure_url with the product/payment data to the API
```

### Advantages

- Image bytes never transit through the API server (saves bandwidth, faster uploads on rural connections).
- The API secret stays server-side.
- Uploads are scoped to a specific folder (`shanta-mahila-bazar/product` or `shanta-mahila-bazar/payment`).
- Images are automatically resized to 1200px max edge with auto quality.

### Image Deletion

`POST /api/uploads/delete` — sellers and admins can delete images. The server
validates that the `publicId` starts with the configured folder prefix so a
caller cannot delete arbitrary assets.

### Without Cloudinary

If no Cloudinary credentials are set, the upload endpoint returns
`503 Service Unavailable`. Products fall back to emoji-only mode — the `emoji`
field on each product is always set and shown when no `imageUrl` exists.

### Required Variables

- `CLOUDINARY_URL` (or `CLOUDINARY_CLOUD_NAME` + `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET`)
- `CLOUDINARY_FOLDER` (optional, defaults to `shanta-mahila-bazar`)

---

## 16. MSG91 (OTP)

### Two Modes

**1. Widget Mode** (recommended — no DLT registration needed):
- The browser runs MSG91's hosted OTP widget.
- Widget sends the SMS and collects the code on its own.
- Browser receives a JWT access token.
- Server exchanges the token with MSG91's `verifyAccessToken` API using the auth key.
- Server checks that the phone number in the token matches the claimed phone.

**2. Plain Sender Mode** (requires DLT-approved template):
- Server generates a 6-digit CSPRNG code, hashes it with HMAC, stores the hash.
- Server sends the code via MSG91's `otp` API with the auth key.
- Client sends the code back; server verifies against the stored hash.
- 5-minute expiry, 5 attempts max, 30-second resend cooldown.

**3. Demo Mode** (development only):
- No MSG91 credentials needed.
- A real 6-digit code is generated and checked identically.
- The code is returned in the API response and shown on the OTP screen.
- **Refused in production** — `config.ts` throws if `NODE_ENV=production` and no SMS provider is configured.

### Required Variables

**Backend:**
- `MSG91_AUTH_KEY` — **secret**, must never be in any `VITE_*` variable
- `MSG91_WIDGET_ID` — for widget mode (with auth key)
- `MSG91_TEMPLATE_ID` + `MSG91_SENDER` — for plain sender mode (alternative)

**Frontend:**
- `VITE_MSG91_WIDGET_ID` — public, needed by the browser to run the widget
- `VITE_MSG91_TOKEN_AUTH` — public, widget configuration

### HTTPS Requirement

MSG91's widget requires HTTPS. It will not work on `http://` in production. The
`localhost` exception applies for development. The widget's dashboard must
whitelist the deployment domain.

### Production Considerations

- **Both** `MSG91_AUTH_KEY` and `MSG91_WIDGET_ID` must be set — either one alone falls back to demo mode.
- The auth key committed in an early revision (`a0775b7`) should be **rotated** — deleting the line from the file did not revoke the key.
- MSG91's API Security settings must whitelist the server's IP address, or all verifications fail with code 418.

---

## 17. Authentication & Security

### Login Flows

| User | Method | Route | Result |
|---|---|---|---|
| **Seller** | Phone + OTP | `POST /api/auth/otp/send` → `POST /api/auth/otp/verify` | If registered: session. If not: registration ticket. |
| **Customer** | Phone + OTP | Same routes, `role: "customer"` | Session (always). `registered: false` if no name yet. |
| **Admin** | Email + password | `POST /api/auth/admin/login` | Session. Password verified via scrypt hash. |

### Session System

- **Session records** stored in the database (JSON or Firestore).
- **Bearer tokens** are HMAC-signed pointers to session records (`{sid, role, iat}`).
- Identity is read from the **record**, never from the token.
- Sessions can be **revoked** — revoking the record kills all tokens pointing at it.
- **Idle timeout**: Admin 8h, Seller/Customer 7d (sliding — resets on activity).
- **Absolute timeout**: Admin 7d, Seller/Customer 90d (cannot be extended).
- **Max sessions per user**: 10. Oldest evicted on new login.
- **Token refresh**: Past halfway through the idle window, a fresh token is sent back via `X-Session-Token`.

### Registration Tickets

When an unregistered seller's OTP succeeds, they receive a **single-use HMAC-signed ticket** (15-minute TTL) instead of a session. The registration endpoint consumes the ticket and reads the phone from it — the request body's phone is ignored.

### Admin Bootstrap

For hosts without shell access, an initial admin can be bootstrapped via
environment variables. Once the first admin signs in successfully, a real record
is written and the bootstrap variables are never consulted again. The hash must
be generated with `npm run admin:users hash` — plaintext passwords are rejected.

### Rate Limiting

All rate limiting is **in-memory** (not persisted). Limits include:
- Global per-IP (all endpoints)
- OTP send per-IP and per-phone (daily quotas)
- OTP verify per-IP and per-phone
- Admin login per-IP and per-email

### Audit Trail

`authEvents` collection records every login attempt, OTP send/verify, session
start/end, and rate-limit event. Phone numbers are **masked** (`****7890`) and
IP addresses are **hashed** in the log, so the audit trail is not itself a
target.

### CORS

- Comma-separated list of origins for multiple front ends.
- `X-Session-Token` exposed for token refresh.
- In production with CORS unset, boot banner prints a warning.

---

## 18. Production Architecture

```
┌─────────────────────────────┐
│  Android APK                │
│  (Capacitor, seller+buyer)  │
│  VITE_API_URL=              │
│   https://api.shantabazar.in│
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────┐
│  https://api.shantabazar.in                          │
│                                                      │
│  ┌─────────────────────────────────────────────────┐ │
│  │  Google Cloud Run (asia-south1, max-instances=1)│ │
│  │  Express API (backend/)                          │ │
│  │                                                  │ │
│  │  ┌──────────┐  ┌───────────┐  ┌──────────────┐  │ │
│  │  │ Firestore│  │Cloudinary │  │   MSG91      │  │ │
│  │  │ (data)   │  │ (images)  │  │   (OTP/SMS)  │  │ │
│  │  └──────────┘  └───────────┘  └──────────────┘  │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────┘
                           ▲
              ┌────────────┘
              │
┌─────────────────────────────┐
│  Admin Website              │
│  (Static SPA, admin/)       │
│  e.g. admin.shantabazar.in  │
│  VITE_API_URL=              │
│   https://api.shantabazar.in│
└─────────────────────────────┘
```

---

## 19. Deployment Order

1. **Prepare the repository**
   - Ensure `shared/`, `backend/`, `frontend/`, `admin/` are all clean.
   - Run `npm run typecheck` to catch compile errors across all workspaces.

2. **Create the first admin**
   - Generate a password hash: `npm run admin:users -- hash`
   - Note the hash for `ADMIN_BOOTSTRAP_PASSWORD_HASH`.

3. **Configure secrets in Google Cloud Secret Manager**
   - `SESSION_SECRET` — generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
   - `FIREBASE_SERVICE_ACCOUNT` — full service account JSON
   - `CLOUDINARY_URL` — from Cloudinary dashboard
   - `MSG91_AUTH_KEY` — from MSG91 dashboard

4. **Set up Firestore**
   - Create a Firebase project (if not existing).
   - Generate a service account key.
   - Deploy security rules: `firebase deploy --only firestore:rules`

5. **Build the Docker image**
   ```bash
   docker build -t DOCKER_USERNAME/shantai-api:v1 .
   ```

6. **Test the Docker image locally**
   ```bash
   docker run -p 4000:4000 -e SESSION_SECRET=test-secret DOCKER_USERNAME/shantai-api:v1
   # Visit http://localhost:4000/api/health
   ```

7. **Push the image**
   ```bash
   docker push DOCKER_USERNAME/shantai-api:v1
   ```

8. **Deploy backend to Cloud Run**
   - Use the command from §13.
   - Set `--max-instances=1`.
   - Set all environment variables and secrets.
   - Note the Cloud Run URL.

9. **Map custom domain** (optional)
   - Map `api.shantabazar.in` to the Cloud Run service.

10. **Deploy admin frontend**
    - Deploy `admin/` to Vercel (or any static host).
    - Set `VITE_API_URL` to the Cloud Run URL.
    - Root directory: `admin/`

11. **Deploy seller/customer frontend**
    - Deploy `frontend/` to Vercel (or any static host).
    - Set `VITE_API_URL`, `VITE_MSG91_WIDGET_ID`, `VITE_MSG91_TOKEN_AUTH`.
    - Root directory: `frontend/`

12. **Configure CORS**
    - Update `CORS_ORIGIN` on Cloud Run to include both frontend URLs (comma-separated).
    - Redeploy / restart the Cloud Run service.

13. **Configure MSG91 widget domains**
    - Add the frontend Vercel URL to MSG91 widget's allowed domains.

14. **Build the Android APK**
    ```bash
    cd frontend
    VITE_API_URL=https://api.shantabazar.in npm run cap:sync
    npm run cap:open   # Opens Android Studio
    ```
    - Build a signed APK in Android Studio.

15. **Final verification**
    - Check the boot banner shows: Firestore, Cloudinary, MSG91 widget, both CORS origins.
    - Log in with a real phone (widget path).
    - Log in to the admin console.

---

## 20. Testing Checklist

### Backend
- [ ] `GET /api/health` returns `{ ok: true }`
- [ ] Backend starts without errors (check boot banner)
- [ ] Boot banner shows correct database, image, OTP, and CORS config

### Authentication
- [ ] Seller OTP send and verify (demo mode locally)
- [ ] Seller OTP with MSG91 widget (production)
- [ ] Customer OTP send and verify
- [ ] Admin email + password login
- [ ] Logout actually revokes the session server-side
- [ ] Rate limiting kicks in after threshold
- [ ] Token refresh via `X-Session-Token`

### Seller Flows
- [ ] Registration wizard (6 screens, with ticket)
- [ ] Subscription payment submission (UTR)
- [ ] Product creation (with slot enforcement)
- [ ] Product photo upload to Cloudinary
- [ ] Product editing (within MAX_EDITS)
- [ ] Order accept → pack → out for delivery → delivered
- [ ] Growth chart / analytics
- [ ] Profile editing
- [ ] Shop open/close toggle

### Customer Flows
- [ ] Browse catalogue (categories, search, pincode filter)
- [ ] View product details
- [ ] Add to cart, multi-seller split
- [ ] Checkout with address
- [ ] Order placement (COD and UPI)
- [ ] Order tracking

### Admin Flows
- [ ] Dashboard stats load correctly
- [ ] Approve/reject subscription payments
- [ ] Approve/reject product listings (rejection requires reason)
- [ ] View seller details (products, orders, payments, earnings)
- [ ] Grant/revoke slot packs
- [ ] Block/unblock sellers (with reason)
- [ ] Order monitoring with filters
- [ ] Impact report generation

### Image Upload
- [ ] Upload signature endpoint returns valid params
- [ ] Direct upload to Cloudinary succeeds
- [ ] Image appears on product
- [ ] Image deletion works when replacing

### Database
- [ ] JSON file persists across server restarts (dev)
- [ ] Firestore reads and writes work (production)
- [ ] Fallback to JSON on Firestore failure
- [ ] Bulk delete protection triggers correctly

### Cloud Run
- [ ] Container starts and responds to health check
- [ ] `max-instances=1` is set
- [ ] Cold start completes (database loads)
- [ ] CORS allows both frontend origins
- [ ] Secrets are correctly injected

### Android APK
- [ ] API URL is correctly baked in
- [ ] OTP flow works from WebView
- [ ] Image uploads work from phone camera
- [ ] Offline/poor connection handling

---

## 21. Known Limitations / Risks

### Single Instance Constraint
The in-memory database snapshot means **exactly one instance** at all times.
Cloud Run autoscaling, multiple replicas, or blue/green deployments with
overlap will cause data loss. This is the most critical deployment constraint.

### In-Memory State (Not Persisted)
The following are stored only in process memory and lost on restart:
- **Rate limit buckets** — reset on every deploy/restart.
- **OTP pending codes** — any in-flight OTP is lost.
- **Write coalescing window** — mitigated by `SIGTERM` flush handler.

### Session Persistence
Sessions are stored in the database (JSON or Firestore) and survive restarts.
However, changing `SESSION_SECRET` signs out every user on the platform.

### Cold Start on Cloud Run
With `min-instances=0`, the first request after idle waits for:
1. Container startup
2. `initStore()` — loading the entire database from Firestore
This can take 5-30+ seconds depending on data size.

### CORS and WebView
The Android APK loads from a WebView filesystem origin, which is not an
`https://` site. CORS may behave differently — if APK requests are blocked,
check CORS configuration for WebView origins.

### Firestore Write Costs
The diff-based writer is efficient, but a single order placement can touch
multiple documents (order, seller, customer). On the free tier, this can be
significant at scale.

### No Horizontal Scaling Path
Converting to multi-instance requires rewriting all route handlers to use async
per-document Firestore reads — a significant engineering effort.

### Image Uploads Require Cloudinary
Without Cloudinary credentials, product photos cannot be uploaded. Products
work with emoji only, but the user experience is diminished.

### MSG91 Widget IP Whitelist
MSG91's API Security requires the server's egress IP to be whitelisted on the
auth key. Cloud Run's egress IP changes unless a static IP is configured via
Cloud NAT. This can cause all OTP verifications to fail silently (code 418).

### Local File Storage
`backend/data/db.json` is a local file. On Cloud Run, the filesystem is
**ephemeral** — data written to it is lost when the container stops. Firestore
must be used for any persistent production data.

---

## 22. Final Deployment Summary

| Component | Technology | Deployment Target | URL / Configuration |
|---|---|---|---|
| **Backend API** | Node.js / Express / TypeScript | Google Cloud Run (asia-south1, max-instances=1) | `api.shantabazar.in` |
| **Seller + Customer App** | React / Vite / TypeScript | Vercel (or static host) | `VITE_API_URL=https://api.shantabazar.in` |
| **Admin Console** | React / Vite / TypeScript | Vercel (or static host, separate project) | `VITE_API_URL=https://api.shantabazar.in` |
| **Android APK** | Capacitor wrapping `frontend/` | Google Play / direct APK | `VITE_API_URL` baked at build time |
| **Database** | Firestore (production) / JSON file (dev) | Google Cloud (same project as Cloud Run) | `FIREBASE_SERVICE_ACCOUNT` |
| **Images** | Cloudinary (signed direct upload) | Cloudinary | `CLOUDINARY_URL` |
| **OTP / SMS** | MSG91 (widget mode, no DLT needed) | MSG91 | `MSG91_AUTH_KEY` + `MSG91_WIDGET_ID` |
| **Shared Types** | TypeScript (compile-time only) | Not deployed — consumed at build time | `shared/src/` |

### What Each Folder Is

| Folder | What it is | Deployed? | Included in Docker? |
|---|---|---|---|
| `shared/` | TypeScript types and domain logic | No (compile-time) | **Yes** — backend build depends on it |
| `backend/` | Express REST API | **Yes** — Cloud Run | **Yes** — the main payload |
| `frontend/` | Seller + Customer React SPA | **Yes** — Vercel / static host | No |
| `admin/` | Admin Console React SPA | **Yes** — Vercel / static host | No |
| `docs/` | Documentation | No | No |

### What Runs Where

| Environment | What runs |
|---|---|
| **Locally** | `backend/` (port 4000) + `frontend/` (port 5173) + optionally `admin/` (port 5174) |
| **Cloud Run** | `backend/` only (Docker container) |
| **Vercel project 1** | `frontend/` (static build) |
| **Vercel project 2** | `admin/` (static build) |
| **Android phone** | `frontend/` (Capacitor WebView wrapping the built SPA) |

### How Everything Communicates

```
All three clients  ──→  one backend API  ──→  Firestore + Cloudinary + MSG91
```

- Frontend and admin both proxy `/api` to `:4000` in development.
- In production, both use `VITE_API_URL` to call the Cloud Run API directly.
- The APK has `VITE_API_URL` baked into the JS bundle at build time.
- CORS on the backend must list both frontend origins.
