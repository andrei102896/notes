import { hideOverlay, showOverlay, toggleOverlay } from "@/content/overlayShell";

type RuntimeMessage = { type: "TOGGLE_OVERLAY" } | { type: "PAYMENT_COMPLETED" };

type OverlayVisibilityEventDetail = {
  visible: boolean;
};

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

    // Anchor-pick transient toggle: never persist, so a navigation during/after the pick still restores NN as open.
    if (isVisibleRequest) {
      showOverlay({ persist: false });
      return;
    }

    hideOverlay({ persist: false });
  },
);
