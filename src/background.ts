import {
  getExtPayClient,
  isExtPayConfigured,
} from "@/lib/extpay";
import { setPendingOverlayForNewTab } from "@/lib/pendingNavigation";
import {
  DEFAULT_TAB_SESSION,
  isGetTabSessionMessage,
  isSetTabSessionMessage,
  tabSessionStorageKey,
  type TabSessionState,
} from "@/lib/tabSession";

if (isExtPayConfigured) {
  getExtPayClient().startBackground();
  try {
    getExtPayClient().onPaid.addListener(() => {
      chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, { type: "PAYMENT_COMPLETED" }, () => {
              void chrome.runtime.lastError;
            });
          }
        }
      });
    });
  } catch {
    // onPaid requires the ExtPay content script on extensionpay.com
  }
}

type OpenUrlInNewTabMessage = {
  type: "OPEN_URL_IN_NEW_TAB";
  payload: {
    url: string;
    openOverlay?: boolean;
  };
};

function isOpenUrlInNewTabMessage(
  message: unknown,
): message is OpenUrlInNewTabMessage {
  if (typeof message !== "object" || message === null) {
    return false;
  }
  const m = message as Record<string, unknown>;
  return m.type === "OPEN_URL_IN_NEW_TAB";
}

function readTabSession(tabId: number): Promise<TabSessionState> {
  const key = tabSessionStorageKey(tabId);
  return new Promise((resolve) => {
    chrome.storage.session.get(key, (result) => {
      if (chrome.runtime.lastError) {
        resolve({ ...DEFAULT_TAB_SESSION });
        return;
      }
      const stored = result[key];
      resolve({ ...DEFAULT_TAB_SESSION, ...(stored as Partial<TabSessionState>) });
    });
  });
}

async function patchTabSessionRecord(
  tabId: number,
  patch: Partial<TabSessionState>,
): Promise<void> {
  const next = { ...(await readTabSession(tabId)), ...patch };
  await chrome.storage.session.set({ [tabSessionStorageKey(tabId)]: next });
}

/** Tab closed → its session ends (docs/1_NN_DASHBOARD: persistence is per tab session). */
chrome.tabs.onRemoved.addListener((tabId) => {
  void chrome.storage.session.remove(tabSessionStorageKey(tabId));
});

chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) {
    return;
  }

  chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" }, () => {
    void chrome.runtime.lastError;
  });
});

/**
 * On install/update the previously-injected content scripts in already-open tabs
 * are orphaned (their extension context is invalidated), so the toolbar toggle
 * stops working until the tab is reloaded. Re-inject the page content script into
 * existing http(s) tabs so the toggle keeps working without a manual refresh.
 */
async function reinjectContentScriptsIntoOpenTabs(): Promise<void> {
  const contentScripts = chrome.runtime.getManifest().content_scripts ?? [];
  for (const script of contentScripts) {
    const files = script.js;
    if (!files || files.length === 0) {
      continue;
    }
    // Skip the ExtPay content script (extensionpay.com only).
    if (script.matches?.some((pattern) => pattern.includes("extensionpay.com"))) {
      continue;
    }
    let tabs: chrome.tabs.Tab[];
    try {
      tabs = await chrome.tabs.query({});
    } catch {
      continue;
    }
    for (const tab of tabs) {
      if (typeof tab.id !== "number" || !tab.url || !/^https?:/.test(tab.url)) {
        continue;
      }
      chrome.scripting.executeScript({ target: { tabId: tab.id }, files }, () => {
        // Restricted pages (CSP, store pages, etc.) throw — ignore.
        void chrome.runtime.lastError;
      });
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void reinjectContentScriptsIntoOpenTabs();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (isGetTabSessionMessage(message)) {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ...DEFAULT_TAB_SESSION });
      return true;
    }
    void readTabSession(tabId).then(sendResponse);
    return true;
  }

  if (isSetTabSessionMessage(message)) {
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") {
      sendResponse({ ok: false });
      return true;
    }
    void patchTabSessionRecord(tabId, message.payload).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (isOpenUrlInNewTabMessage(message)) {
    const targetUrl = message.payload?.url;
    if (!targetUrl) {
      sendResponse({ ok: false, error: "URL missing." });
      return true;
    }
    chrome.tabs.create({ url: targetUrl }, (tab) => {
      if (chrome.runtime.lastError || !tab?.id) {
        sendResponse({
          ok: false,
          error: chrome.runtime.lastError?.message ?? "Could not open tab.",
        });
        return;
      }
      if (message.payload?.openOverlay) {
        setPendingOverlayForNewTab(targetUrl);
      }
      sendResponse({ ok: true, tabId: tab.id });
    });
    return true;
  }

  return false;
});

