import { initPendingAnchorScroll } from "@/content/anchorScroll";
import {
  suppressExtensionContextInvalidatedDevErrors,
  suppressRadixCrossRealmDialogWarnings,
} from "@/content/consoleSuppressions";
import { OVERLAY_SHELL_ID } from "@/content/constants";
import { readOpenHint } from "@/content/openHint";
import {
  hideOverlay,
  premountOverlay,
  showOverlay,
  showOverlayWhenReady,
} from "@/content/overlayShell";
import { claimPendingOverlay } from "@/lib/pendingNavigation";
import { getTabSession } from "@/lib/tabSession";
import { registerContentPanelHost } from "@/messaging/contentPanelBridge";
import { TAB_RESTORED_EVENT } from "@/messaging/contentPanelProtocol";
import "@/content/runtimeMessages";

suppressRadixCrossRealmDialogWarnings();

if (import.meta.env.DEV) {
  suppressExtensionContextInvalidatedDevErrors();
}

registerContentPanelHost();

function initPendingOverlayOpen(): void {
  void claimPendingOverlay(window).then((shouldOpen) => {
    if (shouldOpen) showOverlayWhenReady();
  });
}

/** Authoritative restore: the tab session is the ONLY thing that decides whether NN is on screen. */
function initTabSessionOverlay(): void {
  void getTabSession().then((session) => {
    // Read failed (null) — nothing else knows the answer, so fall back to the hint even though it may
    // be stale: a panel that should be there matters more than one frame of a panel that shouldn't.
    if (session === null) {
      if (readOpenHint()) {
        showOverlayWhenReady();
      }
      return;
    }
    if (session.open) {
      showOverlayWhenReady();
    } else if (readOpenHint()) {
      hideOverlay({ animate: false });
    }
  });
}

/**
 * Back/forward restores this page from the bfcache with the script frozen, not re-run: the overlay comes
 * back exactly as it was, even if the tab was minimized on another page since. Re-apply the session (which
 * also repairs this origin's hint) and let the panel reload data it missed while frozen.
 */
function initBackForwardRestore(): void {
  window.addEventListener("pageshow", (event) => {
    if (!event.persisted) {
      return;
    }
    void getTabSession().then((session) => {
      if (session === null) {
        return;
      }
      if (session.open) {
        showOverlay({ animate: false });
      } else {
        hideOverlay({ animate: false });
      }
      window.dispatchEvent(new CustomEvent(TAB_RESTORED_EVENT));
    });
  });
}

// Startup runs last so a restore can't precede its state and a failed early paint can't break the toggle.

// Drop any orphaned shell from a prior (re-injected) script so this instance owns the overlay.
document.getElementById(OVERLAY_SHELL_ID)?.remove();

// The hint only pre-mounts the panel off-screen; it never shows it. Being per-origin it goes stale the
// moment NN is toggled on another origin, and painting from it flashed a panel the user had minimized.
// The async session read below is the only thing that puts NN on screen.
try {
  if (readOpenHint()) {
    premountOverlay();
  }
} catch {
  /* best-effort pre-mount */
}

initPendingOverlayOpen();
initTabSessionOverlay();
initBackForwardRestore();

// Anchor scroll needs layout, so it waits for DOMContentLoaded and owns the promise overlay-open awaits.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initPendingAnchorScroll);
} else {
  initPendingAnchorScroll();
}
