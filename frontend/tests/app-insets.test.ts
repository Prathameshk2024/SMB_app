import { test } from 'node:test'
import assert from 'node:assert/strict'
import { WEBVIEW_NAV_FALLBACK_PX, isAndroidWebView, resolveInsets } from '../src/lib/appInsets.js'

/**
 * THE PAGE MUST NOT RUN UNDER ANDROID'S NAVIGATION BUTTONS.
 *
 * Inside the APK the WebView draws edge to edge and reports no safe-area
 * inset, so the tab bar and the last line of each page sat under the three
 * buttons. These hold where the room comes from.
 */

const WEBVIEW = 'Mozilla/5.0 (Linux; Android 14; SM-A146B Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36'
const CHROME = 'Mozilla/5.0 (Linux; Android 14; SM-A146B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Mobile Safari/537.36'

test('the APK is recognised, Chrome on the same phone is not', () => {
  assert.equal(isAndroidWebView(WEBVIEW), true)
  assert.equal(isAndroidWebView(CHROME), false)
})

test('inside the APK with no word from the wrapper, room for the three-button bar is kept', () => {
  assert.deepEqual(resolveInsets(undefined, WEBVIEW), { top: 0, bottom: WEBVIEW_NAV_FALLBACK_PX })
  assert.equal(WEBVIEW_NAV_FALLBACK_PX, 48)
})

/** In a browser, env(safe-area-inset-*) already has the right value. */
test('in a browser nothing is added on top of the browser\'s own value', () => {
  assert.deepEqual(resolveInsets(undefined, CHROME), { top: 0, bottom: 0 })
})

test('the wrapper\'s measured value wins over the guess, gesture bar included', () => {
  assert.deepEqual(resolveInsets({ top: 24, bottom: 16 }, WEBVIEW), { top: 24, bottom: 16 })
  assert.deepEqual(resolveInsets({ bottom: 0 }, WEBVIEW), { top: 0, bottom: 0 })
})

test('nonsense from the wrapper cannot push the page off the screen', () => {
  assert.deepEqual(resolveInsets({ top: -5, bottom: Number.NaN }, WEBVIEW), { top: 0, bottom: 0 })
  assert.deepEqual(resolveInsets({ bottom: 9999 }, WEBVIEW), { top: 0, bottom: 200 })
})
