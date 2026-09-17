import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Order, OrderStatus, Review } from '@shared/types.js'
import {
  REVIEW_COMMENT_MAX, REVIEW_WINDOW_DAYS, canReview, publicName, reviewProblem,
  summarizeReviews, toPublicReview,
} from '@shared/review.js'
import { publicReviewsFor, ratingsBySeller, writeReview } from '../src/db/reviews.js'

/**
 * FEEDBACK ON A DELIVERED ORDER.
 *
 * A village seller has nothing a stranger can check except what her last
 * buyers said, so these rules exist to keep that worth reading: only a buyer
 * who received the goods, one voice per order, for a month, first name only.
 */

const DAY = 86_400_000
const DELIVERED_AT = '2026-09-10T10:00:00.000Z'

function order(status: OrderStatus = 'DELIVERED', id = 'SMB1234'): Order {
  return {
    id,
    sellerId: 's1',
    customerId: 'c-9876543210',
    customerName: 'सविता भोसले',
    status,
    items: [{ productId: 'p1', name: 'आंबा लोणचे', emoji: '🫙', qty: 1, price: 120 }],
    events: [
      { to: 'PLACED', at: '2026-09-08T10:00:00.000Z', by: 'customer' },
      ...(status === 'DELIVERED' ? [{ to: 'DELIVERED' as const, at: DELIVERED_AT, by: 'seller' as const }] : []),
    ],
  } as Order
}

const soon = new Date(new Date(DELIVERED_AT).getTime() + 2 * DAY)

test('only a delivered order can be reviewed - a rival with no order has nothing to rate', () => {
  for (const s of ['PLACED', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'CANCELLED', 'REJECTED'] as const) {
    const db = { reviews: [] as Review[] }
    const r = writeReview(db, order(s), { rating: 5 }, soon)
    assert.equal(r.ok, false, s)
    assert.equal(db.reviews.length, 0)
  }
})

test('a tap on a star is a whole review; the words are optional', () => {
  const db = { reviews: [] as Review[] }
  const r = writeReview(db, order(), { rating: 4 }, soon)
  assert.ok(r.ok)
  assert.equal(r.review.rating, 4)
  assert.equal(r.review.comment, undefined)
  assert.equal(r.created, true)
})

test('the stars must be a whole number from one to five', () => {
  for (const bad of [0, 6, 3.5, '5', null, undefined]) {
    assert.notEqual(reviewProblem(bad, undefined), null, String(bad))
  }
  assert.equal(reviewProblem(1, ''), null)
  assert.notEqual(reviewProblem(3, 'x'.repeat(REVIEW_COMMENT_MAX + 1)), null)
})

/**
 * Writing again replaces. A buyer who changes their mind corrects themselves
 * rather than counting twice in her average.
 */
test('one order is one voice: writing again replaces the review', () => {
  const db = { reviews: [] as Review[] }
  writeReview(db, order(), { rating: 2, comment: 'थोडे खारट' }, soon)
  const again = writeReview(db, order(), { rating: 5, comment: 'आठवड्यानंतर छान लागले' }, soon)
  assert.ok(again.ok)
  assert.equal(again.created, false)
  assert.equal(db.reviews.length, 1)
  assert.equal(db.reviews[0]!.rating, 5)
  assert.ok(db.reviews[0]!.updatedAt)
})

test('feedback closes a month after delivery', () => {
  const o = order()
  const deliveredMs = new Date(DELIVERED_AT).getTime()
  assert.equal(canReview(o, deliveredMs + REVIEW_WINDOW_DAYS * DAY), true)
  assert.equal(canReview(o, deliveredMs + REVIEW_WINDOW_DAYS * DAY + 1), false)

  const late = writeReview({ reviews: [] }, o, { rating: 1 }, new Date(deliveredMs + 40 * DAY))
  assert.equal(late.ok, false)
})

/**
 * A review names the buyer to everybody. The seller's card already prints her
 * village, and a full name beside a village is an address.
 */
test('a review is shown under the first name only', () => {
  const db = { reviews: [] as Review[] }
  const r = writeReview(db, order(), { rating: 5 }, soon)
  assert.ok(r.ok)
  assert.equal(r.review.customerName, 'सविता')
  assert.equal(publicName('  Rahul   Deshmukh '), 'Rahul')
  // The placeholder checkout writes for a buyer with no name is not a name.
  assert.equal(publicName('ग्राहक'), '')
})

test('the public copy carries no buyer id and no moderation notes', () => {
  const db = { reviews: [] as Review[] }
  const r = writeReview(db, order(), { rating: 3 }, soon)
  assert.ok(r.ok)
  const pub = toPublicReview({ ...r.review, hidden: true, hiddenReason: 'phone number in text' })
  assert.equal('customerId' in pub, false)
  assert.equal('hiddenReason' in pub, false)
  assert.equal('sellerId' in pub, false)
})

/**
 * Hidden reviews leave the list AND the average. A take-down that still
 * dragged her stars down would punish her for somebody else's abuse.
 */
test('a hidden review leaves both the public list and the average', () => {
  const db = { reviews: [] as Review[] }
  writeReview(db, order('DELIVERED', 'A'), { rating: 5 }, soon)
  writeReview(db, order('DELIVERED', 'B'), { rating: 1, comment: 'abuse' }, soon)
  db.reviews.find((r) => r.orderId === 'B')!.hidden = true

  const { reviews, summary } = publicReviewsFor(db, 's1')
  assert.deepEqual(reviews.map((r) => r.orderId), ['A'])
  assert.deepEqual(summary, { average: 5, count: 1, byStars: [0, 0, 0, 0, 1] })
  assert.equal(ratingsBySeller(db).get('s1')?.count, 1)
})

test('editing a hidden review does not put it back up', () => {
  const db = { reviews: [] as Review[] }
  writeReview(db, order(), { rating: 1 }, soon)
  db.reviews[0]!.hidden = true
  writeReview(db, order(), { rating: 2, comment: 'changed a word' }, soon)
  assert.equal(db.reviews[0]!.hidden, true)
})

test('the average is rounded to one decimal place, and zero with nothing to average', () => {
  assert.deepEqual(summarizeReviews([]), { average: 0, count: 0, byStars: [0, 0, 0, 0, 0] })
  const s = summarizeReviews([{ rating: 5 }, { rating: 4 }, { rating: 4 }])
  assert.equal(s.average, 4.3)
  assert.deepEqual(s.byStars, [0, 0, 0, 2, 1])
})
