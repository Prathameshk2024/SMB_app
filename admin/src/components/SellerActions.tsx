import { useState } from 'react'
import type { SellerStatus } from '@shared/types.js'
import { PLAN } from '@shared/seller.js'
import { UNDO_DAYS } from '@shared/accountClose.js'
import { useT } from '../i18n/I18nProvider.js'
import { api, type SellerRow } from '../lib/api.js'
import { Confirm, PackPicker, useConfirm } from './Confirm.js'
import { Button, Pill, useErrorText } from './ui.js'
import { CloseFields, EMPTY_CLOSE, closeBody, openOrdersText, type CloseFieldsValue } from './CloseAccount.js'

/**
 * The three things an admin may do to a woman's account, in one place.
 *
 * They are offered from two screens - her row in the register and her own
 * page - and the dialogs are the whole safeguard: each states what changes
 * for her tomorrow and waits for a second click. Two copies of that would
 * drift, and the copy that drifts is the one that stops saying "her products
 * will disappear from the app".
 */
type Action = 'grant' | 'revoke' | 'block' | 'close' | 'restore' | null

export function SellerActions({
  seller, onDone,
}: {
  seller: SellerRow
  onDone: () => void
}) {
  const t = useT()
  const errorText = useErrorText()
  const c = useConfirm()

  const [action, setAction] = useState<Action>(null)
  const [packs, setPacks] = useState(1)
  const [blockReason, setBlockReason] = useState('')
  const [closeFields, setCloseFields] = useState<CloseFieldsValue>(EMPTY_CLOSE)
  const [digits, setDigits] = useState('')

  const blocked = seller.status === 'BLOCKED'
  /** Inside the seven days: still undoable. */
  const closing = seller.status === 'CLOSED' && !!seller.closingAt
  /** Erased: nothing left to act on. */
  const closedForGood = seller.status === 'CLOSED' && !seller.closingAt
  const used = seller.slots?.used ?? 0
  const slotsPerPack = PLAN.slotsPerPack

  function ask(next: Exclude<Action, null>) {
    setAction(next)
    setPacks(1)
    setBlockReason('')
    setCloseFields(EMPTY_CLOSE)
    setDigits('')
    c.ask()
  }

  function close() {
    setAction(null)
    c.close()
  }

  async function run(fn: () => Promise<unknown>) {
    c.setBusy(true)
    c.setError('')
    try {
      await fn()
      close()
      onDone()
    } catch (e) {
      // Stays open on failure: the server refuses a revoke that would drop her
      // below the slots she is using, and that message is the whole point.
      c.setError(openOrdersText(e, t) ?? errorText(e))
    } finally {
      c.setBusy(false)
    }
  }

  return (
    <>
      <div className="row wrap">
        <Button variant="quiet" small disabled={c.open} onClick={() => ask('grant')}>
          + {t('se.grantSlots')}
        </Button>
        <Button variant="quiet" small disabled={c.open} onClick={() => ask('revoke')}>
          − {t('se.revoke')}
        </Button>
        <Button
          variant={blocked ? 'ok' : 'danger'}
          small
          disabled={c.open || closedForGood}
          onClick={() => ask('block')}
        >
          {blocked ? t('se.unblock') : t('se.block')}
        </Button>
        {/* Deleting on her behalf, for the woman who asked by phone or email
            and cannot sign in. Once closing, the only action is to undo it. */}
        {closing ? (
          <Button variant="ok" small disabled={c.open} onClick={() => ask('restore')}>
            {t('ac.restore')}
          </Button>
        ) : !closedForGood && (
          <Button variant="danger" small disabled={c.open} onClick={() => ask('close')}>
            {t('ac.sellerOpen')}
          </Button>
        )}
      </div>

      {/* ---- close on her behalf ---- */}
      <Confirm
        open={c.open && action === 'close'}
        title={t('ac.sellerConfirmTitle')}
        description={t('ac.sellerConfirmDesc', { days: UNDO_DAYS })}
        confirmLabel={t('ac.sellerConfirm')}
        tone="danger"
        busy={c.busy}
        error={c.error}
        onCancel={close}
        onConfirm={() => {
          const body = closeBody(closeFields)
          if (!body || digits.length !== 4) {
            c.setError(t('ac.incomplete'))
            return
          }
          void run(() => api.closeSeller(seller.id, { ...body, confirm: digits }))
        }}
      >
        <CloseFields value={closeFields} onChange={setCloseFields} />
        <div style={{ marginTop: 10 }}>
          <label className="field__l">{t('ac.digits')}</label>
          <input
            className="input mono"
            inputMode="numeric"
            maxLength={4}
            style={{ maxWidth: 120 }}
            value={digits}
            onChange={(e) => setDigits(e.target.value.replace(/\D/g, ''))}
          />
        </div>
      </Confirm>

      {/* ---- undo inside the week ---- */}
      <Confirm
        open={c.open && action === 'restore'}
        title={t('ac.restoreTitle')}
        description={t('ac.restoreDesc')}
        confirmLabel={t('ac.restore')}
        busy={c.busy}
        error={c.error}
        onCancel={close}
        onConfirm={() => void run(() => api.restoreSeller(seller.id))}
      />

      {/* ---- grant ---- */}
      <Confirm
        open={c.open && action === 'grant'}
        title={t('se.grantTitle')}
        description={t('se.grantDesc', { n: packs, slots: packs * slotsPerPack })}
        confirmLabel={t('se.grantConfirm')}
        busy={c.busy}
        error={c.error}
        onCancel={close}
        onConfirm={() => void run(() => api.grantSlots(seller.id, packs))}
      >
        <PackPicker value={packs} onChange={setPacks} />
      </Confirm>

      {/* ---- revoke ---- */}
      <Confirm
        open={c.open && action === 'revoke'}
        title={seller.packsApproved > 0 ? t('se.revokeTitle') : t('se.revokeNoneTitle')}
        description={
          seller.packsApproved > 0
            ? t('se.revokeDesc', { n: packs, slots: packs * slotsPerPack, used })
            : t('se.revokeNoneDesc')
        }
        confirmLabel={t('se.revokeConfirm')}
        tone="danger"
        busy={c.busy}
        error={c.error}
        onCancel={close}
        onConfirm={() => void run(() => api.revokeSlots(seller.id, packs))}
      >
        {seller.packsApproved > 0 && (
          <PackPicker value={packs} onChange={setPacks} max={seller.packsApproved} />
        )}
      </Confirm>

      {/* ---- block / unblock ---- */}
      <Confirm
        open={c.open && action === 'block'}
        title={blocked ? t('se.unblockTitle') : t('se.blockTitle')}
        description={blocked ? t('se.unblockDesc') : t('se.blockDesc')}
        confirmLabel={blocked ? t('se.unblockConfirmBtn') : t('se.blockConfirmBtn')}
        tone={blocked ? 'primary' : 'danger'}
        busy={c.busy}
        error={c.error}
        onCancel={close}
        onConfirm={() => void run(() => api.blockSeller(seller.id, !blocked, blockReason.trim()))}
      >
        {!blocked && (
          <div style={{ marginTop: 10 }}>
            <label className="field__l">{t('se.blockReason')}</label>
            <textarea
              className="textarea"
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
            />
          </div>
        )}
      </Confirm>
    </>
  )
}

export function StatusPill({ status }: { status: SellerStatus }) {
  const t = useT()
  const tone =
    status === 'ACTIVE' ? 'ok'
      : status === 'PAYMENT_SUBMITTED' ? 'warn'
        : status === 'BLOCKED' || status === 'PAYMENT_REJECTED' ? 'danger'
          : 'neutral'
  return <Pill tone={tone}>{t(`st.${status}`)}</Pill>
}
