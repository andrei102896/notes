import {
  PENDING_ANCHOR_SCROLL_DELAY_MS,
  PENDING_ANCHOR_SCROLL_SETTLE_MS,
} from "@/content/constants";
import {
  PENDING_ANCHOR_SESSION_KEY,
  clearPendingAnchorState,
  pendingAnchorStorageKeysForUrl,
  purgeOrphanPendingAnchorKeys,
} from "@/lib/pendingNavigation";
import { scrollToAnchorInPage } from "@/messaging/contentPanelBridge";

/** Resolves when the pending anchor scroll finishes; created eagerly by initPendingAnchorScroll so showOverlayWhenReady defers the open until scrolled. */
let anchorScrollDonePromise: Promise<void> = Promise.resolve();
let resolveAnchorScrollDone: (() => void) | null = null;

/** The current anchor-scroll gate; overlay-open paths await this before showing. */
export function whenAnchorScrollDone(): Promise<void> {
  return anchorScrollDonePromise;
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
  const fallbackTimer = window.setTimeout(
    finish,
    PENDING_ANCHOR_SCROLL_SETTLE_MS,
  );
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

export function initPendingAnchorScroll(): void {
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
