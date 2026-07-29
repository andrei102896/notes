import { useCallback, useRef, useState } from "react";

import { browsingContextWindowForTabUrl } from "@/lib/browsingContextWindow";
import { openInNewTab } from "@/lib/openInNewTab";
import {
  clearPendingAnchorState,
  markOverlayReopenOnNextNavigation,
  setPendingAnchorForNavigation,
  setPendingAnchorForNewTab,
} from "@/lib/pendingNavigation";
import { getContentPanelClient } from "@/messaging/contentPanelBridge";
import type { NNAnchorPosition } from "@/types/nnData";

export function toOpenableUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const direct = new URL(trimmed);
    if (direct.protocol === "http:" || direct.protocol === "https:") {
      return direct.toString();
    }
    return null;
  } catch {
    try {
      const withHttps = new URL(`https://${trimmed}`);
      if (!withHttps.hostname.includes(".")) {
        return null;
      }
      return withHttps.toString();
    } catch {
      return null;
    }
  }
}

type UseNoteLinkAnchorInput = {
  /** URL the LINK button opens (the expanded editor passes its unsaved draft). */
  linkUrl: string;
  /** Persisted URL — the anchor navigation target. */
  anchorUrl: string;
  anchor: NNAnchorPosition | null;
  isReadOnly: boolean;
  onSaveAnchor: (anchor: NNAnchorPosition | null) => void;
  onInteract: () => void;
};

/** LINK/ANCHOR actions shared by the expanded URL row and the collapsed header bar. */
export function useNoteLinkAnchor({
  linkUrl,
  anchorUrl,
  anchor,
  isReadOnly,
  onSaveAnchor,
  onInteract,
}: UseNoteLinkAnchorInput) {
  const [isPicking, setIsPicking] = useState(false);
  const pickSessionRef = useRef<{ requestId: string } | null>(null);

  const navigateSameTab = useCallback(
    (targetUrl: string, options: { scrollToAnchor?: boolean }) => {
      const tabWin = browsingContextWindowForTabUrl();
      if (options.scrollToAnchor && anchor) {
        setPendingAnchorForNavigation(tabWin, targetUrl, anchor);
      } else {
        clearPendingAnchorState(tabWin, targetUrl, tabWin.location.href);
      }
      markOverlayReopenOnNextNavigation(tabWin, targetUrl);
      tabWin.location.href = targetUrl;
    },
    [anchor],
  );

  const canOpenLink = toOpenableUrl(linkUrl) !== null;

  const handleLinkClick = useCallback(() => {
    onInteract();
    const target = toOpenableUrl(linkUrl);
    if (!target) {
      return;
    }
    const tabWin = browsingContextWindowForTabUrl();
    const normalizedCurrent = toOpenableUrl(tabWin.location.href);
    if (normalizedCurrent !== null && normalizedCurrent === target) {
      // Same page — nothing to navigate, extension stays open.
      return;
    }
    navigateSameTab(target, { scrollToAnchor: false });
  }, [linkUrl, navigateSameTab, onInteract]);

  const handleLinkContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      onInteract();
      const target = toOpenableUrl(linkUrl);
      if (!target) {
        return;
      }
      const tabWin = browsingContextWindowForTabUrl();
      clearPendingAnchorState(tabWin, target);
      openInNewTab(target);
    },
    [linkUrl, onInteract],
  );

  const handleAnchorClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onInteract();
      if (anchor && (event.ctrlKey || event.metaKey)) {
        if (isReadOnly) {
          return;
        }
        onSaveAnchor(null);
        return;
      }
      if (anchor) {
        const targetUrl = toOpenableUrl(anchorUrl);
        if (!targetUrl) {
          return;
        }
        const tabWin = browsingContextWindowForTabUrl();
        const normalizedCurrent = toOpenableUrl(tabWin.location.href);
        const isSamePage =
          normalizedCurrent !== null && normalizedCurrent === targetUrl;
        if (isSamePage) {
          try {
            await getContentPanelClient().scrollToAnchor(anchor);
          } catch {
            /* content script unavailable */
          }
        } else {
          navigateSameTab(targetUrl, { scrollToAnchor: true });
        }
        return;
      }
      if (isReadOnly) {
        return;
      }
      if (isPicking) {
        if (pickSessionRef.current) {
          getContentPanelClient().cancelAnchorPick(
            pickSessionRef.current.requestId,
          );
          pickSessionRef.current = null;
        }
        setIsPicking(false);
        return;
      }
      setIsPicking(true);
      const client = getContentPanelClient();
      const session = client.startAnchorPick();
      pickSessionRef.current = { requestId: session.requestId };
      try {
        const result = await session.result;
        onSaveAnchor({
          pageX: result.pageX,
          pageY: result.pageY,
          scrollX: result.scrollX,
          scrollY: result.scrollY,
          elementSelector: result.elementSelector,
        });
      } catch {
        // Pick was cancelled or timed out — no change.
      } finally {
        pickSessionRef.current = null;
        setIsPicking(false);
      }
    },
    [anchor, anchorUrl, isPicking, isReadOnly, navigateSameTab, onInteract, onSaveAnchor],
  );

  const handleAnchorContextMenu = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      if (!anchor) {
        return;
      }
      event.preventDefault();
      onInteract();
      const targetUrl = toOpenableUrl(anchorUrl);
      if (!targetUrl) {
        return;
      }
      setPendingAnchorForNewTab(targetUrl, anchor);
      openInNewTab(targetUrl);
    },
    [anchor, anchorUrl, onInteract],
  );

  return {
    canOpenLink,
    isPicking,
    handleLinkClick,
    handleLinkContextMenu,
    handleAnchorClick,
    handleAnchorContextMenu,
  };
}
