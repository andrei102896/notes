import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { browsingContextWindowForTabUrl } from "@/lib/browsingContextWindow";
import {
  clearPendingAnchorState,
  markOverlayReopenOnNextNavigation,
  setPendingAnchorForNavigation,
  setPendingAnchorForNewTab,
} from "@/lib/pendingNavigation";
import type { FormatState } from "@/lib/richTextFormat";
import { cn } from "@/lib/utils";
import { getContentPanelClient } from "@/messaging/contentPanelBridge";
import type { NNAnchorPosition } from "@/types/nnData";

function formatCreatedDateForBox(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}/${day}/${year}`;
}

function trimTrailingSlash(url: string): string {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}

function toOpenableUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const direct = new URL(trimmed);
    if (direct.protocol === "http:" || direct.protocol === "https:") {
      return trimTrailingSlash(direct.toString());
    }
    return null;
  } catch {
    try {
      const withHttps = new URL(`https://${trimmed}`);
      if (!withHttps.hostname.includes(".")) {
        return null;
      }
      return trimTrailingSlash(withHttps.toString());
    } catch {
      return null;
    }
  }
}

function isValidUrl(value: string): boolean {
  return toOpenableUrl(value) !== null;
}

function normalizeUrlForStorage(value: string): string {
  const openable = toOpenableUrl(value);
  if (!openable) {
    return "";
  }
  const parsed = new URL(openable);
  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return trimTrailingSlash(`${parsed.host}${path}`);
}

function normalizeDraftUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = normalizeUrlForStorage(trimmed);
  return normalized || trimmed;
}

type NoteUrlEditorProps = {
  value: string;
  anchor: NNAnchorPosition | null;
  activeSubjectTabId: string | null;
  createdAt: number;
  onSave: (nextUrl: string) => void;
  onSaveAnchor: (anchor: NNAnchorPosition | null) => void;
  onCopyNote: () => void;
  showNotePaste: boolean;
  onPasteNote?: () => void;
  onValidityChange: (isInvalid: boolean) => void;
  onInteract: () => void;
  formatState?: FormatState;
  onApplyFormat?: (command: "bold" | "italic" | "underline") => void;
  /** Trial-ended unpaid mode: URL frozen, anchor not re-pickable (existing still navigable), Paste hidden, B/I/U off; LINK/COPY/ANCHOR-navigate stay on. */
  isReadOnly?: boolean;
};

