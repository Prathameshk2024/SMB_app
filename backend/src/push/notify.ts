import type { AdminNotice, Order, OrderStatus } from '@shared/types.js'
import {
  adminNoticePush, customerOrderPush, paymentClaimedPush, sellerOrderPush,
} from '@shared/pushText.js'
import type { Db } from '../db/seed.js'
import { save } from '../db/store.js'
import { sendPush } from './send.js'
import { pushTargets } from './targets.js'

/**
 * ONE FUNCTION PER TRIGGER: who hears about it, and what they are told.
 *
 * The routes call these with `void` after `save()`, so the response never
 * waits on Firebase. `persist` is `save` in the server and a no-op in tests,
 * which must never write backend/data/db.json.
 */

export function notifyOrderPlaced(db: Db, order: Order, persist: () => void = save): Promise<number> {
  return sendPush(db, pushTargets(db, { sellerId: order.sellerId }), (lang) => sellerOrderPush(order, 'PLACED', lang), persist)
}

export function notifyOrderAdvanced(db: Db, order: Order, to: OrderStatus, persist: () => void = save): Promise<number> {
  return sendPush(db, pushTargets(db, { customerId: order.customerId }), (lang) => customerOrderPush(order, to, lang), persist)
}

export function notifyOrderCancelled(
  db: Db, order: Order, by: 'seller' | 'customer', persist: () => void = save,
): Promise<number> {
  return by === 'customer'
    ? sendPush(db, pushTargets(db, { sellerId: order.sellerId }), (lang) => sellerOrderPush(order, 'CANCELLED', lang), persist)
    : sendPush(db, pushTargets(db, { customerId: order.customerId }), (lang) => customerOrderPush(order, 'CANCELLED', lang), persist)
}

export function notifyPaymentClaimed(db: Db, order: Order, persist: () => void = save): Promise<number> {
  return sendPush(db, pushTargets(db, { sellerId: order.sellerId }), (lang) => paymentClaimedPush(order, lang), persist)
}

export function notifyAdminNotice(db: Db, sellerId: string, notice: AdminNotice, persist: () => void = save): Promise<number> {
  return sendPush(db, pushTargets(db, { sellerId }), (lang) => adminNoticePush(notice, lang), persist)
}
