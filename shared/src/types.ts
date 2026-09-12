/**
 * Types shared by the frontend and the backend.
 *
 * This folder is the single source of truth for anything that crosses the
 * wire. Both tsconfigs alias it to `@shared/*`, so a change here is a compile
 * error on whichever side has not caught up - which is the whole reason this
 * project is in TypeScript.
 */

/* ------------------------------------------------------------------ */
/* Roles & auth                                                        */
/* ------------------------------------------------------------------ */

export type Role = 'seller' | 'customer' | 'admin'

export interface Session {
  token: string
  role: Role
  userId: string
  phone?: string
  name?: string
  /** Present only for sellers. */
  sellerId?: string
  /** Present only for customers. */
  customerId?: string
}

/* ------------------------------------------------------------------ */
/* Order lifecycle                                                     */
/* ------------------------------------------------------------------ */

export type OrderStatus =
  | 'PLACED'
  | 'ACCEPTED'
  | 'PACKED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'REJECTED'
  | 'CANCELLED'

export type PaymentMode = 'COD' | 'UPI'

export type PaymentStatus =
  | 'COD_PENDING'
  | 'COD_COLLECTED'
  /** Accepted or not yet: a UPI order the buyer has not paid for. */
  | 'UPI_PENDING'
  | 'UPI_SUBMITTED'
  | 'UPI_CONFIRMED'

export interface OrderEvent {
  to: OrderStatus
  at: string
  by: 'customer' | 'seller' | 'admin' | 'system'
  note?: string
}

export interface OrderItem {
  productId: string
  name: string
  emoji: string
  qty: number
  price: number
}

export interface Order {
  id: string
  groupId?: string
  sellerId: string
  customerId: string
  customerName: string
  customerPhone: string
  address: string
  landmark?: string
  pincode: string
  items: OrderItem[]
  itemsTotal: number
  deliveryFee: number
  total: number
  paymentMode: PaymentMode
  paymentStatus: PaymentStatus
  paymentUtr?: string
  status: OrderStatus
  /**
   * Legacy. Delivery no longer requires an OTP; kept optional so orders
   * already stored with one still parse. Nothing reads it.
   */
  deliveryOtp?: string
  placedAt: string
  /**
   * The delivery pincode is not in the seller's listed areas - inside
   * Maharashtra, so the order reached their anyway and the decision is their.
   * Their order screen says so, because Accept means "yes, I can get there".
   */
  outsideArea?: boolean
  events: OrderEvent[]
  sourceShareCode?: string
}

/* ------------------------------------------------------------------ */
/* Seller                                                              */
/* ------------------------------------------------------------------ */

export type SellerStatus =
  | 'REGISTERED'
  | 'PAYMENT_SUBMITTED'
  | 'ACTIVE'
  | 'PAYMENT_REJECTED'
  | 'BLOCKED'

export type BusinessType = 'individual' | 'shg' | 'udyam'

export type DispatchTime = 'same' | '1' | '23'

/**
 * The six digital-usage answers behind the Shanta Mahila Bazar Digital Readiness Index.
 * Collected once at registration and re-measured after training, so the
 * before/after comparison the research design needs is possible at all.
 */
export interface DigitalProfile {
  smartphone: boolean
  internet: boolean
  upi: boolean
  whatsappBusiness: boolean
  socialMedia: boolean
  digitalMarketing: boolean
}

/**
 * SOMETHING AN ADMIN DID TO HER ACCOUNT.
 *
 * Every other line in her updates list is derived from an order, because the
 * order already records what happened and when. An admin decision leaves no
 * such trail: a granted pack is a number that is simply larger than it was, so
 * "you were given 5 more slots, on Tuesday" cannot be reconstructed after the
 * fact. This is the smallest thing that can be: an append-only list on her own
 * record, trimmed, written by the same handler that made the change.
 */