export function NoteUrlEditor({
  value,
  anchor,
  createdAt,
  onSave,
  onSaveAnchor,
  onCopyNote,
  showNotePaste,
  onPasteNote,
  onValidityChange,
  onInteract,
  formatState,
  onApplyFormat,
  isReadOnly = false,
}: NoteUrlEditorProps): React.ReactElement {
  const [draft, setDraft] = useState(value);
  const [isPicking, setIsPicking] = useState(false);
  const [isCopyFlashing, setIsCopyFlashing] = useState(false);
  const copyFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pickSessionRef = useRef<{ requestId: string } | null>(null);

  useEffect(() => {
    setDraft(normalizeDraftUrl(value));
  }, [value]);

  useEffect(() => {
    const trimmed = draft.trim();
    onValidityChange(trimmed.length > 0 && !isValidUrl(trimmed));
  }, [draft, onValidityChange]);

  const commit = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) {
      onSave("");
      return;
    }
    const normalized = normalizeUrlForStorage(trimmed);
    if (normalized) {
      setDraft(normalized);
      onSave(normalized);
      return;
    }
    // Invalid input was never persisted — quietly restore the last saved URL instead of nagging.
    setDraft(normalizeDraftUrl(value));
  }, [draft, onSave, value]);

  const openableDraftUrl = toOpenableUrl(draft);
  const canOpenLink = openableDraftUrl !== null;

  const openInNewTab = useCallback((targetUrl: string) => {
    chrome.runtime.sendMessage(
      {
        type: "OPEN_URL_IN_NEW_TAB",
        payload: { url: targetUrl },
      },
      (response?: { ok?: boolean }) => {
        if (response?.ok) {
          return;
        }
        window.open(targetUrl, "_blank", "noopener,noreferrer");
      },
    );
  }, []);

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

  return (
    <div className="bg-background">
      <div className="flex items-stretch border-b border-black">
        <div className="flex h-5 w-12 shrink-0 items-center justify-center border-r border-black bg-note-field font-ui text-note-meta font-bold leading-none">
          URL
        </div>

        <Input
          aria-label="Note URL"
          value={draft}
          readOnly={isReadOnly}
          onChange={(event) => {
            if (isReadOnly) {
              return;
            }
            onInteract();
            const nextValue = event.target.value;
            const trimmed = nextValue.trim();
            if (!trimmed) {
              setDraft("");
              onSave("");
            } else if (isValidUrl(trimmed)) {
              const normalized = normalizeUrlForStorage(trimmed);
              if (normalized) {
                setDraft(normalized);
                onSave(normalized);
              } else {
                setDraft(nextValue);
              }
            } else {
              setDraft(nextValue);
            }
          }}
          onBlur={isReadOnly ? undefined : commit}
          onFocus={onInteract}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              if (!isReadOnly) {
                commit();
              }
            }
          }}
          className="h-5 min-w-0 flex-1 rounded-none border-0 bg-note-field px-2 font-ui text-note-meta font-bold shadow-none focus-visible:ring-0"
        />
        <div className="flex h-5 w-26 shrink-0 items-center justify-center border-l border-black bg-note-field px-2 font-ui text-note-meta font-bold leading-none">
          {formatCreatedDateForBox(createdAt)}
        </div>
      </div>

      <div className="flex h-9 items-stretch">
        <ButtonGroup>
          <Button
            variant="secondary"
            aria-label="Navigate to URL"
            disabled={!canOpenLink}
            onClick={() => {
              onInteract();
              const target = toOpenableUrl(draft);
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
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              onInteract();
              const target = toOpenableUrl(draft);
              if (!target) {
                return;
              }
              const tabWin = browsingContextWindowForTabUrl();
              clearPendingAnchorState(tabWin, target);
              openInNewTab(target);
            }}
            className="h-9 w-12 shrink-0 bg-note-action px-0 font-semibold text-md text-white hover:bg-note-action/90"
          >
            LINK
          </Button>

          <Button
            aria-label={
              anchor ? "Navigate to anchor position" : "Pick page anchor"
            }
            disabled={isReadOnly && !anchor}
            onMouseDown={(event) => {
              // Stop row-level selection handlers treating anchor clicks (notably Cmd/Ctrl+click) as note-selection gestures.
              event.stopPropagation();
            }}
            onClick={async (event) => {
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
                const targetUrl = toOpenableUrl(value);
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
            }}
            onContextMenu={(event) => {
              event.stopPropagation();
              if (!anchor) {
                return;
              }
              event.preventDefault();
              onInteract();
              const targetUrl = toOpenableUrl(value);
              if (!targetUrl) {
                return;
              }
              setPendingAnchorForNewTab(targetUrl, anchor);
              openInNewTab(targetUrl);
            }}
            className={cn(
              "h-9 px-2 font-semibold text-md",
              anchor || isPicking
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-background text-black hover:bg-muted border border-white",
            )}
          >
            {isPicking ? "PICKING…" : "ANCHOR"}
          </Button>

          <Button
            variant="secondary"
            aria-label="Copy note"
            onClick={() => {
              onInteract();
              onCopyNote();
              if (copyFlashTimerRef.current !== null) {
                clearTimeout(copyFlashTimerRef.current);
              }
              setIsCopyFlashing(true);
              copyFlashTimerRef.current = setTimeout(() => {
                setIsCopyFlashing(false);
                copyFlashTimerRef.current = null;
              }, 1500);
            }}
            className={cn(
              "h-9 bg-note-action px-2 text-md font-semibold text-white transition-colors hover:bg-note-action/90",
              isCopyFlashing && "bg-accent hover:bg-accent",
            )}
          >
            COPY
          </Button>

          {showNotePaste ? (
            <Button
              aria-label="Paste note"
              onClick={() => {
                onInteract();
                onPasteNote?.();
              }}
              className="h-9 px-2 text-md font-semibold text-black hover:bg-white bg-white"
            >
              PASTE
            </Button>
          ) : isReadOnly ? null : (
            <Button
              aria-label="Paste URL"
              onClick={async () => {
                onInteract();
                try {
                  const pasted = await navigator.clipboard.readText();
                  if (typeof pasted !== "string") {
                    return;
                  }
                  const trimmed = pasted.trim();
                  if (!trimmed) {
                    setDraft("");
                    onSave("");
                  } else if (isValidUrl(trimmed)) {
                    const normalized = normalizeUrlForStorage(trimmed);
                    if (normalized) {
                      setDraft(normalized);
                      onSave(normalized);
                    } else {
                      setDraft(pasted);
                    }
                  } else {
                    setDraft(pasted);
                  }
                } catch {
                  // Ignore clipboard permission failures silently.
                }
              }}
              className="h-9 px-2 text-md text-black hover:bg-white bg-white font-semibold"
            >
              PASTE
            </Button>
          )}
        </ButtonGroup>

        <div className="flex-1 bg-background" aria-hidden />

        <ButtonGroup className="w-26 shrink-0 border-l border-black">
          <Button
            variant="icon"
            aria-label="Bold"
            aria-pressed={formatState?.bold ?? false}
            disabled={isReadOnly}
            onMouseDown={(event) => {
              event.preventDefault();
              if (isReadOnly) {
                return;
              }
              onApplyFormat?.("bold");
            }}
            className={cn(
              "h-full flex-1 rounded-none border-0 border-r border-black p-0 text-md font-bold",
              formatState?.bold
                ? "bg-accent text-white"
                : "bg-note text-primary",
            )}
          >
            B
          </Button>
          <Button
            variant="icon"
            aria-label="Italic"
            aria-pressed={formatState?.italic ?? false}
            disabled={isReadOnly}
            onMouseDown={(event) => {
              event.preventDefault();
              if (isReadOnly) {
                return;
              }
              onApplyFormat?.("italic");
            }}
            className={cn(
              "h-full flex-1 rounded-none border-0 border-r border-black p-0 text-md italic",
              formatState?.italic
                ? "bg-accent text-white"
                : "bg-note text-primary",
            )}
          >
            I
          </Button>
          <Button
            variant="icon"
            aria-label="Underline"
            aria-pressed={formatState?.underline ?? false}
            disabled={isReadOnly}
            onMouseDown={(event) => {
              event.preventDefault();
              if (isReadOnly) {
                return;
              }
              onApplyFormat?.("underline");
            }}
            className={cn(
              "h-full flex-1 rounded-none border-0 p-0 text-md underline",
              formatState?.underline
                ? "bg-accent text-white"
                : "bg-note text-primary",
            )}
          >
            U
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
