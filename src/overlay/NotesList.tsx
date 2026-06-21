import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";

import { noteUrlMatchesBrowserTab } from "@/lib/nnDashboardNotes";
import {
  applyDropPlacement,
  cloneNoteListLayout,
  flattenLayoutNoteIds,
  NN_COLLAPSED_NOTE_HEADER_PX,
  pruneEmptyNoteGroups,
  resolveDropPlacement,
} from "@/lib/nnNoteLayout";
import { cn } from "@/lib/utils";
import { Note } from "@/overlay/Note";
import type {
  NNCopiedNote,
  NNNoteListLayout,
  NNSyncNote,
} from "@/types/nnData";

/** Section separation between groups (≈ one collapsed note, doc 3_NN_NOTES). */
const SECTION_GAP_CLASS = "mt-[3.25rem]";
/** Spacing between notes inside the same section. */
const NOTE_GAP_CLASS = "mt-3";

/** A non-dragged row's vertical extent, captured once at drag start (scroll-content px). */
type SnapshotRow = { id: string; top: number; bottom: number; mid: number };

/** Flat render unit: a note id plus the leading-margin class for its position. */
type FlatEntry = { noteId: string; marginClass: string };

/** First scrollable ancestor — the coordinate frame for drag hit-testing. */
function getScrollParent(node: HTMLElement | null): HTMLElement | null {
  let el = node?.parentElement ?? null;
  while (el) {
    const overflowY = getComputedStyle(el).overflowY;
    if (overflowY === "auto" || overflowY === "scroll" || overflowY === "overlay") {
      return el;
    }
    el = el.parentElement;
  }
  return null;
}

