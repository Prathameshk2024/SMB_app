import { useState } from 'react'
import type { Order, PublicReview, RatingSummary, Review } from '@shared/types.js'
import {
  RATING_MAX, REVIEW_COMMENT_MAX, canReview, ratingWordKey, reviewProblem,
} from '@shared/review.js'
import { useT } from '../i18n/I18nProvider.js'
import { api, ApiError } from '../lib/api.js'
import { useToast } from '../store/ToastContext.js'
import { IconEdit, IconStar } from './icons.js'
import { Button, Card, Field, Notice, SectionTitle, VoiceInput } from './ui.js'

/**
 * FEEDBACK, ON EVERY SCREEN THAT SHOWS IT.
 *
 * Stars are never alone. Every row of them carries the number and a word -
 * "4 · चांगले" - because colour and shape are not a signal on their own, and
 * a woman reading her own rating should not have to count.
 */

/** Five stars, filled up to the rating. Decorative: the caller prints the words. */
export function Stars({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const filled = Math.round(rating)
  return (
    <span className={`stars stars--${size}`} aria-hidden="true">
      {Array.from({ length: RATING_MAX }, (_, i) => (
        <IconStar key={i} className={i < filled ? 'star star--on' : 'star'} />
      ))}
    </span>
  )
}

/** "★★★★☆ 4.3 · 12 अभिप्राय", or plainly that there are none yet. */
export function RatingLine({ average, count }: { average?: number; count?: number }) {
  const t = useT()
  if (!count) return <span className="small dim">{t('rev.none')}</span>
  return (
    <span className="rating-line">
      <Stars rating={average ?? 0} size="sm" />
      <strong className="num">{(average ?? 0).toFixed(1)}</strong>
      <span className="dim">· {count === 1 ? t('rev.countOne') : t('rev.count', { n: count })}</span>
    </span>
  )
}

/** The big number, and how the stars are spread - what a shop page opens its reviews with. */
export function RatingSummaryCard({ summary }: { summary: RatingSummary }) {
  const t = useT()
  if (summary.count === 0) {
    return <Card><p className="body muted">{t('rev.noneYet')}</p></Card>
  }
  return (
    <Card>
      <div className="rating-summary">
        <div className="rating-summary__big">
          <div className="hero-num">{summary.average.toFixed(1)}</div>
          <Stars rating={summary.average} />
          <div className="small dim">
            {summary.count === 1 ? t('rev.countOne') : t('rev.count', { n: summary.count })}
          </div>
        </div>
        <div className="rating-summary__bars">
          {[5, 4, 3, 2, 1].map((stars) => {
            const n = summary.byStars[stars - 1]
            return (
              <div key={stars} className="rating-bar">
                <span className="num small">{stars}</span>
                <IconStar aria-hidden="true" className="star star--on" />
                <span className="rating-bar__track">
                  <span
                    className="rating-bar__fill"
                    style={{ width: `${Math.round((n / summary.count) * 100)}%` }}
                  />
                </span>
                <span className="num small dim">{n}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  // en-IN on purpose: Latin digits, the way money and dates are printed here.
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** One buyer's review, as anybody reads it. */
export function ReviewItem({ review }: { review: PublicReview }) {
  const t = useT()
  return (
    <div className="review">
      <div className="row-between">
        <strong>{review.customerName || t('rev.anon')}</strong>
        <span className="tiny dim num">{shortDate(review.updatedAt ?? review.createdAt)}</span>
      </div>
      <div className="rating-line">
        <Stars rating={review.rating} size="sm" />
        <span className="small">
          <span className="num">{review.rating}</span> · {t(ratingWordKey(review.rating))}
        </span>
      </div>
      {review.comment && <p className="body review__text">{review.comment}</p>}
      {review.items.length > 0 && (
        <div className="tiny dim">{t('rev.bought')}: {review.items.map((i) => i.name).join(', ')}</div>
      )}
    </div>
  )
}

export function ReviewList({ reviews }: { reviews: PublicReview[] }) {
  return (
    <Card>
      <div className="review-list">
        {reviews.map((r) => <ReviewItem key={r.id} review={r} />)}
      </div>
    </Card>
  )
}

/**
 * Five big stars to tap. Each is a 48px button with its number under it, and
 * the word for the chosen one prints beneath the row - so the choice is read,
 * not guessed from how many shapes are gold.
 */
export function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const t = useT()
  return (
    <div className="stack-sm">
      <div className="star-picker" role="radiogroup" aria-label={t('rev.pickStars')}>
        {Array.from({ length: RATING_MAX }, (_, i) => {
          const n = i + 1
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={value === n}
              aria-label={`${n} · ${t(ratingWordKey(n))}`}
              className={`star-picker__btn ${n <= value ? 'star-picker__btn--on' : ''}`}
              onClick={() => onChange(n)}
            >
              <IconStar aria-hidden="true" className={n <= value ? 'star star--on' : 'star'} />
              <span className="num tiny">{n}</span>
            </button>
          )
        })}
      </div>
      <div className="center" style={{ fontWeight: 700 }} aria-live="polite">
        {value ? t(ratingWordKey(value)) : <span className="dim">{t('rev.tapStar')}</span>}
      </div>
    </div>
  )
}

/**
 * THE BUYER'S FEEDBACK ON THEIR OWN ORDER.
 *
 * Shown once the order is delivered. Three shapes:
 *  - nothing written yet, window open: the stars and a box, asking.
 *  - written: what they said, with "change" while the window is open.
 *  - taken down by an admin: what they said, and that it is not public.
 * Nothing at all once the window has closed on an order never reviewed - a
 * form that can only be refused is not worth the space.
 */
export function OrderReview({
  order, review, onSaved,
}: {
  order: Order
  review?: Review
  onSaved: (review: Review) => void
}) {
  const t = useT()
  const { toast } = useToast()
  const open = canReview(order)
  const [editing, setEditing] = useState(false)
  const [rating, setRating] = useState(review?.rating ?? 0)
  const [comment, setComment] = useState(review?.comment ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  if (order.status !== 'DELIVERED') return null
  if (!review && !open) return null

  if (review && !editing) {
    return (
      <div>
        <SectionTitle>{t('rev.yours')}</SectionTitle>
        <Card>
          <div className="stack-sm">
            {review.hidden && <Notice tone="warn">{t('rev.hiddenForYou')}</Notice>}
            <ReviewItem review={review} />
            {open && !review.hidden && (
              <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                <IconEdit aria-hidden="true" /> {t('rev.change')}
              </Button>
            )}
          </div>
        </Card>
      </div>
    )
  }

  async function submit() {
    setBusy(true)
    setErr('')
    try {
      const res = await api.reviewOrder(order.id, rating, comment.trim() || undefined)
      onSaved(res.review)
      setEditing(false)
      toast(t('rev.thanks'))
    } catch (e) {
      setErr(e instanceof ApiError ? (e.messageMr ?? e.message) : t('rev.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <SectionTitle>{t('rev.askTitle')}</SectionTitle>
      <Card className="notice--warn">
        <div className="stack">
          <p className="body">{t('rev.askSub')}</p>
          <StarPicker value={rating} onChange={(n) => { setRating(n); setErr('') }} />
          <Field label={t('rev.commentLabel')} hint={t('rev.commentHint', { n: REVIEW_COMMENT_MAX })}>
            <VoiceInput
              multiline
              value={comment}
              onChange={setComment}
              maxLength={REVIEW_COMMENT_MAX}
              placeholder={t('rev.commentPlaceholder')}
            />
          </Field>
          {err && <Notice tone="danger">{err}</Notice>}
          <div className="btn-row">
            {editing && (
              <Button
                variant="quiet"
                disabled={busy}
                onClick={() => {
                  setEditing(false)
                  setRating(review?.rating ?? 0)
                  setComment(review?.comment ?? '')
                  setErr('')
                }}
              >
                {t('rev.keepOld')}
              </Button>
            )}
            {/* Disabled until a star is chosen - the same check the server runs. */}
            <Button disabled={busy || reviewProblem(rating, comment) !== null} onClick={() => void submit()}>
              {busy ? t('common.loading') : t('rev.send')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  )
}
