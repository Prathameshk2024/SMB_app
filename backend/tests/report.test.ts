import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ALL_REPORT_REASONS, MAX_REPORT_NOTE, REPORT_REASONS, REPORT_REASONS_FOR, REPORT_TARGETS,
  isReportTarget, mayReport, reasonsFor, reportProblems,
} from '@shared/report.js'

/**
 * REPORTING WHAT SHOULD NOT BE HERE.
 *
 * Anyone can list anything in this market, and after an admin has approved a
 * listing the only people looking at it are buyers. So a buyer needs a way to
 * say "this is wrong" from the screen where she found it - which is also what
 * Google Play requires of an app carrying what its users write.
 *
 * The reason is the part that matters. "Spoiled food" and "that is not her
 * photograph" are different problems with different answers, and a queue of
 * reports that all say "inappropriate" cannot be triaged by anybody.
 */

test('a report without a reason is not a report', () => {
  assert.equal('reason' in reportProblems({}), true)
  assert.equal('reason' in reportProblems({ reason: 'made-up' }), true)
  assert.deepEqual(reportProblems({ reason: 'unsafe' }), {})
})

/**
 * `other` is the escape hatch - a list can never name everything - and it is
 * the one reason that has to carry words, or it says nothing at all.
 */
test('"other" has to say what is wrong', () => {
  assert.equal('note' in reportProblems({ reason: 'other' }), true)
  assert.equal('note' in reportProblems({ reason: 'other', note: 'बाद' }), true, 'four letters is not an explanation')
  assert.deepEqual(reportProblems({ reason: 'other', note: 'फोटो दुसऱ्या दुकानाचा आहे' }), {})
})

test('a named reason needs no words', () => {
  // She picked "does not look safe to eat". Making her type as well is how a
  // report stops being worth the trouble.
  assert.deepEqual(reportProblems({ reason: 'scam' }), {})
})

test('an essay is cut to something a queue can be read from', () => {
  const problems = reportProblems({ reason: 'other', note: 'अ'.repeat(MAX_REPORT_NOTE + 1) })
  assert.equal('note' in problems, true)
})

test('a listing, a review, a shop and a buyer can each be reported', () => {
  // Play's User Generated Content policy asks for a way to report the account
  // behind a post, not only the post - and a shop that takes money and sends
  // nothing is not a complaint about any one listing.
  for (const target of ['product', 'review', 'seller', 'customer']) {
    assert.equal(isReportTarget(target), true, target)
  }
  assert.equal(isReportTarget('order'), false, 'an order is not reported; the people on it are')
  assert.equal(isReportTarget(''), false)
})

/**
 * Each target has its own list, because the questions differ: "does not
 * look safe to eat" means nothing about a buyer, and "ordered and never took
 * delivery" means nothing about a jar of pickle. Every list ends in `other`.
 */
test('each target offers reasons that are about that target', () => {
  for (const target of REPORT_TARGETS) {
    const reasons = reasonsFor(target)
    assert.ok(reasons.length >= 3, `${target} needs a real list`)
    assert.equal(reasons[reasons.length - 1], 'other', `${target} needs an escape hatch, last`)
    for (const r of reasons) assert.ok(ALL_REPORT_REASONS.includes(r), `${r} is not a known reason`)
  }
  assert.ok(reasonsFor('customer').includes('noShow'))
  assert.ok(reasonsFor('seller').includes('noDelivery'))
  assert.ok(!reasonsFor('customer').includes('unsafe'), 'a buyer is not food')
  // The name the report sheet has always imported still means the listing list.
  assert.deepEqual([...REPORT_REASONS], [...REPORT_REASONS_FOR.product])
})

test('a reason from the wrong list is refused, the same as an invented one', () => {
  assert.deepEqual(reportProblems({ reason: 'noShow' }, 'customer'), {})
  assert.equal('reason' in reportProblems({ reason: 'noShow' }, 'product'), true)
  assert.equal('reason' in reportProblems({ reason: 'unsafe' }, 'seller'), true)
  // Without a target, any known reason passes - what a sheet drawn from the
  // flat list needs.
  assert.deepEqual(reportProblems({ reason: 'noShow' }), {})
})

/**
 * A buyer reports what she is shown; a seller reports what is done to her.
 * A seller reporting a listing would be reporting a rival, and a buyer
 * reporting another buyer has never met her through this app.
 */
test('who may report what', () => {
  assert.equal(mayReport('customer', 'product'), true)
  assert.equal(mayReport('customer', 'seller'), true)
  assert.equal(mayReport('seller', 'customer'), true)
  assert.equal(mayReport('seller', 'review'), true, 'the person a review is written about')
  assert.equal(mayReport('seller', 'product'), false, "a rival's listing is not hers to flag")
  assert.equal(mayReport('seller', 'seller'), false)
  assert.equal(mayReport('customer', 'customer'), false)
})
