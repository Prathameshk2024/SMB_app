import { useNavigate } from 'react-router-dom'
import { useI18n, useT } from '../i18n/I18nProvider.js'
import { api } from '../lib/api.js'
import { rupees } from '../lib/format.js'
import { TopBar } from '../components/Shell.js'
import {
  Card, EmptyState, ErrorNote, Loading, SectionTitle, useAsync,
} from '../components/ui.js'
import { IconAllClear } from '../components/icons.js'
import { Donut, RAMP_GREEN, RAMP_MAROON } from '../components/Donut.js'

/**
 * Opens on the queue, not the dashboard.
 *
 * Nobody signs into an admin console to admire a GMV figure. What needs doing
 * is gold and clickable; what is merely true sits quiet underneath. A woman
 * who has paid ₹50 cannot sell anything until one of these tiles is cleared,
 * which is why they come first.
 */
export function Today() {
  const t = useT()
  const nav = useNavigate()
  const { lang } = useI18n()
  const [data, loading, error] = useAsync(() => api.stats(), [])

  if (loading) return <><TopBar title={t('today.title')} /><Loading /></>
  if (error) return <><TopBar title={t('today.title')} /><div className="body"><ErrorNote error={error} /></div></>

  const s = data!.stats

  /**
   * The readiness bands come back as enum keys; their wording lives on the
   * server, next to the scoring that produces them, and rides along on the
   * same response. Translating them here would put two sources of truth on
   * the same five words.
   */
  const labels = data!.bandLabels as Record<string, { mr?: string; en?: string } | undefined>
  const bandLabel = (band: string) =>
    (lang === 'mr' ? labels[band]?.mr : labels[band]?.en) ?? band

  const queue = s.pendingPayments + s.pendingProducts + s.stuckOrders

  return (
    <>
      <TopBar title={t('today.title')} />
      <div className="body stack">

        <section>
          <SectionTitle>{t('today.needsYou')}</SectionTitle>
          {queue === 0 ? (
            <Card>
              <EmptyState icon={IconAllClear} title={t('today.allClear')} body={t('today.allClearSub')} />
            </Card>
          ) : (
            <div className="tiles">
              <ActionTile
                n={s.pendingPayments}
                label={t('today.pendingPayments')}
                onClick={() => nav('/payments')}
              />
              <ActionTile
                n={s.pendingProducts}
                label={t('today.pendingProducts')}
                onClick={() => nav('/products')}
              />
              <ActionTile
                n={s.stuckOrders}
                label={t('today.stuckOrders')}
                onClick={() => nav('/orders')}
              />
            </div>
          )}
        </section>

        <section>
          <SectionTitle>{t('today.health')}</SectionTitle>
          <div className="tiles">
            <Stat n={s.activeSellers} label={t('today.activeSellers')} />
            <Stat n={s.totalSellers} label={t('today.totalSellers')} />
            <Stat n={s.newRegistrations} label={t('today.newThisWeek')} />
            <Stat n={s.ordersToday} label={t('today.ordersToday')} />
            <Stat n={s.ordersWeek} label={t('today.ordersWeek')} />
            <Stat n={rupees(s.womenEarnedMonth)} label={t('today.earnedMonth')} />
            <Stat n={rupees(s.womenEarnedTotal)} label={t('today.earnedTotal')} />
            <Stat n={s.womenWithFirstEarning} label={t('today.firstEarning')} />
            {/* Admin income. Summed from APPROVED payment records, so it is
                what was actually taken - not a count times today's price. */}
            <Stat n={rupees(s.subscriptionRevenue)} label={t('today.income')} />
            <Stat n={s.approvedPaymentCount} label={t('today.paymentsApproved')} />
          </div>
        </section>

        <section>
          <SectionTitle>{t('today.growth')}</SectionTitle>
          <div className="chartgrid">
            {/* Both measures are already aggregated by /admin/stats, so these
                cost no extra request and no API change. */}
            <Card>
              <h3 className="chart__t">{t('today.earningSpread')}</h3>
              <p className="chart__d">{t('today.earningSpreadSub')}</p>
              <Donut
                slices={s.earningBands.map((b) => ({ label: b.label, value: b.v }))}
                ramp={RAMP_MAROON}
                centerLabel={t('today.sellersLabel')}
              />
            </Card>

            <Card>
              <h3 className="chart__t">{t('today.readinessSpread')}</h3>
              <p className="chart__d">{t('today.readinessSpreadSub')}</p>
              <Donut
                slices={s.readinessBands.map((b) => ({
                  label: bandLabel(b.band),
                  value: b.v,
                }))}
                ramp={RAMP_GREEN}
                centerLabel={t('today.sellersLabel')}
              />
            </Card>
          </div>
        </section>

        <section>
          <SectionTitle>{t('today.funnel')}</SectionTitle>
          <Card>
            <Funnel steps={s.funnel} />
          </Card>
        </section>

      </div>
    </>
  )
}

