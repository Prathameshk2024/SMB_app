import type { Order, OrderStatus, PaymentMode, PaymentStatus } from './types.js'

/**
 * THE ORDER STATE MACHINE
 * =======================
 * Locked - five states, this order, no additions:
 *
 *   PLACED -> ACCEPTED -> PACKED -> OUT_FOR_DELIVERY -> DELIVERED
 *
 * DELIVERED is the end. There was a COMPLETED after it, and it meant nothing
 * to either side: the seller had already handed the goods over and been paid,
 * the customer already had them, and no screen offered a way to reach it - so
 * every real order sat at DELIVERED with one greyed-out step below it,
 * implying something was still outstanding when nothing was.
 *
 * Payment is deliberately NOT a step in this chain. It sits on its own axis,
 * because a cash order and a UPI order have to walk the same six screens.
 * Inserting a payment state into the middle is the change that would break it.
 *
 * There is no delivery OTP. The seller marks DELIVERED herself and that is
 * accepted at face value; the trail in `events` is what admin reviews if a
 * customer disputes it. (The login OTP is a different thing entirely and is
 * still required - see backend/src/services/otp.service.ts.)
 *
 * The backend validates transitions against this table; the frontend draws its
 * buttons from it. Neither hard-codes a status string.
 */

export const HAPPY_PATH: OrderStatus[] = [
  'PLACED',
  'ACCEPTED',
  'PACKED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
]

export interface SellerAction {
  to: OrderStatus
  labelKey: string
  tone: 'primary' | 'ghost'
  needsReason?: boolean
  confirmKey?: string
  confirmSubKey?: string
}

export const SELLER_ACTIONS: Record<OrderStatus, SellerAction[]> = {
  PLACED: [
    { to: 'ACCEPTED', labelKey: 'ord.accept', tone: 'primary' },
    { to: 'REJECTED', labelKey: 'ord.reject', tone: 'ghost', needsReason: true },
  ],
  ACCEPTED: [{ to: 'PACKED', labelKey: 'ord.markPacked', tone: 'primary' }],
  PACKED: [
    {
      to: 'OUT_FOR_DELIVERY',
      labelKey: 'ord.markOut',
      tone: 'primary',
      confirmKey: 'ord.confirmOut',
      confirmSubKey: 'ord.confirmOutSub',
    },
  ],
  OUT_FOR_DELIVERY: [
    { to: 'DELIVERED', labelKey: 'ord.markDelivered', tone: 'primary' },
  ],
  DELIVERED: [],
  REJECTED: [],
  CANCELLED: [],
}

/** Icon + tone per status. Colour is never the only signal; the word ships too. */
export const STATUS_STYLE: Record<
  OrderStatus,
  { icon: string; tone: 'neutral' | 'info' | 'warn' | 'ok' | 'danger' }
> = {
  PLACED: { icon: '🔔', tone: 'warn' },
  ACCEPTED: { icon: '👍', tone: 'info' },
  PACKED: { icon: '📦', tone: 'info' },
  OUT_FOR_DELIVERY: { icon: '🛵', tone: 'info' },
  DELIVERED: { icon: '✅', tone: 'ok' },
  REJECTED: { icon: '✖', tone: 'danger' },
  CANCELLED: { icon: '✖', tone: 'danger' },
}

export function statusLabelKey(status: OrderStatus): string {
  return `ord.status.${status}`
}

export function stepIndex(status: OrderStatus): number {
  return HAPPY_PATH.indexOf(status)
}

export function isCancelled(status: OrderStatus): boolean {
  return status === 'REJECTED' || status === 'CANCELLED'
}

/** Server-side guard: is this transition legal from where the order is now? */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (SELLER_ACTIONS[from] || []).some((a) => a.to === to)
}

export function actionFor(from: OrderStatus, to: OrderStatus): SellerAction | undefined {
  return (SELLER_ACTIONS[from] || []).find((a) => a.to === to)
}

/**
 * Does this order need the seller to do something right now? Drives the action
 * queue on My Business - the most important widget in the app.
 */
export function needsSellerAction(order: Order): boolean {
  if (isCancelled(order.status)) return false
  if (order.paymentMode === 'UPI' && order.paymentStatus === 'UPI_SUBMITTED') return true
  return (SELLER_ACTIONS[order.status] || []).length > 0
}

export function customerCanCancel(status: OrderStatus): boolean {
  return status === 'PLACED' || status === 'ACCEPTED'
}

export function initialPaymentStatus(mode: PaymentMode): PaymentStatus {
  return mode === 'UPI' ? 'UPI_PENDING' : 'COD_PENDING'
}

/**
 * MONEY AFTER ACCEPTANCE, NOT BEFORE.
 *
 * A buyer used to pay at checkout, before the seller had seen the order. Now
 * that their delivery-area list is a hint rather than a gate, rejection is a
 * normal outcome - and a rejected prepaid order leaves the money in they
 * account with no refund path in this app.
 *
 * So the order reaches the seller's unpaid, and these two say whose turn it is.
 */

/** The seller's turn is done: the buyer owes the money and can pay it now. */
export function awaitingCustomerPayment(
  o: Pick<Order, 'paymentMode' | 'paymentStatus' | 'status'>,
): boolean {
  return o.paymentMode === 'UPI' && o.paymentStatus === 'UPI_PENDING' && o.status === 'ACCEPTED'
}

/**
 * The seller has not been paid yet, so they do not pack.
 *
 * A typed reference number is a claim, not money - only the seller's own
 * confirmation, made after looking at their UPI app, counts.
 */
export function awaitingPaymentConfirmation(
  o: Pick<Order, 'paymentMode' | 'paymentStatus'>,
): boolean {
  return o.paymentMode === 'UPI' && o.paymentStatus !== 'UPI_CONFIRMED'
}
