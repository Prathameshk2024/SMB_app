import type { AdminNoticeKind, Order, OrderStatus, Role, Seller } from '@shared/types.js'
import { statusLabelKey } from '@shared/orderFlow.js'

/**
 * WHAT CHANGED SINCE SHE LAST LOOKED
 * ==================================
 * A customer places an order and then hears nothing. The seller accepts it,
 * packs it, sets off with it - four real events, none of which reached the
 * person waiting at home. Her only option was to open the order and read the
 * timeline, which means knowing to look.
 *
 * DERIVED, NOT STORED. Every one of these events is already on the order as an
 * `OrderEvent { to, at, by }`, and both sides already fetch their own orders.
 * A `notifications` collection would be a second copy of facts we hold, kept
 * in step by hand, and wrong the first time somebody forgot to write a row.
 * Nothing here needs a new endpoint or a new table.
 *
 * This is NOT push. The app has to be open. Real push needs FCM and a
 * device-token registry, and the honest version of that is a separate piece of
 * work - see "Not built yet" in CLAUDE.md. What this does is make sure that
 * when she DOES open the app, nothing that happened is hidden from her.
 */

export interface Notice {
  /** Stable across reloads, so "seen" survives a refresh. */
  id: string
  /** Absent on an admin decision: there is no order behind it. */
  orderId?: string
  at: string
  /** Key into the dictionary, so the line is written once, in both languages. */
  labelKey: string
  /**
   * What the row is called. An order names what is IN it - a woman recognises
   * her pickle order, not SMB5013 - and an admin decision has no product, so
   * it has none of this and prints its sentence instead.
   */
  title?: string
  /**
   * Where the order stands NOW - the order's own status, not the last event
   * the other side caused. On the seller's side those are rarely the same
   * thing: the only states a customer causes are PLACED and CANCELLED, so a
   * tag drawn from her buyer's last action said "new order" on every row
   * forever, including ones she had packed and delivered herself.
   */
  status?: OrderStatus
  /**
   * Who it concerns, when we know. A SELLER's order list carries
   * `customerName`; a customer's carries only `sellerId`, so on her side this
   * is empty and the line names the order instead. Fetching each seller to
   * fill it would be one request per order for a subtitle.
   */
  who: string
  /** Numbers the line needs, e.g. how many slots. */
  vars?: Record<string, string | number>
  /** Only order lines carry money. */
  total?: number
  /** Where tapping the row goes, when it is not an order. */
  to?: string
}

/**
 * A whole sentence, addressed to whoever is reading it.
 *
 * The list used to print the state machine's own label - "Packed", "Accepted"
 * - which is what the ORDER is, not what happened to HER. A woman waiting at
 * home reads "Accepted" and has to work out who accepted what. The seller's
 * side gets its own wording for the same reason: "Order placed" is a fact
 * about a row, "You have a new order" is a thing to go and do.
 *
 * Only the OTHER side's actions ever reach a feed, so each map holds only the
 * states that side can actually cause. Anything else falls back to the plain
 * status label rather than printing a missing key.
 */
const CUSTOMER_LINE: Partial<Record<OrderStatus, string>> = {
  ACCEPTED: 'notif.cus.ACCEPTED',
  PACKED: 'notif.cus.PACKED',
  OUT_FOR_DELIVERY: 'notif.cus.OUT_FOR_DELIVERY',
  DELIVERED: 'notif.cus.DELIVERED',
  REJECTED: 'notif.cus.REJECTED',
  CANCELLED: 'notif.cus.CANCELLED',
}

const SELLER_LINE: Partial<Record<OrderStatus, string>> = {
  PLACED: 'notif.sel.PLACED',
  CANCELLED: 'notif.sel.CANCELLED',
}

export function noticeLabelKey(status: OrderStatus, role: Role): string {
  const line = role === 'seller' ? SELLER_LINE[status] : CUSTOMER_LINE[status]
  return line ?? statusLabelKey(status)
}

/** What the order is, in the words on the listing. "+2" counts the rest. */
function itemSummary(o: Order): string {
  const [first, ...rest] = o.items ?? []
  if (!first) return o.id
  return rest.length ? `${first.name} +${rest.length}` : first.name
}

