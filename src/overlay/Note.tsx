import React, { useRef, useState } from "react";

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

type NoteProps = {
  note: NNSyncNote;
  activeSubjectTabId: string | null;
  expanded: boolean;
  isActive: boolean;
  isSelected?: boolean;
  matchesCurrentPage: boolean;
  /** Trial-ended unpaid mode: heading/body/url frozen, delete hidden. */
  isReadOnly?: boolean;
  onActivate: (noteId: string) => void;
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
  isSelected,
  matchesCurrentPage,
  isReadOnly = false,
  onActivate,
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
            sortableHandleProps ? "cursor-grab active:cursor-grabbing" : "",
          )}
          {...sortableHandleProps}
        >
          <Input
            type="text"
            aria-label="Note heading"
            data-note-title
            value={note.heading}
            readOnly={isReadOnly}
            onChange={(event) => {
              if (isReadOnly) {
                return;
              }
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
            onFocus={() => onActivate(note.id)}
            placeholder="Note heading..."
            className="h-full w-full rounded-none border-0 bg-muted-foreground px-3 leading-none font-bold text-white outline-none placeholder:text-white/80 text-shadow-lg cursor-pointer"
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
              className="rounded-none border-0 bg-muted-foreground p-0 text-white hover:bg-note-action/90 hover:text-white"
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
