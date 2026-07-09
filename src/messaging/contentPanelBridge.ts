import { generateId } from "@/lib/generateId";
import {
  CONTENT_PANEL_PROTOCOL_VERSION,
  type AnchorPickPayload,
  type AnchorScrollPayload,
  type ContentToPanelMessage,
  type PageContextPayload,
  type PanelToContentMessage,
  isPanelToContentMessage,
} from "@/messaging/contentPanelProtocol";

const PICK_LAYER_ID = "nn-scroll-bookmarks-anchor-pick-layer";
/** Below overlay host (2147483647) so the panel stays clickable while picking. */
const PICK_LAYER_Z_INDEX = 2147483646;

const ANCHOR_CURSOR_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="-2 -2 28 28" fill="none" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="4" r="2" stroke="#111827" stroke-width="4"/>' +
      '<path d="M12 6v16" stroke="#111827" stroke-width="4"/>' +
      '<path d="M9 11h6" stroke="#111827" stroke-width="4"/>' +
      '<path d="m19 13 2-1a9 9 0 0 1-18 0l2 1" stroke="#111827" stroke-width="4"/>' +
      '<circle cx="12" cy="4" r="2" stroke="white" stroke-width="2"/>' +
      '<path d="M12 6v16" stroke="white" stroke-width="2"/>' +
      '<path d="M9 11h6" stroke="white" stroke-width="2"/>' +
      '<path d="m19 13 2-1a9 9 0 0 1-18 0l2 1" stroke="white" stroke-width="2"/>' +
      "</svg>",
  );

function dispatchOverlayVisibility(visible: boolean): void {
  window.dispatchEvent(
    new CustomEvent("nn-dashboard-overlay-visibility-request", {
      detail: { visible },
    }),
  );
}

type PanelRequestHandler = (message: PanelToContentMessage) => void;

let panelRequestHandler: PanelRequestHandler | null = null;

export function subscribePanelToContentRequests(
  handler: PanelRequestHandler,
): () => void {
  panelRequestHandler = handler;
  return () => {
    panelRequestHandler = null;
  };
}

export function postPanelToContent(message: PanelToContentMessage): void {
  panelRequestHandler?.(message);
}

function emitToPanel(message: ContentToPanelMessage): void {
  for (const listener of panelListeners) {
    listener(message);
  }
}

const panelListeners = new Set<(message: ContentToPanelMessage) => void>();

export function subscribeContentToPanel(
  listener: (message: ContentToPanelMessage) => void,
): () => void {
  panelListeners.add(listener);
  return () => {
    panelListeners.delete(listener);
  };
}

function readPageContext(): PageContextPayload {
  return {
    url: window.location.href,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
  };
}

function buildCssSelector(element: Element): string {
  if (element === document.body) {
    return "body";
  }
  if (element === document.documentElement) {
    return "html";
  }

  if (element.id) {
    const idSel = `#${CSS.escape(element.id)}`;
    try {
      if (document.querySelectorAll(idSel).length === 1) {
        return idSel;
      }
    } catch {
      /* fall through */
    }
  }

  const parent = element.parentElement;
  if (!parent) {
    return element.tagName.toLowerCase();
  }

  const children = Array.from(parent.children);
  const index = children.indexOf(element) + 1;
  if (index <= 0) {
    return element.tagName.toLowerCase();
  }

  return `${buildCssSelector(parent)} > :nth-child(${index})`;
}

function anchorPickPayloadFromEvent(ev: MouseEvent): AnchorPickPayload {
  const target = ev.target;
  const element =
    target instanceof Element ? target : (target as Node | null)?.parentElement;
  const selector = element instanceof Element ? buildCssSelector(element) : "";

  return {
    clientX: ev.clientX,
    clientY: ev.clientY,
    pageX: ev.pageX,
    pageY: ev.pageY,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    elementSelector: selector,
  };
}

let activePickRequestId: string | null = null;
let pickLayer: HTMLDivElement | null = null;
let pickKeyHandler: ((e: KeyboardEvent) => void) | null = null;

