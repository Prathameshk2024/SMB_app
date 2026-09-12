import { test } from 'node:test'
import assert from 'node:assert/strict'
import { forgetScroll, recallScroll, rememberScroll } from '../src/lib/scrollMemory.js'

/**
 * WHERE SHE WAS READING.
 *
 * Every route change used to run `window.scrollTo(0, 0)`, which is right going
 * forward - a product page opens at the top - and wrong coming back: she
 * scrolls a long way down the catalogue, opens the tenth product, presses
 * back, and the list has forgotten her. On a phone that is thirty swipes to
 * return to where she was, so she stops browsing deep at all.
 *
 * The position is kept per history entry, because the same path visited twice
 * is two different places she was reading.
 */

test('a position comes back for the entry that saved it', () => {
  rememberScroll('k1', 1200)
  assert.equal(recallScroll('k1'), 1200)
})

test('an entry nobody has scrolled starts at the top', () => {
  assert.equal(recallScroll('never-seen'), 0)
})

/** Two visits to the same screen are two places, not one. */
test('each history entry remembers its own position', () => {
  rememberScroll('k2', 400)
  rememberScroll('k3', 900)

  assert.equal(recallScroll('k2'), 400)
  assert.equal(recallScroll('k3'), 900)
})

test('scrolling again overwrites the old position', () => {
  rememberScroll('k4', 300)
  rememberScroll('k4', 800)

  assert.equal(recallScroll('k4'), 800)
})

/**
 * The map lives for the life of the tab and nothing prunes it, so an entry is
 * dropped when its screen is done with - otherwise a long session browsing a
 * catalogue accumulates a row per product opened.
 */
test('an entry can be forgotten', () => {
  rememberScroll('k5', 500)
  forgetScroll('k5')

  assert.equal(recallScroll('k5'), 0)
})
