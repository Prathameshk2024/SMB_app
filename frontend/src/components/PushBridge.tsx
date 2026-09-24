import { useEffect } from 'react'
import { useI18n } from '../i18n/I18nProvider.js'
import { api } from '../lib/api.js'
import { startPushBridge, type PushWindow } from '../lib/pushBridge.js'
import { useAuth } from '../store/AuthContext.js'

/** Mounted once in App.tsx. Renders nothing; see lib/pushBridge.ts. */
export default function PushBridge() {
  const { session } = useAuth()
  const { lang } = useI18n()
  useEffect(
    () => startPushBridge({ w: window as unknown as PushWindow, session, lang, register: api.registerPush }),
    [session, lang],
  )
  return null
}
