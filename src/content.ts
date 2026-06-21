import React from "react";

import { createRoot, type Root } from "react-dom/client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  PENDING_ANCHOR_SESSION_KEY,
  claimPendingOverlay,
  clearPendingAnchorState,
  pendingAnchorStorageKeysForUrl,
  purgeOrphanPendingAnchorKeys,
} from "@/lib/pendingNavigation";
import { getTabSession, patchTabSession } from "@/lib/tabSession";
import {
  registerContentPanelHost,
  scrollToAnchorInPage,
} from "@/messaging/contentPanelBridge";
import { App } from "@/overlay/App";
import overlayCss from "@/overlay/styles.css?inline";

/**
 * Radix's a11y check reads the host doc, not our iframe dialogs — false positive.
 * Filter only those two messages.
 */
function suppressRadixCrossRealmDialogWarnings(): void {
  const SUPPRESS_FLAG = "__nnRadixDialogWarningsSuppressed";
  const flags = window as unknown as Record<string, boolean>;
  if (flags[SUPPRESS_FLAG]) {
    return;
  }
  flags[SUPPRESS_FLAG] = true;

  const FALSE_POSITIVES = [
    "`DialogContent` requires a `DialogTitle`",
    "Missing `Description` or `aria-describedby={undefined}`",
  ];
  const isRadixFalsePositive = (args: unknown[]): boolean =>
    typeof args[0] === "string" &&
    FALSE_POSITIVES.some((message) => (args[0] as string).includes(message));

  const originalError = console.error;
  console.error = (...args: unknown[]): void => {
    if (isRadixFalsePositive(args)) {
      return;
    }
    originalError(...args);
  };

  const originalWarn = console.warn;
  console.warn = (...args: unknown[]): void => {
    if (isRadixFalsePositive(args)) {
      return;
    }
    originalWarn(...args);
  };
}

/**
 * Dev-only: CRXJS's HMR client (vendor/crx-client-port.js) keeps posting to the
 * runtime port from content scripts orphaned by an extension reload, flooding the
 * page console with "Extension context invalidated". This is harmless dev noise
 * (absent from production builds); swallow only that message so real errors stay
 * visible. Existing orphaned tabs clear on the next page reload.
 */
