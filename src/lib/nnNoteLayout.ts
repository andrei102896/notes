import type { NNNoteListLayout } from "@/types/nnData";

/** Matches collapsed header row (`h-10` at default 16px rem). */
export const NN_COLLAPSED_NOTE_HEADER_PX = 40;

export function noteListLayoutKey(input: {
  activeSubjectTabId: string | null;
  browserTabUrlKey: string | null;
}): string | null {
  if (input.activeSubjectTabId) {
    return `st:${input.activeSubjectTabId}`;
  }
  if (input.browserTabUrlKey) {
    return `url:${input.browserTabUrlKey}`;
  }
  return null;
}

export function buildDefaultNoteListLayout(noteIds: string[]): NNNoteListLayout {
  if (noteIds.length === 0) {
    return { groups: [], gapBeforePxByNoteId: {} };
  }
  return {
    groups: [
      {
        id: "default",
        noteIds: [...noteIds],
      },
    ],
    gapBeforePxByNoteId: {},
  };
}

/**
 * Drops section buckets with no notes (preserves order of non-empty groups).
 */
export function pruneEmptyNoteGroups(layout: NNNoteListLayout): void {
  layout.groups = layout.groups.filter((g) => g.noteIds.length > 0);
}

export function cloneNoteListLayout(layout: NNNoteListLayout): NNNoteListLayout {
  return {
    groups: layout.groups.map((g) => ({
      id: g.id,
      noteIds: [...g.noteIds],
    })),
    gapBeforePxByNoteId: { ...layout.gapBeforePxByNoteId },
  };
}

/**
 * Collapses a multi-group layout into a single ordered stack. Each former group
 * break (every group after the first) becomes a leading gap on that group's first
 * note, so prior visual separations survive as gaps. The note list now uses one
 * stack with per-note gaps for separation (doc 3_NN_NOTES); "sections" are gone.
 */
export function flattenToSingleStack(
  layout: NNNoteListLayout,
): NNNoteListLayout {
  if (layout.groups.length <= 1) {
    return layout;
  }
  const gapBeforePxByNoteId = { ...layout.gapBeforePxByNoteId };
  const noteIds: string[] = [];
  layout.groups.forEach((group, groupIndex) => {
    const firstId = group.noteIds[0];
    if (
      groupIndex > 0 &&
      firstId !== undefined &&
      gapBeforePxByNoteId[firstId] === undefined
    ) {
      gapBeforePxByNoteId[firstId] = NN_COLLAPSED_NOTE_HEADER_PX;
    }
    noteIds.push(...group.noteIds);
  });
  return {
    groups: [{ id: layout.groups[0]?.id ?? "default", noteIds }],
    gapBeforePxByNoteId,
  };
}

/**
 * Ensures each visible note appears exactly once; drops stale ids; appends new notes in sync order.
 */
export function resolveNoteListLayout(
  visibleNoteIdsInSyncOrder: string[],
  stored: NNNoteListLayout | undefined,
): NNNoteListLayout {
  const visibleSet = new Set(visibleNoteIdsInSyncOrder);
  if (!stored || stored.groups.length === 0) {
    return buildDefaultNoteListLayout(visibleNoteIdsInSyncOrder);
  }
  const next = cloneNoteListLayout(stored);
  const seen = new Set<string>();
  for (const g of next.groups) {
    g.noteIds = g.noteIds.filter((id) => {
      if (!visibleSet.has(id) || seen.has(id)) {
        return false;
      }
      seen.add(id);
      return true;
    });
  }
  pruneEmptyNoteGroups(next);
  const newIds: string[] = [];
  for (const id of visibleNoteIdsInSyncOrder) {
    if (!seen.has(id)) {
      newIds.push(id);
      seen.add(id);
    }
  }
  if (newIds.length > 0) {
    if (next.groups.length === 0) {
      next.groups.push({ id: "default", noteIds: [] });
    }
    next.groups[0].noteIds = [...newIds, ...next.groups[0].noteIds];
  }
  const gap = { ...next.gapBeforePxByNoteId };
  for (const key of Object.keys(gap)) {
    if (!visibleSet.has(key)) {
      delete gap[key];
    }
  }
  next.gapBeforePxByNoteId = gap;
  if (next.groups.length === 0) {
    return buildDefaultNoteListLayout(visibleNoteIdsInSyncOrder);
  }
  return flattenToSingleStack(next);
}

export function flattenLayoutNoteIds(layout: NNNoteListLayout): string[] {
  return layout.groups.flatMap((g) => g.noteIds);
}

/**
 * Separates a note from the stack by giving it a leading gap equal to one
 * collapsed note — doc 3_NN_NOTES: Ctrl/Cmd+drag "creating a space equivalent to
 * the note height when collapsed". Idempotent; mutate a cloned layout.
 */
export function separateNoteWithGap(
  layout: NNNoteListLayout,
  noteId: string,
): void {
  layout.gapBeforePxByNoteId[noteId] = NN_COLLAPSED_NOTE_HEADER_PX;
}

export function findNotePlacement(
  layout: NNNoteListLayout,
  noteId: string,
): { groupIndex: number; indexInGroup: number } | null {
  for (let gi = 0; gi < layout.groups.length; gi++) {
    const ni = layout.groups[gi].noteIds.indexOf(noteId);
    if (ni !== -1) {
      return { groupIndex: gi, indexInGroup: ni };
    }
  }
  return null;
}
