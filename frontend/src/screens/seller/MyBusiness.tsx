import { useNavigate } from 'react-router-dom'
import type { Order } from '@shared/types.js'
import { needsSellerAction, STATUS_STYLE, statusLabelKey } from '@shared/orderFlow.js'
import { slotInfo } from '@shared/seller.js'
import { useT } from '../../i18n/I18nProvider.js'
import { api } from '../../lib/api.js'
import {
  AppBar, Button, Card, EmptyState, Loading, Notice,
  Pill, Rupees, SectionTitle, SlotMeter, useAsync,
} from '../../components/ui.js'
import {
  IconAllClear, IconBuyers, IconGrowth, IconOrders, IconPause, IconPlay,
  IconProduct, type IconType,
} from '../../components/icons.js'
import { PageTour } from '../../components/Walkthrough.js'

/**
 * My Business - the daily driver. The order of things on this screen is the
 * design: what needs doing, then what she has earned, then everything else.
 */
export default function MyBusiness() {
  const t = useT()
  const nav = useNavigate()

  const [me, loadingMe, setMe] = useAsync(() => api.me(), [])
  const [orderData, loadingOrders] = useAsync(() => api.myOrders(), [])
  const [productData, loadingProducts] = useAsync(() => api.myProducts(), [])

  if (loadingMe || loadingOrders || loadingProducts) {
    return (
      <>
        <AppBar brand title={t('biz.title')} />
        <div className="screen"><Loading /></div>
      </>
    )
  }
  if (!me) {
    return (
      <>
        <AppBar brand title={t('biz.title')} />
        <div className="screen"><EmptyState title="—" /></div>
      </>
    )
  }

  const seller = me.seller
  const orders = orderData?.orders ?? []
  const products = productData?.products ?? []
  const slots = slotInfo(seller, products)
  const actionable = orders.filter(needsSellerAction)

  // Earned today = orders actually DELIVERED today, read off the event trail
  // rather than the placed date. An order placed Monday and delivered
  // Wednesday is Wednesday's earnings.
  const isToday = (iso?: string) =>
    !!iso && new Date(iso).toDateString() === new Date().toDateString()

  const todayEarnings = orders
    .filter((o) => isToday(o.events.find((e) => e.to === 'DELIVERED')?.at))
    .reduce((n, o) => n + o.total, 0)

  const todayOrders = orders.filter((o) => isToday(o.placedAt)).length

  async function toggleShop() {
    const res = await api.updateMe({ isOpen: !seller.isOpen })
    setMe({ ...me!, seller: res.seller })
  }

  return (
    <>
      <AppBar
        brand
        title={seller.shopName}
        sub={`${seller.womenBizId} · ${seller.village}`}
      />

      <div className="screen stack">
        {/* First thing on the screen when it applies. Being blocked is not the
            same as waiting for approval and must not read like it: she is told
            plainly, given the admin's reason if there was one, and pointed at
            support rather than left to wonder why her shop went quiet. */}
        {seller.status === 'BLOCKED' && (
          <Notice tone="danger" title={t('biz.blockedTitle')}>
            <div>{t('biz.blockedBody')}</div>
            {seller.blockReason && (
              <div style={{ marginTop: 6 }}>
                <strong>{t('biz.blockedReason')}:</strong> {seller.blockReason}
              </div>
            )}
          </Notice>
        )}

        {/* Shop open toggle: one tap, right at the top. */}
        <Card className={seller.isOpen ? '' : 'notice--warn'} data-wt="biz-shop">
          <div className="row-between">
            <div className="stack-sm" style={{ gap: 2 }}>
              <strong>{seller.isOpen ? t('biz.shopOpen') : t('biz.shopClosed')}</strong>
              <span className="small dim">{t('biz.shopOpenHint')}</span>
            </div>
            <Button variant={seller.isOpen ? 'quiet' : 'primary'} size="sm" onClick={toggleShop}>
              {seller.isOpen ? <IconPause aria-hidden="true" /> : <IconPlay aria-hidden="true" />}
            </Button>
          </div>
        </Card>

        <Card data-wt="biz-slots">
          <SlotMeter
            used={slots.used}
            total={slots.total}
            hint={slots.isFull ? t('biz.slotsFull') : t('biz.slotsLeft', { n: slots.left })}
          />
          {slots.almostFull && (
            <div style={{ marginTop: 'var(--s3)' }}>
              <Notice tone="warn">{t('biz.oneSlotLeft')}</Notice>
            </div>
          )}
          {(slots.isFull || slots.total === 0) && (
            <div style={{ marginTop: 'var(--s3)' }}>
              <Button size="sm" onClick={() => nav('/seller/subscription')}>
                {t('biz.addSlots')}
              </Button>
            </div>
          )}
        </Card>

        <div className="row" style={{ gap: 'var(--s3)' }}>
          <Card className="grow">
            <div className="small dim">{t('biz.earnToday')}</div>
            <div className="hero-num" style={{ fontSize: 'var(--t-xl)' }}>
              <Rupees value={todayEarnings} />
            </div>
          </Card>
          <Card className="grow">
            <div className="small dim">{t('biz.ordersToday')}</div>
            <div className="hero-num num" style={{ fontSize: 'var(--t-xl)' }}>{todayOrders}</div>
          </Card>
        </div>

        {/* THE ACTION QUEUE - the most important widget in the app. */}
        <div data-wt="biz-action">
          <SectionTitle
            action={
              <button className="btn btn--quiet btn--sm" onClick={() => nav('/seller/orders')}>
                {t('common.viewAll')}
              </button>
            }
          >
            {t('biz.needsAction')}
          </SectionTitle>

          {actionable.length === 0 ? (
            <Card>
              <EmptyState icon={IconAllClear} title={t('biz.noAction')} body={t('biz.noActionSub')} />
            </Card>
          ) : (
            <div className="stack-sm">
              {actionable.map((o) => (
                <ActionRow key={o.id} order={o} onOpen={() => nav(`/seller/orders/${o.id}`)} />
              ))}
            </div>
          )}
        </div>

        <div className="pgrid pgrid--2" data-wt="biz-links">
          <QuickLink icon={IconProduct} label={t('biz.myProducts')} to="/seller/products" />
          <QuickLink icon={IconOrders} label={t('biz.myOrders')} to="/seller/orders" />
          <QuickLink icon={IconGrowth} label={t('biz.myGrowth')} to="/seller/growth" />
          <QuickLink icon={IconBuyers} label={t('buy.tile')} to="/seller/buyers" />
        </div>

        {seller.status !== 'ACTIVE' && seller.status !== 'BLOCKED' && (
          <Notice tone="warn" title={t('wait.sub')}>{t('wait.canDoMeanwhile')}</Notice>
        )}
      </div>

      <PageTour id="seller.business" />
    </>
  )
}