function removePickLayer(): void {
  if (pickLayer) {
    pickLayer.remove();
    pickLayer = null;
  }
  if (pickKeyHandler) {
    document.removeEventListener("keydown", pickKeyHandler, true);
    pickKeyHandler = null;
  }
  activePickRequestId = null;
}

function startAnchorPickSession(requestId: string): void {
  removePickLayer();

  activePickRequestId = requestId;

  const layer = document.createElement("div");
  layer.id = PICK_LAYER_ID;
  layer.setAttribute("role", "presentation");
  layer.style.cssText = [
    "position:fixed",
    "inset:0",
    `z-index:${PICK_LAYER_Z_INDEX}`,
    `cursor:url("${ANCHOR_CURSOR_SVG}") 14 4, crosshair`,
    "background:rgba(0,0,0,0.08)",
  ].join(";");

  const onPointerDown = (ev: MouseEvent): void => {
    ev.preventDefault();
    ev.stopPropagation();
    const rid = activePickRequestId;
    if (!rid) {
      return;
    }
    const payload = anchorPickPayloadFromEvent(ev);
    removePickLayer();
    dispatchOverlayVisibility(true);
    emitToPanel({
      v: CONTENT_PANEL_PROTOCOL_VERSION,
      type: "nn_cp/anchor_pick_result",
      requestId: rid,
      payload,
    });
  };

  const onWheel = (ev: WheelEvent): void => {
    window.scrollBy({ left: ev.deltaX, top: ev.deltaY, behavior: "instant" });
  };

  layer.addEventListener("mousedown", onPointerDown, true);
  layer.addEventListener("wheel", onWheel, { passive: true });

  pickKeyHandler = (e: KeyboardEvent): void => {
    if (e.key !== "Escape") {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const rid = activePickRequestId;
    removePickLayer();
    dispatchOverlayVisibility(true);
    if (rid) {
      emitToPanel({
        v: CONTENT_PANEL_PROTOCOL_VERSION,
        type: "nn_cp/anchor_pick_cancelled",
        requestId: rid,
      });
    }
  };

  document.addEventListener("keydown", pickKeyHandler, true);
  document.documentElement.appendChild(layer);
  pickLayer = layer;
  dispatchOverlayVisibility(false);
}

export function scrollToAnchorInPage(payload: AnchorScrollPayload): boolean {
  if (payload.elementSelector) {
    try {
      const el = document.querySelector(payload.elementSelector);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        return true;
      }
    } catch {
      /* invalid selector — fall through */
    }
  }
  window.scrollTo({
    left: payload.scrollX,
    top: payload.scrollY,
    behavior: "smooth",
  });
  return false;
}

function cancelAnchorPick(requestId: string): void {
  if (activePickRequestId !== requestId) {
    return;
  }
  removePickLayer();
  dispatchOverlayVisibility(true);
  emitToPanel({
    v: CONTENT_PANEL_PROTOCOL_VERSION,
    type: "nn_cp/anchor_pick_cancelled",
    requestId,
  });
}

/** Registers the content-side dispatcher; call once from the content script entry. */
export function registerContentPanelHost(): () => void {
  return subscribePanelToContentRequests((message) => {
    if (!isPanelToContentMessage(message)) {
      return;
    }

    const { requestId } = message;

    if (message.type === "nn_cp/request_page_context") {
      emitToPanel({
        v: CONTENT_PANEL_PROTOCOL_VERSION,
        type: "nn_cp/page_context",
        requestId,
        payload: readPageContext(),
      });
      return;
    }

    if (message.type === "nn_cp/start_anchor_pick") {
      startAnchorPickSession(requestId);
      return;
    }

    if (message.type === "nn_cp/cancel_anchor_pick") {
      cancelAnchorPick(requestId);
      return;
    }

    if (message.type === "nn_cp/scroll_to_anchor") {
      const elementFound = scrollToAnchorInPage(message.payload);
      emitToPanel({
        v: CONTENT_PANEL_PROTOCOL_VERSION,
        type: "nn_cp/anchor_scroll_result",
        requestId,
        elementFound,
      });
    }
  });
}

