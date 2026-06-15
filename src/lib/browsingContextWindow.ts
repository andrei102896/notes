/**
 * When the dashboard runs inside a same-origin `about:blank` iframe, `window` is
 * the iframe; the tab URL and navigation live on `window.top`.
 */
export function browsingContextWindowForTabUrl(): Window {
  try {
    const topWin = window.top;
    if (topWin !== null && topWin !== window) {
      if (typeof topWin.location?.href === "string") {
        return topWin;
      }
    }
  } catch {
    /* cross-origin top — fall back */
  }
  return window;
}
