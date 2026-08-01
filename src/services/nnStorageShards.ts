import { cloneNoteListLayout, pruneEmptyNoteGroups } from "@/lib/nnNoteLayout";
import { buildIndexFromNotes } from "@/lib/nnStorageBuilders";
import {
  coerceNoteListLayout,
  migrateNote,
  normalizeIndex,
  normalizeMeta,
} from "@/lib/nnStorageNormalize";
import {
  layoutStorageKey,
  NN_NOTE_INDEX_KEY,
  NN_SYNC_META_KEY,
  noteStorageKey,
} from "@/lib/nnSyncKeys";
import { storageService } from "@/services/storageService";
import type {
  NNNoteIndex,
  NNNoteListLayout,
  NNSyncMeta,
  NNSyncNote,
  NNSyncPayload,
} from "@/types/nnData";

export async function getMeta(): Promise<NNSyncMeta> {
  const raw = await storageService.sync.get(NN_SYNC_META_KEY);
  return normalizeMeta(raw);
}

export async function setMeta(meta: NNSyncMeta): Promise<void> {
  await storageService.sync.set(NN_SYNC_META_KEY, meta);
}

export async function getIndex(): Promise<NNNoteIndex> {
  const raw = await storageService.sync.get(NN_NOTE_INDEX_KEY);
  return normalizeIndex(raw);
}

export async function setIndex(index: NNNoteIndex): Promise<void> {
  await storageService.sync.set(NN_NOTE_INDEX_KEY, index);
}

export async function loadNotesForIds(
  noteIds: string[],
): Promise<NNSyncNote[]> {
  if (noteIds.length === 0) {
    return [];
  }
  const keys = noteIds.map(noteStorageKey);
  const raw = await storageService.sync.getMany(keys);
  return noteIds
    .map((id) => migrateNote(raw[noteStorageKey(id)]))
    .filter((n): n is NNSyncNote => n !== null);
}

export async function loadAllNotesInIndexOrder(
  index: NNNoteIndex,
): Promise<NNSyncNote[]> {
  const noteMap = new Map(
    (await loadNotesForIds(index.noteIds)).map((n) => [n.id, n]),
  );
  return index.noteIds
    .map((id) => noteMap.get(id))
    .filter((n): n is NNSyncNote => n !== undefined);
}

export async function loadAllLayouts(
  meta: NNSyncMeta,
): Promise<Record<string, NNNoteListLayout>> {
  if (meta.layoutIndex.length === 0) {
    return {};
  }
  const keys = meta.layoutIndex.map(layoutStorageKey);
  const raw = await storageService.sync.getMany(keys);
  const out: Record<string, NNNoteListLayout> = {};
  for (const layoutKey of meta.layoutIndex) {
    const layout = coerceNoteListLayout(raw[layoutStorageKey(layoutKey)]);
    if (layout) {
      out[layoutKey] = layout;
    }
  }
  return out;
}

export async function writeShardedFromPayload(
  payload: NNSyncPayload,
): Promise<void> {
  const noteLayouts = payload.noteLayouts ?? {};
  const meta: NNSyncMeta = {
    subjectTabs: payload.subjectTabs,
    layoutIndex: Object.keys(noteLayouts),
  };
  const index = buildIndexFromNotes(payload.notes);

  const noteEntries: Record<string, NNSyncNote> = {};
  for (const note of payload.notes) {
    noteEntries[noteStorageKey(note.id)] = note;
  }

  const layoutEntries: Record<string, NNNoteListLayout> = {};
  for (const [layoutKey, layout] of Object.entries(noteLayouts)) {
    layoutEntries[layoutStorageKey(layoutKey)] = layout;
  }

  await setMeta(meta);
  await setIndex(index);
  if (Object.keys(noteEntries).length > 0) {
    await storageService.sync.setMany(noteEntries);
  }
  if (Object.keys(layoutEntries).length > 0) {
    await storageService.sync.setMany(layoutEntries);
  }
}

export async function pruneNotesFromAllLayouts(
  noteIds: string[],
): Promise<void> {
  if (noteIds.length === 0) {
    return;
  }
  const removeSet = new Set(noteIds);
  const meta = await getMeta();
  if (meta.layoutIndex.length === 0) {
    return;
  }

  const layoutKeys = meta.layoutIndex.map(layoutStorageKey);
  const raw = await storageService.sync.getMany(layoutKeys);
  const updates: Record<string, NNNoteListLayout> = {};
  const emptyLayoutKeys: string[] = [];

  for (const layoutKey of meta.layoutIndex) {
    const layout = coerceNoteListLayout(raw[layoutStorageKey(layoutKey)]);
    if (!layout) {
      emptyLayoutKeys.push(layoutKey);
      continue;
    }
    const next = cloneNoteListLayout(layout);
    let changed = false;
    for (const group of next.groups) {
      const before = group.noteIds.length;
      group.noteIds = group.noteIds.filter((id) => !removeSet.has(id));
      if (group.noteIds.length !== before) {
        changed = true;
      }
    }
    for (const id of noteIds) {
      if (id in next.gapBeforePxByNoteId) {
        delete next.gapBeforePxByNoteId[id];
        changed = true;
      }
    }
    if (!changed) {
      continue;
    }
    pruneEmptyNoteGroups(next);
    if (next.groups.length === 0) {
      emptyLayoutKeys.push(layoutKey);
    } else {
      updates[layoutStorageKey(layoutKey)] = next;
    }
  }

  if (Object.keys(updates).length > 0) {
    await storageService.sync.setMany(updates);
  }

  if (emptyLayoutKeys.length > 0) {
    await storageService.sync.removeMany(emptyLayoutKeys.map(layoutStorageKey));
    await setMeta({
      ...meta,
      layoutIndex: meta.layoutIndex.filter(
        (key) => !emptyLayoutKeys.includes(key),
      ),
    });
  }
}

export async function pruneNoteFromAllLayouts(noteId: string): Promise<void> {
  await pruneNotesFromAllLayouts([noteId]);
}
