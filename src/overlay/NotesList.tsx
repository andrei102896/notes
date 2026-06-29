import React, { useCallback, useMemo, useRef } from "react";

import { DndContext, DragOverlay } from "@dnd-kit/core";
import { createPortal } from "react-dom";

import { useNoteDrag } from "@/hooks/useNoteDrag";
import { useNoteSelection } from "@/hooks/useNoteSelection";
import { noteUrlMatchesBrowserTab } from "@/lib/nnDashboardNotes";
import { buildFlatEntries } from "@/lib/notesListGeometry";
import { DragClone } from "@/overlay/DragClone";
import { DraggableNoteRow } from "@/overlay/DraggableNoteRow";
import { DropIndicator } from "@/overlay/DropIndicator";
import type {
  NNCopiedNote,
  NNNoteListLayout,
  NNSyncNote,
} from "@/types/nnData";

type NotesListProps = {
  notesById: Map<string, NNSyncNote>;
  noteLayout: NNNoteListLayout;
  browserTabUrlKey: string | null;
  activeSubjectTabId: string | null;
  activeNoteId: string | null;
  isNoteExpanded: (noteId: string) => boolean;
  onSetNoteExpanded: (noteId: string, expanded: boolean) => void;
  onUpdateNote: (
    noteId: string,
    patch: Partial<Pick<NNSyncNote, "url" | "heading" | "body">>,
  ) => void | Promise<void>;
  onHighlightNote: (noteId: string | null) => void;
  onValidityChange: (noteId: string, isInvalid: boolean) => void;
  onActivateNote: (noteId: string) => void;
  onRequestDelete: (noteId: string) => void;
  onCommitNoteLayout: (next: NNNoteListLayout) => Promise<void>;
  copiedNote: NNCopiedNote | null;
  onCopyNote: (noteId: string) => void;
  /** Disables sorting (drag&drop) and propagates a read-only state to Note. */
  isReadOnly?: boolean;
};

export function NotesList({
  notesById,
  noteLayout,
  browserTabUrlKey,
  activeSubjectTabId,
  activeNoteId,
  isNoteExpanded,
  onSetNoteExpanded,
  onUpdateNote,
  onHighlightNote,
  onValidityChange,
  onActivateNote,
  onRequestDelete,
  onCommitNoteLayout,
  copiedNote,
  onCopyNote,
  isReadOnly = false,
}: NotesListProps): React.ReactElement {
  const listContainerRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef(noteLayout);

  const selection = useNoteSelection({
    layoutRef,
    activeSubjectTabId,
    listContainerRef,
  });
  const drag = useNoteDrag({
    noteLayout,
    layoutRef,
    listContainerRef,
    onCommitNoteLayout,
    selectedNoteIds: selection.selectedNoteIds,
    clearSelection: selection.clearSelection,
    reconcileWithVisible: selection.reconcileWithVisible,
  });

  const { selectedNoteIds, handleSelect } = selection;
  const {
    layout,
    activeId,
    indicator,
    overlayHost,
    sensors,
    isMultiActive,
    dragOrderRef,
    dragHandlers,
  } = drag;

  const renderNoteRow = useCallback(
    (
      noteId: string,
      marginClass: string,
      dimmed = false,
      isSelected = false,
    ): React.ReactNode => {
      const note = notesById.get(noteId);
      if (!note) {
        return null;
      }
      const matchesCurrentPage =
        browserTabUrlKey !== null &&
        noteUrlMatchesBrowserTab(note.url, browserTabUrlKey);
      return (
        <DraggableNoteRow
          key={note.id}
          note={note}
          marginClass={marginClass}
          dimmed={dimmed}
          activeSubjectTabId={activeSubjectTabId}
          isActive={activeNoteId === note.id}
          isSelected={isSelected}
          isExpanded={isNoteExpanded(note.id)}
          matchesCurrentPage={matchesCurrentPage}
          isReadOnly={isReadOnly}
          onActivateNote={onActivateNote}
          onSelect={handleSelect}
          onSetNoteExpanded={onSetNoteExpanded}
          onUpdateNote={onUpdateNote}
          onHighlightNote={onHighlightNote}
          onValidityChange={onValidityChange}
          onRequestDelete={onRequestDelete}
          copiedNote={copiedNote}
          onCopyNote={onCopyNote}
        />
      );
    },
    [
      notesById,
      browserTabUrlKey,
      activeSubjectTabId,
      activeNoteId,
      isNoteExpanded,
      isReadOnly,
      onActivateNote,
      handleSelect,
      onSetNoteExpanded,
      onUpdateNote,
      onHighlightNote,
      onValidityChange,
      onRequestDelete,
      copiedNote,
      onCopyNote,
    ],
  );

  // Memoized so a per-move indicator update reuses the same row elements; React then skips reconciling the rows (and the expensive Note bodies). indicator is intentionally NOT a dep.
  const rows = useMemo(
    () =>
      buildFlatEntries(layout).map(({ noteId, marginClass }) => {
        const dimmed =
          activeId !== null &&
          (noteId === activeId ||
            (isMultiActive && selectedNoteIds.has(noteId)));
        return renderNoteRow(
          noteId,
          marginClass,
          dimmed,
          selectedNoteIds.has(noteId),
        );
      }),
    [layout, activeId, isMultiActive, selectedNoteIds, renderNoteRow],
  );

  const activeNote = activeId ? (notesById.get(activeId) ?? null) : null;
  const backNotes = activeNote
    ? dragOrderRef.current
        .filter((nid) => nid !== activeId)
        .slice(0, 2)
        .map((nid) => notesById.get(nid))
        .filter((n): n is NNSyncNote => n !== undefined)
    : [];

  return (
    <DndContext sensors={sensors} {...dragHandlers}>
      {/* Flat column; section separation is each head's leading margin. Relative so the insertion line positions against it. */}
      <div ref={listContainerRef} className="relative m-0 flex flex-col p-0">
        {rows}
        <DropIndicator indicator={indicator} />
      </div>
      {overlayHost &&
        createPortal(
          <DragOverlay dropAnimation={null}>
            {activeNote ? (
              <DragClone
                note={activeNote}
                backNotes={backNotes}
                isMulti={isMultiActive}
                count={selectedNoteIds.size}
                activeSubjectTabId={activeSubjectTabId}
                browserTabUrlKey={browserTabUrlKey}
                isNoteExpanded={isNoteExpanded}
              />
            ) : null}
          </DragOverlay>,
          overlayHost,
        )}
    </DndContext>
  );
}
