/**
 * Per-tab-session state: panel open-state + selected subject that follow a single
 * browser tab across navigation and are cleared only when the tab closes
 * (docs/1_NN_DASHBOARD ATTRIBUTES.txt — "single browser tab session").
 *
 * The state lives in `chrome.storage.session`, owned by the background worker and
 * keyed by `tabId` (the worker is the only context that can read `sender.tab.id`).
 * Content script + the React overlay reach it through the message helpers below.
 */

export type TabSessionState = {
  /** NN is maximized (visible) in this tab. */
  open: boolean;
  /** Selected subject tab (folder), or null for the default current-page view. */
  activeSubjectTabId: string | null;
  /** Last notes-list scroll offset (px), restored after a same-tab navigation; absent until set. */
  notesScrollTop?: number;
};

export const DEFAULT_TAB_SESSION: TabSessionState = {
  open: false,
  activeSubjectTabId: null,
};

/** `chrome.storage.session` key for a tab's session record. */
export function tabSessionStorageKey(tabId: number): string {
  return `nn_tab_session_${tabId}`;
}

export type GetTabSessionMessage = { type: "GET_TAB_SESSION" };
export type SetTabSessionMessage = {
  type: "SET_TAB_SESSION";
  payload: Partial<TabSessionState>;
};

export function isGetTabSessionMessage(
  value: unknown,
): value is GetTabSessionMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<string, unknown>).type === "GET_TAB_SESSION"
  );
}

export function isSetTabSessionMessage(
  value: unknown,
): value is SetTabSessionMessage {
  if (
    typeof value !== "object" ||
    value === null ||
    (value as Record<string, unknown>).type !== "SET_TAB_SESSION"
  ) {
    return false;
  }
  const payload = (value as Record<string, unknown>).payload;
  return typeof payload === "object" && payload !== null;
}

function isTabSessionState(value: unknown): value is TabSessionState {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const v = value as Record<string, unknown>;
  return (
    typeof v.open === "boolean" &&
    (v.activeSubjectTabId === null || typeof v.activeSubjectTabId === "string")
  );
}

/**
 * Reads this tab's session from the background. Resolves to `null` when the read fails
 * (no response / malformed reply / invalidated context) so callers can distinguish a
 * failed read from a definitive closed session; a valid reply resolves to that state.
 */
export function getTabSession(): Promise<TabSessionState | null> {
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        { type: "GET_TAB_SESSION" } satisfies GetTabSessionMessage,
        (response: unknown) => {
          if (chrome.runtime.lastError || !isTabSessionState(response)) {
            resolve(null);
            return;
          }
          resolve(response);
        },
      );
    } catch {
      // Extension context invalidated (dev reload of an orphaned content script).
      resolve(null);
    }
  });
}

/** Fire-and-forget patch of this tab's session; failures are swallowed. */
export function patchTabSession(patch: Partial<TabSessionState>): void {
  try {
    chrome.runtime.sendMessage(
      { type: "SET_TAB_SESSION", payload: patch } satisfies SetTabSessionMessage,
      () => void chrome.runtime.lastError,
    );
  } catch {
    // Extension context invalidated (dev reload of an orphaned content script).
  }
}