function QuickLink({ icon: Icon, label, to }: { icon: IconType; label: string; to: string }) {
  const nav = useNavigate()
  return (
    <button className="card card--tap" onClick={() => nav(to)} style={{ textAlign: 'center' }}>
      <div className="quicklink__icon" aria-hidden="true"><Icon /></div>
      <div style={{ fontWeight: 700, marginTop: 4 }}>{label}</div>
    </button>
  )
}

/**
 * A row in the action queue. It says what she must DO, not what state the
 * order is in - "Payment received?" beats "UPI_SUBMITTED".
 */
function ActionRow({ order, onOpen }: { order: Order; onOpen: () => void }) {
  const t = useT()
  const style = STATUS_STYLE[order.status]

  const awaitingPayment =
    order.paymentMode === 'UPI' && order.paymentStatus === 'UPI_SUBMITTED'

  const todo = awaitingPayment
    ? t('ord.paymentPending')
    : order.status === 'PLACED'
      ? t('ord.accept')
      : order.status === 'ACCEPTED'
        ? t('ord.markPacked')
        : order.status === 'PACKED'
          ? t('ord.markOut')
          : t('ord.markDelivered')

  return (
    <button className="tile" onClick={onOpen}>
      <div className="tile__img" aria-hidden="true">{style.icon}</div>
      <div className="tile__body">
        <div className="tile__title">{todo}</div>
        <div className="tile__meta">{order.id} · {order.customerName}</div>
        <div className="wrap-row" style={{ marginTop: 2 }}>
          <Pill tone={style.tone} icon={style.icon}>{t(statusLabelKey(order.status))}</Pill>
          <Pill tone="neutral">
            {order.paymentMode === 'COD' ? t('ord.paymentCod') : t('ord.paymentUpi')}
          </Pill>
        </div>
      </div>
      <div className="tile__price"><Rupees value={order.total} /></div>
    </button>
  )
}
