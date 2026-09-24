import type { Session } from '@shared/types.js'
import type { LangCode } from '../i18n/strings.js'

/**
 * THE HANDSHAKE WITH THE APK.
 *
 * The page cannot get a notification token itself - Android System WebView has
 * no push - so it asks the wrapper (`{ type: 'push:enable' }`), and the wrapper
 * answers by calling `window.__smbPushToken(token)`. This file is pure so it
 * can be tested in Node; components/PushBridge.tsx mounts it.
 */

export interface PushWindow {
  /** Present only inside the APK, and only because the wrapper sets onMessage. */
  ReactNativeWebView?: { postMessage(message: string): void }
  __smbPushToken?: (token: string) => void
}

export function wantsPush(session: Pick<Session, 'role'> | null): boolean {
  return session?.role === 'seller' || session?.role === 'customer'
}

/**
 * Ask the wrapper for the token, and register whatever it hands back in her
 * current language. Run again on sign-in and on a language change. Returns the
 * cleanup. Logout needs nothing: the server drops the token with the session.
 */
export function startPushBridge(opts: {
  w: PushWindow
  session: Session | null
  lang: LangCode
  register: (token: string, lang: LangCode) => Promise<unknown>
}): () => void {
  const { w, session, lang, register } = opts
  const bridge = w.ReactNativeWebView
  if (!bridge || !wantsPush(session)) return () => {}

  w.__smbPushToken = (token) => {
    register(token, lang).catch(() => {
      // A notification is a courtesy. The bell list still works without it.
    })
  }
  bridge.postMessage(JSON.stringify({ type: 'push:enable' }))
  return () => {
    delete w.__smbPushToken
  }
}
