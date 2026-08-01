import {
  applyDropPlacement,
  cloneNoteListLayout,
  flattenLayoutNoteIds,
  noteGroupingsEqual,
  pruneEmptyNoteGroups,
  resolveDropPlacement,
} from "@/lib/nnNoteLayout";
import {
  DROP_HYSTERESIS_PX,
  NOTE_GAP_CLASS,
  SECTION_GAP_CLASS,
} from "@/lib/notesListConstants";
import type { NNNoteListLayout } from "@/types/nnData";

/** A visible row's vertical extent (incl. the dimmed dragged note), captured once at drag start, in list-container px. */
export type SnapshotRow = {
  id: string;
  top: number;
  bottom: number;
  mid: number;
};

/** Where/how to draw the drop indicator during a drag (list-container px). */
export type DropIndicatorState = {
  top: number;
  /** Inset the line — marks "first of the section below". */
  indent: boolean;
  /** Cmd/Ctrl: dashed item-sized placeholder box (new section) instead of a bare line. */
  isSection: boolean;
  /** New-section box height (px); 0 for the plain reorder line. */
  boxHeight: number;
  label: string | null;
};

export type FlatEntry = { noteId: string; marginClass: string };

/** Walks the layout into flat render order, tagging each note's leading margin. */
export function buildFlatEntries(layout: NNNoteListLayout): FlatEntry[] {
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
export function isSectionBoundaryIndex(
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

/** Pure hit-test: resolves the drop slot from the frozen snapshot + cursor Y, returning the staged reorder, the indicator to draw, and the new hysteresis anchor (visualIndex). Mutating nothing — the hook applies the outputs. */
export function resolveDragPreview(input: {
  base: NNNoteListLayout;
  snap: SnapshotRow[];
  activeId: string;
  probeY: number;
  asNew: boolean;
  lastFlatIndex: number | null;
  draggedSet: Set<string>;
  dragOrder: string[];
  sectionGapPx: number;
  currentLayout: NNNoteListLayout;
}): {
  pendingNext: NNNoteListLayout | null;
  indicator: DropIndicatorState | null;
  visualIndex: number | null;
} {
  const {
    base,
    snap,
    activeId,
    probeY: y,
    asNew,
    draggedSet,
    dragOrder,
    sectionGapPx,
    currentLayout,
  } = input;

  if (snap.length === 0) {
    return {
      pendingNext: applyDropPlacement(
        base,
        resolveDropPlacement(base, 0, null, asNew),
        dragOrder,
      ),
      indicator: null,
      visualIndex: input.lastFlatIndex,
    };
  }

  // Hit-test among ALL visible rows (incl. the dimmed dragged rows) so the slot follows the cursor past them.
  let visualIndex = 0;
  while (visualIndex < snap.length && snap[visualIndex].mid < y) {
    visualIndex++;
  }
  // Hysteresis: hold the current slot until the cursor clears a row midpoint by this much.
  const K = input.lastFlatIndex;
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

  let boundarySide: "above" | "below" | null = null;
  if (visualIndex > 0 && visualIndex < snap.length) {
    const gapMid = (snap[visualIndex - 1].bottom + snap[visualIndex].top) / 2;
    boundarySide = y < gapMid ? "above" : "below";
  }

  // Map the visual insertion point to a base index (base excludes the dragged block).
  let baseFlatIndex = 0;
  for (let i = 0; i < visualIndex; i++) {
    if (!draggedSet.has(snap[i].id)) {
      baseFlatIndex++;
    }
  }

  // Cmd + cursor anywhere over the last row or below → snap to a new section at the very end, so the whole last row + the space under it is one forgiving drop zone (no pixel-hunting the placeholder).
  const forceEnd = asNew && y >= snap[snap.length - 1].top;
  const endIndex = base.groups.reduce((n, g) => n + g.noteIds.length, 0);
  const placement = resolveDropPlacement(
    base,
    forceEnd ? endIndex : baseFlatIndex,
    boundarySide,
    asNew,
  );
  const pendingNext = applyDropPlacement(base, placement, dragOrder);

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
    if (pendingNext && noteGroupingsEqual(pendingNext, currentLayout)) {
      return { pendingNext: null, indicator: null, visualIndex };
    }
    // New-section cue follows the cursor; the dashed item-box only fits the empty space past the last note, elsewhere a labeled line marks the slot.
    const draggedRow = snap.find((r) => r.id === activeId);
    return {
      pendingNext,
      indicator: {
        top: atListEnd ? top + sectionGapPx : top,
        indent: false,
        isSection: true,
        boxHeight:
          atListEnd && draggedRow ? draggedRow.bottom - draggedRow.top : 0,
        label: "New section",
      },
      visualIndex,
    };
  }

  return {
    pendingNext,
    indicator: {
      top,
      indent: sectionBoundary && boundarySide === "below",
      isSection: false,
      boxHeight: 0,
      label: null,
    },
    visualIndex,
  };
}

/** Measures every [data-note-id] row's extent relative to the container (list-container px). */
export function snapshotRows(container: HTMLElement): SnapshotRow[] {
  const containerRect = container.getBoundingClientRect();
  const rows: SnapshotRow[] = [];
  container.querySelectorAll<HTMLElement>("[data-note-id]").forEach((el) => {
    const id = el.getAttribute("data-note-id");
    if (!id) {
      return;
    }
    const r = el.getBoundingClientRect();
    const top = r.top - containerRect.top;
    const bottom = r.bottom - containerRect.top;
    rows.push({ id, top, bottom, mid: (top + bottom) / 2 });
  });
  return rows;
}

/** Clone of the layout with every dragged note removed + empty groups pruned — the preview base. */
export function layoutWithoutNotes(
  layout: NNNoteListLayout,
  draggedSet: Set<string>,
): NNNoteListLayout {
  const base = cloneNoteListLayout(layout);
  for (const g of base.groups) {
    g.noteIds = g.noteIds.filter((nid) => !draggedSet.has(nid));
  }
  pruneEmptyNoteGroups(base);
  return base;
}

/** The dragged block in flat layout order: the whole selection when id is a multi-member, else just id. */
export function dragOrderForId(
  layout: NNNoteListLayout,
  id: string,
  selectedNoteIds: Set<string>,
): string[] {
  const isMulti = selectedNoteIds.size > 1 && selectedNoteIds.has(id);
  if (!isMulti) {
    return [id];
  }
  return flattenLayoutNoteIds(layout).filter((nid) => selectedNoteIds.has(nid));
}

/** Final (clone+pruned) layout to commit on drop. A plain single-item drop released over the item's OWN original row never moved it → keep the original, so a near-zero "select" drag can't silently merge a sole-item section into its neighbor. */
export function resolveCommittedLayout(input: {
  pending: NNNoteListLayout | null;
  original: NNNoteListLayout;
  wasAsNew: boolean;
  single: boolean;
  cursorY: number | null;
  rowTop: number | null;
  rowBottom: number | null;
}): NNNoteListLayout {
  const { pending, original, wasAsNew, single, cursorY, rowTop, rowBottom } =
    input;
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
  return next;
}
