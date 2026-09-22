/**
 * THE LAST ANSWER A SCREEN GOT, SO COMING BACK SHOWS THE SCREEN SHE LEFT.
 *
 * Every screen fetches its own data, so pressing Back used to mean: spinner,
 * then the list, then a jump down to where she had been reading. Three frames
 * to arrive somewhere she never left. Keeping the previous answer means the
 * list is on screen in the first frame, at its full height, and the scroll
 * goes back before the browser paints - so Back looks like nothing happened,
 * which is what Back is.
 *
 * It is a cache for the NEXT paint, not a data store: every screen still
 * fetches on mount and replaces this the moment the server answers. Nothing
 * is written to disk - stale prices must not outlive the tab.
 *
 * Cleared on the way out of a session. On a field coordinator's phone, where
 * one handset signs in as seller after seller, a cached "my products" from
 * the previous woman is somebody else's shop.
 */
const answers = new Map<string, unknown>()

/** Enough for the screens one browsing session touches, and no more. */
const LIMIT = 40

export function readCache<T>(key: string): T | undefined {
  return answers.get(key) as T | undefined
}

export function writeCache<T>(key: string, data: T): void {
  // Oldest out first: a Map keeps insertion order, and re-writing a key moves
  // it to the end, so the entries she keeps returning to are the ones kept.
  answers.delete(key)
  answers.set(key, data)
  if (answers.size > LIMIT) answers.delete(answers.keys().next().value!)
}

/**
 * Forget one screen's last answer. Used when its refetch fails: what is on
 * screen stays (blanking a list she is reading helps nobody), but the next
 * visit starts from the server rather than from an answer we already know is
 * questionable - a product taken down, a session that has gone.
 */
export function dropCache(key: string): void {
  answers.delete(key)
}

export function clearScreenCache(): void {
  answers.clear()
}
