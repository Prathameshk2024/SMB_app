import type { Order, PublicReview, RatingSummary, Review } from './types.js'

/**
 * FEEDBACK ON A DELIVERED ORDER
 * =============================
 * A woman selling pickle from a village has nothing a stranger can check
 * except what her last buyers said. That makes feedback the most valuable
 * thing on her shop page - and the easiest thing on it to fake or to abuse.
 * Everything below is about keeping it worth reading.
 *
 * ONLY A BUYER WHO RECEIVED THE GOODS. A review belongs to one DELIVERED order
 * and is written by the customer on it. No order, no review: that is what
 * stops a rival leaving ten one-star ratings, and a seller leaving herself ten
 * five-star ones.
 *
 * ONE ORDER, ONE VOICE. Writing again replaces the first review rather than
 * adding a second, so a buyer who changes their mind - the pickle was better
 * after a week - corrects themselves instead of counting twice.
 *
 * FOR A MONTH. A review can be written or changed for REVIEW_WINDOW_DAYS after
 * delivery. Long enough for goods that are judged over time; short enough that
 * a quarrel months later cannot be carried into her rating.
 *
 * STARS ARE REQUIRED, WORDS ARE NOT. Typing is the step these users skip, so a
 * tap on a star is a complete review. The words are optional and capped.
 *
 * FIRST NAME ONLY IN PUBLIC. See `publicName`.
 */

export const REVIEW_WINDOW_DAYS = 30
export const REVIEW_COMMENT_MAX = 500
export const RATING_MIN = 1
export const RATING_MAX = 5

/** When the seller marked it delivered, or undefined if she has not. */
export function deliveredAt(order: Pick<Order, 'status' | 'events'>): string | undefined {
  if (order.status !== 'DELIVERED') return undefined
  return [...(order.events ?? [])].reverse().find((e) => e.to === 'DELIVERED')?.at
}

/**
 * May the buyer write (or change) feedback on this order right now?
 *
 * An order delivered before events were stamped has no date to count from;
 * it is let in rather than locked out, because the failure the window guards
 * against is a late grudge, not an old order with a missing timestamp.
 */
export function canReview(order: Pick<Order, 'status' | 'events'>, now = Date.now()): boolean {
  if (order.status !== 'DELIVERED') return false
  const at = deliveredAt(order)
  if (!at) return true
  return now - new Date(at).getTime() <= REVIEW_WINDOW_DAYS * 86_400_000
}

/**
 * What is wrong with this feedback, in Marathi, or null.
 *
 * Runs in the app so the send button can stay disabled until it is complete,
 * and on the server because the app can be bypassed.
 */
export function reviewProblem(rating: unknown, comment: unknown): string | null {
  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < RATING_MIN || rating > RATING_MAX) {
    return 'तारे निवडा'
  }
  if (comment !== undefined && comment !== null && typeof comment !== 'string') {
    return 'अभिप्राय पुन्हा लिहा'
  }
  if (typeof comment === 'string' && comment.trim().length > REVIEW_COMMENT_MAX) {
    return `अभिप्राय ${REVIEW_COMMENT_MAX} अक्षरांपेक्षा लहान लिहा`
  }
  return null
}

/**
 * The name a review is shown under: the first word of the buyer's name.
 *
 * Reviews are public, and a full name next to a village - which the seller's
 * card already prints - is enough to find someone's house. The first name is
 * what a neighbour recommending a shop would say anyway. Empty when there is
 * no name, and each app prints its own word for "a customer".
 */
export function publicName(name: string | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? ''
  // The placeholder checkout writes when she gave no name is not a name.
  return first === 'ग्राहक' ? '' : first
}

/** Stars across the reviews the public is allowed to see. */
export function summarizeReviews(reviews: Pick<Review, 'rating' | 'hidden'>[]): RatingSummary {
  const byStars: RatingSummary['byStars'] = [0, 0, 0, 0, 0]
  let sum = 0
  let count = 0
  for (const r of reviews) {
    if (r.hidden) continue
    if (r.rating < RATING_MIN || r.rating > RATING_MAX) continue
    byStars[r.rating - 1]! += 1
    sum += r.rating
    count += 1
  }
  return { average: count ? Math.round((sum / count) * 10) / 10 : 0, count, byStars }
}

/** Strip what the public must not see: the buyer's id and any moderation. */
export function toPublicReview(r: Review): PublicReview {
  return {
    id: r.id,
    orderId: r.orderId,
    customerName: r.customerName,
    rating: r.rating,
    comment: r.comment,
    items: r.items,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }
}

/** Dictionary key for the word under a star count - the star is never alone. */
export function ratingWordKey(rating: number): string {
  return `rev.word.${Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(rating)))}`
}
