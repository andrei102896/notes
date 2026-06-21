import type { NNNoteListGroup, NNNoteListLayout } from "@/types/nnData";

/** Matches collapsed header row (`h-10` at default 16px rem) — drag-placeholder height. */
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

/** Stable group id derived from the section's head note (no key churn across renders). */
function sectionId(headNoteId: string): string {
  return `sec-${headNoteId}`;
}

/**
 * Migration: turn legacy per-note separation gaps into real section groups. Within each
 * group, every note (after the first) carrying a `gapBeforePx` starts a new section, then
 * `gapBeforePxByNoteId` is cleared — sections now carry the separation, not per-note gaps.
 * Deterministic ids keep it idempotent (safe to run on every resolve until a commit clears
 * the gaps). No-op when there are no gaps.
 */
export function splitGroupsAtSeparationGaps(
  layout: NNNoteListLayout,
): NNNoteListLayout {
  if (Object.keys(layout.gapBeforePxByNoteId).length === 0) {
    return layout;
  }
  const groups: NNNoteListLayout["groups"] = [];
  for (const group of layout.groups) {
    let current: string[] = [];
    let firstChunk = true;
    const flush = (): void => {
      if (current.length === 0) {
        return;
      }
      groups.push({
        id: firstChunk ? group.id : sectionId(current[0]),
        noteIds: current,
      });
      firstChunk = false;
      current = [];
    };
    group.noteIds.forEach((id, idx) => {
      if (idx > 0 && (layout.gapBeforePxByNoteId[id] ?? 0) > 0) {
        flush();
      }
      current.push(id);
    });
    flush();
  }
  return { groups, gapBeforePxByNoteId: {} };
}

/**
 * Where a dragged block lands, resolved from drag geometry. All indices reference the
 * BASE layout (the dragged notes already removed), so applying a placement to that base
 * yields exactly the committed result.
 *
 * - `into-group` — insert the block inside an existing section at `indexInGroup`.
 * - `new-group` — insert the block as its own new section at the `groupIndex` slot
 *   (between two sections, or at either end).
 * - `split-group` — the block becomes a new section inside `groupIndex`, splitting it into
 *   a head (before `indexInGroup`) and a tail (from `indexInGroup`).
 */
export type NoteDropPlacement =
  | { kind: "into-group"; groupIndex: number; indexInGroup: number }
  | { kind: "new-group"; groupIndex: number }
  | { kind: "split-group"; groupIndex: number; indexInGroup: number };

/**
 * Maps a flat insertion index (0..N over the base's flattened notes) to a placement.
 *
 * `boundarySide` only matters when `flatIndex` lands on a section boundary in JOIN mode:
 * "above" appends to the section above, "below" prepends to the section below — the caller
 * sets it from the midpoint of the inter-section gap (NOTES-BEHAVIOR-2: one boundary, one
 * decision). It's ignored inside a section and in new-section mode. Pure.
 */
export function resolveDropPlacement(
  base: NNNoteListLayout,
  flatIndex: number,
  boundarySide: "above" | "below" | null,
  asNewSection: boolean,
): NoteDropPlacement {
  const groups = base.groups;
  const total = groups.reduce((sum, g) => sum + g.noteIds.length, 0);
  if (total === 0) {
    return { kind: "new-group", groupIndex: 0 };
  }
  const k = Math.max(0, Math.min(flatIndex, total));

  let offset = 0;
  for (let gi = 0; gi < groups.length; gi++) {
    const size = groups[gi].noteIds.length;
    if (k < offset + size) {
      const indexInGroup = k - offset;
      if (indexInGroup === 0) {
        // Leading edge of group gi. For gi>0 this is also the boundary with gi-1.
        if (asNewSection) {
          return { kind: "new-group", groupIndex: gi };
        }
        if (gi > 0 && boundarySide === "above") {
          return {
            kind: "into-group",
            groupIndex: gi - 1,
            indexInGroup: groups[gi - 1].noteIds.length,
          };
        }
        return { kind: "into-group", groupIndex: gi, indexInGroup: 0 };
      }
      // Strictly inside group gi.
      return asNewSection
        ? { kind: "split-group", groupIndex: gi, indexInGroup }
        : { kind: "into-group", groupIndex: gi, indexInGroup };
    }
    offset += size;
  }

  // Past the last note → trailing end of the list.
  if (asNewSection) {
    return { kind: "new-group", groupIndex: groups.length };
  }
  const last = groups.length - 1;
  return {
    kind: "into-group",
    groupIndex: last,
    indexInGroup: groups[last].noteIds.length,
  };
}

/**
 * Inserts `ids` into a clone of `base` at `placement`. New section ids derive from their
 * head note (unique per layout, so no churn across re-previews). Pure — does not mutate
 * `base`. The result is exactly what gets committed, so preview and drop never disagree.
 */
export function applyDropPlacement(
  base: NNNoteListLayout,
  placement: NoteDropPlacement,
  ids: string[],
): NNNoteListLayout {
  const next = cloneNoteListLayout(base);
  switch (placement.kind) {
    case "into-group": {
      next.groups[placement.groupIndex].noteIds.splice(
        placement.indexInGroup,
        0,
        ...ids,
      );
      break;
    }
    case "new-group": {
      const group: NNNoteListGroup = {
        id: sectionId(ids[0]),
        noteIds: [...ids],
      };
      next.groups.splice(placement.groupIndex, 0, group);
      break;
    }
    case "split-group": {
      const group = next.groups[placement.groupIndex];
      const head = group.noteIds.slice(0, placement.indexInGroup);
      const tail = group.noteIds.slice(placement.indexInGroup);
      next.groups.splice(
        placement.groupIndex,
        1,
        { id: group.id, noteIds: head },
        { id: sectionId(ids[0]), noteIds: [...ids] },
        { id: sectionId(tail[0]), noteIds: tail },
      );
      break;
    }
  }
  return next;
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
  // Sections are groups. Migrate any legacy per-note gaps into section groups.
  return splitGroupsAtSeparationGaps(next);
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
