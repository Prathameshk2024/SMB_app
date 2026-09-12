import type {
  Address, AdminPaymentAccount, Category, Customer, DigitalProfile, Order, Product,
  Seller, SellerGroup, SellerWeek, Session, SubscriptionPayment,
} from '@shared/types.js'
import type { SlotInfo } from '@shared/seller.js'

/**
 * The single seam between the app and the server.
 *
 * No screen calls fetch directly. In development Vite proxies /api to
 * localhost:4000; in the APK build VITE_API_URL points at the deployed API,
 * because there is no dev server inside a Capacitor WebView to proxy through.
 */

const BASE = import.meta.env.VITE_API_URL ?? ''
const TOKEN_KEY = 'wb.token'

/**
 * In memory first; localStorage only carries the token across a reload.
 *
 * A phone with site data blocked - or simply full - made every write here a
 * no-op, and reading the token back out of storage on every request turned
 * that into: the seller's shop on screen, no token on the wire, and a 401 on
 * the first thing they tapped. Memory is the source of truth, storage is the
 * backup.
 */
let memoryToken: string | null = null

export function getToken(): string | null {
  if (memoryToken) return memoryToken
  try {
    memoryToken = localStorage.getItem(TOKEN_KEY)
  } catch {
    /* storage unavailable - memory is the source of truth anyway */
  }
  return memoryToken
}

export function setToken(token: string | null): void {
  memoryToken = token
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private mode - the session just won't survive a refresh */
  }
}

/**
 * TWO THINGS THE SESSION HAS TO TELL THE APP
 * ==========================================
 * `wb.token` is what this module sends; `wb.session` (in AuthContext) is what
 * survives a reload and decides which screens render. They have to agree, and
 * for a long time they did not:
 *
 *  - the server slides the idle window by handing back a fresh token on
 *    `X-Session-Token`. That landed in `wb.token` only. On the next reload
 *    AuthContext wrote the ORIGINAL token back over it, so the window never
 *    actually slid and a seller was signed out exactly seven days after login
 *    however much she had used the app in between;
 *  - a 401 cleared `wb.token` and left `wb.session` sitting there, so the UI
 *    still believed she was signed in while every request failed.
 *
 * So the two events that change a session are published here, and AuthContext
 * is the one place that acts on them. Nothing else clears a session - not a
 * back press, not a reload, not opening /seller again.
 */
type TokenListener = (token: string) => void
type ExpiryListener = () => void

const refreshListeners = new Set<TokenListener>()
const expiryListeners = new Set<ExpiryListener>()

/** The server re-stamped the session. Returns an unsubscribe. */
export function onTokenRefresh(fn: TokenListener): () => void {
  refreshListeners.add(fn)
  return () => refreshListeners.delete(fn)
}

/** The server rejected the token: it is genuinely dead. Returns an unsubscribe. */
export function onSessionExpired(fn: ExpiryListener): () => void {
  expiryListeners.add(fn)
  return () => expiryListeners.delete(fn)
}

/** Thrown for any non-2xx. Carries the Marathi message and per-field errors. */
export class ApiError extends Error {
  status: number
  messageMr?: string
  fields?: Record<string, string>

