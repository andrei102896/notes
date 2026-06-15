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
  return next;
}

export function flattenLayoutNoteIds(layout: NNNoteListLayout): string[] {
  return layout.groups.flatMap((g) => g.noteIds);
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
