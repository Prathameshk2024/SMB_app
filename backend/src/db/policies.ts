import { type PolicyAcceptance, acceptNow } from '@shared/legal.js'
import type { Db } from './seed.js'
import { ensureCustomer } from './customers.js'

/**
 * Stamp the policies in force now on the caller's own record.
 *
 * Who is accepting comes from the session, never the body - the same rule as
 * every other write to a person's record - so nobody can accept on somebody
 * else's behalf. Returns null for a seller whose record is gone (closed and
 * erased), which the route answers as 404.
 *
 * A customer's row is created if it does not exist yet, exactly as
 * GET /customers/me would: she is signed in, and the acceptance screen can
 * reach her before anything else has written her row.
 */
export function recordAcceptance(
  db: Db,
  who: { role: 'seller'; sellerId: string } | { role: 'customer'; customerId: string; phone: string },
  now = new Date(),
): PolicyAcceptance | null {
  const stamp = acceptNow(now)

  if (who.role === 'seller') {
    const seller = db.sellers.find((s) => s.id === who.sellerId)
    if (!seller) return null
    seller.acceptedPolicies = stamp
    return stamp
  }

  const customer = ensureCustomer(db, who.customerId, who.phone)
  customer.acceptedPolicies = stamp
  customer.updatedAt = stamp.at
  return stamp
}
