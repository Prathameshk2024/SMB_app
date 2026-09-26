import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Order, Seller } from '@shared/types.js'
import { UNDO_DAYS, daysUntilScrub } from '@shared/accountClose.js'
import { adminCloseCustomer, adminCloseSeller } from '../src/db/accountClose.js'
import { customerIdFor } from '../src/db/customers.js'
import { emptyDb, type Db } from '../src/db/seed.js'

/**
 * CLOSING AN ACCOUNT FOR SOMEBODY WHO CANNOT SIGN IN.
 *
 * The deletion page and the privacy policy promise it: lost phone, OTP that
 * never comes - phone, WhatsApp or email us and we will close it. These tests
 * hold the two things that promise must not turn into:
 *
 *   1. A way to close a stranger's shop by sending one email naming her
 *      number. Staff must say they rang the registered number back.
 *   2. A different deletion from the one her own button makes. It is the
 *      same close - seven days for a seller, none for a buyer - and the same
 *      refusal while an order is in flight.
 */

const NOW = Date.parse('2026-09-26T10:00:00.000Z')
const BY = 'Jyoti Hattarge <jyotihattarge@gmail.com>'
const OK = { channel: 'email', verified: true, confirm: '1223' }

function seller(over: Partial<Seller> = {}): Seller {
  return { id: 's1', phone: '9822011223', status: 'ACTIVE', ...over } as Seller
}

function dbWith(...sellers: Seller[]): Db {
  const db = emptyDb()
  db.sellers.push(...sellers)
  return db
}

test('a staff close is refused until somebody has rung her back', () => {
  const s = seller()
  const db = dbWith(s)

  const unverified = adminCloseSeller(db, s, { ...OK, verified: false }, BY, NOW)
  assert.equal(unverified.ok, false)
  assert.equal(s.status, 'ACTIVE', 'an email naming her number is not enough')

  // "true" as a string is not a tick. Only the checkbox's boolean counts.
  assert.equal(adminCloseSeller(db, s, { ...OK, verified: 'true' }, BY, NOW).ok, false)
})

test('the channel is required and kept, so the record says how it was asked', () => {
  const s = seller()
  const db = dbWith(s)
  assert.equal(adminCloseSeller(db, s, { ...OK, channel: 'carrier pigeon' }, BY, NOW).ok, false)

  assert.equal(adminCloseSeller(db, s, OK, BY, NOW).ok, true)
  assert.equal(s.closeReason, 'other')
  assert.match(s.closeNote!, /email/)
  assert.match(s.closeNote!, /Jyoti Hattarge/, 'and who did it, after they have left')
})

test('the last four digits guard against closing the wrong woman\'s shop', () => {
  // The admin already has her page open; typing her digits is what proves the
  // page is the one the caller was talking about.
  const s = seller()
  const db = dbWith(s)
  assert.equal(adminCloseSeller(db, s, { ...OK, confirm: '9822' }, BY, NOW).ok, false)
  assert.equal(adminCloseSeller(db, s, { ...OK, confirm: '' }, BY, NOW).ok, false)
  assert.equal(s.status, 'ACTIVE')
})

test('a staff close is her own close: the shop shuts now, the erasing waits a week', () => {
  const s = seller()
  const db = dbWith(s)

  adminCloseSeller(db, s, OK, BY, NOW)

  assert.equal(s.status, 'CLOSED')
  assert.equal(daysUntilScrub(s.closingAt!, NOW), UNDO_DAYS)
  assert.equal(s.phone, '9822011223', 'nothing is erased yet - the week still applies')
})

test('an order in flight refuses a staff close exactly as it refuses hers', () => {
  const s = seller()
  const db = dbWith(s)
  db.orders.push({ id: 'o1', sellerId: 's1', customerId: 'c-1', customerPhone: '1', status: 'PACKED' } as Order)

  const r = adminCloseSeller(db, s, OK, BY, NOW)

  assert.equal(r.ok, false)
  assert.equal(!r.ok && r.status, 409)
  assert.deepEqual(!r.ok && r.openOrders, [{ id: 'o1', status: 'PACKED' }])
  assert.equal(s.status, 'ACTIVE')
})

test('closing twice says so instead of starting the week again', () => {
  const s = seller()
  const db = dbWith(s)
  adminCloseSeller(db, s, OK, BY, NOW)
  const firstDue = s.closingAt

  const again = adminCloseSeller(db, s, OK, BY, NOW + 3 * 24 * 60 * 60 * 1000)

  assert.equal(again.ok, false)
  assert.equal(s.closingAt, firstDue)
})

/* ------------------------------------------------------------------ */
/* Buyers                                                              */
/* ------------------------------------------------------------------ */

const BUYER = '9011223344'

function dbWithBuyer(): Db {
  const db = emptyDb()
  db.customers.push({
    id: customerIdFor(BUYER), phone: BUYER, name: 'प्रिया', addresses: [],
    createdAt: '', updatedAt: '',
  })
  db.orders.push({
    id: 'o1', sellerId: 's1', customerId: customerIdFor(BUYER), customerPhone: BUYER,
    customerName: 'प्रिया', address: 'घर क्र. 4', pincode: '413601', status: 'DELIVERED',
  } as Order)
  return db
}

test('a buyer is closed by her number, at once, off her orders too', () => {
  const db = dbWithBuyer()

  const r = adminCloseCustomer(db, BUYER, { channel: 'phone', verified: true }, NOW)

  assert.equal(r.ok, true)
  assert.equal(r.ordersCleared, 1)
  assert.equal(db.customers.length, 0)
  assert.equal(db.orders[0]!.customerPhone, '')
  assert.equal(db.orders[0]!.address, '')
})

test('a buyer close needs the call-back too', () => {
  const db = dbWithBuyer()
  assert.equal(adminCloseCustomer(db, BUYER, { channel: 'phone' }, NOW).ok, false)
  assert.equal(db.customers.length, 1)
})

test('a mistyped number is "not found", never a success for nobody', () => {
  const db = dbWithBuyer()
  const r = adminCloseCustomer(db, '9000000000', { channel: 'email', verified: true }, NOW)
  assert.equal(!r.ok && r.status, 404)
  assert.equal(adminCloseCustomer(db, '12345', { channel: 'email', verified: true }, NOW).ok, false)
})

test('a buyer waiting on a delivery cannot be closed by staff either', () => {
  const db = dbWithBuyer()
  db.orders[0]!.status = 'OUT_FOR_DELIVERY'
  const r = adminCloseCustomer(db, BUYER, { channel: 'whatsapp', verified: true }, NOW)
  assert.equal(!r.ok && r.status, 409)
  assert.equal(db.customers.length, 1)
})
