export const OVERLAY_SHELL_ID = "nn-scroll-bookmarks-overlay-shell";

/** Cold restore waits for the panel's first painted frame before sliding in; this bounds that wait so a slow or throttled page can never strand it off-screen. */
export const PANEL_REVEAL_CAP_MS = 700;

/** Sync paint-hint mirror of the open flag (per-origin sessionStorage); the background session stays authoritative. */
export const OPEN_HINT_SESSION_KEY = "__nn_open";

export const PENDING_ANCHOR_SCROLL_DELAY_MS = 200;
/** Upper bound when `scrollend` is missing or smooth scroll is still running. */
export const PENDING_ANCHOR_SCROLL_SETTLE_MS = 1500;

/** How often to check the extension is still installed (removes a stranded overlay). */
export const EXTENSION_CONTEXT_POLL_MS = 1500;