function newRequestId(): string {
  return generateId();
}

export type AnchorPickSession = {
  requestId: string;
  result: Promise<AnchorPickPayload>;
};

export type ContentPanelClient = {
  requestPageContext: () => Promise<PageContextPayload>;
  startAnchorPick: () => AnchorPickSession;
  cancelAnchorPick: (requestId: string) => void;
  scrollToAnchor: (
    payload: AnchorScrollPayload,
  ) => Promise<{ elementFound: boolean }>;
};

/** Panel-side API; only works after {@link registerContentPanelHost} runs (content script). */
export function getContentPanelClient(): ContentPanelClient {
  function waitForResponse<R>(
    requestId: string,
    predicate: (m: ContentToPanelMessage) => R | undefined,
    timeoutMs: number,
  ): Promise<R> {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => {
        unsubscribe();
        reject(new Error("Content panel request timed out."));
      }, timeoutMs);

      const unsubscribe = subscribeContentToPanel((msg) => {
        if (msg.requestId !== requestId) {
          return;
        }
        if (msg.type === "nn_cp/error") {
          window.clearTimeout(timer);
          unsubscribe();
          reject(new Error(msg.message || msg.code));
          return;
        }
        const hit = predicate(msg);
        if (hit !== undefined) {
          window.clearTimeout(timer);
          unsubscribe();
          resolve(hit);
        }
      });
    });
  }

  return {
    requestPageContext(): Promise<PageContextPayload> {
      const requestId = newRequestId();
      postPanelToContent({
        v: CONTENT_PANEL_PROTOCOL_VERSION,
        type: "nn_cp/request_page_context",
        requestId,
      });
      return waitForResponse(
        requestId,
        (msg) => (msg.type === "nn_cp/page_context" ? msg.payload : undefined),
        8000,
      );
    },

    startAnchorPick(): AnchorPickSession {
      const requestId = newRequestId();
      const result = new Promise<AnchorPickPayload>((resolve, reject) => {
        const timer = window.setTimeout(() => {
          unsubscribe();
          reject(new Error("Anchor pick timed out."));
        }, 120_000);

        const unsubscribe = subscribeContentToPanel((msg) => {
          if (msg.requestId !== requestId) {
            return;
          }
          if (msg.type === "nn_cp/anchor_pick_result") {
            window.clearTimeout(timer);
            unsubscribe();
            resolve(msg.payload);
            return;
          }
          if (msg.type === "nn_cp/anchor_pick_cancelled") {
            window.clearTimeout(timer);
            unsubscribe();
            reject(new Error("Anchor pick cancelled."));
            return;
          }
          if (msg.type === "nn_cp/error") {
            window.clearTimeout(timer);
            unsubscribe();
            reject(new Error(msg.message || msg.code));
          }
        });

        postPanelToContent({
          v: CONTENT_PANEL_PROTOCOL_VERSION,
          type: "nn_cp/start_anchor_pick",
          requestId,
        });
      });

      return { requestId, result };
    },

    cancelAnchorPick(requestId: string): void {
      postPanelToContent({
        v: CONTENT_PANEL_PROTOCOL_VERSION,
        type: "nn_cp/cancel_anchor_pick",
        requestId,
      });
    },

    scrollToAnchor(
      payload: AnchorScrollPayload,
    ): Promise<{ elementFound: boolean }> {
      const requestId = newRequestId();
      postPanelToContent({
        v: CONTENT_PANEL_PROTOCOL_VERSION,
        type: "nn_cp/scroll_to_anchor",
        requestId,
        payload,
      });
      return waitForResponse(
        requestId,
        (msg) =>
          msg.type === "nn_cp/anchor_scroll_result"
            ? { elementFound: msg.elementFound }
            : undefined,
        5000,
      );
    },
  };
}
