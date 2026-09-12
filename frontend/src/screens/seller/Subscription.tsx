import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { isValidUtr, normalizeUtr, utrProblem } from '@shared/payment.js'
import { useT } from '../../i18n/I18nProvider.js'
import { api, ApiError } from '../../lib/api.js'
import { useToast } from '../../store/ToastContext.js'
import QrCode from '../../components/QrCode.js'
import PhotoPicker from '../../components/PhotoPicker.js'
import {
  AppBar, Button, Card, EmptyState, Field, Loading, Notice,
  Rupees, TextInput, useAsync,
} from '../../components/ui.js'
import {
  IconCheck, IconTraining, IconWaiting, IconWarn,
  IconWhatsapp,
} from '../../components/icons.js'

/* ================================================================== */
/* Pay the 50 rupees. She pays the admin account from her own UPI app,  */
/* then types the reference number back in. No gateway.                 */
/* ================================================================== */

export function Subscription() {
  const t = useT()
  const { toast } = useToast()
  const nav = useNavigate()
  const [data, loading] = useAsync(() => api.subscription(), [])

  const [utr, setUtr] = useState('')
  const [shot, setShot] = useState<{ url: string; publicId: string } | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) {
    return <><AppBar title={t('pay.title')} backTo="/seller" /><div className="screen"><Loading /></div></>
  }
  if (!data) {
    return <><AppBar title={t('pay.title')} backTo="/seller" /><div className="screen"><Loading /></div></>
  }

  const { account, plan, slots, payments } = data

  /**
   * ALREADY PAID? THEN THERE IS NOTHING TO DO ON THIS SCREEN.
   *
   * A woman who has sent her UTR and comes back here sees a form asking for
   * money again, and the reasonable thing to do with a form is fill it in -
   * which puts a second ₹50 row in the admin queue for one payment. The
   * waiting screen answers the only question she actually has.
   */
  if (payments.some((p) => p.status === 'PENDING')) {
    return <Navigate to="/seller/waiting" replace />
  }

  /**
   * Slots left means nothing to buy. ₹50 buys 5 more; selling them to a woman
   * with three empty ones is taking money for something she already has. The
   * server refuses this too - the screen just says so first, and in Marathi.
   */
  if (slots.left > 0) {
    return (
      <>
        <AppBar title={t('pay.title')} backTo="/seller" />
        <div className="screen stack">
          <Card>
            <EmptyState
              icon={IconCheck}
              title={t('pay.notNeeded')}
              body={t('pay.notNeededSub', { n: slots.left })}
              action={<Button onClick={() => nav('/seller/upload')}>{t('prod.add')}</Button>}
            />
          </Card>
          <Button variant="ghost" onClick={() => nav('/seller/products')}>{t('biz.myProducts')}</Button>
        </div>
      </>
    )
  }

  async function submit() {
    const problem = utrProblem(utr)
    if (problem) {
      setErr(problem)
      return
    }
    setBusy(true)
    try {
      await api.submitPayment(normalizeUtr(utr), undefined, shot?.url)
      toast(t('ok.paymentSubmitted'))
      nav('/seller/waiting', { replace: true })
    } catch (e) {
      setErr(e instanceof ApiError ? (e.messageMr ?? e.message) : 'Network error')
    } finally {
      setBusy(false)
    }
  }

  const upiLink =
    `upi://pay?pa=${account.upiId}&pn=${encodeURIComponent(account.label)}` +
    `&am=${plan.price}.00&cu=INR&tn=${encodeURIComponent('Shantai Mahila Bazar')}`

  return (
    <>
      <AppBar title={t('pay.title')} backTo="/seller" />
      <div className="screen stack">
        <Card style={{ textAlign: 'center' }}>
          <div className="hero-num"><Rupees value={plan.price} /></div>
          <p className="muted" style={{ marginTop: 'var(--s2)' }}>{t('pay.what')}</p>
        </Card>

        <Card>
          <div className="section-title">{t('pay.payTo')}</div>
          <div className="stack-sm">
            <QrCode value={upiLink} size={200} label={t('pay.scanQr')} />
            <div className="center">
              <div className="small dim">{t('pay.upiId')}</div>
              <strong className="num">{account.upiId}</strong>
            </div>
            {/* No "pay now" link. It handed ₹50 to a UPI app in one tap, and
                the tap most likely to follow a successful payment is the back
                button - which returns here with no reference number captured
                and no record that anything was sent. Scanning the code above
                keeps her in the app that shows her the UTR she has to type. */}
            <div className="small dim center">
              {account.bankName} · A/C {account.accountNo} · {account.ifsc}
            </div>
          </div>
        </Card>

        <Card>
          <div className="section-title">{t('pay.afterPaying')}</div>
          <div className="stack">
            <Field label={t('pay.utr')} hint={t('pay.utrHint')} error={err} required htmlFor="utr">
              <TextInput
                id="utr"
                inputMode="numeric"
                value={utr}
                error={!!err}
                onChange={(e) => { setUtr(e.target.value.replace(/\s/g, '')); setErr('') }}
                placeholder="512309887711"
              />
            </Field>
            {/* This was a button that did nothing - it opened no picker and
                uploaded nowhere, so an admin checking a disputed ₹50 had only
                the typed number to go on. It is a real upload now, into the
                signed `payment` folder rather than among the product photos. */}
            <Field label={`${t('pay.screenshot')} (${t('common.optional')})`}>
              <PhotoPicker
                kind="payment"
                label={t('pay.screenshot')}
                imageUrl={shot?.url}
                onUploaded={setShot}
                onCleared={() => setShot(null)}
              />
            </Field>
          </div>
        </Card>

        <Button onClick={() => void submit()} disabled={busy || !isValidUtr(utr)}>
          {busy ? t('common.loading') : t('pay.submit')}
        </Button>
      </div>
    </>
  )
}

