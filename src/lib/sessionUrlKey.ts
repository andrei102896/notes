/**
 * Stable storage key for the current page, derived from the tab URL.
 * Uses the URL constructor so encoding and trivial differences normalize.
 */
export function sessionUrlKey(href: string): string {
  try {
    return new URL(href).href;
  } catch {
    return href;
  }
}
