import { useT } from '../../i18n/I18nProvider.js'
import { api } from '../../lib/api.js'
import { AppBar, Card, EmptyState, Loading, Notice, useAsync } from '../../components/ui.js'
import { RatingSummaryCard, ReviewList } from '../../components/Reviews.js'
import { IconStar } from '../../components/icons.js'

/**
 * WHAT HER BUYERS SAID.
 *
 * Exactly the list a customer reads on her shop page - no more, no less - so
 * nothing she finds there is a surprise. She cannot reply or remove anything:
 * a review a seller could delete would be worth nothing to the next buyer. If
 * one is abusive, the admin can take it down, and the line under the list
 * says who to ask.
 */
export function SellerReviews() {
  const t = useT()
  const [data, loading] = useAsync(() => api.myReviews(), [])

  return (
    <>
      <AppBar title={t('rev.title')} backTo="/seller" />
      <div className="screen stack">
        {loading ? (
          <Loading />
        ) : !data || data.summary.count === 0 ? (
          <Card>
            <EmptyState icon={IconStar} title={t('rev.sellerEmpty')} body={t('rev.sellerEmptySub')} />
          </Card>
        ) : (
          <>
            <RatingSummaryCard summary={data.summary} />
            <ReviewList reviews={data.reviews} />
            <Notice tone="info">{t('rev.sellerHelp')}</Notice>
          </>
        )}
      </div>
    </>
  )
}
