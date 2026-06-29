import type { NNNoteIndex, NNSyncMeta, NNSyncNote } from "@/types/nnData";

export function buildIndexFromNotes(notes: NNSyncNote[]): NNNoteIndex {
  const bySubjectTab: Record<string, string[]> = {};
  for (const note of notes) {
    const list = bySubjectTab[note.subjectTabId] ?? [];
    list.push(note.id);
    bySubjectTab[note.subjectTabId] = list;
  }
  return {
    noteIds: notes.map((n) => n.id),
    bySubjectTab,
  };
}

export function withLayoutInMeta(
  meta: NNSyncMeta,
  layoutKey: string,
): NNSyncMeta {
  if (meta.layoutIndex.includes(layoutKey)) {
    return meta;
  }
  return { ...meta, layoutIndex: [...meta.layoutIndex, layoutKey] };
}

export function removeNoteIdFromIndex(
  index: NNNoteIndex,
  noteId: string,
): NNNoteIndex {
  const nextBySubjectTab: Record<string, string[]> = {};
  for (const [tabId, ids] of Object.entries(index.bySubjectTab)) {
    const filtered = ids.filter((id) => id !== noteId);
    if (filtered.length > 0) {
      nextBySubjectTab[tabId] = filtered;
    }
  }
  return {
    noteIds: index.noteIds.filter((id) => id !== noteId),
    bySubjectTab: nextBySubjectTab,
  };
}

export function removeNoteIdsFromIndex(
  index: NNNoteIndex,
  noteIdsToRemove: Set<string>,
): NNNoteIndex {
  const nextBySubjectTab: Record<string, string[]> = {};
  for (const [tabId, ids] of Object.entries(index.bySubjectTab)) {
    const filtered = ids.filter((id) => !noteIdsToRemove.has(id));
    if (filtered.length > 0) {
      nextBySubjectTab[tabId] = filtered;
    }
  }
  return {
    noteIds: index.noteIds.filter((id) => !noteIdsToRemove.has(id)),
    bySubjectTab: nextBySubjectTab,
  };
}

export function reorderNotesArray(
  notes: NNSyncNote[],
  newOrderedIds: string[],
): NNSyncNote[] {
  const idSet = new Set(newOrderedIds);
  const positions = notes
    .map((n, i) => ({ n, i }))
    .filter(({ n }) => idSet.has(n.id))
    .map(({ i }) => i);
  const noteMap = new Map(notes.map((n) => [n.id, n]));
  const reordered = newOrderedIds
    .map((id) => noteMap.get(id))
    .filter((n): n is NNSyncNote => n !== undefined);
  const result = [...notes];
  positions.forEach((pos, idx) => {
    result[pos] = reordered[idx];
  });
  return result;
}
