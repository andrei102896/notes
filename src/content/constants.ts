export const OVERLAY_SHELL_ID = "nn-scroll-bookmarks-overlay-shell";

export const LOADING_VEIL_ID = "nn-overlay-loading-veil";
/** Cold-restore blur window: ~1s hold + fade. No page loads faster, so it always covers the load-in. */
export const LOADING_VEIL_HOLD_MS = 1000;
export const LOADING_VEIL_FADE_MS = 300;

/** Sync paint-hint mirror of the open flag (per-origin sessionStorage); the background session stays authoritative. */
export const OPEN_HINT_SESSION_KEY = "__nn_open";

export const PENDING_ANCHOR_SCROLL_DELAY_MS = 200;
/** Upper bound when `scrollend` is missing or smooth scroll is still running. */
export const PENDING_ANCHOR_SCROLL_SETTLE_MS = 1500;

/** How often to check the extension is still installed (removes a stranded overlay). */
export const EXTENSION_CONTEXT_POLL_MS = 1500;
