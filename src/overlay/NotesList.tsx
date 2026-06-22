import React, { useCallback, useEffect, useRef, useState } from "react";

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

/** Section separation between groups — roughly a full collapsed-note slot (Figma "space equivalent
    to a collapse note", doc 3_NN_NOTES). */
const SECTION_GAP_CLASS = "mt-[4rem]";
/** Spacing between notes inside the same section. */
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
  /** Cmd/Ctrl: render a dashed item-sized placeholder box (new section) instead of a bare line. */
  isSection: boolean;
  /** Placeholder height for the new-section box (px); 0 for the plain reorder line. */
  boxHeight: number;
  label: string | null;
};

/** Flat render unit: a note id plus the leading-margin class for its position. */
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
  /** This row is the note currently being dragged — dim it in place (the clone rides the cursor). */
  dimmed?: boolean;
  activeSubjectTabId: string | null;
  isActive: boolean;
  isExpanded: boolean;
  matchesCurrentPage: boolean;
  onActivateNote: (noteId: string) => void;
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
  dimmed = false,
  activeSubjectTabId,
  isActive,
  isExpanded,
  matchesCurrentPage,
  onActivateNote,
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

  // The row never moves during a drag; while it's the active note it dims in place and the
  // DragOverlay renders the clone that follows the cursor. setNodeRef applies no transform.
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
  const listContainerRef = useRef<HTMLDivElement>(null);
  /** True when the live drag should drop the note into its own new section. */
  const separateOnDropRef = useRef(false);

  /** Pre-drag layout with the dragged note removed — the preview is rebuilt from it. */
  const baseLayoutRef = useRef<NNNoteListLayout | null>(null);
  /** The note id being dragged (a one-element set, kept for the snapshot filter). */
  const draggedSetRef = useRef<Set<string>>(new Set());
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

  // Reads every visible row's vertical extent in list-container px, once at drag start — including
  // the dragged note (it stays in place, dimmed), so the insertion line tracks the cursor across
  // it. The list never reflows during a drag, so this stays valid.
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

  // Resolves the drop slot from the frozen snapshot by hit-testing the cursor, stores the reorder
  // for commit, and positions the insertion line. The live list never reorders (drop-only).
  const applyPreview = useCallback((probeY: number) => {
    const base = baseLayoutRef.current;
    const snap = snapshotRef.current;
    const id = activeIdRef.current;
    if (!base || !snap || id === null) {
      return;
    }
    // Cmd/Ctrl: a new section is always appended BELOW all existing notes (never between sections).
    // The placeholder is pinned under the last visible note + a section gap; cursor Y is ignored.
    if (separateOnDropRef.current) {
      lastFlatIndexRef.current = null;
      // Sole item of the last section already IS its own bottom section — a new one would be
      // identical (its emptied group is pruned), so it's a no-op: no placeholder, no change.
      const groups = layoutRef.current.groups;
      const last = groups[groups.length - 1];
      if (last && last.noteIds.length === 1 && last.noteIds[0] === id) {
        pendingNextRef.current = null;
        setIndicator(null);
        return;
      }
      const total = base.groups.reduce((n, g) => n + g.noteIds.length, 0);
      const placement = resolveDropPlacement(base, total, null, true);
      pendingNextRef.current = applyDropPlacement(base, placement, [id]);
      if (snap.length === 0) {
        setIndicator(null);
        return;
      }
      const draggedRow = snap.find((r) => r.id === id);
      setIndicator({
        top: snap[snap.length - 1].bottom + sectionGapPxRef.current,
        indent: false,
        isSection: true,
        boxHeight: draggedRow ? draggedRow.bottom - draggedRow.top : 0,
        label: "Create a new section",
      });
      return;
    }

    const y = probeY;
    if (snap.length === 0) {
      pendingNextRef.current = applyDropPlacement(
        base,
        resolveDropPlacement(base, 0, null, false),
        [id],
      );
      setIndicator(null);
      return;
    }

    // Plain reorder: hit-test among ALL visible rows (incl. the dimmed dragged note) so the line
    // follows the cursor even past the dragged note.
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

    // Map the visual insertion point to a base index (base excludes the dragged note).
    const dragged = draggedSetRef.current;
    let baseFlatIndex = 0;
    for (let i = 0; i < visualIndex; i++) {
      if (!dragged.has(snap[i].id)) {
        baseFlatIndex++;
      }
    }

    const placement = resolveDropPlacement(base, baseFlatIndex, boundarySide, false);
    pendingNextRef.current = applyDropPlacement(base, placement, [id]);

    const sectionBoundary = isSectionBoundaryIndex(base, baseFlatIndex);
    // Hug a row edge (never a gap midpoint) so the line lands in a real visible gap.
    let top: number;
    if (visualIndex <= 0) {
      top = snap[0].top;
    } else if (visualIndex >= snap.length) {
      top = snap[snap.length - 1].bottom;
    } else if (sectionBoundary && boundarySide === "above") {
      top = snap[visualIndex - 1].bottom + 2;
    } else {
      top = snap[visualIndex].top - 2;
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
  }, [noteLayout]);

  useEffect(() => {
    // ownerDocument is the iframe's document — its <body> is outside the frosted container, so the
    // DragOverlay's fixed positioning resolves against the iframe viewport (no offset).
    setOverlayHost(listContainerRef.current?.ownerDocument.body ?? null);
  }, []);

  // "New section" mode tracks the LIVE Ctrl/Cmd state during a drag, so it engages whether the
  // modifier was held at drag start or pressed (or released) mid-drag. Key events catch a
  // stationary press; pointermove (capture, to beat dnd-kit) covers the moving case.
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
    doc.addEventListener("keydown", sync);
    doc.addEventListener("keyup", sync);
    doc.addEventListener("pointermove", sync, true);
    return () => {
      doc.removeEventListener("keydown", sync);
      doc.removeEventListener("keyup", sync);
      doc.removeEventListener("pointermove", sync, true);
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
    setActiveId(id);

    const activator = event.activatorEvent as {
      ctrlKey?: boolean;
      metaKey?: boolean;
      clientY?: number;
    };
    startClientYRef.current =
      typeof activator.clientY === "number" ? activator.clientY : null;
    lastPointerContentYRef.current = null;
    lastFlatIndexRef.current = null;

    // Ctrl/Cmd held at drag start → this note becomes its own new section on drop. The live
    // key listener keeps this in sync if toggled mid-drag.
    separateOnDropRef.current = Boolean(activator.ctrlKey || activator.metaKey);

    // Base = current layout minus the dragged note. The live preview is rebuilt from this on each
    // move, so it always equals what gets committed on drop.
    draggedSetRef.current = new Set([id]);
    const base = cloneNoteListLayout(layoutRef.current);
    for (const g of base.groups) {
      g.noteIds = g.noteIds.filter((nid) => nid !== id);
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

    // Dimming the source doesn't change geometry, so the snapshot is valid taken now.
    takeSnapshot();
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
    // List-container frame: rows and line share it and scroll together, so no scrollTop term.
    const pointerContentY = clientY - container.getBoundingClientRect().top;
    lastPointerContentYRef.current = pointerContentY;
    applyPreview(pointerContentY);
  }

  function resetDragState() {
    activeIdRef.current = null;
    baseLayoutRef.current = null;
    snapshotRef.current = null;
    draggedSetRef.current = new Set();
    startClientYRef.current = null;
    lastPointerContentYRef.current = null;
    lastFlatIndexRef.current = null;
    separateOnDropRef.current = false;
    pendingNextRef.current = null;
    setActiveId(null);
    setIndicator(null);
  }

  function handleDragEnd() {
    const pending = pendingNextRef.current;
    resetDragState();

    // Commit the reorder applyPreview resolved (pendingNextRef). No move resolved → layout unchanged.
    const next = cloneNoteListLayout(pending ?? layoutRef.current);
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

  const renderNoteRow = (
    noteId: string,
    marginClass: string,
    dimmed = false,
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
        isExpanded={isNoteExpanded(note.id)}
        matchesCurrentPage={matchesCurrentPage}
        isReadOnly={isReadOnly}
        onActivateNote={onActivateNote}
        onSetNoteExpanded={onSetNoteExpanded}
        onUpdateNote={onUpdateNote}
        onHighlightNote={onHighlightNote}
        onValidityChange={onValidityChange}
        onRequestDelete={onRequestDelete}
        copiedNote={copiedNote}
        onCopyNote={onCopyNote}
      />
    );
  };

  // The grabbed note's faithful clone that rides the cursor. dnd-kit sizes the overlay wrapper to
  // the dragged row's measured rect, so the read-only Note fills the column width.
  const renderDragClone = (): React.ReactNode => {
    const note = activeId ? notesById.get(activeId) : undefined;
    if (!note) {
      return null;
    }
    const matchesCurrentPage =
      browserTabUrlKey !== null &&
      noteUrlMatchesBrowserTab(note.url, browserTabUrlKey);
    return (
      <div className="shadow-lg">
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
      </div>
    );
  };

  // The list renders in stable order during a drag (no reflow); the active note dims in place and a
  // single static line marks the resolved drop slot.
  const renderRows = (): React.ReactNode => {
    const rows = buildFlatEntries(layout).map(({ noteId, marginClass }) =>
      renderNoteRow(noteId, marginClass, noteId === activeId),
    );
    return (
      <>
        {rows}
        {indicator &&
          (indicator.isSection ? (
            // New-section placeholder: a dashed item-sized box (where the note lands) + a line under it.
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
          ) : (
            // Plain reorder: one thin high-contrast line (#111 + white ring) at the drop slot.
            <div
              aria-hidden
              className="pointer-events-none absolute right-0 z-20"
              style={{ top: indicator.top, left: indicator.indent ? "0.75rem" : 0 }}
            >
              <div className="-translate-y-1/2 h-[3px] rounded-full bg-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
            </div>
          ))}
      </>
    );
  };

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {/* Flat column; section separation is each section head's leading margin. Relative so the
          insertion line positions against it. */}
      <div ref={listContainerRef} className="relative m-0 flex flex-col p-0">
        {renderRows()}
      </div>
      {overlayHost &&
        createPortal(
          <DragOverlay dropAnimation={null}>{renderDragClone()}</DragOverlay>,
          overlayHost,
        )}
    </DndContext>
  );
}
