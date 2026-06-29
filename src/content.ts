import { initPendingAnchorScroll } from "@/content/anchorScroll";
import {
  suppressExtensionContextInvalidatedDevErrors,
  suppressRadixCrossRealmDialogWarnings,
} from "@/content/consoleSuppressions";
import { OVERLAY_SHELL_ID } from "@/content/constants";
import { readOpenHint } from "@/content/openHint";
import {
  hideOverlay,
  showOverlay,
  showOverlayWhenReady,
} from "@/content/overlayShell";
import { claimPendingOverlay } from "@/lib/pendingNavigation";
import { getTabSession } from "@/lib/tabSession";
import { registerContentPanelHost } from "@/messaging/contentPanelBridge";
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
