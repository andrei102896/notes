import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
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
  flattenLayoutNoteIds,
  NN_COLLAPSED_NOTE_HEADER_PX,
  pruneEmptyNoteGroups,
  separateNoteWithGap,
} from "@/lib/nnNoteLayout";
import { Note } from "@/overlay/Note";
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

  // Reserve the note's real height while dragging so the list doesn't reflow at
  // drag start — a reflow desyncs the drag-overlay offset and jolts the top item.
  const contentRef = useRef<HTMLDivElement>(null);
  const lastContentHeightRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!isDragging && contentRef.current) {
      lastContentHeightRef.current = contentRef.current.offsetHeight;
    }
  });

  // Active dragged note: show a same-height drop-zone placeholder (no reflow).
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
          style={{
            height: `${lastContentHeightRef.current ?? NN_COLLAPSED_NOTE_HEADER_PX}px`,
          }}
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
      <div ref={contentRef}>
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
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const lastClickedNoteRef = useRef<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  /** Ordered list of all selected note IDs at the moment drag starts (saved for drop). */
  const multiDragOrderRef = useRef<string[]>([]);
  /** True when the current single-note drag began with Ctrl/Cmd held (separation, doc 3 line 88). */
  const separateOnDropRef = useRef(false);
  const dragOverlayDeltaRef = useRef<{ x: number; y: number } | null>(null);
  const dragInitialTopLeftRef = useRef<{ left: number; top: number } | null>(
    null,
  );

  /**
   * dnd-kit's measured overlay start position is offset from the real row (the
   * sticky header + the scroll container inside the iframe), leaving the dragged
   * card ~30px above the cursor. Capture the row's true top-left at drag start and
   * shift the overlay by the difference so it stays stuck to the cursor. Modifiers
   * on <DragOverlay> affect only the overlay visual, NOT collision detection.
   */
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

  /**
   * Closest-center collision, but with the collision rect shifted by the same
   * offset applied to the overlay — so the drop indicator tracks the *visible*
   * card and opens at a symmetric point whether dragging up or down (otherwise
   * dnd-kit's raw, ~30px-offset rect makes it open too early one way, too late the
   * other). closestCenter (not pointerWithin) avoids oscillating with the strategy.
   */
  const cursorAlignedCollision: CollisionDetection = (args) => {
    const delta = dragOverlayDeltaRef.current;
    if (!delta) {
      return closestCenter(args);
    }
    return closestCenter({
      ...args,
      collisionRect: {
        ...args.collisionRect,
        top: args.collisionRect.top + delta.y,
        bottom: args.collisionRect.bottom + delta.y,
      },
    });
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
    const initialRect = event.active.rect.current.initial;
    dragInitialTopLeftRef.current = domRect
      ? { left: domRect.left, top: domRect.top }
      : initialRect
        ? { left: initialRect.left, top: initialRect.top }
        : null;
    dragOverlayDeltaRef.current = null;
    setActiveId(id);

    const isMulti = selectedNoteIds.size > 1 && selectedNoteIds.has(id);

    // Ctrl/Cmd held at drag start → separate this single note with a leading gap
    // on drop (doc 3 line 88). Multi-select drags keep their existing behavior.
    const activator = event.activatorEvent as {
      ctrlKey?: boolean;
      metaKey?: boolean;
    };
    separateOnDropRef.current =
      !isMulti && Boolean(activator.ctrlKey || activator.metaKey);

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

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    dragInitialTopLeftRef.current = null;
    dragOverlayDeltaRef.current = null;
    setActiveId(null);

    const activeNoteId = String(active.id);
    const isMultiDrag =
      selectedNoteIds.size > 1 && selectedNoteIds.has(activeNoteId);

    setSelectedNoteIds(new Set());
    lastClickedNoteRef.current = null;

    const shouldSeparate = separateOnDropRef.current;
    separateOnDropRef.current = false;

    if (!over) {
      // Dropped outside the list — restore the pre-drag layout (a multi-drag
      // lifted the other selected notes out in handleDragStart).
      layoutRef.current = noteLayout;
      setLayout(noteLayout);
      return;
    }

    const overId = String(over.id);
    const next = cloneNoteListLayout(layoutRef.current);
    const group = next.groups[0];
    if (!group) {
      return;
    }
    const ids = group.noteIds;

    if (isMultiDrag) {
      // The other selected notes were lifted out in handleDragStart; drop the whole
      // ordered block where the active note lands.
      const block = multiDragOrderRef.current;
      const activeIndex = ids.indexOf(activeNoteId);
      const withoutActive = ids.filter((nid) => nid !== activeNoteId);
      const overIndex =
        overId === activeNoteId ? activeIndex : withoutActive.indexOf(overId);
      const insertAt = overIndex === -1 ? withoutActive.length : overIndex;
      group.noteIds = [
        ...withoutActive.slice(0, insertAt),
        ...block,
        ...withoutActive.slice(insertAt),
      ];
    } else {
      // Reorder only on drop; verticalListSortingStrategy showed the live gap.
      const from = ids.indexOf(activeNoteId);
      const to = ids.indexOf(overId);
      if (from !== -1 && to !== -1 && from !== to) {
        group.noteIds = arrayMove(ids, from, to);
      }
      if (shouldSeparate) {
        separateNoteWithGap(next, activeNoteId);
      }
    }

    pruneEmptyNoteGroups(next);
    layoutRef.current = next;
    setLayout(next);
    void onCommitNoteLayout(next);
  }

  function handleDragCancel() {
    dragInitialTopLeftRef.current = null;
    dragOverlayDeltaRef.current = null;
    separateOnDropRef.current = false;
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

  // Single flat stack (the layout is always one group now — see flattenToSingleStack).
  const stackNoteIds = layout.groups[0]?.noteIds ?? [];
  const stackGroupId = layout.groups[0]?.id ?? "default";

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={cursorAlignedCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div
        ref={listContainerRef}
        className="m-0 flex flex-col gap-3 p-0"
        onMouseDown={() => {
          setSelectedNoteIds(new Set());
          lastClickedNoteRef.current = null;
        }}
      >
        <SortableContext
          id={stackGroupId}
          items={stackNoteIds}
          strategy={verticalListSortingStrategy}
        >
          {stackNoteIds.map((nid) => {
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
                groupId={stackGroupId}
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
