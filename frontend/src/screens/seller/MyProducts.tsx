import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Product } from '@shared/types.js'
import { PRODUCT_STATUS_STYLE } from '@shared/seller.js'
import { REJECT_GRACE_HOURS, hoursUntilRemoval } from '@shared/moderation.js'
import { useT } from '../../i18n/I18nProvider.js'
import { api } from '../../lib/api.js'
import { useToast } from '../../store/ToastContext.js'
import ProductImage from '../../components/ProductImage.js'
import {
  AppBar, Button, Card, ConfirmSheet, EmptyState, Loading, Notice,
  Pill, Rupees, SlotMeter, useAsync,
} from '../../components/ui.js'
import {
  IconEdit, IconPause, IconPlay, IconPlus, IconProduct, IconTrash,
} from '../../components/icons.js'

export default function MyProducts() {
  const t = useT()
  const nav = useNavigate()
  const { toast } = useToast()
  const [data, loading, setData] = useAsync(() => api.myProducts(), [])
  const [toArchive, setToArchive] = useState<Product | null>(null)

  if (loading) {
    return <><AppBar title={t('biz.myProducts')} backTo="/seller" /><div className="screen"><Loading /></div></>
  }
  if (!data) {
    return <><AppBar title={t('biz.myProducts')} backTo="/seller" /><div className="screen"><EmptyState title="—" /></div></>
  }

  const { products, slots } = data

  async function togglePause(p: Product) {
    const res = await api.updateProduct(p.id, {
      status: p.status === 'PAUSED' ? 'LIVE' : 'PAUSED',
    })
    setData({ ...data!, products: products.map((x) => (x.id === res.product.id ? res.product : x)) })
    toast(t('ok.productUpdated'))
  }

  async function doArchive() {
    if (!toArchive) return
    const res = await api.archiveProduct(toArchive.id)
    setData({ products: products.filter((x) => x.id !== toArchive.id), slots: res.slots })
    setToArchive(null)
    toast(t('ok.productRemoved'))
  }

  return (
    <>
      <AppBar title={t('biz.myProducts')} backTo="/seller" />
      <div className="screen stack">
        <Card>
          <SlotMeter
            used={slots.used}
            total={slots.total}
            hint={slots.isFull ? t('biz.slotsFull') : t('biz.slotsLeft', { n: slots.left })}
          />
        </Card>

        {products.length === 0 ? (
          <Card>
            {/* No action here: the same button sits in the bar below, on every
                branch of this screen. Two of it, one above the other, made the
                lower one look like a different thing. */}
            <EmptyState
              icon={IconProduct}
              title={t('prod.noProducts')}
              body={t('prod.noProductsSub')}
            />
          </Card>
        ) : (
          <div className="stack-sm">
            {products.map((p) => {
              const style = p.status !== 'ARCHIVED' ? PRODUCT_STATUS_STYLE[p.status] : null
              const outOfStock = !p.madeToOrder && p.stock === 0
              return (
                <Card key={p.id}>
                  {/* The whole row is the way in to editing. A seller who
                      wants to fix a price taps the product, not a pencil the
                      size of a fingernail beside it. */}
                  <button
                    type="button"
                    className="tile-tap"
                    onClick={() => nav(`/seller/products/${p.id}/edit`)}
                  >
                    <ProductImage
                      src={p.imageUrl}
                      emoji={p.emoji}
                      categoryId={p.categoryId}
                      size={62}
                      className="tile__img"
                    />
                    <div className="tile__body">
                      <div className="tile__title">{p.name}</div>
                      <div className="row" style={{ gap: 6 }}>
                        <strong><Rupees value={p.price} /></strong>
                        <span className="small dim">/ {t(`unit.${p.unit}`)}</span>
                      </div>
                      <div className="wrap-row" style={{ marginTop: 4 }}>
                        {style && <Pill tone={style.tone} icon={style.icon}>{t(style.labelKey)}</Pill>}
                        <Pill tone={outOfStock ? 'danger' : 'neutral'}>
                          {outOfStock
                            ? t('prod.outOfStock')
                            : p.madeToOrder
                              ? t('prod.madeToOrder')
                              : `${t('prod.inStock')}: ${p.stock}`}
                        </Pill>
                      </div>
                    </div>
                    <span className="tile-tap__go" aria-hidden="true"><IconEdit /></span>
                  </button>

                  {/* Rejected is not deleted. She reads why, and how long the
                      listing stays before it removes itself - so a product
                      disappearing is something she was told about first. */}
                  {p.status === 'REJECTED' && (
                    <div style={{ marginTop: 'var(--s3)' }}>
                      <Notice tone="danger" title={t('prod.rejected')}>
                        {p.rejectReason}
                        <div className="small" style={{ marginTop: 4 }}>
                          {hoursUntilRemoval(p) == null
                            ? t('prod.rejectedRemoval', { n: REJECT_GRACE_HOURS })
                            : t('prod.rejectedRemovalIn', { n: hoursUntilRemoval(p)! })}
                        </div>
                      </Notice>
                    </div>
                  )}

                  <div className="btn-row" style={{ marginTop: 'var(--s3)' }}>
                    {(p.status === 'LIVE' || p.status === 'PAUSED') && (
                      <Button variant="quiet" size="sm" onClick={() => void togglePause(p)}>
                        {p.status === 'PAUSED' ? <IconPlay aria-hidden="true" /> : <IconPause aria-hidden="true" />}
                      </Button>
                    )}
                    <Button
                      variant="quiet"
                      size="sm"
                      onClick={() => nav(`/seller/products/${p.id}/edit`)}
                    >
                      <IconEdit aria-hidden="true" /> {t('common.edit')}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setToArchive(p)}>
                      <IconTrash aria-hidden="true" /> {t('prod.archive')}
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        <Button onClick={() => nav('/seller/upload')} disabled={slots.isFull}>
          <IconPlus aria-hidden="true" /> {t('prod.add')}
        </Button>
        {slots.isFull && (
          <Notice tone="warn" title={t('prod.slotsFullTitle')}>{t('prod.slotsFullBody')}</Notice>
        )}
      </div>

      {/* Spells out the consequence, never a bare "Are you sure?" */}
      <ConfirmSheet
        open={!!toArchive}
        title={toArchive?.name ?? ''}
        body={t('prod.archiveConfirm')}
        confirmLabel={t('prod.archive')}
        tone="danger"
        onCancel={() => setToArchive(null)}
        onConfirm={() => void doArchive()}
      />
    </>
  )
}
