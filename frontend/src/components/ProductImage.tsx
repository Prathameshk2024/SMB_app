import { useEffect, useState } from 'react'
import { categoryPhoto } from '../lib/categoryPhoto.js'
import { imageCache } from '../lib/imageCache.js'
import { cloudinaryThumb } from '../lib/upload.js'

/**
 * A product image that reads through the LRU cache.
 *
 * Products currently carry an emoji rather than a photo, so `src` is usually
 * absent and we render the emoji. The moment real photos land - Capacitor
 * Camera on the seller side, object storage behind it - passing `src` is all
 * that is needed; every list and detail screen already uses this component.
 *
 * If a cached image was evicted, or the fetch fails, it falls back to the
 * emoji rather than showing a broken frame. Eviction is never a visible error.
 */
export default function ProductImage({
  src,
  emoji,
  categoryId,
  size,
  rounded = 'var(--r-sm)',
  className,
}: {
  src?: string
  emoji: string
  /** The seller's category, so a listing with no photo borrows the category's. */
  categoryId?: string
  /** Square side in px. Omit to fill the parent (used by the 1:1 card top). */
  size?: number
  rounded?: string
  className?: string
}) {
  // Ask Cloudinary for the exact rendered size rather than the 1200px master.
  // A 150px card pulling a 1200px file wastes ~95% of the bytes, and this is
  // also the cache key, so each size is cached separately and correctly.
  const wanted = src ? cloudinaryThumb(src, (size ?? 400) * 2) : undefined

  // Start from the cache so an already-seen image paints on the first frame
  // with no flash and no request.
  const [url, setUrl] = useState<string | undefined>(() =>
    wanted ? imageCache.peek(wanted) : undefined,
  )
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!wanted) return
    const cached = imageCache.peek(wanted)
    if (cached) {
      setUrl(cached)
      return
    }

    let alive = true
    setFailed(false)
    imageCache
      .load(wanted)
      .then((objectUrl) => alive && setUrl(objectUrl))
      .catch(() => alive && setFailed(true))
    return () => {
      alive = false
    }
  }, [wanted])

  const box: React.CSSProperties = size
    ? { width: size, height: size, borderRadius: rounded }
    : { width: '100%', aspectRatio: '1', borderRadius: rounded }

  if (!src || failed || !url) {
    // A photograph of the seller's category beats an emoji, and it is a
    // bundled asset, so it needs no cache, no request and cannot itself fail
    // to load.
    const stockPhoto = categoryPhoto(categoryId)
    if (stockPhoto) {
      return (
        <img
          className={className}
          src={stockPhoto}
          alt=""
          loading="lazy"
          decoding="async"
          style={{ ...box, objectFit: 'cover' }}
        />
      )
    }

    return (
      <div
        className={className}
        style={{
          ...box,
          background: 'var(--gold-soft)',
          display: 'grid',
          placeItems: 'center',
          fontSize: size ? Math.round(size * 0.42) : '2.4rem',
          overflow: 'hidden',
        }}
        aria-hidden="true"
      >
        {emoji}
      </div>
    )
  }

  return (
    <img
      className={className}
      src={url}
      alt=""
      loading="lazy"
      decoding="async"
      style={{ ...box, objectFit: 'cover' }}
      onError={() => setFailed(true)}
    />
  )
}
