import { generateId } from "@/lib/generateId";
import {
  cloneNoteListLayout,
  flattenLayoutNoteIds,
  pruneEmptyNoteGroups,
} from "@/lib/nnNoteLayout";
import {
  removeNoteIdFromIndex,
  reorderNotesArray,
  withLayoutInMeta,
} from "@/lib/nnStorageBuilders";
import { migrateNote } from "@/lib/nnStorageNormalize";
import { layoutStorageKey, noteStorageKey } from "@/lib/nnSyncKeys";
import {
  getIndex,
  getMeta,
  loadAllNotesInIndexOrder,
  loadNotesForIds,
  pruneNoteFromAllLayouts,
  setIndex,
  setMeta,
} from "@/services/nnStorageShards";
import { storageService } from "@/services/storageService";
import type { NNNoteListLayout, NNSyncNote } from "@/types/nnData";

/** Creates a new note at the top of the global note list, expanded by default. */
export async function addNote(input: {
  subjectTabId: string;
  url: string;
}): Promise<NNSyncNote> {
  const index = await getIndex();
  const newNote: NNSyncNote = {
    id: generateId(),
    subjectTabId: input.subjectTabId,
    url: input.url,
    heading: "",
    body: "",
    createdAt: Date.now(),
    isExpanded: true,
  };

  await storageService.sync.setMany({
    [noteStorageKey(newNote.id)]: newNote,
  });

  await setIndex({
    noteIds: [newNote.id, ...index.noteIds],
    bySubjectTab: {
      ...index.bySubjectTab,
      [input.subjectTabId]: [
        newNote.id,
        ...(index.bySubjectTab[input.subjectTabId] ?? []),
      ],
    },
  });

  return newNote;
}

/** Updates editable note fields; unknown note id is a no-op. */
export async function updateNote(
  noteId: string,
  patch: Partial<
    Pick<
      NNSyncNote,
      "url" | "heading" | "body" | "anchor" | "isExpanded" | "createdAt"
    >
  >,
): Promise<void> {
  const key = noteStorageKey(noteId);
  const raw = await storageService.sync.getMany([key]);
  const prev = migrateNote(raw[key]);
  if (!prev) {
    return;
  }

  const next: NNSyncNote = {
    ...prev,
    ...(patch.url !== undefined ? { url: patch.url } : {}),
    ...(patch.heading !== undefined ? { heading: patch.heading } : {}),
    ...(patch.body !== undefined ? { body: patch.body } : {}),
    ...(patch.anchor !== undefined ? { anchor: patch.anchor } : {}),
    ...(patch.isExpanded !== undefined ? { isExpanded: patch.isExpanded } : {}),
    ...(patch.createdAt !== undefined ? { createdAt: patch.createdAt } : {}),
  };
  await storageService.sync.setMany({ [key]: next });
}

/** Sets `isExpanded` on a batch of notes in a single write. */
export async function setNotesExpanded(
  noteIds: string[],
  expanded: boolean,
): Promise<void> {
  if (noteIds.length === 0) {
    return;
  }
  const notes = await loadNotesForIds(noteIds);
  const updates: Record<string, NNSyncNote> = {};
  for (const note of notes) {
    updates[noteStorageKey(note.id)] = { ...note, isExpanded: expanded };
  }
  if (Object.keys(updates).length > 0) {
    await storageService.sync.setMany(updates);
  }
}

/** Deletes one note by id; unknown note id is a no-op. */
export async function deleteNote(noteId: string): Promise<void> {
  const index = await getIndex();
  if (!index.noteIds.includes(noteId)) {
    return;
  }

  await storageService.sync.removeMany([noteStorageKey(noteId)]);
  await setIndex(removeNoteIdFromIndex(index, noteId));
  await pruneNoteFromAllLayouts(noteId);
}

/** Reorders the subset in `newOrderedIds` within the global index, preserving the relative positions of notes not in the subset. */
export async function reorderNotes(newOrderedIds: string[]): Promise<void> {
  const index = await getIndex();
  const notes = await loadAllNotesInIndexOrder(index);
  const reordered = reorderNotesArray(notes, newOrderedIds);
  await setIndex({ ...index, noteIds: reordered.map((n) => n.id) });
}

/** Persists section layout + gap metadata and matches global note order to the flattened layout. */
export async function commitNoteListLayout(
  layoutKey: string,
  layout: NNNoteListLayout,
): Promise<void> {
  const meta = await getMeta();
  const index = await getIndex();
  const normalized = cloneNoteListLayout(layout);
  pruneEmptyNoteGroups(normalized);
  const flat = flattenLayoutNoteIds(normalized);
  const notes = await loadAllNotesInIndexOrder(index);
  const reordered = reorderNotesArray(notes, flat);

  await storageService.sync.setMany({
    [layoutStorageKey(layoutKey)]: normalized,
  });
  await setMeta(withLayoutInMeta(meta, layoutKey));
  await setIndex({ ...index, noteIds: reordered.map((n) => n.id) });
}
