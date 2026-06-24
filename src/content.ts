import type { Root } from "react-dom/client";

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
import { mountOverlayApp } from "@/overlay/mountOverlayApp";

/** Radix's a11y check reads the host doc, not our iframe dialogs — filter only those two false-positive messages. */
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

/** Dev-only: CRXJS HMR client floods orphaned content scripts with harmless "Extension context invalidated"; swallow only that message. */
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

/** Panel sizing calibration (one source of truth): at REFERENCE_VIEWPORT_PX renders 1:1; width scales proportionally and iframe root font-size is the single knob the rem-based UI rides. */
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

/** Sync paint-hint mirror of the open flag (per-origin sessionStorage); the background session stays authoritative. */
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

/** Resolves when the pending anchor scroll finishes; created eagerly by initPendingAnchorScroll so showOverlayWhenReady defers the open until scrolled. */
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
      // Cross-origin nav has no sync open-hint, so frost the async restore into one smooth reveal.
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

/** Pointer-transparent, self-clearing frost over a cold restore; can never strand the panel. */
function showLoadingVeil(): void {
  const shell = document.getElementById(OVERLAY_SHELL_ID);
  if (!shell) {
    return;
  }
  removeLoadingVeil();

  const veil = document.createElement("div");
  veil.id = LOADING_VEIL_ID;
  veil.setAttribute("aria-hidden", "true");
  // pointer-events:none guarantees the panel stays clickable even if the veil ever lingers.
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
    // fill:forwards settles the veil at opacity 0 even if cleanup is starved, so it never sticks.
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
  // Create the promise before any async work so later overlay-open paths (background OPEN_OVERLAY) wait.
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

/** Authoritative restore: reopen NN if the tab session was open, else correct a stale open-hint (docs/1_NN_DASHBOARD). */
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

/** After uninstall/disable/update the script is orphaned and `chrome.runtime.id` goes undefined — "extension gone". */
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

  const { doc: iframeDoc, appRoot } = mountOverlayInFrame(frame);
  // Iframe document now exists — set the root font-size knob before the first React paint.
  syncOverlayViewportMetrics(shell);
  // Mount React synchronously (eager import); lazy import() can fail on strict-CSP sites, leaving a click-blocking empty shell.
  overlayRoot = mountOverlayApp(iframeDoc, appRoot);

  return shell;
}

// Builds the iframe document skeleton + app-root synchronously so the shell paints at document_start; mountOverlayApp injects the stylesheet later.
function mountOverlayInFrame(frame: HTMLIFrameElement): {
  doc: Document;
  appRoot: HTMLElement;
} {
  const doc = frame.contentDocument;
  if (doc === null) {
    throw new Error("Notes for Net: overlay iframe has no document");
  }

  doc.open();
  doc.write(
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"></head><body></body></html>',
  );
  doc.close();

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
  return { doc, appRoot };
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
  // Snap geometry to whole device pixels so the iframe layer lands on the physical grid; at fractional DPR (Windows 125% = 1.25) a sub-pixel edge rasterizes the whole overlay blurry.
  const dpr = window.devicePixelRatio || 1;
  const snapToDevicePx = (px: number): number => Math.round(px * dpr) / dpr;

  // Never exceed the viewport; scale font-size from the applied width so width and font stay locked even when a clamp binds.
  const panelWidth = snapToDevicePx(Math.min(clampedWidth, viewportWidth));
  const rootFontPx = (panelWidth / REFERENCE_PANEL_WIDTH_PX) * BASE_ROOT_FONT_PX;

  shell.style.top = `${snapToDevicePx(top)}px`;
  shell.style.height = `${snapToDevicePx(height)}px`;
  shell.style.width = `${panelWidth}px`;

  // Measured host scrollbar width: panel hugs the right edge, so the UI insets by this (+2px margin) to clear it; 0 for overlay scrollbars.
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

/** `animate:false` restores in-place (no reopen slide); `persist:false` is the best-effort hint paint that must not overwrite the session. */
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

/** `animate:false` hides instantly to correct a stale open-hint when the session says closed. */
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

// Startup runs last so a restore can't precede its state and a failed early paint can't break the toggle.

// Drop any orphaned shell from a prior (re-injected) script so this instance owns the overlay.
document.getElementById(OVERLAY_SHELL_ID)?.remove();

// Best-effort: paint a still-open overlay from the sync hint before the page paints; async restores below still run.
try {
  if (readOpenHint()) {
    showOverlay({ animate: false, persist: false });
  }
} catch {
  /* best-effort early paint */
}

initPendingOverlayOpen();
initTabSessionOverlay();

// Anchor scroll needs layout, so it waits for DOMContentLoaded and owns the promise overlay-open awaits.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPendingAnchorScroll);
} else {
  initPendingAnchorScroll();
}
