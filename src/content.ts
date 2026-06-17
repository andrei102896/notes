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

suppressRadixCrossRealmDialogWarnings();

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
    showOverlay();
  });
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

function initPendingNavigationState(): void {
  // Anchor first — creates the deferred promise that overlay-open waits on.
  initPendingAnchorScroll();
  initPendingOverlayOpen();
}

// A prior, now-orphaned content script (e.g. left after an extension update that
// re-injected this script into an already-open tab) may have an overlay shell still
// in the DOM whose React root is dead. Remove it so this fresh instance owns the
// overlay. No-op on a normal page load, where no shell exists yet.
document.getElementById(OVERLAY_SHELL_ID)?.remove();

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPendingNavigationState);
} else {
  initPendingNavigationState();
}

type RuntimeMessage =
  | { type: "TOGGLE_OVERLAY" }
  | { type: "PAYMENT_COMPLETED" };

type OverlayVisibilityEventDetail = {
  visible: boolean;
};

let overlayRoot: Root | null = null;
let hideOverlayTimer: number | null = null;
let overlayViewportListenersAttached = false;
let overlayShellSlideOpen = false;

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

function ensureOverlayMounted(): HTMLDivElement {
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

  // Null-guard: the first call runs before the iframe is appended/mounted.
  const iframeDoc = shell.querySelector("iframe")?.contentDocument;
  if (iframeDoc) {
    iframeDoc.documentElement.style.fontSize = `${rootFontPx}px`;
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

function showOverlay(): void {
  const shell = ensureOverlayMounted();
  if (hideOverlayTimer !== null) {
    window.clearTimeout(hideOverlayTimer);
    hideOverlayTimer = null;
  }

  overlayShellSlideOpen = true;
  shell.style.visibility = "visible";
  shell.style.pointerEvents = "auto";
  shell.style.transform = "translateX(100%)";
  shell.setAttribute("aria-hidden", "false");
  window.requestAnimationFrame(() => {
    shell.style.transform = "translateX(0)";
  });
}

function hideOverlay(): void {
  const shell = document.getElementById(OVERLAY_SHELL_ID);
  if (!shell) {
    overlayShellSlideOpen = false;
    return;
  }
  if (hideOverlayTimer !== null) {
    window.clearTimeout(hideOverlayTimer);
  }

  overlayShellSlideOpen = false;
  shell.style.transform = "translateX(100%)";

  hideOverlayTimer = window.setTimeout(() => {
    shell.style.visibility = "hidden";
    shell.style.pointerEvents = "none";
    shell.setAttribute("aria-hidden", "true");
    hideOverlayTimer = null;
  }, 320);
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
