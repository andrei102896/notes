import type { NNAnchorPosition } from "@/types/nnData";

export const PENDING_ANCHOR_SESSION_KEY = "nn_pending_anchor";
export const PENDING_ANCHOR_STORAGE_PREFIX = "nn_pending_anchor_";
export const PENDING_OVERLAY_SESSION_KEY = "nn_pending_overlay";
const PENDING_OVERLAY_STORAGE_PREFIX = "nn_pending_overlay_";

function trimTrailingSlash(url: string): string {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}

/** Storage keys for a pending anchor, covering href variants that may appear after navigation. */
export function pendingAnchorStorageKeysForUrl(url: string): string[] {
  const keys = new Set<string>([
    `${PENDING_ANCHOR_STORAGE_PREFIX}${url}`,
    `${PENDING_ANCHOR_STORAGE_PREFIX}${trimTrailingSlash(url)}`,
  ]);
  try {
    const parsed = new URL(url);
    keys.add(`${PENDING_ANCHOR_STORAGE_PREFIX}${parsed.href}`);
    keys.add(
      `${PENDING_ANCHOR_STORAGE_PREFIX}${trimTrailingSlash(parsed.href)}`,
    );
  } catch {
    /* best-effort */
  }
  return Array.from(keys);
}

/** Removes session + chrome.storage.local pending-anchor entries (all variants for optional URLs). */
export function clearPendingAnchorState(
  tabWin: Window,
  ...urls: string[]
): void {
  tabWin.sessionStorage.removeItem(PENDING_ANCHOR_SESSION_KEY);

  const keys = new Set<string>();
  for (const url of urls) {
    if (!url) {
      continue;
    }
    for (const key of pendingAnchorStorageKeysForUrl(url)) {
      keys.add(key);
    }
  }
  keys.add(`${PENDING_ANCHOR_STORAGE_PREFIX}${tabWin.location.href}`);
  keys.add(
    `${PENDING_ANCHOR_STORAGE_PREFIX}${trimTrailingSlash(tabWin.location.href)}`,
  );

  if (keys.size === 0) {
    return;
  }
  void chrome.storage.local.remove(Array.from(keys));
}

function pendingAnchorStoragePayload(
  targetUrl: string,
  anchor: NNAnchorPosition,
): Record<string, NNAnchorPosition> {
  return Object.fromEntries(
    pendingAnchorStorageKeysForUrl(targetUrl).map((key) => [key, anchor]),
  );
}

/** Same-tab navigation: session (fast) + storage (fallback). */
export function setPendingAnchorForNavigation(
  tabWin: Window,
  targetUrl: string,
  anchor: NNAnchorPosition,
): void {
  tabWin.sessionStorage.setItem(
    PENDING_ANCHOR_SESSION_KEY,
    JSON.stringify(anchor),
  );
  void chrome.storage.local.set(pendingAnchorStoragePayload(targetUrl, anchor));
}

/** New tab (e.g. right-click ANCHOR): only storage — session does not carry across tabs. */
export function setPendingAnchorForNewTab(
  targetUrl: string,
  anchor: NNAnchorPosition,
): void {
  void chrome.storage.local.set(pendingAnchorStoragePayload(targetUrl, anchor));
}

function pendingOverlayStorageKeysForUrl(url: string): string[] {
  return pendingAnchorStorageKeysForUrl(url).map((k) =>
    PENDING_OVERLAY_STORAGE_PREFIX + k.slice(PENDING_ANCHOR_STORAGE_PREFIX.length),
  );
}

/** New tab opened with overlay (background calls this after chrome.tabs.create). */
export function setPendingOverlayForNewTab(targetUrl: string): void {
  void chrome.storage.local.set(
    Object.fromEntries(
      pendingOverlayStorageKeysForUrl(targetUrl).map((k) => [k, true]),
    ),
  );
}

/** Same-tab navigation: overlay should reopen on the next page load. */
export function markOverlayReopenOnNextNavigation(
  tabWin: Window,
  targetUrl: string,
): void {
  tabWin.sessionStorage.setItem(PENDING_OVERLAY_SESSION_KEY, "1");
  setPendingOverlayForNewTab(targetUrl);
}

/** Read and consume the pending overlay flag. Returns true if overlay should open. */
export function claimPendingOverlay(tabWin: Window): Promise<boolean> {
  const fromSession = tabWin.sessionStorage.getItem(PENDING_OVERLAY_SESSION_KEY);
  if (fromSession !== null) {
    tabWin.sessionStorage.removeItem(PENDING_OVERLAY_SESSION_KEY);
    return Promise.resolve(true);
  }
  return new Promise((resolve) => {
    const keys = pendingOverlayStorageKeysForUrl(tabWin.location.href);
    chrome.storage.local.get(keys, (result) => {
      if (chrome.runtime.lastError) {
        resolve(false);
        return;
      }
      const found = keys.some((k) => result[k]);
      if (found) void chrome.storage.local.remove(keys);
      resolve(found);
    });
  });
}

/** Drops leftover `nn_pending_anchor_*` keys so a later LINK cannot trigger a stale scroll. */
export function purgeOrphanPendingAnchorKeys(): void {
  chrome.storage.local.get(null, (all) => {
    if (chrome.runtime.lastError || !all) {
      return;
    }
    const keys = Object.keys(all).filter((key) =>
      key.startsWith(PENDING_ANCHOR_STORAGE_PREFIX),
    );
    if (keys.length > 0) {
      void chrome.storage.local.remove(keys);
    }
  });
}
