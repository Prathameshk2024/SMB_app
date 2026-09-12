import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Product } from '@shared/types.js'
import { REJECT_GRACE_MS, hoursUntilRemoval, isRemovable } from '@shared/moderation.js'
import { purgeExpiredRejections } from '../src/db/moderation.js'

/**
 * REJECTED IS NOT DELETED.
 *
 * An admin used to be able to make a listing disappear, which from her side is
 * indistinguishable from a bug: the product she photographed and priced is
 * simply gone, with nothing to read. A rejection now carries a reason, stays
 * where she can see it, and removes itself 48 hours later - so these are about
 * the clock: it starts on the decision, it is not restarted, and a rejection
 * with no stamp is never swept.
 */

const NOW = Date.parse('2026-09-08T12:00:00.000Z')

function product(over: Partial<Product> = {}): Product {
  return { id: 'p1', sellerId: 's1', name: 'लोणचे', status: 'LIVE', ...over } as Product
}

test('the clock runs from the rejection, not from now', () => {
  const p = product({
    status: 'REJECTED',
    rejectedAt: new Date(NOW - 10 * 3_600_000).toISOString(),
  })

  assert.equal(hoursUntilRemoval(p, NOW), 38)
  assert.equal(isRemovable(p, NOW), false)
})

test('at 48 hours it goes', () => {
  const p = product({
    status: 'REJECTED',
    rejectedAt: new Date(NOW - REJECT_GRACE_MS).toISOString(),
  })

  assert.equal(hoursUntilRemoval(p, NOW), 0)
  assert.equal(isRemovable(p, NOW), true)
})

/**
 * Rows rejected before this rule existed carry no stamp. "We do not know when
 * this was rejected" must read as "the clock has not started" - deleting them
 * on sight is the exact behaviour the reject flow replaced.
 */
test('a rejection with no timestamp is never swept', () => {
  const p = product({ status: 'REJECTED' })

  assert.equal(hoursUntilRemoval(p, NOW), null)
  assert.equal(isRemovable(p, NOW), false)
})

test('the sweep takes only what is expired, and leaves everything else alone', () => {
  const products = [
    product({ id: 'live' }),
    product({ id: 'pending', status: 'PENDING' }),
    product({
      id: 'fresh',
      status: 'REJECTED',
      rejectedAt: new Date(NOW - 3_600_000).toISOString(),
    }),
    product({
      id: 'expired',
      status: 'REJECTED',
      rejectedAt: new Date(NOW - REJECT_GRACE_MS - 1000).toISOString(),
    }),
    product({ id: 'unstamped', status: 'REJECTED' }),
  ]

  const removed = purgeExpiredRejections(products, NOW)

  assert.equal(removed, 1)
  assert.deepEqual(products.map((p) => p.id), ['live', 'pending', 'fresh', 'unstamped'])
})

/**
 * The array is the live one every route holds a reference to, and the caller
 * only writes to disk when something actually changed.
 */
test('a sweep that removes nothing reports nothing', () => {
  const products = [product({ id: 'live' })]
  assert.equal(purgeExpiredRejections(products, NOW), 0)
  assert.equal(products.length, 1)
})
