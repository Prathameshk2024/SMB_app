import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Seller } from '@shared/types.js'
import { POLICY_VERSION, needsPolicyAcceptance, saidYes } from '@shared/legal.js'
import type { Db } from '../src/db/seed.js'
import { customerIdFor, isRegisteredCustomer } from '../src/db/customers.js'
import { recordAcceptance } from '../src/db/policies.js'

/**
 * CONSENT THAT CAN BE SHOWN, NOT ASSUMED
 * ======================================
 * The DPDP Act puts the burden on the operator: if the college holds a
 * woman's phone number, village and UPI ID, it has to be able to show she
 * agreed, to which text, and when. `acceptedPolicies` on her own record is
 * that evidence, and these are the rules that keep it honest.
 */

function emptyDb(): Db {
  return { sellers: [], products: [], orders: [], payments: [], customers: [] } as unknown as Db
}

const PHONE = '9011223344'
const CID = customerIdFor(PHONE)

test('only a literal true is a yes', () => {
  // A field that is missing is an older app that never drew the checkbox.
  // Reading that as agreement would record consent nobody gave.
  assert.equal(saidYes({ acceptPolicies: true }), true)
  for (const body of [{}, null, undefined, { acceptPolicies: 'true' }, { acceptPolicies: 1 }]) {
    assert.equal(saidYes(body), false, JSON.stringify(body))
  }
})

test('somebody who registered before the policies existed is asked', () => {
  assert.equal(needsPolicyAcceptance(undefined), true)
})

test('an older version is asked again, the current one is not', () => {
  assert.equal(needsPolicyAcceptance({ version: '2020-01-01', at: '2020-01-01T00:00:00Z' }), true)
  assert.equal(needsPolicyAcceptance({ version: POLICY_VERSION, at: new Date().toISOString() }), false)
})

test('a seller\'s acceptance is stamped with the version and the server\'s time', () => {
  const db = emptyDb()
  db.sellers.push({ id: 's1' } as Seller)
  const now = new Date('2026-09-26T10:00:00Z')

  const stamp = recordAcceptance(db, { role: 'seller', sellerId: 's1' }, now)

  assert.deepEqual(stamp, { version: POLICY_VERSION, at: now.toISOString() })
  assert.deepEqual(db.sellers[0]!.acceptedPolicies, stamp)
})

test('a seller whose record is gone cannot accept anything', () => {
  assert.equal(recordAcceptance(emptyDb(), { role: 'seller', sellerId: 'nobody' }), null)
})

test('a customer can accept before her row exists, and that does not register her', () => {
  // The acceptance screen can reach a signed-in buyer before anything else
  // has written her row. Accepting must not quietly stand in for her name:
  // "registered" still means a real name, which the seller reads on the order.
  const db = emptyDb()

  const stamp = recordAcceptance(db, { role: 'customer', customerId: CID, phone: PHONE })

  assert.equal(db.customers.length, 1)
  assert.deepEqual(db.customers[0]!.acceptedPolicies, stamp)
  assert.equal(isRegisteredCustomer(db, CID), false)
})

test('a seller\'s consent is checked before her single-use ticket is spent', () => {
  // Refusing after the ticket is consumed would send her back for another OTP,
  // against a three-a-day ceiling, because of a checkbox.
  const src = readFileSync(join(import.meta.dirname, '..', 'src', 'routes', 'sellers.routes.ts'), 'utf8')
  const handler = src.slice(src.indexOf("sellersRouter.post('/register'"))
  const consent = handler.indexOf('saidYes(')
  const ticket = handler.indexOf('consumeTicket(')
  assert.ok(consent > 0 && ticket > 0, 'both checks are in the register handler')
  assert.ok(consent < ticket, 'consent is checked first')
})
