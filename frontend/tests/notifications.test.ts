import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { AdminNotice, Order, Seller } from '@shared/types.js'
import { adminFeed, buildFeed, mergeFeeds, noticeLabelKey } from '../src/lib/notifications.js'
import { dictionaries } from '../src/i18n/strings.js'

/**
 * The updates list is read by a woman waiting at home, not by the state
 * machine. It used to print the machine's own label - "Packed", "Accepted" -
 * which says what the ORDER is, and leaves her to work out who did what to it.
 * Each side now gets a sentence aimed at itself.
 */

test('the customer is told what happened to HER order', () => {
  assert.equal(
    dictionaries.en[noticeLabelKey('ACCEPTED', 'customer')],
    'Your order has been accepted',
  )
  assert.equal(
    dictionaries.en[noticeLabelKey('DELIVERED', 'customer')],
    'Your order has been delivered',
  )
})

/** The same event, the other way round: for the seller it is work to do. */
test('the seller is told there is something to do', () => {
  assert.equal(dictionaries.en[noticeLabelKey('PLACED', 'seller')], 'You have a new order')
  assert.notEqual(
    noticeLabelKey('CANCELLED', 'seller'),
    noticeLabelKey('CANCELLED', 'customer'),
  )
})

/** A state nobody wrote a sentence for still reads as words, not as a key. */
test('an unmapped state falls back to the plain status label', () => {
  const key = noticeLabelKey('PACKED', 'seller')
  assert.equal(key, 'ord.status.PACKED')
  assert.ok(dictionaries.mr[key], 'the fallback has to exist in both dictionaries')
  assert.ok(dictionaries.en[key])
})

test('every line the feed can print exists in both languages', () => {
  const states = [
    'PLACED', 'ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED',
  ] as const
  const missing: string[] = []
  for (const role of ['seller', 'customer'] as const) {
    for (const s of states) {
      const key = noticeLabelKey(s, role)
      if (!dictionaries.mr[key] || !dictionaries.en[key]) missing.push(`${role}/${s}: ${key}`)
    }
  }
  assert.deepEqual(missing, [])
})

/* ------------------------------------------------------------------ */
/* One row per order                                                   */
/* ------------------------------------------------------------------ */

/**
 * An order walking its four states used to announce itself four times, the
 * rows identical apart from the verb and the same total printed on each. What
 * a woman waiting at home wants is one answer to "where is my order", not its
 * history read back to her as four separate pieces of news.
 */
function order(events: Order['events'], status: Order['status'] = 'DELIVERED'): Order {
  return {
    id: 'SMB5013',
    status,
    total: 444,
    customerName: 'रेखा',
    items: [
      { productId: 'p1', name: 'आंब्याचे लोणचे', emoji: '🫙', qty: 1, price: 220 },
      { productId: 'p2', name: 'कांदा लसूण मसाला', emoji: '🌶️', qty: 2, price: 180 },
    ],
    events,
  } as Order
}

const WALK: Order['events'] = [
  { to: 'PLACED', at: '2026-09-09T10:00:00.000Z', by: 'customer' },
  { to: 'ACCEPTED', at: '2026-09-09T11:00:00.000Z', by: 'seller' },
  { to: 'PACKED', at: '2026-09-09T12:00:00.000Z', by: 'seller' },
  { to: 'OUT_FOR_DELIVERY', at: '2026-09-09T13:00:00.000Z', by: 'seller' },
  { to: 'DELIVERED', at: '2026-09-09T14:00:00.000Z', by: 'seller' },
]

test('four events on one order are one row, not four', () => {
  const feed = buildFeed([order(WALK)], 'customer')
  assert.equal(feed.length, 1)
  assert.equal(feed[0]?.id, 'SMB5013', 'the order IS the row, so it keys on the order')
})

test('the row shows where the order is NOW', () => {
  const [row] = buildFeed([order(WALK)], 'customer')
  assert.equal(row?.status, 'DELIVERED')
  assert.equal(row?.at, '2026-09-09T14:00:00.000Z', 'timed by the latest move, so it reads as new again')
})

