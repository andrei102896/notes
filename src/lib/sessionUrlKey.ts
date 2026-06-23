/** Stable per-page storage key derived from the tab URL; the URL constructor normalizes encoding and trivial differences. */
export function sessionUrlKey(href: string): string {
  try {
    return new URL(href).href;
  } catch {
    return href;
  }
}
