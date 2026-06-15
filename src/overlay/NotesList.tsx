import React, { useEffect, useRef, useState } from "react";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { noteUrlMatchesBrowserTab } from "@/lib/nnDashboardNotes";
import {
  cloneNoteListLayout,
  findNotePlacement,
  flattenLayoutNoteIds,
  NN_COLLAPSED_NOTE_HEADER_PX,
  pruneEmptyNoteGroups,
} from "@/lib/nnNoteLayout";
import { cn } from "@/lib/utils";
import { Note } from "@/overlay/Note";
import type {
  NNCopiedNote,
  NNNoteListLayout,
  NNSyncNote,
} from "@/types/nnData";

/** Single droppable at list tail — creates a new group with the dragged note. */
const NEW_SECTION_DROP_ID = "nn-new-section-tail";

const pointerFirstCollision: CollisionDetection = (args) => {
  // Keep drop target in sync with actual mouse position when overlay is offset.
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) {
    return pointerCollisions;
  }
  return closestCorners(args);
};

function isNewSectionDropId(id: string): boolean {
  return id === NEW_SECTION_DROP_ID;
}

function moveNoteToNewGroupAtListEnd(
  layout: NNNoteListLayout,
  activeId: string,
): void {
  const from = findNotePlacement(layout, activeId);
  if (!from) {
    return;
  }
  const fromGroup = layout.groups[from.groupIndex];
  if (!fromGroup) {
    return;
  }
  const [removed] = fromGroup.noteIds.splice(from.indexInGroup, 1);
  pruneEmptyNoteGroups(layout);
  layout.groups.push({
    id: crypto.randomUUID(),
    noteIds: [removed],
  });
}


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

type SortableNoteRowProps = {
  note: NNSyncNote;
  groupId: string;
  gapBeforePx: number;
  activeSubjectTabId: string | null;
  isActive: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  matchesCurrentPage: boolean;
  onActivateNote: (noteId: string) => void;
  onSelectNote: (noteId: string, e: React.MouseEvent) => void;
  onSetNoteExpanded: (noteId: string, expanded: boolean) => void;
  onUpdateNote: NotesListProps["onUpdateNote"];
  onHighlightNote: NotesListProps["onHighlightNote"];
  onValidityChange: NotesListProps["onValidityChange"];
  onRequestDelete: NotesListProps["onRequestDelete"];
  copiedNote: NNCopiedNote | null;
  onCopyNote: (noteId: string) => void;
  isReadOnly?: boolean;
};

function SortableNoteRow({
  note,
  groupId,
  gapBeforePx,
  activeSubjectTabId,
  isActive,
  isSelected,
  isExpanded,
  matchesCurrentPage,
  onActivateNote,
  onSelectNote,
  onSetNoteExpanded,
  onUpdateNote,
  onHighlightNote,
  onValidityChange,
  onRequestDelete,
  copiedNote,
  onCopyNote,
  isReadOnly = false,
}: SortableNoteRowProps): React.ReactElement {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: note.id,
    data: { type: "note", groupId },
    disabled: isReadOnly,
  });

  // Active dragged note: show a drop-zone placeholder at the destination position
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        data-note-id={note.id}
        style={{ transform: CSS.Transform.toString(transform), transition }}
        className="flex flex-col"
      >
        {gapBeforePx > 0 ? (
          // Persisted px scaled to rem so the gap rides the panel sizing knob.
          <div
            className="shrink-0"
            style={{ height: `${gapBeforePx / 16}rem` }}
            aria-hidden
          />
        ) : null}
        <div
          style={{ height: `${NN_COLLAPSED_NOTE_HEADER_PX / 16}rem` }}
          className="rounded border-2 border-dashed border-primary/60 bg-primary/10"
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-note-id={note.id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex flex-col"
      onMouseDown={(e) => {
        e.stopPropagation();
        // Ctrl/Cmd is handled in onClick to avoid conflict with Cmd+drag (separation)
        if (!e.ctrlKey && !e.metaKey) {
          onSelectNote(note.id, e);
        }
      }}
      onClick={(e) => {
        // dnd-kit suppresses click after drag, so this only fires for actual clicks
        if (e.ctrlKey || e.metaKey) {
          onSelectNote(note.id, e);
        }
      }}
    >
      {gapBeforePx > 0 ? (
        // Persisted px scaled to rem so the gap rides the panel sizing knob.
        <div
          className="shrink-0"
          style={{ height: `${gapBeforePx / 16}rem` }}
          aria-hidden
        />
      ) : null}
      <Note
        note={note}
        activeSubjectTabId={activeSubjectTabId}
        expanded={isExpanded}
        isActive={isActive}
        isSelected={isSelected}
        matchesCurrentPage={matchesCurrentPage}
        isReadOnly={isReadOnly}
        onActivate={onActivateNote}
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
  );
}