function ActionTile({ n, label, onClick }: { n: number; label: string; onClick: () => void }) {
  // A zero still shows, dimmed. Hiding it would make the row jump about as
  // items are cleared, and "nothing waiting" is information too.
  return (
    <button
      type="button"
      className={`tile ${n > 0 ? 'tile--action' : 'tile--zero'}`}
      onClick={onClick}
      disabled={n === 0}
    >
      <div className="tile__n">{n}</div>
      <div className="tile__l">{label}</div>
    </button>
  )
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="tile">
      <div className="tile__n">{n}</div>
      <div className="tile__l">{label}</div>
    </div>
  )
}

/**
 * Registered -> paid -> approved -> first product -> first order.
 *
 * The question this answers is not "how many at each stage" - the numbers on
 * the right say that - it is WHERE PEOPLE ARE LOST. So each bar is drawn as a
 * share of the FIRST stage, and the gap between two bars carries the drop-off
 * between them. That is the figure a programme manager reports, and it used to
 * require reading two bars and doing the arithmetic.
 *
 * One sequential ramp, light to dark, because the stages are ordered. The old
 * version painted four bars maroon and the last one gold, which read as a
 * status change rather than as the end of a sequence.
 *
 * A stage LARGER than the first is possible and is not hidden: payments are
 * counted per payment, so a woman who pays twice appears twice. The bar fills
 * the track and the share is still printed, so the anomaly is visible rather
 * than clipped into looking like a clean 100%.
 */
function Funnel({ steps }: { steps: { mr: string; en: string; v: number }[] }) {
  // The API sends both languages for these labels, so the console picks one
  // rather than translating - the wording stays owned by a single place.
  const { lang } = useI18n()
  const first = steps[0]?.v ?? 0

  return (
    <div className="funnel">
      {steps.map((step, i) => {
        const share = first > 0 ? step.v / first : 0
        const prev = i > 0 ? steps[i - 1]!.v : null
        const lost = prev !== null && prev > 0 ? prev - step.v : 0
        const lostPct = prev !== null && prev > 0 ? Math.round((lost / prev) * 100) : 0

        return (
          <div key={step.en} style={{ display: 'contents' }}>
            {i > 0 && (
              <div className={`funnel__drop ${lostPct >= 50 ? 'funnel__drop--bad' : ''}`}>
                {lost > 0 ? `- ${lost} (${lostPct}%)` : lost < 0 ? `+ ${-lost}` : '-'}
              </div>
            )}

            <div className="funnel__row">
              <div className="funnel__name">{lang === 'mr' ? step.mr : step.en}</div>
              <div className="funnel__track">
                <div
                  className={`funnel__fill ${share >= 1 ? 'funnel__fill--over' : ''}`}
                  style={{
                    width: `${Math.min(100, Math.round(share * 100))}%`,
                    background: RAMP_MAROON[
                      Math.round((i * (RAMP_MAROON.length - 1)) / Math.max(1, steps.length - 1))
                    ],
                  }}
                />
              </div>
              <div className="funnel__n">
                <span className="funnel__v">{step.v}</span>
                <span className="funnel__pct">{Math.round(share * 100)}%</span>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
