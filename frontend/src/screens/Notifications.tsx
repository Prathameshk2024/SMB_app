import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useT } from '../i18n/I18nProvider.js'
import { useAuth } from '../store/AuthContext.js'
import { api } from '../lib/api.js'
import { adminFeed, buildFeed, markSeen, mergeFeeds } from '../lib/notifications.js'
import { STATUS_STYLE, statusLabelKey } from '@shared/orderFlow.js'
import {
  AppBar, Card, EmptyState, Loading, Pill, Rupees, useAsync,
} from '../components/ui.js'
import { IconBell, IconChevron } from '../components/icons.js'

/**
 * Everything that happened to her orders while she was not looking.
 *
 * ONE SCREEN FOR BOTH SIDES. A seller sees what her buyers did; a customer
 * sees what her seller did. The list is the same shape either way - an order,
 * a new state, a time - and writing it twice would be two places for the
 * wording to drift.
 *
 * Opening this screen marks everything read. Not each row: she has just been
 * shown the lot, and leaving a badge up after she has looked is the fastest
 * way to teach somebody to ignore a badge.
 */
export default function Notifications() {
  const t = useT()
  const nav = useNavigate()
  const { session } = useAuth()
  const [data, loading] = useAsync(() => api.myOrders(), [])
  /* Admin decisions live on her own seller record, so this is the same call
     every seller screen already makes - not a notifications endpoint. */
  const [meData] = useAsync(
    () => (session?.role === 'seller' ? api.me() : Promise.resolve(null)),
    [session?.role],
  )

  // No per-row "new" mark: the row already says where the order is, and a
  // second badge beside a status tag is two things competing to be the thing
  // she reads. The bell still counts what she has not seen - that is what a
  // badge is for, and this screen is what clears it.
  useEffect(() => {
    if (session && !loading) markSeen(session.userId)
  }, [session, loading])

  const feed = session
    ? mergeFeeds(buildFeed(data?.orders ?? [], session.role), adminFeed(meData?.seller))
    : []
  const orderPath = session?.role === 'seller' ? '/seller/orders' : '/shop/orders'

  return (
    <>
      <AppBar title={t('notif.title')} backTo={session?.role === 'seller' ? '/seller' : '/shop'} />
      <div className="screen stack-sm">
        {loading ? (
          <Loading />
        ) : feed.length === 0 ? (
          <Card>
            <EmptyState icon={IconBell} title={t('notif.none')} body={t('notif.noneSub')} />
          </Card>
        ) : (
          feed.map((n) => (
            <button
              key={n.id}
              className="tile"
              onClick={() => {
                const to = n.orderId ? `${orderPath}/${n.orderId}` : n.to
                if (to) nav(to)
              }}
            >
              <div className="tile__body">
                <div className="tile__title">
                  {/* An order is named after what is in it and wears its state
                      as a tag; an admin decision has no product, so it still
                      prints its own sentence. */}
                  {n.title ?? t(n.labelKey, n.vars)}
                  {n.status && (
                    <Pill
                      tone={STATUS_STYLE[n.status].tone}
                      icon={STATUS_STYLE[n.status].icon}
                    >
                      {t(statusLabelKey(n.status))}
                    </Pill>
                  )}
                </div>
                <div className="tile__meta">
                  {[n.who, n.orderId, when(n.at)].filter(Boolean).join(' · ')}
                </div>
              </div>
              {n.total != null && <div className="tile__price"><Rupees value={n.total} /></div>}
              <span aria-hidden="true"><IconChevron /></span>
            </button>
          ))
        )}
      </div>
    </>
  )
}

/** Date and time, in the phone's own locale settings. */
function when(iso: string): string {
  const d = new Date(iso)
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}
