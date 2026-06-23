/** In the same-origin `about:blank` iframe, `window` is the iframe; tab URL/navigation live on `window.top`. */
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
