/**
 * LRU CACHE FOR PRODUCT IMAGES
 * ============================
 * Product photos come from object storage, and every render that re-fetches
 * one is a paid read plus a download on a rural connection. This keeps the
 * recently-seen images in memory as blob URLs so a scroll back up the list, or
 * a return from a product page, costs nothing.
 *
 * Capacity differs by role because the two apps browse differently:
 *   SELLER   10 - she has at most a handful of her own products
 *   CUSTOMER 20 - she scrolls a catalog across many sellers
 *
 * Eviction is strict LRU: reading an entry marks it most-recently-used, and
 * the least-recently-used is dropped when the cache is full. A dropped image
 * is simply re-fetched on next view, so eviction can never break rendering.
 *
 * Cache keys include the URL exactly as stored. When a seller replaces a photo
 * the storage URL changes (new object name / new token), so the old entry is
 * never served for a new image. `invalidate()` covers the case where a URL is
 * reused deliberately.
 */

export type CacheRole = 'seller' | 'customer'

export const CACHE_LIMITS: Record<CacheRole, number> = {
  seller: 10,
  customer: 20,
}

interface Entry {
  /** Object URL for the cached blob. */
  objectUrl: string
  /** In-flight fetch, so two components asking at once make one request. */
  loading?: Promise<string>
  bytes: number
}

class LruImageCache {
  /** A Map keeps insertion order, which is exactly the LRU order we need. */
  private map = new Map<string, Entry>()
  private limit: number

  constructor(limit: number) {
    this.limit = limit
  }

  setLimit(limit: number): void {
    this.limit = limit
    this.evictIfNeeded()
  }

  get size(): number {
    return this.map.size
  }

  /** Peek without changing recency - used by components to render instantly. */
  peek(url: string): string | undefined {
    return this.map.get(url)?.objectUrl
  }

  private touch(url: string, entry: Entry): void {
    // Re-inserting moves the key to the end: most recently used.
    this.map.delete(url)
    this.map.set(url, entry)
  }

  private evictIfNeeded(): void {
    while (this.map.size > this.limit) {
      // The first key in insertion order is the least recently used.
      const oldest = this.map.keys().next()
      if (oldest.done) break
      const entry = this.map.get(oldest.value)
      if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl)
      this.map.delete(oldest.value)
    }
  }

  /**
   * Return a displayable URL for `url`, fetching and caching it if needed.
   * Concurrent callers for the same URL share one network request.
   */
  async load(url: string): Promise<string> {
    const hit = this.map.get(url)
    if (hit) {
      this.touch(url, hit)
      return hit.loading ?? hit.objectUrl
    }

    const entry: Entry = { objectUrl: '', bytes: 0 }
    const loading = (async () => {
      const res = await fetch(url, { cache: 'force-cache' })
      if (!res.ok) throw new Error(`image ${res.status}`)
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      entry.objectUrl = objectUrl
      entry.bytes = blob.size
      entry.loading = undefined
      return objectUrl
    })()

    entry.loading = loading
    this.map.set(url, entry)
    this.evictIfNeeded()

    try {
      return await loading
    } catch (err) {
      // A failed fetch must not occupy a slot.
      this.map.delete(url)
      throw err
    }
  }

  /** Drop one URL - call when a product photo is replaced in place. */
  invalidate(url: string): void {
    const entry = this.map.get(url)
    if (entry?.objectUrl) URL.revokeObjectURL(entry.objectUrl)
    this.map.delete(url)
  }

  clear(): void {
    for (const entry of this.map.values()) {
      if (entry.objectUrl) URL.revokeObjectURL(entry.objectUrl)
    }
    this.map.clear()
  }

  /** Ordered least- to most-recently-used. Used by the debug readout. */
  keys(): string[] {
    return [...this.map.keys()]
  }
}

/**
 * One cache per app. The role is set once the session is known, which is when
 * we learn whether to hold 10 images or 20.
 */
export const imageCache = new LruImageCache(CACHE_LIMITS.customer)

export function configureImageCache(role: CacheRole): void {
  imageCache.setLimit(CACHE_LIMITS[role])
}
