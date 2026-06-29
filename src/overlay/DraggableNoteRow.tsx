import React from "react";

import { useDraggable } from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import { Note, type NoteSelectModifiers } from "@/overlay/Note";
import type { NNCopiedNote, NNSyncNote } from "@/types/nnData";

type DraggableNoteRowProps = {
  note: NNSyncNote;
  /** Leading margin class — small within a section, large at a section head. */
  marginClass: string;
  /** Any note in the dragged set — dim it in place (the clone rides the cursor). */
  dimmed?: boolean;
  activeSubjectTabId: string | null;
  isActive: boolean;
  /** Part of a multi-note selection. */
  isSelected: boolean;
  isExpanded: boolean;
  matchesCurrentPage: boolean;
  onActivateNote: (noteId: string) => void;
  onSelect: (noteId: string, mods: NoteSelectModifiers) => void;
  onSetNoteExpanded: (noteId: string, expanded: boolean) => void;
  onUpdateNote: (
    noteId: string,
    patch: Partial<Pick<NNSyncNote, "url" | "heading" | "body">>,
  ) => void | Promise<void>;
  onHighlightNote: (noteId: string | null) => void;
  onValidityChange: (noteId: string, isInvalid: boolean) => void;
  onRequestDelete: (noteId: string) => void;
  copiedNote: NNCopiedNote | null;
  onCopyNote: (noteId: string) => void;
  isReadOnly?: boolean;
};

export const DraggableNoteRow = React.memo(function DraggableNoteRow({
  note,
  marginClass,
  dimmed = false,
  activeSubjectTabId,
  isActive,
  isSelected,
  isExpanded,
  matchesCurrentPage,
  onActivateNote,
  onSelect,
  onSetNoteExpanded,
  onUpdateNote,
  onHighlightNote,
  onValidityChange,
  onRequestDelete,
  copiedNote,
  onCopyNote,
  isReadOnly = false,
}: DraggableNoteRowProps): React.ReactElement {
  const { attributes, listeners, setNodeRef } = useDraggable({
    id: note.id,
    disabled: isReadOnly,
  });

  // Row never moves during a drag: active note dims in place, the DragOverlay clone follows the cursor (no transform).
  return (
    <div
      ref={setNodeRef}
      data-note-id={note.id}
      className={cn("flex flex-col", marginClass)}
    >
      <div className={dimmed ? "opacity-40" : undefined}>
        <Note
          note={note}
          activeSubjectTabId={activeSubjectTabId}
          expanded={isExpanded}
          isActive={isActive}
          isSelected={isSelected}
          matchesCurrentPage={matchesCurrentPage}
          isReadOnly={isReadOnly}
          onActivate={onActivateNote}
          onSelect={onSelect}
          onSetExpanded={onSetNoteExpanded}
          onUpdateNote={onUpdateNote}
          onHighlightNote={onHighlightNote}
          onValidityChange={onValidityChange}
          onRequestDelete={onRequestDelete}
          copiedNote={copiedNote}
          onCopyNote={onCopyNote}
          sortableHandleProps={
            isReadOnly ? undefined : { ...attributes, ...listeners }
          }
        />
      </div>
    </div>
  );
});