/* ================================================================== */
/* THE WAITING SCREEN                                                   */
/* A full screen, not a toast and not a banner she can miss. It answers  */
/* the only question she has: did my 50 rupees go through?              */
/* ================================================================== */

export function PaymentWaiting() {
  const t = useT()
  const nav = useNavigate()
  const [data, loading, setData] = useAsync(() => api.subscription(), [])

  /**
   * Poll while she is waiting.
   *
   * She is sitting on this screen precisely because she is waiting on someone
   * else, so the screen has to change by itself. Making her pull-to-refresh to
   * discover she was approved is the one interaction this audience will not
   * think to try. Ten seconds is frequent enough to feel immediate and light
   * enough for rural 4G, and it stops the moment she is approved or rejected.
   */
  const status = data?.status
  const settled = status === 'ACTIVE' || status === 'PAYMENT_REJECTED'

  useEffect(() => {
    if (loading || settled) return
    const id = setInterval(() => {
      api.subscription().then(setData).catch(() => {
        /* offline for a moment - the next tick will pick it up */
      })
    }, 10_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, settled])

  if (loading || !data) {
    return <div className="app-shell"><div className="screen"><Loading /></div></div>
  }

  const latest = data.payments[0]

  if (data.status === 'ACTIVE') {
    return (
      <div className="app-shell">
        <div className="screen screen--nonav stack center" style={{ justifyContent: 'center', minHeight: '100vh' }}>
          <div style={{ fontSize: '4rem' }} aria-hidden="true">🎉</div>
          <h1 className="h1">{t('wait.approved')}</h1>
          <p className="muted">{t('wait.approvedSub')}</p>
          <Button onClick={() => nav('/seller/upload', { replace: true })}>{t('wait.addFirst')}</Button>
          <Button variant="quiet" onClick={() => nav('/seller', { replace: true })}>{t('biz.title')}</Button>
        </div>
      </div>
    )
  }

  if (data.status === 'PAYMENT_REJECTED') {
    return (
      <div className="app-shell">
        <AppBar title={t('pay.title')} />
        <div className="screen screen--nonav stack">
          <div className="center stack-sm">
            <div className="bigstate bigstate--warn" aria-hidden="true"><IconWarn /></div>
            <h1 className="h1">{t('wait.rejected')}</h1>
          </div>
          {latest?.rejectReason && <Notice tone="danger">{latest.rejectReason}</Notice>}
          <Button onClick={() => nav('/seller/subscription')}>{t('wait.resubmit')}</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <AppBar title={t('pay.title')} />
      <div className="screen screen--nonav stack">
        <div className="center stack-sm" style={{ paddingTop: 'var(--s5)' }}>
          <div className="bigstate" aria-hidden="true"><IconWaiting /></div>
          <h1 className="h1">{t('wait.title')}</h1>
          <p className="h3" style={{ color: 'var(--ink-2)', fontWeight: 600 }}>{t('wait.sub')}</p>
        </div>

        <Notice tone="info">{t('wait.eta')}</Notice>

        {latest && (
          <Card>
            <div className="section-title">{t('wait.youSent')}</div>
            <div className="stack-sm">
              <div className="row-between">
                <span className="dim">{t('pay.title')}</span>
                <strong><Rupees value={latest.amount} /></strong>
              </div>
              <div className="row-between">
                <span className="dim">{t('pay.utr')}</span>
                <strong className="num">{latest.utr}</strong>
              </div>
              <div className="row-between">
                <span className="dim">{t('common.today')}</span>
                <span className="num">
                  {new Date(latest.submittedAt).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
          </Card>
        )}

        <p className="muted small">{t('wait.canDoMeanwhile')}</p>

        <div className="btn-row">
          <Button variant="ghost" onClick={() => nav('/seller/help')}><IconTraining aria-hidden="true" /> {t('wait.watchTraining')}</Button>
          <Button variant="ghost" onClick={() => nav('/seller/help')}><IconWhatsapp aria-hidden="true" /> {t('wait.contactHelp')}</Button>
        </div>
        <Button variant="quiet" onClick={() => nav('/seller')}>{t('biz.title')}</Button>
      </div>
    </div>
  )
}
