import type { Root } from "react-dom/client";

import { whenAnchorScrollDone } from "@/content/anchorScroll";
import {
  EXTENSION_CONTEXT_POLL_MS,
  OVERLAY_SHELL_ID,
  PANEL_REVEAL_CAP_MS,
} from "@/content/constants";
import { writeOpenHint } from "@/content/openHint";
import {
  attachOverlayViewportListeners,
  syncOverlayViewportMetrics,
} from "@/content/overlayMetrics";
import { patchTabSession } from "@/lib/tabSession";
import { mountOverlayApp } from "@/overlay/mountOverlayApp";

let overlayRoot: Root | null = null;
let hideOverlayTimer: number | null = null;
let overlayShellSlideOpen = false;
let contextWatchTimer: number | null = null;
/** The shell THIS content-script instance created; used so an orphaned instance never removes a shell a newer instance owns. */
let ownedShell: HTMLDivElement | null = null;

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
  try {
    overlayRoot?.unmount();
  } catch {
    // Unmount cleanups may touch the now-dead extension APIs — ignore.
  }
  overlayRoot = null;
  overlayShellSlideOpen = false;
  // Only tear down the shell this instance created: after a reload/update a fresh content script
  // re-creates + owns it, and this orphaned instance must not remove that live overlay.
  const current = document.getElementById(OVERLAY_SHELL_ID);
  if (current !== null && current === ownedShell) {
    current.remove();
  }
  ownedShell = null;
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
  ownedShell = shell;
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
    /* Lateral shadow on the SHELL, not inside the iframe: an iframe cannot paint outside its own box,
       and a box-shadow never hit-tests, so the host page keeps its clicks. */
    "box-shadow:-8px 0 44px 8px rgba(26,26,26,0.42), 0 25px 50px -12px rgb(0 0 0 / 0.25)",
    "transform:translateX(100%)",
    "transition:transform 300ms ease-out",
    "visibility:hidden",
    "pointer-events:none",
    /* Width is set explicitly (and rescaled on resize) by syncOverlayViewportMetrics. */
    "max-width:100vw",
  ].join(";");
}

/** `animate:false` restores in-place (no reopen slide); `persist:false` is the best-effort hint paint that must not overwrite the session. */
export function showOverlay({
  animate = true,
  persist = true,
}: { animate?: boolean; persist?: boolean } = {}): void {
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

/** Parks the panel off-screen (visible, so it really paints) without deciding whether to show it — the
 *  per-origin hint can't know about minimizes elsewhere. The async session read then slides in a painted panel. */
export function premountOverlay(): void {
  ensureOverlayMounted().style.visibility = "visible";
}

/** Resolves once the panel has painted a frame, or at the cap — never leaves the reveal waiting on a slow page. */
function whenPanelPainted(): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (): void => {
      if (settled) {
        return;
      }
      settled = true;
      resolve();
    };
    window.setTimeout(settle, PANEL_REVEAL_CAP_MS);
    // Two frames: the first runs before React's commit paints, the second after it.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(settle);
    });
  });
}

/** Wait for any in-progress anchor scroll to finish, then show overlay. */
export function showOverlayWhenReady(): void {
  void whenAnchorScrollDone().then(() => {
    try {
      // Already on screen — nothing to animate.
      if (overlayShellSlideOpen) {
        showOverlay({ animate: false });
        return;
      }
      // Cold restore: let React paint while the shell is parked off-screen, then slide it in like a
      // normal open instead of snapping it on and hiding the load-in behind a fade.
      premountOverlay();
      void whenPanelPainted().then(() => {
        showOverlay({ animate: true });
      });
    } catch {
      // One page's mount failure must not surface as an unhandled rejection.
    }
  });
}

/** `animate:false` hides instantly to correct a stale open-hint; `persist:false` is a transient hide (anchor pick) that keeps the saved open state so a navigation still restores NN. */
export function hideOverlay({
  animate = true,
  persist = true,
}: { animate?: boolean; persist?: boolean } = {}): void {
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
  if (persist) {
    patchTabSession({ open: false });
    writeOpenHint(false);
  }

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

export function toggleOverlay(): void {
  ensureOverlayMounted();
  if (!overlayShellSlideOpen) {
    showOverlay();
    return;
  }
  hideOverlay();
}
