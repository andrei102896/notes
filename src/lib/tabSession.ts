/** Per-tab-session state (open-state + selected subject) following one browser tab until it closes; lives in chrome.storage.session keyed by tabId, owned by the background worker (only context that can read sender.tab.id) and reached via the message helpers below. */

export type TabSessionState = {
  /** NN is maximized (visible) in this tab. */
  open: boolean;
  /** Selected subject tab (folder), or null for the default current-page view. */
  activeSubjectTabId: string | null;
  /** Last notes-list scroll offset (px), restored after a same-tab navigation; absent until set. */
  notesScrollTop?: number;
  /** Last subject-tab strip scroll offset (px), restored after a same-tab navigation so the selected tab stays where it was; absent until set. */
  subjectTabScrollTop?: number;
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

/** Reads this tab's session from the background; resolves to null on read failure (no/malformed reply, invalidated context) so callers distinguish a failed read from a definitive closed session. */
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
      {
        type: "SET_TAB_SESSION",
        payload: patch,
      } satisfies SetTabSessionMessage,
      () => void chrome.runtime.lastError,
    );
  } catch {
    // Extension context invalidated (dev reload of an orphaned content script).
  }
}
