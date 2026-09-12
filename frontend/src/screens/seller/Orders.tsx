import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { Order, OrderStatus } from '@shared/types.js'
import {
  HAPPY_PATH, SELLER_ACTIONS, STATUS_STYLE, awaitingPaymentConfirmation,
  statusLabelKey, stepIndex, type SellerAction,
} from '@shared/orderFlow.js'
import { useT } from '../../i18n/I18nProvider.js'
import { api, ApiError } from '../../lib/api.js'
import { useToast } from '../../store/ToastContext.js'
import {
  AppBar, Button, Card, Choice, ConfirmSheet, EmptyState,
  Loading, Notice, Pill, Rupees, useAsync,
} from '../../components/ui.js'
import { IconCall, IconCheck, IconMap, IconOrders } from '../../components/icons.js'

const TABS: { id: string; labelKey: string; statuses?: OrderStatus[] }[] = [
  { id: 'action', labelKey: 'biz.needsAction' },
  // ACCEPTED, PACKED and OUT_FOR_DELIVERY are one tab: from her side they are
  // the same order, in hand and not yet delivered. Splitting them gave three
  // tabs that were each empty most of the time.
  { id: 'accepted', labelKey: 'ord.accepted', statuses: ['ACCEPTED', 'PACKED', 'OUT_FOR_DELIVERY'] },
  { id: 'done', labelKey: 'ord.delivered', statuses: ['DELIVERED'] },
  { id: 'cancelled', labelKey: 'ord.cancelled', statuses: ['REJECTED', 'CANCELLED'] },
]

