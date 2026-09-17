import type { Order, PublicReview, RatingSummary, Review } from '@shared/types.js'
import {
  canReview, publicName, reviewProblem, summarizeReviews, toPublicReview,
} from '@shared/review.js'
import type { Db } from './seed.js'
import { newId } from './ids.js'

export type ReviewResult =
  | { ok: true; review: Review; created: boolean }
  | { ok: false; status: number; error: string; messageMr: string }

/**
 * Write the buyer's feedback on one of their own orders.
 *
 * Kept out of the route so the rules can be tested without a server. The
 * caller has already found the order under THIS customer's id, so ownership
 * is settled; this decides whether feedback is allowed now, and whether it is
 * complete.
 *
 * Writing again REPLACES the review on that order. The moderation fields are
 * left exactly as they were: a buyer whose review was taken down does not get
 * it back up by editing a word.
 */
export function writeReview(
  db: Pick<Db, 'reviews'>,
  order: Order,
  body: { rating?: unknown; comment?: unknown },
  now = new Date(),
): ReviewResult {
  if (order.status !== 'DELIVERED') {
    return {
      ok: false, status: 409, error: 'Only a delivered order can be reviewed',
      messageMr: 'ऑर्डर पोहोचल्यानंतरच अभिप्राय देता येतो',
    }
  }
  if (!canReview(order, now.getTime())) {
    return {
      ok: false, status: 409, error: 'The feedback window for this order has closed',
      messageMr: 'या ऑर्डरसाठी अभिप्राय देण्याची मुदत संपली आहे',
    }
  }

  const problem = reviewProblem(body.rating, body.comment)
  if (problem) return { ok: false, status: 400, error: 'Invalid review', messageMr: problem }

  const rating = body.rating as number
  const comment = typeof body.comment === 'string' && body.comment.trim() ? body.comment.trim() : undefined
  const at = now.toISOString()

  const existing = db.reviews.find((r) => r.orderId === order.id)
  if (existing) {
    existing.rating = rating
    existing.comment = comment
    existing.updatedAt = at
    return { ok: true, review: existing, created: false }
  }

  const review: Review = {
    id: newId('rv'),
    orderId: order.id,
    sellerId: order.sellerId,
    customerId: order.customerId,
    customerName: publicName(order.customerName),
    rating,
    comment,
    items: order.items.map((i) => ({ productId: i.productId, name: i.name })),
    createdAt: at,
  }
  db.reviews.unshift(review)
  return { ok: true, review, created: true }
}

/** What anyone may read about one shop: visible reviews, newest first, and the stars. */
export function publicReviewsFor(
  db: Pick<Db, 'reviews'>,
  sellerId: string,
): { reviews: PublicReview[]; summary: RatingSummary } {
  const mine = db.reviews.filter((r) => r.sellerId === sellerId)
  return {
    reviews: mine
      .filter((r) => !r.hidden)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(toPublicReview),
    summary: summarizeReviews(mine),
  }
}

/**
 * Stars for every seller in one pass.
 *
 * The catalogue prints a rating on every product card, and looking reviews up
 * seller by seller inside that loop would be one scan of `reviews` per card.
 */
export function ratingsBySeller(db: Pick<Db, 'reviews'>): Map<string, RatingSummary> {
  const grouped = new Map<string, Review[]>()
  for (const r of db.reviews) {
    const list = grouped.get(r.sellerId)
    if (list) list.push(r)
    else grouped.set(r.sellerId, [r])
  }
  const out = new Map<string, RatingSummary>()
  for (const [sellerId, list] of grouped) out.set(sellerId, summarizeReviews(list))
  return out
}

export const NO_RATING: RatingSummary = { average: 0, count: 0, byStars: [0, 0, 0, 0, 0] }
