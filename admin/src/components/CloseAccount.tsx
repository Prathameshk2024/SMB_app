import { useState } from 'react'
import { ADMIN_CLOSE_CHANNELS, ADMIN_CLOSE_NOTE_MAX, type AdminCloseChannel } from '@shared/accountClose.js'
import { useT } from '../i18n/I18nProvider.js'
import { ApiError, api, type AdminCloseBody } from '../lib/api.js'
import { Confirm, useConfirm } from './Confirm.js'
import { Button, Card, SectionTitle, useErrorText } from './ui.js'
import { useToast } from '../store/ToastContext.js'

/**
 * CLOSING AN ACCOUNT FOR SOMEBODY WHO CANNOT SIGN IN.
 *
 * The public deletion page promises that a lost phone or a missing OTP does
 * not trap anyone in an account: phone, WhatsApp or email the desk. These are
 * the desk's tools for keeping that promise. The server insists on the same
 * three things this form asks for (adminCloseProblem): how the request came,
 * that someone rang the REGISTERED number back and heard her confirm, and -
 * for a seller - her last four digits typed.
 */

export interface CloseFieldsValue {
  channel: AdminCloseChannel | ''
  verified: boolean
  note: string
}

export const EMPTY_CLOSE: CloseFieldsValue = { channel: '', verified: false, note: '' }

/** What the server needs, or null while the form cannot be sent yet. */
export function closeBody(v: CloseFieldsValue): AdminCloseBody | null {
  if (!v.channel || !v.verified) return null
  return { channel: v.channel, verified: true, note: v.note.trim() || undefined }
}

export function CloseFields({ value, onChange }: { value: CloseFieldsValue; onChange: (v: CloseFieldsValue) => void }) {
  const t = useT()
  return (
    <div className="stack-sm" style={{ marginTop: 10 }}>
      <div>
        <div className="field__l">{t('ac.channel')}</div>
        <div className="row wrap" style={{ gap: 6 }}>
          {ADMIN_CLOSE_CHANNELS.map((ch) => (
            <button
              key={ch}
              type="button"
              className={`packbtn ${value.channel === ch ? 'packbtn--on' : ''}`}
              onClick={() => onChange({ ...value, channel: ch })}
            >
              {t(`ac.channel.${ch}`)}
            </button>
          ))}
        </div>
      </div>

      <label className="verify__item">
        <input
          type="checkbox"
          checked={value.verified}
          onChange={() => onChange({ ...value, verified: !value.verified })}
        />
        <span>{t('ac.verified')}</span>
      </label>

      <div>
        <label className="field__l">{t('ac.note')}</label>
        <input
          className="input"
          value={value.note}
          maxLength={ADMIN_CLOSE_NOTE_MAX}
          onChange={(e) => onChange({ ...value, note: e.target.value })}
        />
      </div>
    </div>
  )
}

/** Open orders, named, instead of a bare "refused": the desk can go and chase them. */
export function openOrdersText(e: unknown, t: (k: string, v?: Record<string, string | number>) => string): string | null {
  const orders = e instanceof ApiError ? e.openOrders : undefined
  if (!orders?.length) return null
  return t('ac.openOrders', { list: orders.map((o) => `${o.id} (${o.status})`).join(', ') })
}

/**
 * A buyer has no page in the console - she is her phone number - so her
 * account is closed from here, by the number the desk types.
 */
export function BuyerCloseCard() {
  const t = useT()
  const errorText = useErrorText()
  const { toast } = useToast()
  const c = useConfirm()
  const [phone, setPhone] = useState('')
  const [fields, setFields] = useState<CloseFieldsValue>(EMPTY_CLOSE)

  function reset() {
    setPhone('')
    setFields(EMPTY_CLOSE)
    c.close()
  }

  async function run() {
    const body = closeBody(fields)
    if (!body) {
      c.setError(t('ac.incomplete'))
      return
    }
    c.setBusy(true)
    c.setError('')
    try {
      const res = await api.closeCustomer({ ...body, phone })
      toast(t('ac.buyerClosed', { n: res.ordersCleared }))
      reset()
    } catch (e) {
      c.setError(openOrdersText(e, t) ?? errorText(e))
    } finally {
      c.setBusy(false)
    }
  }

  return (
    <Card>
      <SectionTitle>{t('ac.buyerTitle')}</SectionTitle>
      <p className="small dim" style={{ marginTop: 0 }}>{t('ac.buyerSub')}</p>
      {!c.open && (
        <Button variant="quiet" small onClick={c.ask}>{t('ac.buyerOpen')}</Button>
      )}
      <Confirm
        open={c.open}
        title={t('ac.buyerConfirmTitle')}
        description={t('ac.buyerConfirmDesc')}
        confirmLabel={t('ac.buyerConfirm')}
        tone="danger"
        busy={c.busy}
        error={c.error}
        onCancel={reset}
        onConfirm={() => void run()}
      >
        <div style={{ marginTop: 10 }}>
          <label className="field__l">{t('ac.buyerPhone')}</label>
          <input
            className="input mono"
            inputMode="numeric"
            maxLength={10}
            value={phone}
            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          />
        </div>
        <CloseFields value={fields} onChange={setFields} />
      </Confirm>
    </Card>
  )
}
