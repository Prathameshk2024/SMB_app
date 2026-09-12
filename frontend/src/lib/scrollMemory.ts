/**
 * WHERE SHE WAS READING, PER HISTORY ENTRY.
 *
 * Forward navigation should start at the top and backward navigation should
 * not - a product page opens at its own beginning, and the catalogue she came
 * from opens where she left it. One `window.scrollTo(0, 0)` on every route
 * change gets the first half right and the second half exactly wrong: thirty
 * swipes back down to the product she was looking at, on a phone, which is how
 * a shopper learns not to browse past the first screenful.
 *
 * Keyed on the history entry rather than the path, because the same screen
 * reached twice is two different places she was reading.
 *
 * In memory only, and deliberately: a scroll position is worth nothing after
 * the tab closes, and writing one to storage on every scroll event would be
 * the most frequent write in the app.
 */
const positions = new Map<string, number>()

export function rememberScroll(key: string, y: number): void {
  positions.set(key, y)
}

/** Anywhere she has not been is the top. */
export function recallScroll(key: string): number {
  return positions.get(key) ?? 0
}

export function forgetScroll(key: string): void {
  positions.delete(key)
}
