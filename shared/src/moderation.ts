import type { Product } from './types.js'

/**
 * REJECTION IS NOT DELETION.
 *
 * An admin who does not like a listing used to be able to make it disappear.
 * From the seller's side that is indistinguishable from a bug: the product she
 * photographed and priced is simply gone, with nothing to read and nobody to
 * ask. So a rejection now does three things instead - it carries a reason, it
 * leaves the product where she can see it, and it removes itself after
 * 48 hours.
 *
 * The window is here rather than in the backend because all three sides say
 * the number out loud: the API deletes on it, her app counts down to it, and
 * the console promises it. One constant, one meaning.
 */
export const REJECT_GRACE_HOURS = 48
export const REJECT_GRACE_MS = REJECT_GRACE_HOURS * 3_600_000

/**
 * When this product disappears, or null if it never will.
 *
 * A rejection stamped before this rule existed has no `rejectedAt`, and the
 * safe reading of "we do not know when it was rejected" is that the clock has
 * not started - never that it expired long ago.
 */
export function removalDueAt(p: Pick<Product, 'status' | 'rejectedAt'>): number | null {
  if (p.status !== 'REJECTED' || !p.rejectedAt) return null
  const at = new Date(p.rejectedAt).getTime()
  return Number.isNaN(at) ? null : at + REJECT_GRACE_MS
}

/** Whole hours left, floored at 0. What her screen counts down. */
export function hoursUntilRemoval(
  p: Pick<Product, 'status' | 'rejectedAt'>,
  now = Date.now(),
): number | null {
  const due = removalDueAt(p)
  if (due == null) return null
  return Math.max(0, Math.ceil((due - now) / 3_600_000))
}

/** Its 48 hours are up: the sweeper may take it. */
export function isRemovable(
  p: Pick<Product, 'status' | 'rejectedAt'>,
  now = Date.now(),
): boolean {
  const due = removalDueAt(p)
  return due != null && due <= now
}