  constructor(status: number, body: { error?: string; messageMr?: string; fields?: Record<string, string> }) {
    super(body.error ?? 'Request failed')
    this.status = status
    this.messageMr = body.messageMr
    this.fields = body.fields
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken()
  const res = await fetch(`${BASE}/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })

  // The server slides the session forward: past halfway through the idle
  // window it hands back a freshly stamped token. Swapping it in here is what
  // stops an active user being signed out on a timer.
  const refreshed = res.headers.get('X-Session-Token')
  if (refreshed && refreshed !== token) {
    setToken(refreshed)
    for (const fn of refreshListeners) fn(refreshed)
  }

  const text = await res.text()

  /**
   * An EMPTY 5xx is not our API answering badly - every failure it raises
   * carries { error, messageMr, ref }. It is the Vite dev proxy giving up on
   * localhost:4000, which it reports as a 500 with no body at all, and that
   * reached the screen as the meaningless "Request failed".
   */
  if (!text && !res.ok && res.status >= 500) {
    throw new ApiError(res.status, {
      error: `API did not respond (HTTP ${res.status}) - is the backend running on :4000?`,
      messageMr: 'सर्व्हरशी संपर्क होत नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.',
    })
  }

  let body: Record<string, unknown> = {}
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>
    } catch {
      // A non-JSON body means something other than our API answered - almost
      // always the Vite dev proxy reporting that the backend is not running,
      // which arrives as a 500 with an HTML body. Without this branch the
      // JSON.parse throws and the real status is lost behind "Network error".
      throw new ApiError(res.status, {
        error: `API did not respond (HTTP ${res.status}) - is the backend running on :4000?`,
        messageMr: 'सर्व्हरशी संपर्क होत नाही. थोड्या वेळाने पुन्हा प्रयत्न करा.',
      })
    }
  }

  // 401 means the SERVER rejected this token - expired, or signed with a
  // different secret. `requireRole` answers 403 for the wrong role, so this is
  // never "not allowed here"; it is "there is no session any more". Telling
  // AuthContext is the only way she gets back to the phone screen instead of
  // tapping a shop that answers 401 to everything.
  if (res.status === 401 && token) {
    setToken(null)
    for (const fn of expiryListeners) fn()
  }

  if (!res.ok) throw new ApiError(res.status, body)
  return body as T
}

const get = <T,>(p: string) => request<T>(p)
const post = <T,>(p: string, body?: unknown) =>
  request<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) })
const patch = <T,>(p: string, body: unknown) =>
  request<T>(p, { method: 'PATCH', body: JSON.stringify(body) })
const del = <T,>(p: string) => request<T>(p, { method: 'DELETE' })

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

export const api = {
  sendOtp: (phone: string) =>
    post<{ sent: boolean; demoCode?: string; cooldownMs?: number }>('/auth/otp/send', { phone }),

  /**
   * `registered` and `session` are independent on purpose. A customer whose
   * OTP checked out is authenticated - she gets a session - but she is not
   * registered until she has given us a name, so both come back together and
   * the caller decides where she lands. A seller with no record gets
   * `registered: false` and no session, because there is nothing to sign in to
   * until the wizard has run.
   */
  verifyOtp: (phone: string, code: string, role: 'seller' | 'customer') =>
    post<{
      registered: boolean
      session?: Session
      phone?: string
      /**
       * Single-use proof that this phone just passed an OTP. Present only for
       * a seller with no record yet, and required by `registerSeller` - the
       * server reads the phone out of it and ignores the one in the body.
       */
      ticket?: string
    }>('/auth/otp/verify', { phone, code, role }),

  /**
   * End the session on the SERVER, not just in this browser.
   *
   * Logging out used to clear localStorage and nothing else, which left the
   * token valid for its whole window - so signing out on a borrowed phone did
   * not sign you out of anything.
   */
  logout: () => post<{ ok: true }>('/auth/logout'),

  /** Devices this account is signed in on. Never anybody else's. */
  sessions: () =>
    get<{
      sessions: {
        id: string
        client?: string
        createdAt: string
        lastSeenAt: string
        current: boolean
      }[]
    }>('/auth/sessions'),

  endSession: (id: string) => del<{ ok: true }>(`/auth/sessions/${id}`),

  /* ---------------- seller ---------------- */

  registerSeller: (body: SellerRegistration) =>
    post<{ seller: Seller; session: Session }>('/sellers/register', body),

  me: () => get<{ seller: Seller; slots: SlotInfo }>('/sellers/me'),

  updateMe: (patchBody: Partial<Seller>) =>
    patch<{ seller: Seller }>('/sellers/me', patchBody),

  /** Her buyers, derived from her own orders. Never anybody else's. */
  myBuyers: () => get<{ buyers: SellerBuyer[] }>('/sellers/me/buyers'),

  sellerById: (id: string) => get<{ seller: Seller }>(`/sellers/${id}`),

  subscription: () =>
    get<{
      plan: { price: number; slotsPerPack: number }
      account: AdminPaymentAccount
      slots: SlotInfo
      status: Seller['status']
      payments: SubscriptionPayment[]
    }>('/sellers/me/subscription'),

  submitPayment: (utr: string, payerUpi?: string, screenshotUrl?: string) =>
    post<{ payment: SubscriptionPayment; status: Seller['status'] }>(
      '/sellers/me/subscription/payment',
      { utr, payerUpi, screenshotUrl },
    ),

  /* ---------------- products ---------------- */

  myProducts: () => get<{ products: Product[]; slots: SlotInfo }>('/products/mine'),

  createProduct: (body: Partial<Product> & { asDraft?: boolean }) =>
    post<{ product: Product }>('/products', body),

  updateProduct: (id: string, body: Partial<Product>) =>
    patch<{ product: Product }>(`/products/${id}`, body),

  archiveProduct: (id: string) => del<{ ok: true; slots: SlotInfo }>(`/products/${id}`),

  /* ---------------- catalog (public) ---------------- */

  categories: () => get<{ categories: Category[] }>('/catalog/categories'),

  catalog: (params: { categoryId?: string; q?: string; pincode?: string; sellerId?: string } = {}) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v)
    const s = qs.toString()
    return get<{ products: (Product & { seller?: Partial<Seller> })[] }>(
      `/catalog/products${s ? `?${s}` : ''}`,
    )
  },

  product: (id: string) => get<{ product: Product; seller?: Seller }>(`/catalog/products/${id}`),

  /** Is this pincode covered by any open seller? Derived, never a static list. */
  serviceability: (pincode: string) =>
    get<{
      pincode: string
      serviceable: boolean
      sellerCount: number
      productCount: number
      nearbyVillages: string[]
    }>(`/catalog/serviceability?pincode=${encodeURIComponent(pincode)}`),

  /* ---------------- her own record ---------------- */

  /**
   * Her customer record, addresses included. Created empty on first call.
   *
   * This replaced `addresses()`, which hit an unauthenticated endpoint and
   * returned the same two seeded addresses to everybody.
   */
  customerMe: () => get<{ customer: Customer }>('/customers/me'),

  updateCustomerMe: (name: string) => patch<{ customer: Customer }>('/customers/me', { name }),

  addAddress: (body: AddressInput) =>
    post<{ address: Address }>('/customers/me/addresses', body),

  updateAddress: (id: string, body: Partial<AddressInput>) =>
    patch<{ address: Address }>(`/customers/me/addresses/${id}`, body),

  deleteAddress: (id: string) => del<{ ok: true }>(`/customers/me/addresses/${id}`),

  /* ---------------- orders ---------------- */

  myOrders: () => get<{ orders: Order[] }>('/orders/mine'),
  order: (id: string) => get<{ order: Order; seller?: Partial<Seller> }>(`/orders/${id}`),

  placeOrders: (body: {
    address: { line: string; landmark?: string; pincode: string }
    groups: SellerGroup[]
    paymentMode: 'COD' | 'UPI'
    customerName?: string
  }) => post<{ orders: Order[]; groupId: string }>('/orders', body),

  advanceOrder: (id: string, to: Order['status'], extra?: { otp?: string; reason?: string }) =>
    post<{ order: Order }>(`/orders/${id}/advance`, { to, ...extra }),

  /** The buyer paying, after the seller has accepted. */
  payOrder: (id: string, utr: string) =>
    post<{ order: Order }>(`/orders/${id}/pay`, { utr }),

  confirmPayment: (id: string) => post<{ order: Order }>(`/orders/${id}/confirm-payment`),

  /* ---------------- analytics ---------------- */

  sellerWeek: (id: string) => get<{ week: SellerWeek | null }>(`/analytics/seller/${id}/week`),
}

/** One row of the seller's "My Buyers" screen. Derived server-side. */
export interface SellerBuyer {
  customerId: string
  name: string
  phone: string
  orderCount: number
  totalSpent: number
  lastOrderAt: string
  lastAddress: string
  pincode: string
}

export interface AddressInput {
  label?: string
  line: string
  landmark?: string
  pincode: string
  isDefault?: boolean
}

export interface SellerRegistration {
  /**
   * From `verifyOtp`. The server takes the phone number from THIS and ignores
   * anything the body claims, so registration cannot be pointed at a number
   * whose OTP was never passed.
   */
  ticket: string
  name: string
  age?: number
  education?: string
  whatsapp?: string
  village: string
  taluka: string
  district: string
  pincode: string
  shopName: string
  about?: string
  businessType: Seller['businessType']
  shgName?: string
  yearsInBusiness?: number
  monthlyCapacity?: number
  sellsFood: boolean
  upiId: string
  upiQrUrl?: string
  upiQrPublicId?: string
  digital: DigitalProfile
  deliveryFee?: number
  minOrder?: number
  dispatch?: Seller['dispatch']
}
