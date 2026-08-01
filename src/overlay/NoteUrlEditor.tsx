import React, { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Input } from "@/components/ui/input";
import { toOpenableUrl, useNoteLinkAnchor } from "@/hooks/useNoteLinkAnchor";
import type { FormatState } from "@/lib/richTextFormat";
import { cn } from "@/lib/utils";
import type { NNAnchorPosition } from "@/types/nnData";

function formatCreatedDateForBox(timestamp: number): string {
  const date = new Date(timestamp);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const year = String(date.getFullYear());
  return `${month}/${day}/${year}`;
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
  // Keep significant trailing slashes on sub-paths (some servers 404 without them, e.g. audi.com/en/); drop only the bare root slash for a clean homepage.
  const cleanedPath = path === "/" ? "" : path;
  return `${parsed.host}${cleanedPath}`;
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
  const [isCopyFlashing, setIsCopyFlashing] = useState(false);
  const copyFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const {
    canOpenLink,
    isPicking,
    handleLinkClick,
    handleLinkContextMenu,
    handleAnchorClick,
    handleAnchorContextMenu,
  } = useNoteLinkAnchor({
    linkUrl: draft,
    anchorUrl: value,
    anchor,
    isReadOnly,
    onSaveAnchor,
    onInteract,
  });

  return (
    <div className="bg-background">
      <div className="flex items-stretch border-b border-black">
        <div className="flex h-5 w-12 shrink-0 items-center justify-center border-r border-black bg-note-field font-ui text-note-meta font-bold">
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
            // Keep the raw text while typing; normalize + persist on commit (blur/Enter) so slashes and paths aren't stripped mid-keystroke.
            setDraft(event.target.value);
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
        <div className="flex h-5 w-26 shrink-0 items-center justify-center border-l border-black bg-note-field font-ui text-note-meta font-bold">
          {formatCreatedDateForBox(createdAt)}
        </div>
      </div>

      <div className="flex h-9 items-stretch">
        {/* border-r closes the action group with a divider after PASTE, mirroring the B/I/U group's border-l (like the URL row's bordered URL/date boxes flanking the input). */}
        <ButtonGroup className="border-r border-black">
          <Button
            variant="secondary"
            aria-label="Navigate to URL"
            disabled={!canOpenLink}
            onClick={handleLinkClick}
            onContextMenu={handleLinkContextMenu}
            className="h-9 w-12 shrink-0 bg-note-action px-0 font-normal text-md text-white hover:bg-note-action/90"
          >
            LINK
          </Button>

          <Button
            aria-label={
              anchor ? "Navigate to anchor position" : "Pick page anchor"
            }
            // Deleted URL greys ANCHOR whether or not one is set (client 2026-08-01); the live draft, so it
            // greys as the field empties rather than on blur.
            disabled={draft.trim() === "" || (isReadOnly && !anchor)}
            onMouseDown={(event) => {
              // Stop row-level selection handlers treating anchor clicks (notably Cmd/Ctrl+click) as note-selection gestures.
              event.stopPropagation();
            }}
            onClick={handleAnchorClick}
            onContextMenu={handleAnchorContextMenu}
            className={cn(
              "h-9 px-2 font-normal text-md",
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
              "h-9 bg-note-action px-2 text-md font-normal text-white transition-colors hover:bg-note-action/90",
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
              className="h-9 px-2 text-md font-normal text-black hover:bg-white bg-white"
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
              className="h-9 px-2 text-md text-black hover:bg-white bg-white font-normal"
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
              "h-full flex-1 rounded-none border-0 border-r border-black p-0 font-ui text-md font-bold",
              formatState?.bold ? "bg-accent text-white" : "bg-note text-black",
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
              "h-full flex-1 rounded-none border-0 border-r border-black p-0 font-ui text-md font-medium italic",
              formatState?.italic
                ? "bg-accent text-white"
                : "bg-note text-black",
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
              "h-full flex-1 rounded-none border-0 p-0 font-ui text-md font-bold underline",
              formatState?.underline
                ? "bg-accent text-white"
                : "bg-note text-black",
            )}
          >
            U
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
