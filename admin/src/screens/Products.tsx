import { useState } from 'react'
import { useT } from '../i18n/I18nProvider.js'
import { IconProducts } from '../components/icons.js'
import { REJECT_GRACE_HOURS, hoursUntilRemoval } from '@shared/moderation.js'
import { api, type ProductRow } from '../lib/api.js'
import { rupees } from '../lib/format.js'
import { TopBar } from '../components/Shell.js'
import {
  Button, Card, EmptyState, ErrorNote, Field, Loading, Notice, Pill,
  useAsync, useErrorText,
} from '../components/ui.js'

type Tab = 'PENDING' | 'LIVE' | 'REJECTED'

/**
 * Moderation is mostly looking, so the photo leads.
 *
 * There is no review queue here, and that is deliberate. A seller publishes her
 * own listing the moment she finishes the wizard - nothing is ever created
 * PENDING - so a "to review" tab was permanently empty and a Publish button
 * had nothing it could ever apply to. What this screen does is the other
 * direction: take a live listing down, with a reason she reads, and put one
 * back if it was taken down in error.
 */
export function Products() {
  const t = useT()
  const [tab, setTab] = useState<Tab>('PENDING')
  const [data, loading, error, reload] = useAsync(() => api.products(tab), [tab])

  const rows = data?.products ?? []

  return (
    <>
      <TopBar title={t('pr.title')} />
      <div className="body stack">
        <div className="row wrap">
          <Button small variant={tab === 'PENDING' ? 'primary' : 'quiet'} onClick={() => setTab('PENDING')}>
            {t('pr.pendingTab')}
          </Button>
          <Button small variant={tab === 'LIVE' ? 'primary' : 'quiet'} onClick={() => setTab('LIVE')}>
            {t('pr.liveTab')}
          </Button>
          <Button small variant={tab === 'REJECTED' ? 'primary' : 'quiet'} onClick={() => setTab('REJECTED')}>
            {t('pr.rejectedTab')}
          </Button>
        </div>

        <ErrorNote error={error} />

        {loading ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Card><EmptyState icon={IconProducts} title={t('pr.empty')} body={t('pr.emptySub')} /></Card>
        ) : (
          <div className="stack-sm">
            {rows.map((p) => <ProductCard key={p.id} product={p} onDone={reload} />)}
          </div>
        )}
      </div>
    </>
  )
}

/**
 * One listing, with whatever action its status allows.
 *
 * Exported because her own page shows the same listings, and the take-down
 * flow - a reason she reads, and 48 hours in which it can be undone - must be
 * the same one in both places. A second copy is a second thing to keep in
 * step, and the half that falls behind is the half that stops explaining
 * itself.
 */
export function ProductCard({ product, onDone }: { product: ProductRow; onDone: () => void }) {
  const t = useT()
  const errorText = useErrorText()

  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const [reasonErr, setReasonErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  /**
   * Taking a live listing down IS a rejection: it carries a reason she can
   * read and it removes itself 48 hours later. That replaced the delete
   * button, which removed the product on the spot and told her nothing.
   */
  /**
   * Nothing a seller writes reaches a shopper until it is published here. She
   * submits, this screen decides - and a refusal carries a reason she reads in
   * her own app, because "it never appeared" is the one outcome she cannot act
   * on.
   */
  const pending = product.status === 'PENDING'
  const live = product.status === 'LIVE'
  const rejected = product.status === 'REJECTED'

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setErr('')
    try {
      await action()
      onDone()
    } catch (e) {
      setErr(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  function reject() {
    if (!reason.trim()) {
      setReasonErr(t('c.required'))
      return
    }
    void run(() => api.moderateProduct(product.id, false, reason.trim()))
  }

  return (
    <Card>
      <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
        <ProductThumb product={product} />

        <div className="grow">
          <div className="row wrap" style={{ gap: 8 }}>
            {/* Her words, rendered exactly as she wrote them. */}
            <span className="strong">{product.name}</span>
            {product.isFood && <Pill tone="info">{t('pr.food')}</Pill>}
            {pending && <Pill tone="warn">{t('pr.pendingTab')}</Pill>}
            {product.status === 'LIVE' && <Pill tone="ok">{t('pr.liveTab')}</Pill>}
            {product.status === 'REJECTED' && <Pill tone="danger">{t('pr.rejectedTab')}</Pill>}
          </div>

          <div className="small dim">
            {rupees(product.price)}
            {product.seller && <> · {t('pr.by')}: {product.seller.name}</>}
          </div>

          {product.rejectReason && (
            <div className="small" style={{ color: 'var(--danger)' }}>
              {t('c.reason')}: {product.rejectReason}
            </div>
          )}

          {/* Rejecting does not delete. Saying when it does is what stops an
              admin going looking for a delete button that no longer exists. */}
          {product.status === 'REJECTED' && (
            <div className="small dim-2">
              {hoursUntilRemoval(product) == null
                ? t('pr.removalWindow', { n: REJECT_GRACE_HOURS })
                : t('pr.removalIn', { n: hoursUntilRemoval(product)! })}
            </div>
          )}
        </div>

        {(pending || live) && !rejecting && (
          <div className="row">
            {pending && (
              <Button
                variant="ok"
                small
                disabled={busy}
                onClick={() => void run(() => api.moderateProduct(product.id, true))}
              >
                {t('pr.publish')}
              </Button>
            )}
            <Button variant="danger" small disabled={busy} onClick={() => setRejecting(true)}>
              {pending ? t('pr.reject') : t('pr.takeDown')}
            </Button>
          </div>
        )}

        {/* Within the 48 hours a take-down can be undone - which is the other
            reason rejection beats deletion: a mistake is recoverable. */}
        {rejected && (
          <Button
            variant="ok"
            small
            disabled={busy}
            onClick={() => void run(() => api.moderateProduct(product.id, true))}
          >
            {t('pr.restore')}
          </Button>
        )}
      </div>


      {rejecting && (
        <div className="stack-sm" style={{ marginTop: 12 }}>
          <Field label={t('pr.rejectReason')} error={reasonErr}>
            <textarea
              className="textarea"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setReasonErr('') }}
              placeholder={t('pr.rejectReasonHint')}
            />
          </Field>
          <div className="small dim-2">{t('pr.rejectReasonHint')}</div>
          {/* The consequence, spelled out at the moment of the decision. */}
          <div className="small dim-2">{t('pr.removalWindow', { n: REJECT_GRACE_HOURS })}</div>
          <div className="row">
            <Button variant="danger" small disabled={busy} onClick={reject}>{t('pr.reject')}</Button>
            <Button variant="quiet" small disabled={busy} onClick={() => setRejecting(false)}>
              {t('c.cancel')}
            </Button>
          </div>
        </div>
      )}

      {err && <div style={{ marginTop: 10 }}><Notice tone="danger">{err}</Notice></div>}
    </Card>
  )
}

/**
 * Cloudinary photo when there is one, her chosen emoji when there is not -
 * the seller app falls back the same way when image uploads are switched off.
 */
function ProductThumb({ product }: { product: ProductRow }) {
  const box: React.CSSProperties = {
    width: 64, height: 64, flex: 'none',
    borderRadius: 'var(--r)', border: '1px solid var(--line)',
    background: 'var(--surface-2)', objectFit: 'cover',
    display: 'grid', placeItems: 'center', fontSize: 28,
  }

  if (product.imageUrl) {
    return <img src={product.imageUrl} alt="" style={box} loading="lazy" />
  }
  return <div style={box} aria-hidden="true">{product.emoji || '📦'}</div>
}