/**
 * ONE ROW PER ORDER, NOT ONE PER EVENT.
 *
 * An order that is accepted, packed, sent out and delivered produced four
 * rows, identical apart from the verb, stacked on top of each other with the
 * same total repeated four times. A woman opening this wants to know where
 * her pickle order is - one answer - not to read its history as four separate
 * announcements. So the row is the ORDER, it is named after what is in it,
 * and the state moves into a tag that changes as the order walks.
 *
 * The other side's actions only. A seller does not need telling that she
 * accepted an order two seconds ago, and a customer does not need telling she
 * placed one. Filtering by `by` is what keeps the list to things that happened
 * WHILE SHE WAS NOT LOOKING.
 *
 * Timestamped by the LATEST such event, which is what the bell's count reads:
 * an order that moves again after she looked counts once, not once per step.
 *
 * The TAG, though, is the order's own status rather than that event - see
 * `Notice.status`. What the row is for is "where is this order now".
 */
export function buildFeed(orders: Order[], role: Role): Notice[] {
  const mine = role === 'seller' ? 'seller' : 'customer'

  const out: Notice[] = []

  for (const o of orders) {
    const theirs = (o.events ?? [])
      .filter((e) => e.by !== mine)
      .sort((a, b) => a.at.localeCompare(b.at))

    const last = theirs[theirs.length - 1]
    if (!last) continue

    out.push({
      // The ORDER is the row, so the order id is the key. A second event on
      // the same order updates this row rather than adding one.
      id: o.id,
      orderId: o.id,
      at: last.at,
      labelKey: noticeLabelKey(last.to, role),
      title: itemSummary(o),
      status: o.status,
      who: mine === 'seller' ? o.customerName : '',
      total: o.total,
    })
  }

  return out.sort((a, b) => b.at.localeCompare(a.at))
}

/* ------------------------------------------------------------------ */
/* What she has already seen                                           */
/* ------------------------------------------------------------------ */

/**
 * A timestamp in localStorage, per account.
 *
 * Per account because a shared family phone is normal here: her daughter
 * signing in must not clear the badge her mother has not looked at yet.
 *
 * A timestamp rather than a set of ids because it cannot grow, and because
 * "everything before this moment is read" is exactly what pressing the bell
 * means.
 */
function key(userId: string): string {
  return `wb.seenUntil.${userId}`
}

export function lastSeen(userId: string): string {
  try {
    return localStorage.getItem(key(userId)) ?? ''
  } catch {
    return ''
  }
}

export function markSeen(userId: string, at = new Date().toISOString()): void {
  try {
    localStorage.setItem(key(userId), at)
  } catch {
    /* private mode - the badge simply comes back next time */
  }
}

export function unreadCount(feed: Notice[], userId: string): number {
  const seen = lastSeen(userId)
  // No stored mark means she has never opened the list. Everything is new,
  // capped so a seller with a year of history is not shown "412".
  return feed.filter((n) => n.at > seen).length
}

/* ------------------------------------------------------------------ */
/* What an admin did to her account                                    */
/* ------------------------------------------------------------------ */

/**
 * The other half of "what happened while she was not looking".
 *
 * Her slots grew by five and nothing on any screen said so - she had to
 * notice the meter herself, and a woman who has just paid ₹50 and been
 * approved by hand deserves to be told rather than to check. These come off
 * her own seller record (`seller.notices`), written by the admin handler that
 * made the change, so this needs no new endpoint: `api.me()` already carries
 * them.
 */
const ADMIN_ROW: Record<AdminNoticeKind, { to?: string }> = {
  SLOTS_GRANTED: { to: '/seller/products' },
  SLOTS_REVOKED: { to: '/seller/subscription' },
  PAYMENT_APPROVED: { to: '/seller/products' },
  PAYMENT_REJECTED: { to: '/seller/subscription' },
  BLOCKED: {},
  UNBLOCKED: {},
  PRODUCT_APPROVED: { to: '/seller/products' },
  PRODUCT_REJECTED: { to: '/seller/products' },
}

export function adminFeed(seller: Seller | null | undefined): Notice[] {
  return (seller?.notices ?? []).map((n) => ({
    id: n.id,
    at: n.at,
    labelKey: `notif.adm.${n.kind}`,
    vars: n.n == null ? undefined : { n: n.n },
    // The reason, or the product's name - whatever the decision was about.
    who: n.note ?? '',
    to: ADMIN_ROW[n.kind]?.to,
  }))
}

/** Both halves, newest first. The list she reads does not care where a line came from. */
export function mergeFeeds(...feeds: Notice[][]): Notice[] {
  return feeds.flat().sort((a, b) => b.at.localeCompare(a.at))
}
