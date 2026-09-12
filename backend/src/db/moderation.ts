import type { Product } from '@shared/types.js'
import { isRemovable } from '@shared/moderation.js'

/**
 * The other half of "rejected, not deleted": something has to actually remove
 * it when the 48 hours are up.
 *
 * A sweep rather than a per-product timer. Timers do not survive a restart,
 * and this process restarts on every deploy; a sweep only has to run
 * occasionally and is correct however long the server was down. It is called
 * at boot and hourly from index.ts, and again whenever the admin console asks
 * for the rejected list, so nobody is ever shown a row that has expired.
 */
export function expiredRejections(products: Product[], now = Date.now()): Product[] {
  return products.filter((p) => isRemovable(p, now))
}

/**
 * Drops expired rejections from the array IN PLACE and reports how many went.
 *
 * In place because `db.products` is the live array every route holds a
 * reference to - reassigning it would leave handlers reading a stale copy.
 * The caller decides whether to `save()`: sweeping nothing must not schedule
 * a write.
 */
export function purgeExpiredRejections(products: Product[], now = Date.now()): number {
  const doomed = new Set(expiredRejections(products, now).map((p) => p.id))
  if (doomed.size === 0) return 0

  for (let i = products.length - 1; i >= 0; i--) {
    if (doomed.has(products[i]!.id)) products.splice(i, 1)
  }
  return doomed.size
}