/** Out-of-order events must not make an older timestamp win. */
test('the row is timed by the latest event however they are ordered', () => {
  const shuffled = [WALK[4]!, WALK[1]!, WALK[3]!, WALK[2]!]
  assert.equal(buildFeed([order(shuffled)], 'customer')[0]?.at, '2026-09-09T14:00:00.000Z')
})

/**
 * The seller's tag is the ORDER's state, not her buyer's last move.
 *
 * A customer only ever causes PLACED and CANCELLED, so a tag drawn from the
 * other side's last event left every row on the seller's list reading "new
 * order" for ever - including the ones she had packed and handed over herself.
 */
test("the seller's row shows where the order actually is", () => {
  const [row] = buildFeed([order(WALK, 'OUT_FOR_DELIVERY')], 'seller')
  assert.equal(row?.status, 'OUT_FOR_DELIVERY')
  assert.notEqual(row?.status, 'PLACED', 'not frozen at what the buyer did')
})

test('the row is named after what is in the order, with the rest counted', () => {
  assert.equal(buildFeed([order(WALK)], 'customer')[0]?.title, 'आंब्याचे लोणचे +1')
})

/** Her own actions are not news to her - the seller placed nothing. */
test('an order with nothing from the other side is not a row at all', () => {
  const mineOnly = [{ to: 'ACCEPTED' as const, at: '2026-09-09T11:00:00.000Z', by: 'seller' as const }]
  assert.deepEqual(buildFeed([order(mineOnly)], 'seller'), [])
})

/* ------------------------------------------------------------------ */
/* Admin decisions                                                     */
/* ------------------------------------------------------------------ */

/**
 * Her slots used to just grow. An admin approved the ₹50, five slots
 * appeared, and nothing anywhere told her - she had to spot the meter. These
 * lines come off her own seller record, written by the admin handler.
 */
function seller(notices: AdminNotice[]): Seller {
  return { id: 's1', notices } as Seller
}

test('a granted pack is a sentence with the number in it', () => {
  const [row] = adminFeed(seller([
    { id: 'a1', at: '2026-09-08T10:00:00.000Z', kind: 'SLOTS_GRANTED', n: 5 },
  ]))

  assert.equal(row?.labelKey, 'notif.adm.SLOTS_GRANTED')
  assert.deepEqual(row?.vars, { n: 5 })
  assert.equal(
    dictionaries.en[row!.labelKey]?.replace('{n}', '5'),
    'You have been given 5 more product slots',
  )
})

/** No order behind it, so nothing may render an order id or a rupee amount. */
test('an admin line carries no order and no money', () => {
  const [row] = adminFeed(seller([
    { id: 'a2', at: '2026-09-08T10:00:00.000Z', kind: 'UNBLOCKED' },
  ]))

  assert.equal(row?.orderId, undefined)
  assert.equal(row?.total, undefined)
})

test('a rejection carries its reason across', () => {
  const [row] = adminFeed(seller([
    { id: 'a3', at: '2026-09-08T10:00:00.000Z', kind: 'PRODUCT_REJECTED', note: 'Photo unclear' },
  ]))

  assert.equal(row?.who, 'Photo unclear')
})

test('both halves of the list are one list, newest first', () => {
  const merged = mergeFeeds(
    [{ id: 'o1', at: '2026-09-01T00:00:00.000Z', labelKey: 'x', who: '' }],
    adminFeed(seller([
      { id: 'a4', at: '2026-09-08T00:00:00.000Z', kind: 'SLOTS_GRANTED', n: 5 },
    ])),
  )

  assert.deepEqual(merged.map((n) => n.id), ['a4', 'o1'])
})

test('every admin line exists in both languages', () => {
  const kinds: AdminNotice['kind'][] = [
    'SLOTS_GRANTED', 'SLOTS_REVOKED', 'PAYMENT_APPROVED', 'PAYMENT_REJECTED',
    'BLOCKED', 'UNBLOCKED', 'PRODUCT_APPROVED', 'PRODUCT_REJECTED',
  ]
  const missing = kinds
    .map((k) => `notif.adm.${k}`)
    .filter((key) => !dictionaries.mr[key] || !dictionaries.en[key])

  assert.deepEqual(missing, [])
})
