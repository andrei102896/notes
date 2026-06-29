import { useCallback, useEffect, useRef, useState } from "react";

import { flattenLayoutNoteIds } from "@/lib/nnNoteLayout";
import type { NoteSelectModifiers } from "@/overlay/Note";
import type { NNNoteListLayout } from "@/types/nnData";

type UseNoteSelectionParams = {
  layoutRef: React.MutableRefObject<NNNoteListLayout>;
  activeSubjectTabId: string | null;
  listContainerRef: React.RefObject<HTMLDivElement | null>;
};

export type NoteSelectionApi = {
  /** Multi-note selection (Cmd/Ctrl toggle, Shift range); dragging a member moves the whole set. */
  selectedNoteIds: Set<string>;
  handleSelect: (noteId: string, mods: NoteSelectModifiers) => void;
  /** Shift-range anchor — the note last clicked plainly or with Cmd/Ctrl. */
  anchorNoteIdRef: React.MutableRefObject<string | null>;
  /** Drop selection/anchor ids that aren't in the visible set (e.g. a selected note was deleted). */
  reconcileWithVisible: (visible: Set<string>) => void;
  clearSelection: () => void;
};

export function useNoteSelection({
  layoutRef,
  activeSubjectTabId,
  listContainerRef,
}: UseNoteSelectionParams): NoteSelectionApi {
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    new Set(),
  );
  const anchorNoteIdRef = useRef<string | null>(null);
  /** True while the anchor came from a bare left-click and hasn't been consumed — the next Cmd/Ctrl-click folds it into the group. */
  const plainAnchorPendingRef = useRef(false);

  // Cmd/Ctrl toggles a note; Shift selects the range from the anchor; a plain click clears. Stable (functional updater + refs) so the rows don't churn on its identity.
  const handleSelect = useCallback(
    (noteId: string, mods: NoteSelectModifiers) => {
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
    },
    [layoutRef],
  );

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
  }, [listContainerRef]);

  const reconcileWithVisible = useCallback((visible: Set<string>) => {
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
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedNoteIds((prev) => (prev.size ? new Set() : prev));
    anchorNoteIdRef.current = null;
  }, []);

  return {
    selectedNoteIds,
    handleSelect,
    anchorNoteIdRef,
    reconcileWithVisible,
    clearSelection,
  };
}