export type AdminNoticeKind =
  | 'SLOTS_GRANTED'
  | 'SLOTS_REVOKED'
  | 'PAYMENT_APPROVED'
  | 'PAYMENT_REJECTED'
  | 'BLOCKED'
  | 'UNBLOCKED'
  | 'PRODUCT_APPROVED'
  | 'PRODUCT_REJECTED'

export interface AdminNotice {
  id: string
  at: string
  kind: AdminNoticeKind
  /** Slots, where the sentence carries a number. Slots, not packs - a pack is our word. */
  n?: number
  /** A reason, or the product's name. Shown to her as written, so keep it plain. */
  note?: string
}

export interface Seller {
  id: string
  /** Shanta Mahila Bazar ID, e.g. SMB-ANADUR-001. Printed on packaging and posters. */
  womenBizId: string

  // personal
  name: string
  photo: string
  phone: string
  whatsapp?: string
  age?: number
  education?: string

  // location
  village: string
  villageCode: string
  taluka: string
  district: string
  pincode: string

  // business
  shopName: string
  shopSlug: string
  about?: string
  businessType: BusinessType
  shgName?: string
  yearsInBusiness?: number
  /** Units she can make per month. Drives what admin can realistically promise. */
  monthlyCapacity?: number
  sellsFood: boolean

  // money in. `upiId` is collected at registration because she cannot be paid
  // without it. The payment QR is a SEPARATE, later step: it is generated from
  // that UPI ID (or she uploads her bank's own QR image), and `upiQrReady`
  // records that she has actually been through that step.
  upiId: string
  upiVerified: boolean
  upiQrUrl?: string
  upiQrPublicId?: string
  upiQrReady?: boolean

  // digital readiness
  digital: DigitalProfile
  readinessScore: number
  readinessBand: ReadinessBand

  // shop settings
  isOpen: boolean
  deliveryFee: number
  freeDeliveryAbove: number
  minOrder: number
  dispatch: DispatchTime
  pincodes: string[]

  // platform
  status: SellerStatus
  /**
   * When an admin blocked her, and why. Her own screens read these to tell
   * her what happened - a blocked seller who is simply shown an empty shop
   * has no idea whether the app is broken or she has been removed.
   */
  blockedAt?: string
  blockReason?: string
  packsApproved: number
  /**
   * Listings published over the life of the account, archived ones included.
   * Counted because archiving frees a slot instantly, so without it the edit
   * limit is avoided by taking a listing down and putting a new one up.
   */
  listingsPublished?: number
  /** Admin decisions about her account, newest last. Trimmed on write. */
  notices?: AdminNotice[]
  rating: number
  ratingCount: number
  qrScans: number
  qrOrders: number
  createdAt: string
}

export type ReadinessBand = 'starter' | 'basic' | 'advanced' | 'digital'

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export type ProductStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'LIVE'
  | 'REJECTED'
  | 'PAUSED'
  | 'ARCHIVED'

export type Unit = 'kg' | 'g' | 'piece' | 'dozen' | 'litre' | 'ml' | 'set'

export interface Product {
  id: string
  sellerId: string
  /** Fallback shown until a real photo exists, and if one fails to load. */
  emoji: string
  /** Cloudinary secure_url. Read through the LRU cache, never fetched directly. */
  imageUrl?: string
  /** Cloudinary public_id, so a replaced photo can be deleted from the account. */
  imagePublicId?: string
  name: string
  nameEn?: string
  categoryId: string
  isFood: boolean

  // food only - all four are required when isFood is true
  ingredients?: string
  vegType?: 'veg' | 'nonveg'

  // non-food only
  material?: string

  price: number
  mrp: number
  unit: Unit
  stock: number
  madeToOrder?: boolean

  status: ProductStatus
  rejectReason?: string
  /**
   * When an admin rejected it. A rejected listing is removed automatically
   * 48 hours later (see shared/src/moderation.ts) - the stamp is what that
   * clock counts from, and what her app counts down to.
   */
  rejectedAt?: string
  views: number
  /**
   * How many of MAX_EDITS the seller has spent on this listing. Absent on
   * anything published before the rule existed, which reads as none used -
   * nobody loses an edit to a change they made when editing was free.
   */
  editCount?: number
  createdAt: string
}

