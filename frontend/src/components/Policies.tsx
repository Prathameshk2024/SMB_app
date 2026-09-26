import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { needsPolicyAcceptance } from '@shared/legal.js'
import { useI18n, useT } from '../i18n/I18nProvider.js'
import { useAuth } from '../store/AuthContext.js'
import { api, ApiError } from '../lib/api.js'
import { type DocId, legalDoc, legalPath } from '../legal/index.js'
import { Button, Choice, Notice } from './ui.js'
import { IconChevron, IconPolicy } from './icons.js'

/** Which documents each side is asked to accept. */
const SELLER_DOCS: DocId[] = ['seller', 'terms', 'privacy', 'refunds']
const BUYER_DOCS: DocId[] = ['terms', 'privacy', 'refunds']

/** The documents as links, named in the reader's language. */
function ReadFirst({ docs }: { docs: DocId[] }) {
  const t = useT()
  const { lang } = useI18n()
  return (
    <div className="stack-sm">
      <div className="small dim">{t('legal.readFirst')}</div>
      <ul className="stack-sm" style={{ margin: 0, paddingLeft: 'var(--s5)' }}>
        {docs.map((id) => (
          <li key={id}><Link to={legalPath(id)}>{legalDoc(lang, id).title}</Link></li>
        ))}
      </ul>
    </div>
  )
}

/**
 * "I HAVE READ AND AGREE", AS A THING SHE TICKS.
 *
 * A `Choice`, not a native checkbox: the native one is a 16px target for a
 * thumb, and this audience's design rule is 44px. The links sit ABOVE it and
 * outside it, because a link inside a button is invalid HTML and a tap on it
 * would tick the box as well as open the page.
 */
export function PolicyConsent({
  role, checked, onChange, error,
}: {
  role: 'seller' | 'customer'
  checked: boolean
  onChange: (v: boolean) => void
  error?: string
}) {
  const t = useT()
  return (
    <div className="stack-sm">
      <ReadFirst docs={role === 'seller' ? SELLER_DOCS : BUYER_DOCS} />
      <Choice
        selected={checked}
        onSelect={() => onChange(!checked)}
        title={t(role === 'seller' ? 'legal.agreeSeller' : 'legal.agreeBuyer')}
      />
      {error && <Notice tone="danger">{error}</Notice>}
    </div>
  )
}

/**
 * THE ONE-TIME ACCEPTANCE SCREEN.
 *
 * For everybody who registered before the policies existed, and for everybody
 * again whenever POLICY_VERSION moves. The DPDP Act expects people whose data
 * is already held to be given the notice too, not only new arrivals.
 *
 * It covers the whole app, like RateOrderGate, and there is no close button:
 * the one way on is to agree. The one way out is the policy pages themselves
 * (public routes outside the layout) and, from them, Back. A woman who does
 * not agree can still delete her account from the public deletion page.
 *
 * One fetch when the layout mounts, never on a timer: the answer only changes
 * when she taps "I agree" here or a deploy moves the version, and a deploy
 * reloads the page anyway.
 */
export function PolicyGate({ onBlockingChange }: { onBlockingChange?: (blocking: boolean) => void }) {
  const t = useT()
  const { session } = useAuth()
  const role = session?.role === 'seller' || session?.role === 'customer' ? session.role : null
  const [state, setState] = useState<'unknown' | 'first' | 'changed' | 'ok'>('unknown')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const check = useCallback(async () => {
    if (!role) return
    try {
      const accepted = role === 'seller'
        ? (await api.me()).seller.acceptedPolicies
        : (await api.customerMe()).customer.acceptedPolicies
      if (!needsPolicyAcceptance(accepted)) setState('ok')
      else setState(accepted ? 'changed' : 'first')
    } catch {
      // Offline or a server hiccup: never lock her out of her own shop over
      // it. The next time the layout mounts it asks again.
      setState('ok')
    }
  }, [role])

  useEffect(() => { void check() }, [check])

  const blocking = state === 'first' || state === 'changed'
  useEffect(() => { onBlockingChange?.(blocking) }, [blocking, onBlockingChange])

  if (!blocking || !role) return null

  async function agree() {
    setBusy(true)
    setErr('')
    try {
      await api.acceptPolicies()
      setState('ok')
    } catch (e) {
      setErr(e instanceof ApiError ? (e.messageMr ?? e.message) : t('legal.gateFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="gate" role="dialog" aria-modal="true" aria-labelledby="policy-gate-title">
      <div className="gate__inner stack">
        <div className="stack-sm">
          <h1 id="policy-gate-title" className="h2">{t('legal.gateTitle')}</h1>
          <p className="body">{t(state === 'changed' ? 'legal.gateChanged' : 'legal.gateFirst')}</p>
        </div>
        <ReadFirst docs={role === 'seller' ? SELLER_DOCS : BUYER_DOCS} />
        {err && <Notice tone="danger">{err}</Notice>}
        <Button onClick={agree} disabled={busy}>
          {busy ? t('common.loading') : t('legal.gateAgree')}
        </Button>
      </div>
    </div>
  )
}

/**
 * The way back to the policies from inside the app, on both profile screens.
 * Play expects the privacy policy to be reachable in the app, not only from
 * the store listing.
 */
export function PoliciesTile() {
  const t = useT()
  return (
    <Link className="tile" to={legalPath()}>
      <div className="tile__img" aria-hidden="true"><IconPolicy /></div>
      <div className="tile__body">
        <div className="tile__title">{t('legal.title')}</div>
        <div className="small dim">{t('legal.tileSub')}</div>
      </div>
      <span aria-hidden="true"><IconChevron /></span>
    </Link>
  )
}

/** The line under "Send OTP": what continuing means, with the two documents to read. */
export function ContinueNote() {
  const t = useT()
  const { lang } = useI18n()
  return (
    <p className="small dim" style={{ margin: 0 }}>
      {t('legal.continueNote')}{' '}
      <Link to={legalPath('terms')}>{legalDoc(lang, 'terms').title}</Link>
      {' · '}
      <Link to={legalPath('privacy')}>{legalDoc(lang, 'privacy').title}</Link>
    </p>
  )
}
