import React, {
  useCallback,
  useEffect,
  useMemo,
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
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { createPortal } from "react-dom";

import { noteUrlMatchesBrowserTab } from "@/lib/nnDashboardNotes";
import {
  applyDropPlacement,
  cloneNoteListLayout,
  flattenLayoutNoteIds,
  noteGroupingsEqual,
  pruneEmptyNoteGroups,
  resolveDropPlacement,
} from "@/lib/nnNoteLayout";
import { cn } from "@/lib/utils";
import { Note, type NoteSelectModifiers } from "@/overlay/Note";
import type {
  NNCopiedNote,
  NNNoteListLayout,
  NNSyncNote,
} from "@/types/nnData";

/** Section gap ≈ a collapsed-note slot (Figma "space equivalent to a collapse note", doc 3_NN_NOTES). */
const SECTION_GAP_CLASS = "mt-[4rem]";
const NOTE_GAP_CLASS = "mt-4";

/** Drop hysteresis (px): cursor must clear a row midpoint by this to switch slots — tolerance, no flicker. */
const DROP_HYSTERESIS_PX = 12;

/** A visible row's vertical extent (incl. the dimmed dragged note), captured once at drag start, in list-container px. */
type SnapshotRow = { id: string; top: number; bottom: number; mid: number };

/** Where/how to draw the drop indicator during a drag (list-container px). */
type DropIndicator = {
  top: number;
  /** Inset the line — marks "first of the section below". */
  indent: boolean;
  /** Cmd/Ctrl: dashed item-sized placeholder box (new section) instead of a bare line. */
  isSection: boolean;
  /** New-section box height (px); 0 for the plain reorder line. */
  boxHeight: number;
  label: string | null;
};

type FlatEntry = { noteId: string; marginClass: string };

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

/** True when inserting at flatIndex in base falls exactly on a boundary between two sections. */
function isSectionBoundaryIndex(
  base: NNNoteListLayout,
  flatIndex: number,
): boolean {
  if (flatIndex <= 0) {
    return false;
  }
  let offset = 0;
  for (const group of base.groups) {
    if (offset > 0 && flatIndex === offset) {
      return true;
    }
    offset += group.noteIds.length;
  }
  return false;
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
  onUpdateNote: NotesListProps["onUpdateNote"];
  onHighlightNote: NotesListProps["onHighlightNote"];
  onValidityChange: NotesListProps["onValidityChange"];
  onRequestDelete: NotesListProps["onRequestDelete"];
  copiedNote: NNCopiedNote | null;
  onCopyNote: (noteId: string) => void;
  isReadOnly?: boolean;
};

const DraggableNoteRow = React.memo(function DraggableNoteRow({
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
  /** Multi-note selection (Cmd/Ctrl toggle, Shift range); dragging a member moves the whole set. */
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(),
  );
  /** Shift-range anchor — the note last clicked plainly or with Cmd/Ctrl. */
  const anchorNoteIdRef = useRef<string | null>(null);
  /** True while the anchor came from a bare left-click and hasn't been consumed — the next Cmd/Ctrl-click folds it into the group. */
  const plainAnchorPendingRef = useRef(false);
  const listContainerRef = useRef<HTMLDivElement>(null);
  /** True when the live drag should drop the block into its own new section. */
  const separateOnDropRef = useRef(false);

  /** Pre-drag layout with the dragged notes removed — the preview is rebuilt from it. */
  const baseLayoutRef = useRef<NNNoteListLayout | null>(null);
  /** Ids of every note in the drag (the selection if multi, else the active note); snapshot/base filter against this. */
  const draggedSetRef = useRef<Set<string>>(new Set());
  /** The same ids in flat layout order — inserted as one contiguous block on drop. */
  const dragOrderRef = useRef<string[]>([]);
  /** Frozen row geometry (list-container px) — hit-testing reads this, never the live DOM. */
  const snapshotRef = useRef<SnapshotRow[] | null>(null);
  /** Pointer Y at drag activation, in iframe-viewport px (delta-relative origin). */
  const startClientYRef = useRef<number | null>(null);
  /** Last resolved hit-test Y in list-container px — replayed when Cmd toggles mid-drag. */
  const lastPointerContentYRef = useRef<number | null>(null);
  /** Last resolved insertion index — anchors drop hysteresis so tiny moves don't flip the slot. */
  const lastFlatIndexRef = useRef<number | null>(null);
  /** Real reorder computed by applyPreview during drag; committed only on drop. */
  const pendingNextRef = useRef<NNNoteListLayout | null>(null);
  /** Where/how the drop indicator (reorder line or new-section box) draws — null when no slot is resolved. */
  const [indicator, setIndicator] = useState<DropIndicator | null>(null);
  /** Iframe <body> — the drag clone portals here to escape the frosted container's containing block. */
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  /** Section gap (SECTION_GAP_CLASS = 4rem) in px, captured at drag start — positions the new-section placeholder. */
  const sectionGapPxRef = useRef(0);
  /** List-container top in viewport px, cached at drag start + refreshed on scroll — avoids a forced reflow each move. */
  const containerTopRef = useRef(0);
  /** Active dragged row's original extent (list-container px); a plain drop released inside it didn't move the item → no-op. */
  const draggedRowTopRef = useRef<number | null>(null);
  const draggedRowBottomRef = useRef<number | null>(null);

  // Cmd/Ctrl toggles a note; Shift selects the range from the anchor; a plain click clears. Stable (functional updater + refs) so the rows don't churn on its identity.
  const handleSelect = useCallback((noteId: string, mods: NoteSelectModifiers) => {
    if (mods.metaKey || mods.ctrlKey) {
      setSelectedNoteIds((prev) => {
        const next = new Set(prev);
        // First Cmd/Ctrl-click after a bare left-click folds that plain-clicked note (the anchor) into the group too.
        if (
          plainAnchorPendingRef.current &&
          anchorNoteIdRef.current &&
          anchorNoteIdRef.current !== noteId
        ) {
          next.add(anchorNoteIdRef.current);
        }
        if (next.has(noteId)) {
          next.delete(noteId);
        } else {
          next.add(noteId);
        }
        return next;
      });
      plainAnchorPendingRef.current = false;
      anchorNoteIdRef.current = noteId;
      return;
    }
    if (mods.shiftKey && anchorNoteIdRef.current) {
      const flatIds = flattenLayoutNoteIds(layoutRef.current);
      const a = flatIds.indexOf(anchorNoteIdRef.current);
      const b = flatIds.indexOf(noteId);
      if (a !== -1 && b !== -1) {
        const [start, end] = a <= b ? [a, b] : [b, a];
        setSelectedNoteIds(new Set(flatIds.slice(start, end + 1)));
        plainAnchorPendingRef.current = false;
        return;
      }
    }
    // Bare left-click: drop any selection, remember this note as the pending group start (no ring yet).
    setSelectedNoteIds((prev) => (prev.size ? new Set() : prev));
    anchorNoteIdRef.current = noteId;
    plainAnchorPendingRef.current = true;
  }, []);

  // Freezes every visible row's extent (incl. the dimmed dragged notes) at drag start; list never reflows mid-drag, so it stays valid.
  const takeSnapshot = useCallback(() => {
    const container = listContainerRef.current;
    if (!container) {
      snapshotRef.current = null;
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const rows: SnapshotRow[] = [];
    container
      .querySelectorAll<HTMLElement>("[data-note-id]")
      .forEach((el) => {
        const id = el.getAttribute("data-note-id");
        if (!id) {
          return;
        }
        const r = el.getBoundingClientRect();
        const top = r.top - containerRect.top;
        const bottom = r.bottom - containerRect.top;
        rows.push({ id, top, bottom, mid: (top + bottom) / 2 });
      });
    snapshotRef.current = rows;
  }, []);

  // Hit-tests the cursor against the frozen snapshot to resolve the drop slot, stores the reorder for commit, positions the line; list reorders on drop only.
  const applyPreview = useCallback((probeY: number) => {
    const base = baseLayoutRef.current;
    const snap = snapshotRef.current;
    const id = activeIdRef.current;
    if (!base || !snap || id === null) {
      return;
    }
    const y = probeY;
    if (snap.length === 0) {
      pendingNextRef.current = applyDropPlacement(
        base,
        resolveDropPlacement(base, 0, null, separateOnDropRef.current),
        dragOrderRef.current,
      );
      setIndicator(null);
      return;
    }

    // Hit-test among ALL visible rows (incl. the dimmed dragged rows) so the slot follows the cursor past them.
    let visualIndex = 0;
    while (visualIndex < snap.length && snap[visualIndex].mid < y) {
      visualIndex++;
    }
    // Hysteresis: hold the current slot until the cursor clears a row midpoint by this much.
    const K = lastFlatIndexRef.current;
    if (K !== null) {
      let idx = Math.max(0, Math.min(K, snap.length));
      while (idx < snap.length && y > snap[idx].mid + DROP_HYSTERESIS_PX) {
        idx++;
      }
      while (idx > 0 && y < snap[idx - 1].mid - DROP_HYSTERESIS_PX) {
        idx--;
      }
      visualIndex = idx;
    }
    // Cursor past an end always wins (hysteresis can't trap the ends).
    if (y <= snap[0].top) {
      visualIndex = 0;
    } else if (y >= snap[snap.length - 1].bottom) {
      visualIndex = snap.length;
    }
    lastFlatIndexRef.current = visualIndex;

    let boundarySide: "above" | "below" | null = null;
    if (visualIndex > 0 && visualIndex < snap.length) {
      const gapMid = (snap[visualIndex - 1].bottom + snap[visualIndex].top) / 2;
      boundarySide = y < gapMid ? "above" : "below";
    }

    // Map the visual insertion point to a base index (base excludes the dragged block).
    const dragged = draggedSetRef.current;
    let baseFlatIndex = 0;
    for (let i = 0; i < visualIndex; i++) {
      if (!dragged.has(snap[i].id)) {
        baseFlatIndex++;
      }
    }

    // Cmd/Ctrl drops the block as its own new section at the cursor slot (top, between, or bottom); plain reorder joins the adjacent section.
    const asNew = separateOnDropRef.current;
    // Cmd + cursor anywhere over the last row or below → snap to a new section at the very end, so the whole last row + the space under it is one forgiving drop zone (no pixel-hunting the placeholder).
    const forceEnd = asNew && y >= snap[snap.length - 1].top;
    const endIndex = base.groups.reduce((n, g) => n + g.noteIds.length, 0);
    const placement = resolveDropPlacement(
      base,
      forceEnd ? endIndex : baseFlatIndex,
      boundarySide,
      asNew,
    );
    pendingNextRef.current = applyDropPlacement(
      base,
      placement,
      dragOrderRef.current,
    );

    const atListEnd = visualIndex >= snap.length || forceEnd;
    const sectionBoundary = isSectionBoundaryIndex(base, baseFlatIndex);
    // Hug a row edge (never a gap midpoint) so the line lands in a real visible gap.
    let top: number;
    if (visualIndex <= 0) {
      top = snap[0].top;
    } else if (atListEnd) {
      top = snap[snap.length - 1].bottom;
    } else if (sectionBoundary && boundarySide === "above") {
      top = snap[visualIndex - 1].bottom + 2;
    } else {
      top = snap[visualIndex].top - 2;
    }

    if (asNew) {
      // A new section that reproduces the current layout (e.g. dragging the sole item of the last section to the bottom) changes nothing — don't show the misleading cue.
      if (
        pendingNextRef.current &&
        noteGroupingsEqual(pendingNextRef.current, layoutRef.current)
      ) {
        pendingNextRef.current = null;
        setIndicator(null);
        return;
      }
      // New-section cue follows the cursor; the dashed item-box only fits the empty space past the last note, elsewhere a labeled line marks the slot.
      const draggedRow = snap.find((r) => r.id === id);
      setIndicator({
        top: atListEnd ? top + sectionGapPxRef.current : top,
        indent: false,
        isSection: true,
        boxHeight:
          atListEnd && draggedRow ? draggedRow.bottom - draggedRow.top : 0,
        label: "New section",
      });
      return;
    }

    setIndicator({
      top,
      indent: sectionBoundary && boundarySide === "below",
      isSection: false,
      boxHeight: 0,
      label: null,
    });
  }, []);

  useEffect(() => {
    // An in-flight drag owns the layout; don't let an external update clobber the live preview.
    if (activeIdRef.current !== null) {
      return;
    }
    setLayout(noteLayout);
    layoutRef.current = noteLayout;
    // Drop selected/anchor ids that no longer exist (e.g. a selected note was deleted).
    const visible = new Set(flattenLayoutNoteIds(noteLayout));
    setSelectedNoteIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visible.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    if (anchorNoteIdRef.current && !visible.has(anchorNoteIdRef.current)) {
      anchorNoteIdRef.current = null;
    }
  }, [noteLayout]);

  useEffect(() => {
    // Iframe <body> is outside the frosted container, so the DragOverlay's fixed positioning resolves against the iframe viewport (no offset).
    setOverlayHost(listContainerRef.current?.ownerDocument.body ?? null);
  }, []);

  // Switching subject tabs swaps the list but doesn't remount — drop any selection so it can't carry across tabs.
  useEffect(() => {
    setSelectedNoteIds((prev) => (prev.size ? new Set() : prev));
    anchorNoteIdRef.current = null;
  }, [activeSubjectTabId]);

  // A press outside the list clears the selection (finder-style multi-select). Capture phase so a child's stopPropagation can't swallow it.
  useEffect(() => {
    const doc = listContainerRef.current?.ownerDocument;
    if (!doc) {
      return;
    }
    const handleMouseDown = (e: MouseEvent) => {
      const container = listContainerRef.current;
      if (container && !container.contains(e.target as Node)) {
        setSelectedNoteIds((prev) => (prev.size ? new Set() : prev));
        anchorNoteIdRef.current = null;
      }
    };
    doc.addEventListener("mousedown", handleMouseDown, true);
    return () => doc.removeEventListener("mousedown", handleMouseDown, true);
  }, []);

  // "New section" tracks LIVE Ctrl/Cmd during the drag: key events catch a stationary press; pointermove (capture, to beat dnd-kit) the moving case.
  useEffect(() => {
    if (activeId === null) {
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
        // Re-resolve the line for the new mode (joins a section vs. own section).
        if (lastPointerContentYRef.current !== null) {
          applyPreview(lastPointerContentYRef.current);
        }
      }
    };
    // Autoscroll moves the list under a stationary pointer; keep the cached top fresh (capture — scroll doesn't bubble).
    const refreshContainerTop = () => {
      const c = listContainerRef.current;
      if (c) {
        containerTopRef.current = c.getBoundingClientRect().top;
      }
    };
    doc.addEventListener("keydown", sync);
    doc.addEventListener("keyup", sync);
    doc.addEventListener("pointermove", sync, true);
    doc.addEventListener("scroll", refreshContainerTop, true);
    return () => {
      doc.removeEventListener("keydown", sync);
      doc.removeEventListener("keyup", sync);
      doc.removeEventListener("pointermove", sync, true);
      doc.removeEventListener("scroll", refreshContainerTop, true);
    };
  }, [activeId, applyPreview]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // 4px: a move past this is a drag (reorder); a release within it is a click (edit title).
      activationConstraint: { distance: 4 },
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    activeIdRef.current = id;

    const activator = event.activatorEvent as {
      ctrlKey?: boolean;
      metaKey?: boolean;
      clientY?: number;
    };
    startClientYRef.current =
      typeof activator.clientY === "number" ? activator.clientY : null;
    lastPointerContentYRef.current = null;
    lastFlatIndexRef.current = null;

    // Ctrl/Cmd at drag start → own new section on drop; live key listener keeps this in sync if toggled mid-drag.
    separateOnDropRef.current = Boolean(activator.ctrlKey || activator.metaKey);

    // Grabbing a selected note drags the whole selection; otherwise just that note. Block = the dragged ids in flat layout order.
    const isMulti = selectedNoteIds.size > 1 && selectedNoteIds.has(id);
    const flatIds = flattenLayoutNoteIds(layoutRef.current);
    dragOrderRef.current = isMulti
      ? flatIds.filter((nid) => selectedNoteIds.has(nid))
      : [id];
    draggedSetRef.current = new Set(dragOrderRef.current);

    // Base = current layout minus the dragged block; preview rebuilds from this each move, so it equals what commits on drop.
    const base = cloneNoteListLayout(layoutRef.current);
    for (const g of base.groups) {
      g.noteIds = g.noteIds.filter((nid) => !draggedSetRef.current.has(nid));
    }
    pruneEmptyNoteGroups(base);
    baseLayoutRef.current = base;

    pendingNextRef.current = null;
    setIndicator(null);

    // 4rem in px (iframe root font) — how far below the last note the new-section placeholder sits.
    const root = listContainerRef.current?.ownerDocument.documentElement;
    sectionGapPxRef.current = root
      ? 4 * (parseFloat(getComputedStyle(root).fontSize) || 16)
      : 64;

    // Dimming the source rows doesn't change geometry, so the snapshot is valid taken now.
    takeSnapshot();
    containerTopRef.current =
      listContainerRef.current?.getBoundingClientRect().top ?? 0;

    const activeRow = snapshotRef.current?.find((r) => r.id === id) ?? null;
    draggedRowTopRef.current = activeRow ? activeRow.top : null;
    draggedRowBottomRef.current = activeRow ? activeRow.bottom : null;

    setActiveId(id);
  }

  function handleDragMove(event: DragMoveEvent) {
    const container = listContainerRef.current;
    if (activeIdRef.current === null || snapshotRef.current === null) {
      return;
    }
    const startClientY = startClientYRef.current;
    if (startClientY === null || !container) {
      return;
    }
    const clientY = startClientY + event.delta.y;
    // List-container frame: rows and line share it and scroll together, so no scrollTop term. Cached top (refreshed on scroll) avoids a per-move reflow.
    const pointerContentY = clientY - containerTopRef.current;
    lastPointerContentYRef.current = pointerContentY;
    applyPreview(pointerContentY);
  }

  function resetDragState() {
    activeIdRef.current = null;
    baseLayoutRef.current = null;
    snapshotRef.current = null;
    draggedSetRef.current = new Set();
    dragOrderRef.current = [];
    startClientYRef.current = null;
    lastPointerContentYRef.current = null;
    lastFlatIndexRef.current = null;
    separateOnDropRef.current = false;
    pendingNextRef.current = null;
    containerTopRef.current = 0;
    draggedRowTopRef.current = null;
    draggedRowBottomRef.current = null;
    anchorNoteIdRef.current = null;
    setActiveId(null);
    setIndicator(null);
    setSelectedNoteIds((prev) => (prev.size ? new Set() : prev));
  }

  function handleDragEnd() {
    const pending = pendingNextRef.current;
    const wasAsNew = separateOnDropRef.current;
    const single = dragOrderRef.current.length === 1;
    const cursorY = lastPointerContentYRef.current;
    const rowTop = draggedRowTopRef.current;
    const rowBottom = draggedRowBottomRef.current;
    const original = layoutRef.current;
    resetDragState();

    // A plain single-item drop released over the item's OWN original row never moved it → keep the original layout, so a near-zero "select" drag can't silently merge a sole-item section into its neighbor. (Dragging onto another note leaves the row → applies; a Cmd drop in place is an intentional split → applies.)
    let resolved = pending ?? original;
    if (
      pending &&
      !wasAsNew &&
      single &&
      cursorY !== null &&
      rowTop !== null &&
      rowBottom !== null &&
      cursorY >= rowTop &&
      cursorY <= rowBottom
    ) {
      resolved = original;
    }

    const next = cloneNoteListLayout(resolved);
    pruneEmptyNoteGroups(next);
    layoutRef.current = next;
    setLayout(next);
    void onCommitNoteLayout(next);
  }

  function handleDragCancel() {
    resetDragState();
    layoutRef.current = noteLayout;
    setLayout(noteLayout);
  }

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

  const isMultiActive =
    activeId !== null &&
    selectedNoteIds.size > 1 &&
    selectedNoteIds.has(activeId);

  const renderNoteClone = (note: NNSyncNote): React.ReactNode => {
    const matchesCurrentPage =
      browserTabUrlKey !== null &&
      noteUrlMatchesBrowserTab(note.url, browserTabUrlKey);
    return (
      <Note
        note={note}
        activeSubjectTabId={activeSubjectTabId}
        expanded={isNoteExpanded(note.id)}
        isActive={false}
        matchesCurrentPage={matchesCurrentPage}
        isReadOnly
        onActivate={() => {}}
        onSetExpanded={() => {}}
        onUpdateNote={() => {}}
        onHighlightNote={() => {}}
        onValidityChange={() => {}}
        onRequestDelete={() => {}}
        copiedNote={null}
        onCopyNote={() => {}}
      />
    );
  };

  // Cursor-riding clone; dnd-kit sizes the overlay wrapper to the dragged row's rect. A multi-drag stacks up to 2 faint clones behind + a count badge.
  const renderDragClone = (): React.ReactNode => {
    const note = activeId ? notesById.get(activeId) : undefined;
    if (!note) {
      return null;
    }
    const backNotes = dragOrderRef.current
      .filter((nid) => nid !== activeId)
      .slice(0, 2)
      .map((nid) => notesById.get(nid))
      .filter((n): n is NNSyncNote => n !== undefined);
    return (
      <div className="relative">
        {backNotes.map((backNote, i) => (
          <div
            key={backNote.id}
            aria-hidden
            className="pointer-events-none absolute inset-0 shadow-lg"
            style={{
              transform: `translate(${(i + 1) * 6}px, ${(i + 1) * 6}px)`,
              opacity: 0.45,
              zIndex: -(i + 1),
            }}
          >
            {renderNoteClone(backNote)}
          </div>
        ))}
        <div className="relative shadow-lg">
          {isMultiActive && (
            <span className="absolute -top-2 -right-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.75rem] font-semibold text-accent-foreground">
              {selectedNoteIds.size}
            </span>
          )}
          {renderNoteClone(note)}
        </div>
      </div>
    );
  };

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

  // Drop indicator as a separate sibling so per-move setIndicator re-renders only this, not the rows.
  const indicatorNode =
    indicator &&
    (indicator.isSection && indicator.boxHeight > 0 ? (
      // New section past the last note: dashed item-sized box (where the block lands) + a line under it.
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 left-0 z-20"
        style={{ top: indicator.top }}
      >
        <div
          className="relative rounded-md border-2 border-dashed border-muted-foreground/50 bg-muted-foreground/10"
          style={{ height: indicator.boxHeight }}
        >
          {indicator.label && (
            <span className="absolute top-1 left-1 rounded bg-[#111111] px-1 text-[0.75rem] font-semibold uppercase leading-none tracking-wide text-white">
              {indicator.label}
            </span>
          )}
        </div>
        <div className="mt-1 h-[3px] rounded-full bg-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
      </div>
    ) : indicator.isSection ? (
      // New section between/above rows: a labeled line at the slot (the frozen list leaves no room for a box).
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 left-0 z-20 -translate-y-1/2"
        style={{ top: indicator.top }}
      >
        <div className="h-[3px] rounded-full bg-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
        {indicator.label && (
          <span className="absolute top-1/2 left-1 -translate-y-1/2 rounded bg-[#111111] px-1 text-[0.75rem] font-semibold uppercase leading-none tracking-wide text-white">
            {indicator.label}
          </span>
        )}
      </div>
    ) : (
      // Plain reorder: one thin high-contrast line (#111 + white ring) at the drop slot.
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 z-20"
        style={{ top: indicator.top, left: indicator.indent ? "0.75rem" : 0 }}
      >
        <div className="-translate-y-1/2 h-[3px] rounded-full bg-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
      </div>
    ));

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Flat column; section separation is each head's leading margin. Relative so the insertion line positions against it. */}
      <div ref={listContainerRef} className="relative m-0 flex flex-col p-0">
        {rows}
        {indicatorNode}
      </div>
      {overlayHost &&
        createPortal(
          <DragOverlay dropAnimation={null}>{renderDragClone()}</DragOverlay>,
          overlayHost,
        )}
    </DndContext>
  );
}
