import React, { useEffect, useRef, useState } from "react";

import { Columns4, Minus, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import type { FormatState } from "@/lib/richTextFormat";
import { cn } from "@/lib/utils";
import { NoteUrlEditor } from "@/overlay/NoteUrlEditor";
import {
  RichTextBodyEditor,
  type RichTextBodyEditorHandle,
} from "@/overlay/RichTextBodyEditor";
import type { NNCopiedNote, NNSyncNote } from "@/types/nnData";

const NOTE_HEADING_MAX_LEN = 50;

/** Modifier keys a selection click carries (Cmd/Ctrl = toggle, Shift = range). */
export type NoteSelectModifiers = {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
};

type NoteProps = {
  note: NNSyncNote;
  activeSubjectTabId: string | null;
  expanded: boolean;
  isActive: boolean;
  /** Part of a multi-note selection — shows the selection ring. */
  isSelected?: boolean;
  matchesCurrentPage: boolean;
  /** Trial-ended unpaid mode: heading/body/url frozen, delete hidden. */
  isReadOnly?: boolean;
  onActivate: (noteId: string) => void;
  onSelect?: (noteId: string, mods: NoteSelectModifiers) => void;
  onSetExpanded: (noteId: string, expanded: boolean) => void;
  onUpdateNote: (
    noteId: string,
    patch: Partial<
      Pick<NNSyncNote, "url" | "heading" | "body" | "anchor" | "createdAt">
    >,
  ) => void | Promise<void>;
  onHighlightNote: (noteId: string | null) => void;
  onValidityChange: (noteId: string, isInvalid: boolean) => void;
  onRequestDelete: (noteId: string) => void;
  copiedNote: NNCopiedNote | null;
  onCopyNote: (noteId: string) => void;
  sortableHandleProps?: React.HTMLAttributes<HTMLDivElement>;
};

export function Note({
  note,
  activeSubjectTabId,
  expanded,
  isSelected = false,
  matchesCurrentPage,
  isReadOnly = false,
  onActivate,
  onSelect,
  onSetExpanded,
  onUpdateNote,
  onHighlightNote,
  onValidityChange,
  onRequestDelete,
  copiedNote,
  onCopyNote,
  sortableHandleProps,
}: NoteProps): React.ReactElement {
  const editorRef = useRef<RichTextBodyEditorHandle>(null);
  const showNotePaste = copiedNote !== null && !isReadOnly;
  const [formatState, setFormatState] = useState<FormatState>({
    bold: false,
    italic: false,
    underline: false,
  });

  // Heading runs on a local draft (async persist would reset the caret); adopt external changes only while unfocused.
  const headingFocusedRef = useRef(false);
  const [headingFocused, setHeadingFocused] = useState(false);
  const [headingDraft, setHeadingDraft] = useState(note.heading);
  useEffect(() => {
    if (!headingFocusedRef.current) {
      setHeadingDraft(note.heading);
    }
  }, [note.heading]);

  // Header is the drag handle only while the title is unfocused, so a focused title can drag-select text.
  const headerHandleProps =
    sortableHandleProps && !headingFocused ? sortableHandleProps : undefined;

  return (
    <Card
      onMouseDown={() => onActivate(note.id)}
      className={cn(
        "border-[6px] bg-note p-0",
        isSelected && "ring-2 ring-primary ring-offset-2",
        matchesCurrentPage ? "border-accent" : "border-border",
      )}
    >
      <Collapsible
        open={expanded}
        onOpenChange={(open) => onSetExpanded(note.id, open)}
      >
        <div
          className={cn(
            "flex h-10 items-stretch",
            headerHandleProps ? "cursor-grab active:cursor-grabbing" : "",
          )}
          {...headerHandleProps}
        >
          <Input
            type="text"
            aria-label="Note heading"
            data-note-title
            maxLength={NOTE_HEADING_MAX_LEN}
            value={headingDraft}
            readOnly={isReadOnly}
            onChange={(event) => {
              if (isReadOnly) {
                return;
              }
              setHeadingDraft(event.target.value);
              onActivate(note.id);
              onHighlightNote(note.id);
              void onUpdateNote(note.id, { heading: event.target.value });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.stopPropagation();
                return;
              }
              if (event.key === " ") {
                event.stopPropagation();
              }
            }}
            onMouseDown={(event) => {
              // Don't focus on press so a drag (>activation distance) moves the note; a clean click focuses via onClick, so click+drag never edits the title.
              if (!headingFocused && !isReadOnly) {
                event.preventDefault();
              }
            }}
            onClick={(event) => {
              if (headingFocused || isReadOnly) {
                return;
              }
              // Modifier-click selects (dnd-kit suppresses this click after a real drag, so a modifier-drag never selects); a clean click edits the title.
              if (event.metaKey || event.ctrlKey || event.shiftKey) {
                // Mouse-down preventDefault blocks the implicit blur, so a note being edited elsewhere keeps focus — drop it explicitly. (No instanceof: the node lives in the iframe realm, where the content-script HTMLElement won't match.)
                const active = event.currentTarget.ownerDocument
                  .activeElement as HTMLElement | null;
                if (active && active !== event.currentTarget) {
                  active.blur();
                }
                onSelect?.(note.id, {
                  metaKey: event.metaKey,
                  ctrlKey: event.ctrlKey,
                  shiftKey: event.shiftKey,
                });
                return;
              }
              onSelect?.(note.id, {
                metaKey: false,
                ctrlKey: false,
                shiftKey: false,
              });
              event.currentTarget.focus();
            }}
            onFocus={() => {
              headingFocusedRef.current = true;
              setHeadingFocused(true);
              onActivate(note.id);
            }}
            onBlur={() => {
              headingFocusedRef.current = false;
              setHeadingFocused(false);
            }}
            className="h-full w-full rounded-none border-0 bg-muted-foreground px-3 leading-none font-normal text-white outline-none cursor-pointer"
          />
          <div className="flex shrink-0 items-stretch">
            <CollapsibleTrigger asChild>
              <Button
                variant="icon"
                aria-label="Collapse note"
                disabled={!expanded}
                onClick={() => onActivate(note.id)}
                className="border-0 bg-muted p-0 text-foreground disabled:opacity-100"
              >
                <Minus />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleTrigger asChild>
              <Button
                variant="icon"
                aria-label="Expand note"
                disabled={expanded}
                onClick={() => onActivate(note.id)}
                className="border-0 bg-muted p-0 text-foreground disabled:opacity-100"
              >
                <Square />
              </Button>
            </CollapsibleTrigger>
            <Button
              variant="icon"
              aria-label="Delete note"
              disabled={isReadOnly}
              onClick={() => {
                onActivate(note.id);
                onRequestDelete(note.id);
              }}
              className="rounded-none border-0 bg-muted-foreground p-0 text-white hover:bg-muted-foreground"
            >
              <Columns4 />
            </Button>
          </div>
        </div>

        <CollapsibleContent className="data-[state=open]:block data-[state=closed]:hidden">
          <RichTextBodyEditor
            ref={editorRef}
            value={note.body}
            isReadOnly={isReadOnly}
            onChange={(nextHtml) => {
              if (isReadOnly) {
                return;
              }
              onHighlightNote(note.id);
              void onUpdateNote(note.id, { body: nextHtml });
            }}
            onInteract={() => onActivate(note.id)}
            onFormatStateChange={setFormatState}
          />
          <NoteUrlEditor
            value={note.url}
            anchor={note.anchor ?? null}
            activeSubjectTabId={activeSubjectTabId}
            createdAt={note.createdAt}
            isReadOnly={isReadOnly}
            onSave={(nextUrl) => {
              if (isReadOnly) {
                return;
              }
              onHighlightNote(note.id);
              void onUpdateNote(note.id, { url: nextUrl });
            }}
            onSaveAnchor={(anchor) => {
              if (isReadOnly) {
                return;
              }
              onHighlightNote(note.id);
              void onUpdateNote(note.id, { anchor });
            }}
            onCopyNote={() => onCopyNote(note.id)}
            showNotePaste={showNotePaste}
            onPasteNote={
              copiedNote && !isReadOnly
                ? () => {
                    onHighlightNote(note.id);
                    void onUpdateNote(note.id, {
                      heading: copiedNote.heading,
                      body: copiedNote.body,
                      url: copiedNote.url,
                      createdAt: copiedNote.createdAt,
                      anchor: copiedNote.anchor,
                    });
                  }
                : undefined
            }
            onValidityChange={(isInvalid) =>
              onValidityChange(note.id, isInvalid)
            }
            onInteract={() => {
              onActivate(note.id);
              onHighlightNote(note.id);
            }}
            formatState={formatState}
            onApplyFormat={(cmd) => editorRef.current?.applyFormat(cmd)}
          />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