export interface Category {
  id: string
  icon: string
  mr: string
  en: string
  food: boolean
}

/* ------------------------------------------------------------------ */
/* Subscription                                                        */
/* ------------------------------------------------------------------ */

export type PaymentApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export interface SubscriptionPayment {
  id: string
  sellerId: string
  sellerName: string
  womenBizId: string
  phone: string
  amount: number
  utr: string
  payerUpi: string
  screenshotUrl?: string
  submittedAt: string
  status: PaymentApprovalStatus
  /** Set when the same reference number was already used by someone else. */
  duplicateUtr: boolean
  verifiedAt?: string
  verifiedBy?: string
  rejectReason?: string
}

export interface AdminPaymentAccount {
  label: string
  upiId: string
  bankName: string
  accountNo: string
  ifsc: string
}

/* ------------------------------------------------------------------ */
/* Addresses & cart                                                    */
/* ------------------------------------------------------------------ */

export interface Address {
  id: string
  label: string
  line: string
  landmark?: string
  /**
   * Optional: an order captures a line, a landmark and a pincode but never a
   * city, so an address recovered from one has none to give.
   */
  city?: string
  pincode: string
  isDefault: boolean
}

/**
 * A customer, keyed by phone number.
 *
 * Her addresses live inside this document rather than in a collection of their
 * own. She has two or three, they are only ever read alongside the rest of her
 * record, and embedding keeps a checkout write atomic instead of split across
 * two documents.
 *
 * Deliberately absent: order counts and spending totals. Those are derived
 * from `orders` when they are needed. A stored counter goes wrong the first
 * time an order is cancelled, and goes wrong silently.
 */
export interface Customer {
  /** `c-<phone>` - derived, so it always matches the id inside her token. */
  id: string
  phone: string
  name: string
  addresses: Address[]
  createdAt: string
  updatedAt: string
  /** Reserved for admin moderation (Phase 3). Nothing reads it yet. */
  blocked?: boolean
}

export interface CartItem {
  productId: string
  sellerId: string
  /**
   * The shop's name, copied in when the item was added. The cart holds one
   * seller's goods and has to be able to say whose without waiting on the
   * catalogue to load - a refusal that names no shop explains nothing.
   */
  sellerName?: string
  name: string
  emoji: string
  price: number
  unit: Unit
  qty: number
}

/** A cart split into one bucket per seller. Each becomes its own order. */
export interface SellerGroup {
  sellerId: string
  seller?: Seller
  items: CartItem[]
  itemsTotal: number
  deliveryFee: number
  total: number
  minOrder: number
  belowMinimum: boolean
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export interface WeekDay {
  d: string
  dEn: string
  v: number
}

export interface SellerWeek {
  days: WeekDay[]
  lastWeekTotal: number
  ordersThisWeek: number
  ordersLastWeek: number
  views: number
  ordered: number
  repeatCustomers: number
}

export interface AdminStats {
  gmvMonth: number
  ordersToday: number
  ordersWeek: number
  activeSellers: number
  totalSellers: number
  newRegistrations: number
  pendingPayments: number
  /** Listings waiting for an admin to publish them. */
  pendingProducts: number
  stuckOrders: number
  openDisputes: number
  womenEarnedTotal: number
  womenEarnedMonth: number
  womenWithFirstEarning: number
  /** Summed from APPROVED payment records, never from the plan price times a count. */
  subscriptionRevenue: number
  /** How many payments that total is made of. */
  approvedPaymentCount: number
  repurchaseRate: number
  funnel: { mr: string; en: string; v: number }[]
  earningBands: { label: string; v: number }[]
  readinessBands: { band: ReadinessBand; v: number }[]
}

/* ------------------------------------------------------------------ */
/* API envelope                                                        */
/* ------------------------------------------------------------------ */

export interface ApiError {
  error: string
  /** Marathi message, safe to show a seller directly. */
  messageMr?: string
  fields?: Record<string, string>
}
