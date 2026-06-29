import { useCallback, useEffect, useRef, useState } from "react";

import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragMoveEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { flattenLayoutNoteIds } from "@/lib/nnNoteLayout";
import {
  DRAG_ACTIVATION_DISTANCE_PX,
  SECTION_GAP_REM,
} from "@/lib/notesListConstants";
import {
  dragOrderForId,
  layoutWithoutNotes,
  resolveCommittedLayout,
  resolveDragPreview,
  snapshotRows,
  type DropIndicatorState,
  type SnapshotRow,
} from "@/lib/notesListGeometry";
import type { NNNoteListLayout } from "@/types/nnData";

type UseNoteDragParams = {
  noteLayout: NNNoteListLayout;
  layoutRef: React.MutableRefObject<NNNoteListLayout>;
  listContainerRef: React.RefObject<HTMLDivElement | null>;
  onCommitNoteLayout: (next: NNNoteListLayout) => Promise<void>;
  selectedNoteIds: Set<string>;
  clearSelection: () => void;
  reconcileWithVisible: (visible: Set<string>) => void;
};

export function useNoteDrag({
  noteLayout,
  layoutRef,
  listContainerRef,
  onCommitNoteLayout,
  selectedNoteIds,
  clearSelection,
  reconcileWithVisible,
}: UseNoteDragParams) {
  const [layout, setLayout] = useState(noteLayout);
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);
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
  const [indicator, setIndicator] = useState<DropIndicatorState | null>(null);
  /** Iframe <body> — the drag clone portals here to escape the frosted container's containing block. */
  const [overlayHost, setOverlayHost] = useState<HTMLElement | null>(null);
  /** Section gap (SECTION_GAP_CLASS = 4rem) in px, captured at drag start — positions the new-section placeholder. */
  const sectionGapPxRef = useRef(0);
  /** List-container top in viewport px, cached at drag start + refreshed on scroll — avoids a forced reflow each move. */
  const containerTopRef = useRef(0);
  /** Active dragged row's original extent (list-container px); a plain drop released inside it didn't move the item → no-op. */
  const draggedRowTopRef = useRef<number | null>(null);
  const draggedRowBottomRef = useRef<number | null>(null);

  // Freezes every visible row's extent (incl. the dimmed dragged notes) at drag start; list never reflows mid-drag, so it stays valid.
  const takeSnapshot = useCallback(() => {
    const container = listContainerRef.current;
    snapshotRef.current = container ? snapshotRows(container) : null;
  }, [listContainerRef]);

  // Hit-tests the cursor against the frozen snapshot (pure resolveDragPreview), stores the reorder for commit, positions the line; list reorders on drop only.
  const applyPreview = useCallback(
    (probeY: number) => {
      const base = baseLayoutRef.current;
      const snap = snapshotRef.current;
      const id = activeIdRef.current;
      if (!base || !snap || id === null) {
        return;
      }
      const result = resolveDragPreview({
        base,
        snap,
        activeId: id,
        probeY,
        asNew: separateOnDropRef.current,
        lastFlatIndex: lastFlatIndexRef.current,
        draggedSet: draggedSetRef.current,
        dragOrder: dragOrderRef.current,
        sectionGapPx: sectionGapPxRef.current,
        currentLayout: layoutRef.current,
      });
      lastFlatIndexRef.current = result.visualIndex;
      pendingNextRef.current = result.pendingNext;
      setIndicator(result.indicator);
    },
    [layoutRef],
  );

  useEffect(() => {
    // An in-flight drag owns the layout; don't let an external update clobber the live preview.
    if (activeIdRef.current !== null) {
      return;
    }
    setLayout(noteLayout);
    layoutRef.current = noteLayout;
    reconcileWithVisible(new Set(flattenLayoutNoteIds(noteLayout)));
  }, [noteLayout, layoutRef, reconcileWithVisible]);

  useEffect(() => {
    // Iframe <body> is outside the frosted container, so the DragOverlay's fixed positioning resolves against the iframe viewport (no offset).
    setOverlayHost(listContainerRef.current?.ownerDocument.body ?? null);
  }, [listContainerRef]);

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
  }, [activeId, applyPreview, listContainerRef]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: DRAG_ACTIVATION_DISTANCE_PX },
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
    dragOrderRef.current = dragOrderForId(
      layoutRef.current,
      id,
      selectedNoteIds,
    );
    draggedSetRef.current = new Set(dragOrderRef.current);

    // Base = current layout minus the dragged block; preview rebuilds from this each move, so it equals what commits on drop.
    baseLayoutRef.current = layoutWithoutNotes(
      layoutRef.current,
      draggedSetRef.current,
    );

    pendingNextRef.current = null;
    setIndicator(null);

    // 4rem in px (iframe root font) — how far below the last note the new-section placeholder sits.
    const root = listContainerRef.current?.ownerDocument.documentElement;
    sectionGapPxRef.current = root
      ? SECTION_GAP_REM * (parseFloat(getComputedStyle(root).fontSize) || 16)
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
    setActiveId(null);
    setIndicator(null);
    clearSelection();
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

    const next = resolveCommittedLayout({
      pending,
      original,
      wasAsNew,
      single,
      cursorY,
      rowTop,
      rowBottom,
    });
    layoutRef.current = next;
    setLayout(next);
    void onCommitNoteLayout(next);
  }

  function handleDragCancel() {
    resetDragState();
    layoutRef.current = noteLayout;
    setLayout(noteLayout);
  }

  const isMultiActive =
    activeId !== null &&
    selectedNoteIds.size > 1 &&
    selectedNoteIds.has(activeId);

  return {
    layout,
    activeId,
    indicator,
    overlayHost,
    sensors,
    isMultiActive,
    dragOrderRef,
    dragHandlers: {
      onDragStart: handleDragStart,
      onDragMove: handleDragMove,
      onDragEnd: handleDragEnd,
      onDragCancel: handleDragCancel,
    },
  };
}