/** Walks the layout into flat render order, tagging each note's leading margin. */
function buildFlatEntries(layout: NNNoteListLayout): FlatEntry[] {
  const entries: FlatEntry[] = [];
  layout.groups.forEach((group, groupIndex) => {
    group.noteIds.forEach((noteId, indexInGroup) => {
      const isFirstOverall = groupIndex === 0 && indexInGroup === 0;
      entries.push({
        noteId,
        marginClass: isFirstOverall
          ? ""
          : indexInGroup === 0
            ? SECTION_GAP_CLASS
            : NOTE_GAP_CLASS,
      });
    });
  });
  return entries;
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

type DraggableNoteRowProps = {
  note: NNSyncNote;
  /** Leading margin class — small within a section, large at a section head. */
  marginClass: string;
  /** Cmd-drag in progress: the active row previews as the head of a new section. */
  separating: boolean;
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

function DraggableNoteRow({
  note,
  marginClass,
  separating,
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
}: DraggableNoteRowProps): React.ReactElement {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: note.id,
    disabled: isReadOnly,
  });

  // Track the row's real height so the placeholder reserves the same space (no reflow jolt
  // when the card lifts into the overlay). Reads after every non-dragging render.
  const contentRef = useRef<HTMLDivElement>(null);
  const lastContentHeightRef = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (!isDragging && contentRef.current) {
      lastContentHeightRef.current = contentRef.current.offsetHeight;
    }
  });

  // The dragged note's slot becomes the single drop placeholder; the card itself rides the
  // DragOverlay. Accent outline when separating signals "this is becoming a new section".
  if (isDragging) {
    return (
      <div
        ref={setNodeRef}
        data-drag-placeholder
        className={cn("flex flex-col", marginClass)}
      >
        <div
          style={{
            height: `${lastContentHeightRef.current ?? NN_COLLAPSED_NOTE_HEADER_PX}px`,
          }}
          className={cn(
            "rounded border-2 border-dashed",
            separating
              ? "border-accent bg-accent/10"
              : "border-primary/60 bg-primary/10",
          )}
        />
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      data-note-id={note.id}
      className={cn("flex flex-col", marginClass)}
      onMouseDown={(e) => {
        e.stopPropagation();
        // Ctrl/Cmd is handled in onClick to avoid conflict with Cmd+drag (separation).
        if (!e.ctrlKey && !e.metaKey) {
          onSelectNote(note.id, e);
        }
      }}
      onClick={(e) => {
        // dnd-kit suppresses click after drag, so this only fires for actual clicks.
        if (e.ctrlKey || e.metaKey) {
          onSelectNote(note.id, e);
        }
      }}
    >
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
  const activeIdRef = useRef<string | null>(null);
  /** True while a single-note Ctrl/Cmd drag is in progress — drives the overlay cue. */
  const [separationDrag, setSeparationDrag] = useState(false);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const lastClickedNoteRef = useRef<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  /** Ordered list of all selected note IDs at the moment drag starts (saved for drop). */
  const multiDragOrderRef = useRef<string[]>([]);
  /** True when the live drag should drop the note into its own new section. */
  const separateOnDropRef = useRef(false);
  const dragOverlayDeltaRef = useRef<{ x: number; y: number } | null>(null);
  const dragInitialTopLeftRef = useRef<{ left: number; top: number } | null>(
    null,
  );

  /** Pre-drag layout with every dragged note removed — the preview is rebuilt from it. */
  const baseLayoutRef = useRef<NNNoteListLayout | null>(null);
  /** All note ids being dragged (single note, or the multi-select block). */
  const draggedSetRef = useRef<Set<string>>(new Set());
  /** Frozen row geometry (scroll-content px) — hit-testing reads this, never the live DOM. */
  const snapshotRef = useRef<SnapshotRow[] | null>(null);
  /** Set when a snapshot must be (re)taken after the next render commits. */
  const needsSnapshotRef = useRef(false);
  /** The scroll container that frames drag coordinates. */
  const scrollParentRef = useRef<HTMLElement | null>(null);
  /** Pointer Y at drag activation, in iframe-viewport px (delta-relative origin). */
  const startClientYRef = useRef<number | null>(null);
  /** Last resolved pointer Y in scroll-content px — replayed when Cmd toggles mid-drag. */
  const lastPointerContentYRef = useRef<number | null>(null);

  /**
   * dnd-kit's measured overlay start position is offset from the real row (the sticky
   * header + the scroll container inside the iframe), leaving the dragged card ~30px above
   * the cursor. Capture the row's true top-left at drag start and shift the overlay by the
   * difference. This patches the overlay VISUAL only; collision/geometry is driven by the
   * real pointer (see takeSnapshot/handleDragMove), so it never relies on dnd-kit rects.
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

  // Reads each remaining row's vertical extent into scroll-content coordinates. Taken once
  // per drag (after the active note has lifted to a placeholder), so the preview can rebuild
  // from a stable geometry that the live reflow can never feed back into — no oscillation.
  const takeSnapshot = useCallback(() => {
    const container = listContainerRef.current;
    const sp = scrollParentRef.current;
    if (!container || !sp) {
      snapshotRef.current = null;
      return;
    }
    const spRect = sp.getBoundingClientRect();
    const scrollTop = sp.scrollTop;
    const dragged = draggedSetRef.current;
    const rows: SnapshotRow[] = [];
    container
      .querySelectorAll<HTMLElement>("[data-note-id]")
      .forEach((el) => {
        const id = el.getAttribute("data-note-id");
        if (!id || dragged.has(id)) {
          return;
        }
        const r = el.getBoundingClientRect();
        const top = r.top - spRect.top + scrollTop;
        const bottom = r.bottom - spRect.top + scrollTop;
        rows.push({ id, top, bottom, mid: (top + bottom) / 2 });
      });
    snapshotRef.current = rows;
  }, []);

  // Rebuilds the live preview from the frozen snapshot + the current pointer. The insertion
  // index is the count of rows whose middle sits above the pointer; at a section boundary the
  // midpoint of the inter-section gap decides "end of section above" vs "start of section
  // below" (NOTES-BEHAVIOR-2). The result equals what gets committed on drop. Refs only, so
  // it's stable and safe to replay from the Cmd-toggle listener.
  const applyPreview = useCallback((pointerContentY: number) => {
    const base = baseLayoutRef.current;
    const snap = snapshotRef.current;
    const id = activeIdRef.current;
    if (!base || !snap || id === null) {
      return;
    }
    let flatIndex = 0;
    while (flatIndex < snap.length && snap[flatIndex].mid < pointerContentY) {
      flatIndex++;
    }
    let boundarySide: "above" | "below" | null = null;
    if (flatIndex > 0 && flatIndex < snap.length) {
      const gapMid =
        (snap[flatIndex - 1].bottom + snap[flatIndex].top) / 2;
      boundarySide = pointerContentY < gapMid ? "above" : "below";
    }
    const placement = resolveDropPlacement(
      base,
      flatIndex,
      boundarySide,
      separateOnDropRef.current,
    );
    const next = applyDropPlacement(base, placement, [id]);
    layoutRef.current = next;
    setLayout(next);
  }, []);

  useEffect(() => {
    setLayout(noteLayout);
    layoutRef.current = noteLayout;
  }, [noteLayout]);

  // Snapshot after the drag-start render commits, so it reflects the lifted layout (active
  // note already a placeholder, multi-select members removed).
  useLayoutEffect(() => {
    if (!needsSnapshotRef.current) {
      return;
    }
    needsSnapshotRef.current = false;
    takeSnapshot();
  }, [activeId, takeSnapshot]);

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

  // "New section" mode tracks the LIVE Ctrl/Cmd state during a single-note drag, so it
  // engages whether the modifier was held at drag start or pressed (or released) mid-drag.
  // Key events catch a stationary press; pointermove (capture, to beat dnd-kit) covers the
  // moving case where key focus may sit outside the iframe. Multi-select drags never separate.
  useEffect(() => {
    if (activeId === null) {
      return;
    }
    const isMulti = selectedNoteIds.size > 1 && selectedNoteIds.has(activeId);
    if (isMulti) {
      return;
    }
    const doc = listContainerRef.current?.ownerDocument;
    if (!doc) {
      return;
    }
    const sync = (e: KeyboardEvent | PointerEvent) => {
      const on = e.ctrlKey || e.metaKey;
      if (separateOnDropRef.current !== on) {
        separateOnDropRef.current = on;
        setSeparationDrag(on);
        // Re-resolve the placeholder for the new mode (joins a section vs. own section).
        if (lastPointerContentYRef.current !== null) {
          applyPreview(lastPointerContentYRef.current);
        }
      }
    };
    doc.addEventListener("keydown", sync);
    doc.addEventListener("keyup", sync);
    doc.addEventListener("pointermove", sync, true);
    return () => {
      doc.removeEventListener("keydown", sync);
      doc.removeEventListener("keyup", sync);
      doc.removeEventListener("pointermove", sync, true);
    };
  }, [activeId, selectedNoteIds, applyPreview]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 10 },
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
    activeIdRef.current = id;
    setActiveId(id);

    const activator = event.activatorEvent as {
      ctrlKey?: boolean;
      metaKey?: boolean;
      clientY?: number;
    };
    startClientYRef.current =
      typeof activator.clientY === "number" ? activator.clientY : null;
    lastPointerContentYRef.current = null;
    scrollParentRef.current = getScrollParent(listContainerRef.current);
    snapshotRef.current = null;

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

    const isMulti = selectedNoteIds.size > 1 && selectedNoteIds.has(id);

    // Ctrl/Cmd held at drag start → this note becomes its own new section on drop. The live
    // key listener keeps this in sync if toggled mid-drag. Multi-select drags never separate.
    separateOnDropRef.current =
      !isMulti && Boolean(activator.ctrlKey || activator.metaKey);
    setSeparationDrag(separateOnDropRef.current);

    // Base = current layout minus everything being dragged. The live preview is rebuilt from
    // this on each move, so it always equals what gets committed on drop.
    const draggedSet = isMulti ? new Set(selectedNoteIds) : new Set([id]);
    draggedSetRef.current = draggedSet;
    const base = cloneNoteListLayout(layoutRef.current);
    for (const g of base.groups) {
      g.noteIds = g.noteIds.filter((nid) => !draggedSet.has(nid));
    }
    pruneEmptyNoteGroups(base);
    baseLayoutRef.current = base;

    if (isMulti) {
      // Remember the block's order for drop, then lift the non-active members out of the
      // visible layout now (only the active note previews, with a count badge).
      multiDragOrderRef.current = flattenLayoutNoteIds(layoutRef.current).filter(
        (nid) => selectedNoteIds.has(nid),
      );
      const others = new Set([...selectedNoteIds].filter((nid) => nid !== id));
      const lifted = cloneNoteListLayout(layoutRef.current);
      for (const g of lifted.groups) {
        g.noteIds = g.noteIds.filter((nid) => !others.has(nid));
      }
      pruneEmptyNoteGroups(lifted);
      layoutRef.current = lifted;
      setLayout(lifted);
    } else {
      multiDragOrderRef.current = [];
    }

    needsSnapshotRef.current = true;
  }

  function handleDragMove(event: DragMoveEvent) {
    if (activeIdRef.current === null || snapshotRef.current === null) {
      return;
    }
    const startClientY = startClientYRef.current;
    const sp = scrollParentRef.current;
    if (startClientY === null || !sp) {
      return;
    }
    const clientY = startClientY + event.delta.y;
    const contentY = clientY - sp.getBoundingClientRect().top + sp.scrollTop;
    lastPointerContentYRef.current = contentY;
    applyPreview(contentY);
  }

  function resetDragState() {
    activeIdRef.current = null;
    baseLayoutRef.current = null;
    snapshotRef.current = null;
    needsSnapshotRef.current = false;
    draggedSetRef.current = new Set();
    scrollParentRef.current = null;
    startClientYRef.current = null;
    lastPointerContentYRef.current = null;
    dragInitialTopLeftRef.current = null;
    dragOverlayDeltaRef.current = null;
    separateOnDropRef.current = false;
    setActiveId(null);
    setSeparationDrag(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const activeNoteId = activeIdRef.current ?? String(event.active.id);
    const isMultiDrag =
      selectedNoteIds.size > 1 && selectedNoteIds.has(activeNoteId);

    resetDragState();
    setSelectedNoteIds(new Set());
    lastClickedNoteRef.current = null;

    // The live preview already IS the drop result (built by applyPreview). Commit it; for a
    // multi-drag, expand the active note back into the full ordered block at its spot.
    const next = cloneNoteListLayout(layoutRef.current);
    if (isMultiDrag) {
      const SENTINEL = "__nn_multi_sentinel__";
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
    }

    pruneEmptyNoteGroups(next);
    layoutRef.current = next;
    setLayout(next);
    void onCommitNoteLayout(next);
  }

  function handleDragCancel() {
    resetDragState();
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

  const flatEntries = buildFlatEntries(layout);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Single flat column: section separation is a leading margin on each section head, so
          rebuilding the preview never reparents a row (no remount/flicker). */}
      <div
        ref={listContainerRef}
        className="m-0 flex flex-col p-0"
        onMouseDown={() => {
          setSelectedNoteIds(new Set());
          lastClickedNoteRef.current = null;
        }}
      >
        {flatEntries.map(({ noteId, marginClass }) => {
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
              separating={separationDrag}
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