function suppressExtensionContextInvalidatedDevErrors(): void {
  const matches = (text: unknown): boolean =>
    typeof text === "string" && text.includes("Extension context invalidated");

  window.addEventListener(
    "error",
    (event) => {
      const errorMessage =
        event.error instanceof Error ? event.error.message : undefined;
      if (matches(event.message) || matches(errorMessage)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : reason;
    if (matches(message)) {
      event.preventDefault();
    }
  });
}

suppressRadixCrossRealmDialogWarnings();

if (import.meta.env.DEV) {
  suppressExtensionContextInvalidatedDevErrors();
}

registerContentPanelHost();

/**
 * Panel sizing calibration (the one source of truth). At REFERENCE_VIEWPORT_PX the panel is
 * REFERENCE_PANEL_WIDTH_PX wide and the iframe root font-size is BASE_ROOT_FONT_PX, so every
 * design px renders 1:1. Width scales proportionally with the viewport; the iframe root
 * font-size is the single "knob" the rem-based overlay UI rides. Clamps bind only on very
 * small / very large viewports.
 */
const REFERENCE_PANEL_WIDTH_PX = 686;
const REFERENCE_VIEWPORT_PX = 1920;
const PANEL_MIN_WIDTH_PX = 480;
const PANEL_MAX_WIDTH_PX = 860;
const BASE_ROOT_FONT_PX = 16;

const OVERLAY_SHELL_ID = "nn-scroll-bookmarks-overlay-shell";

const LOADING_VEIL_ID = "nn-overlay-loading-veil";
/** Cold-restore blur window: ~1s hold + fade. No page loads faster, so it always covers the load-in. */
const LOADING_VEIL_HOLD_MS = 1000;
const LOADING_VEIL_FADE_MS = 300;

/**
 * Synchronously-readable mirror of the per-tab open flag, in the page's
 * `sessionStorage` (tab-scoped, per-origin, survives same-origin navigation). A paint
 * hint only — the background tab session stays authoritative (see `initTabSessionOverlay`).
 */
const OPEN_HINT_SESSION_KEY = "__nn_open";

function writeOpenHint(open: boolean): void {
  try {
    if (open) {
      window.sessionStorage.setItem(OPEN_HINT_SESSION_KEY, "1");
    } else {
      window.sessionStorage.removeItem(OPEN_HINT_SESSION_KEY);
    }
  } catch {
    // sessionStorage can throw (sandboxed/partitioned contexts, storage disabled).
  }
}

function readOpenHint(): boolean {
  try {
    return window.sessionStorage.getItem(OPEN_HINT_SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

const PENDING_ANCHOR_SCROLL_DELAY_MS = 200;
/** Upper bound when `scrollend` is missing or smooth scroll is still running. */
const PENDING_ANCHOR_SCROLL_SETTLE_MS = 1500;

/**
 * Resolves when the current pending anchor scroll finishes (or immediately if
 * there is no pending scroll).  Used by `showOverlayWhenReady` to defer the
 * overlay open until the page has scrolled to position.
 *
 * Created eagerly by `initPendingAnchorScroll` so that `showOverlayWhenReady`
 * called shortly after always waits on the correct promise.
 */
let anchorScrollDonePromise: Promise<void> = Promise.resolve();
let resolveAnchorScrollDone: (() => void) | null = null;

function executePendingAnchorScroll(anchor: unknown): boolean {
  if (
    typeof anchor !== "object" ||
    anchor === null ||
    typeof (anchor as Record<string, unknown>).scrollX !== "number" ||
    typeof (anchor as Record<string, unknown>).scrollY !== "number"
  ) {
    return false;
  }
  const payload = anchor as {
    elementSelector: string;
    scrollX: number;
    scrollY: number;
    pageX: number;
    pageY: number;
  };
  if (!payload.elementSelector) {
    restoreScroll(payload.scrollY);
  } else {
    scrollToAnchorInPage(payload);
  }
  return true;
}

function whenScrollSettled(onSettled: () => void): void {
  let settled = false;
  const finish = (): void => {
    if (settled) {
      return;
    }
    settled = true;
    window.removeEventListener("scrollend", finish);
    window.clearTimeout(fallbackTimer);
    onSettled();
  };

  window.addEventListener("scrollend", finish, { once: true });
  const fallbackTimer = window.setTimeout(finish, PENDING_ANCHOR_SCROLL_SETTLE_MS);
}

function markAnchorScrollDone(): void {
  if (resolveAnchorScrollDone) {
    resolveAnchorScrollDone();
    resolveAnchorScrollDone = null;
  }
}

function finishPendingAnchorNavigation(): void {
  clearPendingAnchorState(window, window.location.href);
  purgeOrphanPendingAnchorKeys();
  markAnchorScrollDone();
}

function schedulePendingAnchorScroll(anchor: unknown): void {
  window.setTimeout(() => {
    const didScroll = executePendingAnchorScroll(anchor);
    if (!didScroll) {
      finishPendingAnchorNavigation();
      return;
    }
    whenScrollSettled(finishPendingAnchorNavigation);
  }, PENDING_ANCHOR_SCROLL_DELAY_MS);
}

/** Drop session flag immediately so init cannot schedule a second scroll; storage clears after scroll. */
function consumePendingAnchor(anchor: unknown): void {
  sessionStorage.removeItem(PENDING_ANCHOR_SESSION_KEY);
  schedulePendingAnchorScroll(anchor);
}

/** Wait for any in-progress anchor scroll to finish, then show overlay. */
function showOverlayWhenReady(): void {
  void anchorScrollDonePromise.then(() => {
    try {
      // Cross-origin nav has no synchronous open-hint (sessionStorage is per-origin), so the
      // panel restores via this async path and its content streams in just after. Frost it
      // briefly so the load-in reads as one smooth reveal instead of an empty→filled jump.
      const isColdRestore = !overlayShellSlideOpen;
      showOverlay({ animate: false });
      if (isColdRestore) {
        showLoadingVeil();
      }
    } catch {
      // One page's mount failure must not surface as an unhandled rejection.
    }
  });
}

/**
 * Briefly frosts/blurs the panel while a cold restore streams its content in. Cosmetic and
 * pointer-transparent, and self-clears via the animation engine, so it can never strand the
 * panel behind a cover.
 */
function showLoadingVeil(): void {
  const shell = document.getElementById(OVERLAY_SHELL_ID);
  if (!shell) {
    return;
  }
  removeLoadingVeil();

  const veil = document.createElement("div");
  veil.id = LOADING_VEIL_ID;
  veil.setAttribute("aria-hidden", "true");
  // pointer-events:none is the hard guarantee that the panel stays clickable even if this
  // element ever lingers — clicks hit-test straight through to the iframe beneath it.
  veil.style.cssText = [
    "position:absolute",
    "inset:0",
    "z-index:1",
    "background:rgba(248,248,248,0.45)",
    "backdrop-filter:blur(8px)",
    "-webkit-backdrop-filter:blur(8px)",
    "pointer-events:none",
  ].join(";");
  shell.appendChild(veil);

  const total = LOADING_VEIL_HOLD_MS + LOADING_VEIL_FADE_MS;
  try {
    // Drive the hold+fade on the animation engine with fill:forwards, so the veil settles at
    // opacity 0 (fully invisible, blur and all) even if its cleanup is starved by a
    // background-throttled timer. It can never end up stuck covering the panel.
    const animation = veil.animate(
      [
        { opacity: 1, offset: 0 },
        { opacity: 1, offset: LOADING_VEIL_HOLD_MS / total },
        { opacity: 0, offset: 1 },
      ],
      { duration: total, easing: "ease-out", fill: "forwards" },
    );
    loadingVeilAnimation = animation;
    animation.onfinish = () => removeLoadingVeil();
  } catch {
    // Web Animations unavailable — remove on a plain timer (still pointer-transparent).
    loadingVeilTimer = window.setTimeout(removeLoadingVeil, total);
  }
}

function removeLoadingVeil(): void {
  if (loadingVeilTimer !== null) {
    window.clearTimeout(loadingVeilTimer);
    loadingVeilTimer = null;
  }
  if (loadingVeilAnimation !== null) {
    try {
      loadingVeilAnimation.cancel();
    } catch {
      // Already finished/detached.
    }
    loadingVeilAnimation = null;
  }
  document.getElementById(LOADING_VEIL_ID)?.remove();
}

function initPendingAnchorScroll(): void {
  // Create the promise eagerly BEFORE any async work so that overlay-open
  // paths that arrive later (background OPEN_OVERLAY message) will wait.
  anchorScrollDonePromise = new Promise<void>((resolve) => {
    resolveAnchorScrollDone = resolve;
  });

  const sessionRaw = sessionStorage.getItem(PENDING_ANCHOR_SESSION_KEY);
  if (sessionRaw) {
    try {
      consumePendingAnchor(JSON.parse(sessionRaw));
    } catch {
      clearPendingAnchorState(window, window.location.href);
      markAnchorScrollDone();
    }
    return;
  }

  const keys = pendingAnchorStorageKeysForUrl(window.location.href);
  if (keys.length === 0) {
    // No anchor to scroll — resolve immediately (LINK case).
    markAnchorScrollDone();
    return;
  }

  chrome.storage.local.get(keys, (result) => {
    let anchor: unknown;
    for (const key of keys) {
      if (result[key] !== undefined) {
        anchor = result[key];
        break;
      }
    }
    if (anchor !== undefined) {
      consumePendingAnchor(anchor);
    } else {
      purgeOrphanPendingAnchorKeys();
      // No anchor found — resolve immediately (LINK case).
      markAnchorScrollDone();
    }
  });
}

function initPendingOverlayOpen(): void {
  void claimPendingOverlay(window).then((shouldOpen) => {
    if (shouldOpen) showOverlayWhenReady();
  });
}

/**
 * Per-tab-session restore from the authoritative background session: reopen NN if it
 * was open before navigating (docs/1_NN_DASHBOARD — open-state persists for the tab
 * session), or close it if the synchronous hint opened it but the session says closed
 * (a stale hint, e.g. after Chrome restored sessionStorage on a browser restart while
 * the per-tab session reset).
 */
function initTabSessionOverlay(): void {
  void getTabSession().then((session) => {
    // Read failed (null) — trust the synchronous hint paint, change nothing.
    if (session === null) {
      return;
    }
    if (session.open) {
      showOverlayWhenReady();
    } else if (readOpenHint()) {
      hideOverlay({ animate: false });
    }
  });
}

type RuntimeMessage =
  | { type: "TOGGLE_OVERLAY" }
  | { type: "PAYMENT_COMPLETED" };

type OverlayVisibilityEventDetail = {
  visible: boolean;
};

/** How often to check the extension is still installed (removes a stranded overlay). */
const EXTENSION_CONTEXT_POLL_MS = 1500;

let overlayRoot: Root | null = null;
let hideOverlayTimer: number | null = null;
let overlayViewportListenersAttached = false;
let overlayShellSlideOpen = false;
let contextWatchTimer: number | null = null;
let loadingVeilTimer: number | null = null;
let loadingVeilAnimation: Animation | null = null;

function isRuntimeMessage(value: unknown): value is RuntimeMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  if (v.type === "TOGGLE_OVERLAY") {
    return true;
  }
  if (v.type === "PAYMENT_COMPLETED") {
    return true;
  }
  return false;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!isRuntimeMessage(message)) {
    return false;
  }

  if (message.type === "TOGGLE_OVERLAY") {
    toggleOverlay();
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "PAYMENT_COMPLETED") {
    window.dispatchEvent(new CustomEvent("nn-payment-completed"));
    sendResponse({ ok: true });
    return true;
  }

  return false;
});

window.addEventListener(
  "nn-dashboard-overlay-visibility-request",
  (event: Event) => {
    const customEvent = event as CustomEvent<OverlayVisibilityEventDetail>;
    const isVisibleRequest = Boolean(customEvent.detail?.visible);

    if (isVisibleRequest) {
      showOverlay();
      return;
    }

    hideOverlay();
  },
);

/**
 * A content script (and the DOM it injected) keeps running after the extension is
 * uninstalled, disabled, or updated — Chrome only clears it on the next page load. When the
 * context dies, `chrome.runtime.id` becomes undefined and the runtime APIs throw; treat that
 * as "extension gone".
 */
function isExtensionContextValid(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

/** Removes the overlay and stops all timers when the extension is no longer there. */
function teardownOrphanedOverlay(): void {
  if (contextWatchTimer !== null) {
    window.clearInterval(contextWatchTimer);
    contextWatchTimer = null;
  }
  if (hideOverlayTimer !== null) {
    window.clearTimeout(hideOverlayTimer);
    hideOverlayTimer = null;
  }
  removeLoadingVeil();
  try {
    overlayRoot?.unmount();
  } catch {
    // Unmount cleanups may touch the now-dead extension APIs — ignore.
  }
  overlayRoot = null;
  overlayShellSlideOpen = false;
  document.getElementById(OVERLAY_SHELL_ID)?.remove();
}

/** Polls for extension-context loss while the overlay is mounted (idempotent). */
function startExtensionContextWatch(): void {
  if (contextWatchTimer !== null) {
    return;
  }
  contextWatchTimer = window.setInterval(() => {
    if (!isExtensionContextValid()) {
      teardownOrphanedOverlay();
    }
  }, EXTENSION_CONTEXT_POLL_MS);
}

function ensureOverlayMounted(): HTMLDivElement {
  startExtensionContextWatch();
  const existing = document.getElementById(OVERLAY_SHELL_ID);
  if (existing instanceof HTMLDivElement) {
    syncOverlayViewportMetrics(existing);
    return existing;
  }

  const shell = document.createElement("div");
  shell.id = OVERLAY_SHELL_ID;
  shell.setAttribute("aria-hidden", "true");
  configureOverlayShell(shell);

  document.documentElement.appendChild(shell);
  syncOverlayViewportMetrics(shell);
  attachOverlayViewportListeners();

  const frame = document.createElement("iframe");
  frame.title = "Notes for Net dashboard";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = [
    "display:block",
    "border:0",
    "width:100%",
    "height:100%",
    "background:transparent",
    /* Host pages with color-scheme: dark break transparent iframe + backdrop-filter. */
    "color-scheme:light",
  ].join(";");
  shell.appendChild(frame);

  const iframeRoot = mountOverlayInFrame(frame);
  // Iframe document now exists — set the root font-size knob before the first React paint.
  syncOverlayViewportMetrics(shell);
  overlayRoot = createRoot(iframeRoot);
  const queryClient = new QueryClient();
  overlayRoot.render(
    React.createElement(
      React.StrictMode,
      null,
      React.createElement(
        QueryClientProvider,
        { client: queryClient },
        React.createElement(App),
      ),
    ),
  );

  return shell;
}

function mountOverlayInFrame(frame: HTMLIFrameElement): HTMLElement {
  const doc = frame.contentDocument;
  if (doc === null) {
    throw new Error("Notes for Net: overlay iframe has no document");
  }

  doc.open();
  doc.write(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>',
  );
  doc.close();

  const styleEl = doc.createElement("style");
  styleEl.textContent = overlayCss;
  doc.head.appendChild(styleEl);

  doc.documentElement.style.height = "100%";
  doc.documentElement.style.background = "transparent";
  doc.documentElement.style.colorScheme = "light";
  doc.body.style.margin = "0";
  doc.body.style.height = "100%";
  doc.body.style.overflow = "hidden";
  doc.body.style.background = "transparent";
  // Keep wheel scroll inside the iframe; don't scroll the host page behind it.
  doc.documentElement.style.overscrollBehavior = "none";
  doc.body.style.overscrollBehavior = "none";

  // Avoid createRoot on document.body — extensions mutate it; root on a child div.
  const appRoot = doc.createElement("div");
  appRoot.id = "nn-overlay-app-root";
  appRoot.style.height = "100%";
  doc.body.appendChild(appRoot);
  return appRoot;
}

function configureOverlayShell(shell: HTMLDivElement): void {
  /* Inline only: dashboard CSS is injected inside the iframe, not on the host page. */
  shell.style.cssText = [
    "position:fixed",
    "right:0",
    "top:0",
    "height:100%",
    "color-scheme:light",
    `z-index:${2147483647}`,
    "overflow:visible",
    "box-shadow:0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "transform:translateX(100%)",
    "transition:transform 300ms ease-out",
    "visibility:hidden",
    "pointer-events:none",
    /* Width is set explicitly (and rescaled on resize) by syncOverlayViewportMetrics. */
    "max-width:100vw",
  ].join(";");
}

function syncOverlayViewportMetrics(shell: HTMLElement): void {
  const viewport = window.visualViewport;
  const top = Math.max(0, viewport?.offsetTop ?? 0);
  const height = viewport?.height ?? window.innerHeight;
  const viewportWidth = viewport?.width ?? window.innerWidth;

  const proportionalWidth =
    viewportWidth * (REFERENCE_PANEL_WIDTH_PX / REFERENCE_VIEWPORT_PX);
  const clampedWidth = Math.min(
    Math.max(proportionalWidth, PANEL_MIN_WIDTH_PX),
    PANEL_MAX_WIDTH_PX,
  );
  // Never exceed the viewport (small screens); compute the scale from the width
  // actually applied so width and font-size stay locked even when a clamp binds.
  const panelWidth = Math.min(clampedWidth, viewportWidth);
  const rootFontPx = (panelWidth / REFERENCE_PANEL_WIDTH_PX) * BASE_ROOT_FONT_PX;

  shell.style.top = `${top}px`;
  shell.style.height = `${height}px`;
  shell.style.width = `${panelWidth}px`;

  // Measured host scrollbar width — the panel hugs the viewport's right edge, so the
  // overlay UI must inset by this much to clear the scrollbar (0 for overlay/auto-hiding
  // scrollbars, where nothing overlaps). +2px safety margin.
  const scrollbarPx = Math.max(
    0,
    window.innerWidth - document.documentElement.clientWidth,
  );
  const scrollbarGutter = scrollbarPx > 0 ? `${scrollbarPx + 2}px` : "0px";

  // Null-guard: the first call runs before the iframe is appended/mounted.
  const iframeDoc = shell.querySelector("iframe")?.contentDocument;
  if (iframeDoc) {
    iframeDoc.documentElement.style.fontSize = `${rootFontPx}px`;
    iframeDoc.documentElement.style.setProperty(
      "--nn-scrollbar-gutter",
      scrollbarGutter,
    );
  }
}

function attachOverlayViewportListeners(): void {
  if (overlayViewportListenersAttached) {
    return;
  }

  const updateMetrics = (): void => {
    const shell = document.getElementById(OVERLAY_SHELL_ID);
    if (!(shell instanceof HTMLDivElement)) {
      return;
    }
    syncOverlayViewportMetrics(shell);
  };

  window.addEventListener("resize", updateMetrics);
  window.visualViewport?.addEventListener("resize", updateMetrics);
  window.visualViewport?.addEventListener("scroll", updateMetrics);
  overlayViewportListenersAttached = true;
}

/**
 * `animate: false` reveals the panel already in place (no slide), used when
 * restoring an open overlay across a navigation so it never appears to reopen.
 * `persist: false` skips writing the open-state; used by the startup hint paint,
 * which is a best-effort render and must not overwrite the authoritative session.
 */
function showOverlay(
  { animate = true, persist = true }: { animate?: boolean; persist?: boolean } = {},
): void {
  const shell = ensureOverlayMounted();
  if (hideOverlayTimer !== null) {
    window.clearTimeout(hideOverlayTimer);
    hideOverlayTimer = null;
  }

  overlayShellSlideOpen = true;
  shell.style.visibility = "visible";
  shell.style.pointerEvents = "auto";
  shell.setAttribute("aria-hidden", "false");

  if (animate) {
    shell.style.transform = "translateX(100%)";
    window.requestAnimationFrame(() => {
      shell.style.transform = "translateX(0)";
    });
  } else {
    withoutTransition(shell, () => {
      shell.style.transform = "translateX(0)";
    });
  }

  if (persist) {
    patchTabSession({ open: true });
    writeOpenHint(true);
  }
}

/**
 * `animate: false` hides the panel instantly (no slide), used to correct a stale
 * open hint when the authoritative tab session says the overlay should be closed.
 */
function hideOverlay({ animate = true }: { animate?: boolean } = {}): void {
  removeLoadingVeil();
  const shell = document.getElementById(OVERLAY_SHELL_ID);
  if (!shell) {
    overlayShellSlideOpen = false;
    return;
  }
  if (hideOverlayTimer !== null) {
    window.clearTimeout(hideOverlayTimer);
    hideOverlayTimer = null;
  }

  overlayShellSlideOpen = false;
  patchTabSession({ open: false });
  writeOpenHint(false);

  if (!animate) {
    withoutTransition(shell, () => {
      shell.style.transform = "translateX(100%)";
    });
    shell.style.visibility = "hidden";
    shell.style.pointerEvents = "none";
    shell.setAttribute("aria-hidden", "true");
    return;
  }

  shell.style.transform = "translateX(100%)";
  hideOverlayTimer = window.setTimeout(() => {
    shell.style.visibility = "hidden";
    shell.style.pointerEvents = "none";
    shell.setAttribute("aria-hidden", "true");
    hideOverlayTimer = null;
  }, 320);
}

/** Applies a transform with the CSS transition suppressed (no animation). */
function withoutTransition(el: HTMLElement, apply: () => void): void {
  const previous = el.style.transition;
  el.style.transition = "none";
  apply();
  void el.offsetWidth;
  el.style.transition = previous;
}

function toggleOverlay(): void {
  ensureOverlayMounted();
  if (!overlayShellSlideOpen) {
    showOverlay();
    return;
  }
  hideOverlay();
}

function restoreScroll(targetY: number): void {
  let attempts = 0;
  const maxAttempts = 20;
  const intervalMs = 250;

  const timer = window.setInterval(() => {
    window.scrollTo({ top: targetY, behavior: "auto" });
    attempts += 1;

    const closeEnough = Math.abs(window.scrollY - targetY) <= 2;
    if (closeEnough || attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
  }, intervalMs);
}

// Startup runs last, after the module-level state and the TOGGLE_OVERLAY listener are
// in place, so a same-tab restore cannot run before its state exists and a failed early
// paint cannot stop the toolbar toggle from working.

// A prior, now-orphaned content script (e.g. left after an extension update that
// re-injected this script into an already-open tab) may have an overlay shell still
// in the DOM whose React root is dead. Remove it so this fresh instance owns the
// overlay. No-op on a normal page load, where no shell exists yet.
document.getElementById(OVERLAY_SHELL_ID)?.remove();

// Restore a still-open overlay before the page paints, from the synchronous hint. The
// authoritative async restores below still run if this best-effort paint throws.
try {
  if (readOpenHint()) {
    showOverlay({ animate: false, persist: false });
  }
} catch {
  /* best-effort early paint */
}

initPendingOverlayOpen();
initTabSessionOverlay();

// Anchor scroll needs layout, so it stays on DOMContentLoaded; it owns the deferred
// promise the overlay-open paths await.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPendingAnchorScroll);
} else {
  initPendingAnchorScroll();
}