export function SellerOrders() {
  const t = useT()
  const nav = useNavigate()
  const [tab, setTab] = useState('action')
  const [data, loading] = useAsync(() => api.myOrders(), [])

  const orders = data?.orders ?? []
  const list = orders.filter((o) => {
    if (tab === 'action') {
      return (
        SELLER_ACTIONS[o.status].length > 0 ||
        (o.paymentMode === 'UPI' && o.paymentStatus === 'UPI_SUBMITTED')
      )
    }
    return TABS.find((x) => x.id === tab)?.statuses?.includes(o.status) ?? false
  })

  return (
    <>
      <AppBar title={t('biz.myOrders')} backTo="/seller" />
      <div className="hscroll" style={{ padding: 'var(--s3) var(--s4)', margin: 0 }}>
        {TABS.map((tb) => (
          <button
            key={tb.id}
            className={`chip ${tab === tb.id ? 'chip--on' : ''}`}
            onClick={() => setTab(tb.id)}
          >
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div className="screen stack-sm" style={{ paddingTop: 0 }}>
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <Card><EmptyState icon={IconOrders} title={t('ord.noOrders')} body={t('ord.noOrdersSub')} /></Card>
        ) : (
          list.map((o) => (
            <button key={o.id} className="tile" onClick={() => nav(`/seller/orders/${o.id}`)}>
              <div className="tile__img" aria-hidden="true">{STATUS_STYLE[o.status].icon}</div>
              <div className="tile__body">
                <div className="tile__title">{o.customerName}</div>
                <div className="tile__meta">{o.id} · {o.items.length} {t('ord.items')}</div>
                <div className="wrap-row" style={{ marginTop: 2 }}>
                  <Pill tone={STATUS_STYLE[o.status].tone} icon={STATUS_STYLE[o.status].icon}>
                    {t(statusLabelKey(o.status))}
                  </Pill>
                </div>
              </div>
              <div className="tile__price"><Rupees value={o.total} /></div>
            </button>
          ))
        )}
      </div>
    </>
  )
}

/* ================================================================== */
/* Order detail - where the state machine actually runs                */
/* ================================================================== */

export function SellerOrderDetail() {
  const { orderId } = useParams()
  const t = useT()
  const { toast } = useToast()
  const [data, loading, setData] = useAsync(() => api.order(orderId!), [orderId])

  const [confirm, setConfirm] = useState<SellerAction | null>(null)
  const [actionErr, setActionErr] = useState('')
  const [rejectOpen, setRejectOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return <><AppBar title={t('ord.order')} backTo="/seller/orders" /><div className="screen"><Loading /></div></>
  }
  if (!data) {
    return <><AppBar title={t('ord.order')} backTo="/seller/orders" /><div className="screen"><EmptyState title="—" /></div></>
  }

  const order = data.order
  /**
   * The seller may ACCEPT an order they have not been paid for - that is the
   * point of paying after acceptance - but they do not PACK one. The server
   * refuses it too; hiding the button is what stops their finding that out by
   * being told no.
   */
  const unpaid = awaitingPaymentConfirmation(order)
  const actions = SELLER_ACTIONS[order.status].filter((a) => !(a.to === 'PACKED' && unpaid))
  const awaitingUpi = order.paymentMode === 'UPI' && order.paymentStatus === 'UPI_SUBMITTED'
  const waitingForBuyer = order.paymentMode === 'UPI' && order.paymentStatus === 'UPI_PENDING'
  const style = STATUS_STYLE[order.status]

  async function run(action: SellerAction, extra?: { reason?: string }) {
    setBusy(true)
    setActionErr('')
    try {
      const res = await api.advanceOrder(order.id, action.to, extra)
      setData({ ...data!, order: res.order })
      setRejectOpen(false)
      // Names the state she just moved it to, not a generic "saved" - the
      // whole doubt on this screen is which step the order is on now.
      toast(`${t('ok.orderUpdated')}: ${t(statusLabelKey(res.order.status))}`)
    } catch (e) {
      if (e instanceof ApiError) setActionErr(e.messageMr ?? e.message)
    } finally {
      setBusy(false)
    }
  }

  async function confirmPayment() {
    setBusy(true)
    const res = await api.confirmPayment(order.id)
    setData({ ...data!, order: res.order })
    toast(t('ok.paymentConfirmed'))
    setBusy(false)
  }

  return (
    <>
      <AppBar
        title={`${t('ord.order')} ${order.id}`}
        backTo="/seller/orders"
      />

      <div className="screen stack">
        <div className="row-between">
          <Pill tone={style.tone} icon={style.icon}>{t(statusLabelKey(order.status))}</Pill>
          <strong style={{ fontSize: 'var(--t-lg)' }}><Rupees value={order.total} /></strong>
        </div>

        {/* The seller is being asked to deliver somewhere they have not listed, so the
            question is put in front of them before Accept. */}
        {order.outsideArea && (
          <Notice tone="warn" title={t('ord.outsideArea')}>
            {t('ord.outsideAreaSub', { pincode: order.pincode })}
          </Notice>
        )}

        {/* Accepted, and the buyer has not paid yet. Nothing for the seller to do
            but wait - and know that is what they are waiting for. */}
        {waitingForBuyer && order.status === 'ACCEPTED' && (
          <Notice tone="warn" title={t('ord.awaitingBuyer')}>{t('ord.awaitingBuyerSub')}</Notice>
        )}

        {waitingForBuyer && order.status === 'PLACED' && (
          <Notice tone="info">{t('ord.payAfterAccept')}</Notice>
        )}

        {awaitingUpi && (
          <Card className="notice--warn">
            <div className="stack-sm">
              <strong>{t('ord.paymentPending')}</strong>
              <div className="small muted">UTR: <span className="num">{order.paymentUtr}</span></div>
              <Button onClick={confirmPayment} disabled={busy}><IconCheck aria-hidden="true" /> {t('ord.paymentGot')}</Button>
            </div>
          </Card>
        )}
        {order.paymentStatus === 'UPI_CONFIRMED' && (
          <Notice tone="ok"><IconCheck aria-hidden="true" /> {t('ord.paymentDone')} · UPI</Notice>
        )}
        {order.paymentMode === 'COD' && (
          <Notice tone="info">{t('ord.paymentCod')} · <Rupees value={order.total} /></Notice>
        )}

        <Card>
          <div className="stack-sm">
            {order.items.map((i) => (
              <div key={i.productId} className="row-between">
                <div className="row">
                  <span aria-hidden="true" style={{ fontSize: '1.5rem' }}>{i.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600 }}>{i.name}</div>
                    <div className="small dim num">{i.qty} × ₹{i.price}</div>
                  </div>
                </div>
                <Rupees value={i.qty * i.price} />
              </div>
            ))}
            <hr className="divider" style={{ margin: 'var(--s2) 0' }} />
            <div className="row-between small">
              <span className="dim">{t('cus.deliveryFee')}</span>
              <Rupees value={order.deliveryFee} />
            </div>
            <div className="row-between">
              <strong>{t('ord.total')}</strong>
              <strong><Rupees value={order.total} /></strong>
            </div>
          </div>
        </Card>

        <Card>
          <div className="stack-sm">
            <div className="section-title">{t('ord.customer')}</div>
            <strong>{order.customerName}</strong>
            <div className="small muted">{order.address}</div>
            {order.landmark && <div className="small dim">{order.landmark}</div>}
            <div className="small dim num">{order.pincode}</div>
            <div className="btn-row" style={{ marginTop: 'var(--s2)' }}>
              <a className="btn btn--ghost btn--sm" href={`tel:${order.customerPhone}`}>
                <IconCall aria-hidden="true" /> {t('ord.callCustomer')}
              </a>
              <a
                className="btn btn--ghost btn--sm"
                href={`https://maps.google.com/?q=${encodeURIComponent(order.address)}`}
                target="_blank"
                rel="noreferrer"
              >
                <IconMap aria-hidden="true" /> {t('ord.openMap')}
              </a>
            </div>
          </div>
        </Card>

        <Card>
          <div className="section-title">{t('cus.trackOrder')}</div>
          <Timeline order={order} />
        </Card>

        {actionErr && <Notice tone="danger">{actionErr}</Notice>}

        {actions.length > 0 && (
          <div className="actionbar">
            {actions.map((a) => (
              <Button
                key={a.to}
                variant={a.tone === 'ghost' ? 'ghost' : 'primary'}
                disabled={busy}
                onClick={() => {
                  if (a.needsReason) setRejectOpen(true)
                  else if (a.confirmKey) setConfirm(a)
                  else void run(a)
                }}
              >
                {t(a.labelKey)}
              </Button>
            ))}
          </div>
        )}
      </div>

      <ConfirmSheet
        open={!!confirm}
        title={confirm ? t(confirm.confirmKey!) : ''}
        body={confirm?.confirmSubKey ? t(confirm.confirmSubKey) : ''}
        confirmLabel={confirm ? t(confirm.labelKey) : ''}
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          const a = confirm!
          setConfirm(null)
          void run(a)
        }}
      />

      {rejectOpen && (
        <div className="sheet-backdrop" onClick={() => setRejectOpen(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <div className="stack">
              <h2 className="h2">{t('ord.rejectReason')}</h2>
              <div className="stack-sm">
                {['ord.reasonStock', 'ord.reasonArea', 'ord.reasonClosed'].map((k) => (
                  <Choice
                    key={k}
                    selected={false}
                    onSelect={() =>
                      void run(
                        { to: 'REJECTED', labelKey: 'ord.reject', tone: 'ghost', needsReason: true },
                        { reason: t(k) },
                      )
                    }
                    title={t(k)}
                  />
                ))}
              </div>
              <Button variant="quiet" onClick={() => setRejectOpen(false)}>{t('common.cancel')}</Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** Draws the locked six-state happy path with the order's real timestamps. */
export function Timeline({ order }: { order: Order }) {
  const t = useT()
  const current = stepIndex(order.status)

  return (
    <div className="timeline">
      {HAPPY_PATH.map((s, i) => {
        const at = order.events.find((e) => e.to === s)?.at
        const cls = i < current ? 'tl--done' : i === current ? 'tl--now' : 'tl--todo'
        return (
          <div key={s} className={`tl ${cls}`}>
            <div className="tl__dot" aria-hidden="true">
              {i < current ? <IconCheck aria-hidden="true" /> : i === current ? STATUS_STYLE[s].icon : ''}
            </div>
            <div>
              <div className="tl__label">{t(statusLabelKey(s))}</div>
              {at && (
                <div className="tl__time">
                  {new Date(at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                  })}
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
