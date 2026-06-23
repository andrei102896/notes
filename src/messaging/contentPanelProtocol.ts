/** Versioned content-host ↔ overlay-panel messages; bump {@link CONTENT_PANEL_PROTOCOL_VERSION} on payload/semantics changes. */
export const CONTENT_PANEL_PROTOCOL_VERSION = 1 as const;

export type ProtocolVersion = typeof CONTENT_PANEL_PROTOCOL_VERSION;

/** Shared envelope for every message on this channel. */
export type ContentPanelEnvelope = {
  v: ProtocolVersion;
};

export type PageContextPayload = {
  url: string;
  scrollX: number;
  scrollY: number;
};

export type AnchorPickPayload = {
  clientX: number;
  clientY: number;
  pageX: number;
  pageY: number;
  scrollX: number;
  scrollY: number;
  elementSelector: string;
};

export type AnchorScrollPayload = {
  elementSelector: string;
  pageX: number;
  pageY: number;
  scrollX: number;
  scrollY: number;
};

/** Panel → content (commands / requests). */
export type PanelToContentMessage =
  | (ContentPanelEnvelope & {
      type: "nn_cp/request_page_context";
      requestId: string;
    })
  | (ContentPanelEnvelope & {
      type: "nn_cp/start_anchor_pick";
      requestId: string;
    })
  | (ContentPanelEnvelope & {
      type: "nn_cp/cancel_anchor_pick";
      requestId: string;
    })
  | (ContentPanelEnvelope & {
      type: "nn_cp/scroll_to_anchor";
      requestId: string;
      payload: AnchorScrollPayload;
    });

/** Content → panel (responses / events). */
export type ContentToPanelMessage =
  | (ContentPanelEnvelope & {
      type: "nn_cp/page_context";
      requestId: string;
      payload: PageContextPayload;
    })
  | (ContentPanelEnvelope & {
      type: "nn_cp/anchor_pick_result";
      requestId: string;
      payload: AnchorPickPayload;
    })
  | (ContentPanelEnvelope & {
      type: "nn_cp/anchor_pick_cancelled";
      requestId: string;
    })
  | (ContentPanelEnvelope & {
      type: "nn_cp/error";
      requestId: string;
      code: string;
      message: string;
    })
  | (ContentPanelEnvelope & {
      type: "nn_cp/anchor_scroll_result";
      requestId: string;
      elementFound: boolean;
    });

export function isPanelToContentMessage(
  value: unknown,
): value is PanelToContentMessage {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const m = value as Record<string, unknown>;
  if (m.v !== CONTENT_PANEL_PROTOCOL_VERSION) {
    return false;
  }
  if (typeof m.requestId !== "string" || m.requestId.length === 0) {
    return false;
  }
  const t = m.type;
  if (t === "nn_cp/request_page_context") {
    return true;
  }
  if (t === "nn_cp/start_anchor_pick") {
    return true;
  }
  if (t === "nn_cp/cancel_anchor_pick") {
    return true;
  }
  if (t === "nn_cp/scroll_to_anchor") {
    const p = m.payload as Record<string, unknown> | null;
    return (
      typeof p === "object" &&
      p !== null &&
      typeof p.elementSelector === "string" &&
      typeof p.scrollX === "number" &&
      typeof p.scrollY === "number"
    );
  }
  return false;
}
