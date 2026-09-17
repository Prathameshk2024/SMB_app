/**
 * ROOM FOR ANDROID'S OWN BARS, INSIDE THE APK.
 *
 * The APK is a WebView that draws edge to edge (Android 15 makes that the
 * default), so the phone's navigation bar - the three buttons, or the gesture
 * pill - sits ON TOP of the bottom of the page. The CSS already leaves room
 * for it through `env(safe-area-inset-bottom)`, and that works in Chrome and
 * Safari. Android System WebView reports it as 0, so inside the APK the tab
 * bar, the action bar and the last line of every page went under the buttons.
 *
 * So the page is told the inset another way, in this order:
 *
 *   1. The wrapper knows the real value (react-native-safe-area-context) and
 *      can hand it over as `window.ShantaiInsets = { top, bottom }` before the
 *      page loads, or later as a `shantai:insets` event when it changes.
 *   2. Failing that, inside an Android WebView, a fixed 48px - the height of
 *      the three-button bar, the taller of the two. On a gesture-bar phone that
 *      is some empty space under the tab bar; the alternative is buttons she
 *      cannot press.
 *   3. Anywhere else, nothing: the browser's own `env()` value is right.
 *
 * The CSS takes the larger of this and `env()`, so a WebView that one day
 * reports real insets is never double-counted.
 */

export interface Insets {
  top: number
  bottom: number
}

/** Height of Android's three-button navigation bar, in CSS px (= dp). */
export const WEBVIEW_NAV_FALLBACK_PX = 48

/** Android marks its WebView with "; wv)" in the user agent; Chrome does not. */
export function isAndroidWebView(userAgent: string): boolean {
  return /; wv\)/.test(userAgent)
}

function clean(n: unknown): number {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? Math.min(Math.round(v), 200) : 0
}

/** What to reserve, given what the wrapper said (if anything) and where we are running. */
export function resolveInsets(fromWrapper: Partial<Insets> | undefined, userAgent: string): Insets {
  if (fromWrapper && (fromWrapper.top != null || fromWrapper.bottom != null)) {
    return { top: clean(fromWrapper.top), bottom: clean(fromWrapper.bottom) }
  }
  if (isAndroidWebView(userAgent)) return { top: 0, bottom: WEBVIEW_NAV_FALLBACK_PX }
  return { top: 0, bottom: 0 }
}

type InsetWindow = Window & { ShantaiInsets?: Partial<Insets> }

function apply(insets: Insets): void {
  const root = document.documentElement
  root.style.setProperty('--app-inset-t', `${insets.top}px`)
  root.style.setProperty('--app-inset-b', `${insets.bottom}px`)
}

/** Run once, before the first render. */
export function installAppInsets(win: InsetWindow = window): void {
  apply(resolveInsets(win.ShantaiInsets, win.navigator.userAgent))
  win.addEventListener('shantai:insets', (e) => {
    apply(resolveInsets((e as CustomEvent<Partial<Insets>>).detail, win.navigator.userAgent))
  })
}
