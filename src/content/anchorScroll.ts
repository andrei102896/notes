import {
  PENDING_ANCHOR_SCROLL_DELAY_MS,
  PENDING_ANCHOR_SCROLL_SETTLE_MS,
} from "@/content/constants";
import {
  PENDING_ANCHOR_SESSION_KEY,
  clearPendingAnchorState,
  pendingAnchorStorageKeysForUrl,
  pendingAnchorUrlMatches,
  purgeOrphanPendingAnchorKeys,
} from "@/lib/pendingNavigation";

/** Resolves when the pending anchor scroll finishes; created eagerly by initPendingAnchorScroll so showOverlayWhenReady defers the open until scrolled. */
let anchorScrollDonePromise: Promise<void> = Promise.resolve();
let resolveAnchorScrollDone: (() => void) | null = null;

/** The current anchor-scroll gate; overlay-open paths await this before showing. */
export function whenAnchorScrollDone(): Promise<void> {
  return anchorScrollDonePromise;
}

/** Scroll to the anchor, retrying until the page settles: dynamic pages (video/lazy homepages, e.g. bugatti.com) lay out their target after load, so a single early scroll lands short. */
function restoreAnchor(payload: {
  elementSelector: string;
  scrollY: number;
}): void {
  let attempts = 0;
  const maxAttempts = 24;
  const intervalMs = 250;
  let lastY = Number.NaN;

  const tick = (): void => {
    let element: Element | null = null;
    if (payload.elementSelector) {
      try {
        element = document.querySelector(payload.elementSelector);
      } catch {
        element = null;
      }
    }

    let arrived: boolean;
    if (element) {
      element.scrollIntoView({ block: "center", behavior: "auto" });
      // Settled once re-centering stops moving (page above stopped growing).
      arrived = attempts >= 1 && Math.abs(window.scrollY - lastY) <= 2;
    } else {
      window.scrollTo({ top: payload.scrollY, behavior: "auto" });
      // Settled once the target Y is actually reachable (page grew tall enough).
      arrived = Math.abs(window.scrollY - payload.scrollY) <= 2;
    }
    lastY = window.scrollY;
    attempts += 1;

    if (arrived || attempts >= maxAttempts) {
      window.clearInterval(timer);
    }
  };

  const timer = window.setInterval(tick, intervalMs);
  tick();
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
  };
  restoreAnchor(payload);
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
    let session: { url?: unknown; anchor?: unknown };
    try {
      session = JSON.parse(sessionRaw);
    } catch {
      clearPendingAnchorState(window, window.location.href);
      markAnchorScrollDone();
      return;
    }
    // Only fire on the page the anchor targets; a key orphaned by a cross-origin go-to-anchor must not scroll an unrelated same-origin page.
    if (
      typeof session.url === "string" &&
      pendingAnchorUrlMatches(session.url, window.location.href)
    ) {
      consumePendingAnchor(session.anchor);
      return;
    }
    // Wrong/stale page — drop the session key and fall through to the URL-scoped storage path.
    sessionStorage.removeItem(PENDING_ANCHOR_SESSION_KEY);
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