function NewSectionDropTarget() {
  const { setNodeRef, isOver } = useDroppable({
    id: NEW_SECTION_DROP_ID,
    data: { type: "new-section" },
  });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "h-10 py-2 box-border flex items-center justify-center rounded border border-dashed px-2 text-center font-medium uppercase leading-tight tracking-wide transition-colors",
        isOver
          ? "border-accent bg-accent/15 text-foreground"
          : "border-muted-foreground/35 text-muted-foreground",
      )}
    >
      Drop to create section
    </div>
  );
}

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
  const [layout, setLayout] = useState(noteLayout);
  const layoutRef = useRef(noteLayout);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dragSeparation, setDragSeparation] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const lastClickedNoteRef = useRef<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  /** Ordered list of all selected note IDs at the moment drag starts (saved for drop). */
  const multiDragOrderRef = useRef<string[]>([]);
  const dragOverlayDeltaRef = useRef<{ x: number; y: number } | null>(null);
  const dragInitialTopLeftRef = useRef<{ left: number; top: number } | null>(
    null,
  );

  const normalizeOverlayViewportOffset: Modifier = ({
    draggingNodeRect,
    transform,
  }) => {
    if (!draggingNodeRect || !dragInitialTopLeftRef.current) {
      return transform;
    }
    if (dragOverlayDeltaRef.current === null) {
      dragOverlayDeltaRef.current = {
        x: dragInitialTopLeftRef.current.left - draggingNodeRect.left,
        y: dragInitialTopLeftRef.current.top - draggingNodeRect.top,
      };
    }
    return {
      ...transform,
      x: transform.x + dragOverlayDeltaRef.current.x,
      y: transform.y + dragOverlayDeltaRef.current.y,
    };
  };

  useEffect(() => {
    setLayout(noteLayout);
    layoutRef.current = noteLayout;
  }, [noteLayout]);

  useEffect(() => {
    // ownerDocument gives the iframe's document, not the host page's document
    const doc = listContainerRef.current?.ownerDocument;
    if (!doc) return;

    function handleDocumentMouseDown(e: MouseEvent) {
      if (
        listContainerRef.current &&
        !listContainerRef.current.contains(e.target as Node)
      ) {
        setSelectedNoteIds(new Set());
        lastClickedNoteRef.current = null;
      }
    }
    doc.addEventListener("mousedown", handleDocumentMouseDown);
    return () => doc.removeEventListener("mousedown", handleDocumentMouseDown);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleSelectNote(noteId: string, e: React.MouseEvent) {
    const isCtrlCmd = e.ctrlKey || e.metaKey;
    const isShift = e.shiftKey;

    if (isCtrlCmd) {
      setSelectedNoteIds((prev) => {
        const next = new Set(prev);
        if (next.has(noteId)) {
          next.delete(noteId);
        } else {
          next.add(noteId);
        }
        return next;
      });
      lastClickedNoteRef.current = noteId;
    } else if (isShift && lastClickedNoteRef.current) {
      const flatIds = flattenLayoutNoteIds(layoutRef.current);
      const lastIdx = flatIds.indexOf(lastClickedNoteRef.current);
      const thisIdx = flatIds.indexOf(noteId);
      if (lastIdx !== -1 && thisIdx !== -1) {
        const [start, end] =
          lastIdx <= thisIdx ? [lastIdx, thisIdx] : [thisIdx, lastIdx];
        setSelectedNoteIds(new Set(flatIds.slice(start, end + 1)));
      }
    } else {
      // Single click: no ring — clear selection unless note is already selected
      // (keep selection if already selected so multi-drag still works)
      if (!selectedNoteIds.has(noteId)) {
        setSelectedNoteIds(new Set());
      }
      lastClickedNoteRef.current = noteId;
    }
  }

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const activeRowEl = listContainerRef.current?.querySelector<HTMLElement>(
      `[data-note-id="${id}"]`,
    );
    const domRect = activeRowEl?.getBoundingClientRect();
    const measuredRect = domRect
      ? { left: domRect.left, top: domRect.top }
      : null;
    const initialRect = event.active.rect.current.initial;
    dragInitialTopLeftRef.current =
      measuredRect ??
      (initialRect ? { left: initialRect.left, top: initialRect.top } : null);
    dragOverlayDeltaRef.current = null;
    setActiveId(id);
    setDragSeparation(true);

    const isMulti = selectedNoteIds.size > 1 && selectedNoteIds.has(id);
    if (isMulti) {
      // Save ordered list of selected notes for drop handling
      const flatIds = flattenLayoutNoteIds(layoutRef.current);
      multiDragOrderRef.current = flatIds.filter((nid) => selectedNoteIds.has(nid));

      // Remove non-active selected notes from the layout so they visually disappear
      // and the remaining notes reflow to fill their space
      const selectedSet = new Set(selectedNoteIds);
      const next = cloneNoteListLayout(layoutRef.current);
      for (const g of next.groups) {
        g.noteIds = g.noteIds.filter((nid) => nid === id || !selectedSet.has(nid));
      }
      pruneEmptyNoteGroups(next);
      layoutRef.current = next;
      setLayout(next);
    } else {
      multiDragOrderRef.current = [];
    }
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const activeNoteId = String(active.id);
    const overId = String(over.id);
    if (activeNoteId === overId) {
      return;
    }
    if (isNewSectionDropId(overId)) {
      return;
    }

    setLayout((prev) => {
      const from = findNotePlacement(prev, activeNoteId);
      const to = findNotePlacement(prev, overId);
      if (!from || !to) {
        return prev;
      }

      const next = cloneNoteListLayout(prev);

      if (from.groupIndex === to.groupIndex) {
        const g = next.groups[from.groupIndex];
        if (from.indexInGroup === to.indexInGroup) {
          return prev;
        }
        g.noteIds = arrayMove(g.noteIds, from.indexInGroup, to.indexInGroup);
      } else {
        const fromG = next.groups[from.groupIndex];
        const toG = next.groups[to.groupIndex];
        const [moved] = fromG.noteIds.splice(from.indexInGroup, 1);
        const overIdx = toG.noteIds.indexOf(overId);
        if (overIdx === -1) {
          fromG.noteIds.splice(from.indexInGroup, 0, moved);
          return prev;
        }
        toG.noteIds.splice(overIdx, 0, moved);
        pruneEmptyNoteGroups(next);
      }
      layoutRef.current = next;
      return next;
    });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    dragInitialTopLeftRef.current = null;
    dragOverlayDeltaRef.current = null;
    setDragSeparation(false);
    setActiveId(null);

    const activeNoteId = String(active.id);
    const isMultiDrag =
      selectedNoteIds.size > 1 && selectedNoteIds.has(activeNoteId);

    setSelectedNoteIds(new Set());
    lastClickedNoteRef.current = null;

    if (!over) {
      layoutRef.current = noteLayout;
      setLayout(noteLayout);
      return;
    }

    const overId = String(over.id);

    if (isNewSectionDropId(overId)) {
      const next = cloneNoteListLayout(layoutRef.current);
      if (isMultiDrag) {
        // Non-active selected notes already removed from layout in handleDragStart;
        // just move the active note out and create a new group with all selected.
        for (const g of next.groups) {
          g.noteIds = g.noteIds.filter((id) => id !== activeNoteId);
        }
        pruneEmptyNoteGroups(next);
        next.groups.push({
          id: crypto.randomUUID(),
          noteIds: multiDragOrderRef.current,
        });
      } else {
        moveNoteToNewGroupAtListEnd(next, activeNoteId);
      }
      pruneEmptyNoteGroups(next);
      layoutRef.current = next;
      setLayout(next);
      void onCommitNoteLayout(next);
      return;
    }

    if (isMultiDrag) {
      // Non-active selected notes were removed from layout in handleDragStart.
      // The active note has been moved to the destination via handleDragOver.
      // Replace it with the full ordered block.
      const SENTINEL = "__nn_multi_sentinel__";
      const next = cloneNoteListLayout(layoutRef.current);

      outer: for (const g of next.groups) {
        for (let i = 0; i < g.noteIds.length; i++) {
          if (g.noteIds[i] === activeNoteId) {
            g.noteIds[i] = SENTINEL;
            break outer;
          }
        }
      }

      for (const g of next.groups) {
        const si = g.noteIds.indexOf(SENTINEL);
        if (si !== -1) {
          g.noteIds.splice(si, 1, ...multiDragOrderRef.current);
          break;
        }
      }

      pruneEmptyNoteGroups(next);
      layoutRef.current = next;
      setLayout(next);
      void onCommitNoteLayout(next);
      return;
    }

    const next = cloneNoteListLayout(layoutRef.current);
    pruneEmptyNoteGroups(next);
    layoutRef.current = next;
    setLayout(next);
    void onCommitNoteLayout(next);
  }

  function handleDragCancel() {
    dragInitialTopLeftRef.current = null;
    dragOverlayDeltaRef.current = null;
    setDragSeparation(false);
    setActiveId(null);
    layoutRef.current = noteLayout;
    setLayout(noteLayout);
    setSelectedNoteIds(new Set());
    lastClickedNoteRef.current = null;
  }

  const activeNote = activeId ? notesById.get(activeId) : undefined;
  const isMultiDragActive =
    activeId !== null &&
    selectedNoteIds.size > 1 &&
    selectedNoteIds.has(activeId);
  const dragOverlayBackNotes = isMultiDragActive
    ? multiDragOrderRef.current
        .filter((id) => id !== activeId)
        .slice(0, 2)
        .map((id) => notesById.get(id))
        .filter((n): n is NNSyncNote => n !== undefined)
    : [];

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerFirstCollision}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={listContainerRef}
        className="m-0 flex flex-col gap-11 p-0"
        onMouseDown={() => {
          setSelectedNoteIds(new Set());
          lastClickedNoteRef.current = null;
        }}
      >
        {layout.groups.map((group) => (
          <div key={group.id} className="flex flex-col gap-3">
            <SortableContext
              id={group.id}
              items={group.noteIds}
              strategy={verticalListSortingStrategy}
            >
              {group.noteIds.map((nid) => {
                const note = notesById.get(nid);
                if (!note) {
                  return null;
                }
                const matchesCurrentPage =
                  browserTabUrlKey !== null &&
                  noteUrlMatchesBrowserTab(note.url, browserTabUrlKey);
                return (
                  <SortableNoteRow
                    key={note.id}
                    note={note}
                    groupId={group.id}
                    gapBeforePx={layout.gapBeforePxByNoteId[note.id] ?? 0}
                    activeSubjectTabId={activeSubjectTabId}
                    isActive={activeNoteId === note.id}
                    isSelected={selectedNoteIds.has(note.id)}
                    isExpanded={isNoteExpanded(note.id)}
                    matchesCurrentPage={matchesCurrentPage}
                    isReadOnly={isReadOnly}
                    onActivateNote={onActivateNote}
                    onSelectNote={handleSelectNote}
                    onSetNoteExpanded={onSetNoteExpanded}
                    onUpdateNote={onUpdateNote}
                    onHighlightNote={onHighlightNote}
                    onValidityChange={onValidityChange}
                    onRequestDelete={onRequestDelete}
                    copiedNote={copiedNote}
                    onCopyNote={onCopyNote}
                  />
                );
              })}
            </SortableContext>
          </div>
        ))}
        {!isReadOnly &&
        activeId !== null &&
        notesById.has(activeId) &&
        dragSeparation ? (
          <NewSectionDropTarget />
        ) : null}
      </div>
      <DragOverlay
        dropAnimation={null}
        modifiers={[normalizeOverlayViewportOffset]}
      >
        {activeNote ? (
          <div className="relative">
            {dragOverlayBackNotes.map((note, i) => (
              <div
                key={note.id}
                className="pointer-events-none absolute inset-0"
                style={{
                  transform: `translate(${(i + 1) * 6}px, ${(i + 1) * 6}px)`,
                  opacity: 0.45,
                  zIndex: i + 1,
                }}
              >
                <Note
                  note={note}
                  activeSubjectTabId={activeSubjectTabId}
                  expanded={false}
                  isActive={false}
                  isSelected
                  matchesCurrentPage={false}
                  onActivate={() => {}}
                  onSetExpanded={() => {}}
                  onUpdateNote={onUpdateNote}
                  onHighlightNote={onHighlightNote}
                  onValidityChange={onValidityChange}
                  onRequestDelete={onRequestDelete}
                  copiedNote={null}
                  onCopyNote={() => {}}
                />
              </div>
            ))}
            <div
              className="relative"
              style={{ zIndex: dragOverlayBackNotes.length + 1 }}
            >
              {isMultiDragActive ? (
                <div className="absolute -right-2 -top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {selectedNoteIds.size}
                </div>
              ) : null}
              <Note
                note={activeNote}
                activeSubjectTabId={activeSubjectTabId}
                expanded={isNoteExpanded(activeNote.id)}
                isActive={activeNoteId === activeNote.id}
                isSelected={selectedNoteIds.has(activeNote.id)}
                matchesCurrentPage={
                  browserTabUrlKey !== null &&
                  noteUrlMatchesBrowserTab(activeNote.url, browserTabUrlKey)
                }
                onActivate={onActivateNote}
                onSetExpanded={onSetNoteExpanded}
                onUpdateNote={onUpdateNote}
                onHighlightNote={onHighlightNote}
                onValidityChange={onValidityChange}
                onRequestDelete={onRequestDelete}
                copiedNote={copiedNote}
                onCopyNote={onCopyNote}
              />
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
