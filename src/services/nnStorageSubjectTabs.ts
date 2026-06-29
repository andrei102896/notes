import { removeNoteIdsFromIndex } from "@/lib/nnStorageBuilders";
import { layoutStorageKey, noteStorageKey } from "@/lib/nnSyncKeys";
import { clampSubjectTabName } from "@/lib/subjectTabName";
import {
  getIndex,
  getMeta,
  pruneNotesFromAllLayouts,
  setIndex,
  setMeta,
} from "@/services/nnStorageShards";
import { storageService } from "@/services/storageService";
import type { NNSubjectTab } from "@/types/nnData";

/** Adds a subject tab folder; empty / whitespace-only names are ignored (returns null). */
export async function addSubjectTab(
  name: string,
): Promise<NNSubjectTab | null> {
  const trimmed = clampSubjectTabName(name.trim());
  if (!trimmed) {
    return null;
  }
  const meta = await getMeta();
  const newTab: NNSubjectTab = {
    id: crypto.randomUUID(),
    name: trimmed,
    createdAt: Date.now(),
  };
  await setMeta({ ...meta, subjectTabs: [...meta.subjectTabs, newTab] });
  return newTab;
}

/** Renames an existing subject tab; empty / whitespace-only names are ignored (no-op). */
export async function renameSubjectTab(
  subjectTabId: string,
  name: string,
): Promise<void> {
  const trimmed = clampSubjectTabName(name.trim());
  if (!trimmed) {
    return;
  }
  const meta = await getMeta();
  const idx = meta.subjectTabs.findIndex((t) => t.id === subjectTabId);
  if (idx === -1) {
    return;
  }
  const nextTabs = [...meta.subjectTabs];
  nextTabs[idx] = { ...nextTabs[idx], name: trimmed };
  await setMeta({ ...meta, subjectTabs: nextTabs });
}

/** Removes a subject tab and all notes that belong to it. */
export async function deleteSubjectTab(subjectTabId: string): Promise<void> {
  const meta = await getMeta();
  const index = await getIndex();
  const noteIds = index.bySubjectTab[subjectTabId] ?? [];
  const layoutKey = `st:${subjectTabId}`;

  if (noteIds.length > 0) {
    await storageService.sync.removeMany(noteIds.map(noteStorageKey));
  }

  const nextBySubjectTab = { ...index.bySubjectTab };
  delete nextBySubjectTab[subjectTabId];
  const removeSet = new Set(noteIds);
  await setIndex({
    noteIds: index.noteIds.filter((id) => !removeSet.has(id)),
    bySubjectTab: nextBySubjectTab,
  });

  const nextLayoutIndex = meta.layoutIndex.filter((k) => k !== layoutKey);
  await setMeta({
    subjectTabs: meta.subjectTabs.filter((t) => t.id !== subjectTabId),
    layoutIndex: nextLayoutIndex,
  });

  if (meta.layoutIndex.includes(layoutKey)) {
    await storageService.sync.removeMany([layoutStorageKey(layoutKey)]);
  }

  if (noteIds.length > 0) {
    await pruneNotesFromAllLayouts(noteIds);
  }
}

export async function deleteAllNotesInSubjectTab(
  subjectTabId: string,
): Promise<void> {
  const index = await getIndex();
  const noteIds = index.bySubjectTab[subjectTabId] ?? [];
  if (noteIds.length === 0) {
    return;
  }

  const removeSet = new Set(noteIds);
  await storageService.sync.removeMany(noteIds.map(noteStorageKey));
  await setIndex(removeNoteIdsFromIndex(index, removeSet));
  await pruneNotesFromAllLayouts(noteIds);
}
