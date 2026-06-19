import {
  cloneNoteListLayout,
  flattenLayoutNoteIds,
  pruneEmptyNoteGroups,
} from "@/lib/nnNoteLayout";
import {
  isNNSyncStorageKey,
  layoutStorageKey,
  LEGACY_NN_SYNC_DATA_KEY,
  NN_NOTE_INDEX_KEY,
  NN_SYNC_META_KEY,
  noteStorageKey,
} from "@/lib/nnSyncKeys";
import { clampSubjectTabName } from "@/lib/subjectTabName";
import { storageService } from "@/services/storageService";
import type {
  NNNoteIndex,
  NNNoteListGroup,
  NNNoteListLayout,
  NNPageSessionState,
  NNSyncMeta,
  NNSubjectTab,
  NNSyncNote,
  NNSyncPayload,
} from "@/types/nnData";

export const DEFAULT_NN_SYNC: NNSyncPayload = {
  subjectTabs: [],
  notes: [],
};

const DEFAULT_META: NNSyncMeta = {
  subjectTabs: [],
  layoutIndex: [],
};

const DEFAULT_INDEX: NNNoteIndex = {
  noteIds: [],
  bySubjectTab: {},
};

export const DEFAULT_PAGE_SESSION = (): NNPageSessionState => ({
  activeSubjectTabId: null,
});

function normalizeMeta(raw: unknown): NNSyncMeta {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_META };
  }
  const o = raw as Record<string, unknown>;
  const layoutIndex = Array.isArray(o.layoutIndex)
    ? o.layoutIndex.map((k) => String(k)).filter((k) => k.length > 0)
    : [];
  return {
    subjectTabs: migrateSubjectTabs(o.subjectTabs),
    layoutIndex,
  };
}

function normalizeIndex(raw: unknown): NNNoteIndex {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_INDEX };
  }
  const o = raw as Record<string, unknown>;
  const noteIds = Array.isArray(o.noteIds)
    ? o.noteIds.map((id) => String(id)).filter((id) => id.length > 0)
    : [];
  const bySubjectTab: Record<string, string[]> = {};
  if (o.bySubjectTab && typeof o.bySubjectTab === "object") {
    for (const [tabId, ids] of Object.entries(
      o.bySubjectTab as Record<string, unknown>,
    )) {
      if (!Array.isArray(ids)) {
        continue;
      }
      bySubjectTab[tabId] = ids
        .map((id) => String(id))
        .filter((id) => id.length > 0);
    }
  }
  return { noteIds, bySubjectTab };
}

function migrateSubjectTabs(raw: unknown): NNSubjectTab[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.map((item) => {
    if (!item || typeof item !== "object") {
      return {
        id: crypto.randomUUID(),
        name: "",
        createdAt: Date.now(),
      };
    }
    const t = item as Record<string, unknown>;
    return {
      id: String(t.id ?? crypto.randomUUID()),
      name: String(t.name ?? ""),
      createdAt: typeof t.createdAt === "number" ? t.createdAt : Date.now(),
    };
  });
}

function migrateNote(raw: unknown): NNSyncNote | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const n = raw as Record<string, unknown>;
  const rawAnchor = n.anchor;
  const anchor =
    rawAnchor &&
    typeof rawAnchor === "object" &&
    typeof (rawAnchor as Record<string, unknown>).pageX === "number" &&
    typeof (rawAnchor as Record<string, unknown>).pageY === "number" &&
    typeof (rawAnchor as Record<string, unknown>).elementSelector === "string"
      ? (rawAnchor as import("@/types/nnData").NNAnchorPosition)
      : null;
  const id = String(n.id ?? "");
  if (!id) {
    return null;
  }
  return {
    id,
    subjectTabId: String(n.subjectTabId ?? ""),
    url: typeof n.url === "string" ? n.url : "",
    heading: typeof n.heading === "string" ? n.heading : "",
    body: typeof n.body === "string" ? n.body : "",
    createdAt: typeof n.createdAt === "number" ? n.createdAt : Date.now(),
    anchor,
    isExpanded: typeof n.isExpanded === "boolean" ? n.isExpanded : true,
  };
}

function migrateNotes(raw: unknown): NNSyncNote[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .map((item) => migrateNote(item))
    .filter((n): n is NNSyncNote => n !== null);
}

function coerceNoteListLayout(v: unknown): NNNoteListLayout | null {
  if (!v || typeof v !== "object") {
    return null;
  }
  const o = v as Record<string, unknown>;
  const groupsRaw = o.groups;
  if (!Array.isArray(groupsRaw)) {
    return null;
  }
  const groups: NNNoteListGroup[] = [];
  for (const g of groupsRaw) {
    if (!g || typeof g !== "object") {
      continue;
    }
    const gr = g as Record<string, unknown>;
    const id =
      typeof gr.id === "string" && gr.id.length > 0
        ? gr.id
        : crypto.randomUUID();
    const ids = Array.isArray(gr.noteIds)
      ? gr.noteIds.map((x) => String(x)).filter((s) => s.length > 0)
      : [];
    groups.push({ id, noteIds: ids });
  }
  const gapRaw = o.gapBeforePxByNoteId;
  const gapBeforePxByNoteId: Record<string, number> = {};
  if (gapRaw && typeof gapRaw === "object") {
    for (const [k, val] of Object.entries(gapRaw)) {
      if (typeof val === "number" && Number.isFinite(val)) {
        gapBeforePxByNoteId[k] = Math.max(0, Math.round(val));
      }
    }
  }
  const layout: NNNoteListLayout = { groups, gapBeforePxByNoteId };
  pruneEmptyNoteGroups(layout);
  if (layout.groups.length === 0) {
    return null;
  }
  return layout;
}

function migrateNoteLayouts(
  raw: unknown,
): Record<string, NNNoteListLayout> | undefined {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  if (typeof raw !== "object") {
    return undefined;
  }
  const out: Record<string, NNNoteListLayout> = {};
  for (const [k, v] of Object.entries(raw)) {
    const layout = coerceNoteListLayout(v);
    if (layout) {
      out[k] = layout;
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

/** Normalizes legacy monolithic blob or assembled payload. */
export function migrateNNSyncPayload(raw: unknown): NNSyncPayload {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_NN_SYNC;
  }
  const o = raw as Record<string, unknown>;
  return {
    subjectTabs: migrateSubjectTabs(o.subjectTabs),
    notes: migrateNotes(o.notes),
    noteLayouts: migrateNoteLayouts(o.noteLayouts),
  };
}

function buildIndexFromNotes(notes: NNSyncNote[]): NNNoteIndex {
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

async function getMeta(): Promise<NNSyncMeta> {
  const raw = await storageService.sync.get(NN_SYNC_META_KEY);
  return normalizeMeta(raw);
}

async function setMeta(meta: NNSyncMeta): Promise<void> {
  await storageService.sync.set(NN_SYNC_META_KEY, meta);
}

async function getIndex(): Promise<NNNoteIndex> {
  const raw = await storageService.sync.get(NN_NOTE_INDEX_KEY);
  return normalizeIndex(raw);
}

async function setIndex(index: NNNoteIndex): Promise<void> {
  await storageService.sync.set(NN_NOTE_INDEX_KEY, index);
}

async function loadNotesForIds(noteIds: string[]): Promise<NNSyncNote[]> {
  if (noteIds.length === 0) {
    return [];
  }
  const keys = noteIds.map(noteStorageKey);
  const raw = await storageService.sync.getMany(keys);
  return noteIds
    .map((id) => migrateNote(raw[noteStorageKey(id)]))
    .filter((n): n is NNSyncNote => n !== null);
}

async function loadAllNotesInIndexOrder(
  index: NNNoteIndex,
): Promise<NNSyncNote[]> {
  const noteMap = new Map(
    (await loadNotesForIds(index.noteIds)).map((n) => [n.id, n]),
  );
  return index.noteIds
    .map((id) => noteMap.get(id))
    .filter((n): n is NNSyncNote => n !== undefined);
}

async function loadAllLayouts(
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

async function writeShardedFromPayload(payload: NNSyncPayload): Promise<void> {
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

async function migrateChromeSyncStorageToLocalIfNeeded(): Promise<void> {
  const existingLocalMeta = await storageService.sync.get(NN_SYNC_META_KEY);
  if (existingLocalMeta !== undefined) {
    return;
  }

  const oldSyncItems = (await chrome.storage.sync.get(null)) as Record<
    string,
    unknown
  >;
  const itemsToCopy = Object.fromEntries(
    Object.entries(oldSyncItems).filter(([key]) => isNNSyncStorageKey(key)),
  );

  if (Object.keys(itemsToCopy).length === 0) {
    return;
  }

  await storageService.sync.setMany(itemsToCopy);
}

async function migrateLegacyBlobIfNeeded(): Promise<void> {
  await migrateChromeSyncStorageToLocalIfNeeded();

  const legacy = await storageService.sync.get(LEGACY_NN_SYNC_DATA_KEY);
  if (legacy === undefined) {
    return;
  }

  const existingMeta = await storageService.sync.get(NN_SYNC_META_KEY);
  if (existingMeta !== undefined) {
    await storageService.sync.remove(LEGACY_NN_SYNC_DATA_KEY);
    return;
  }

  const normalized = migrateNNSyncPayload(legacy);
  await writeShardedFromPayload(normalized);
  await storageService.sync.remove(LEGACY_NN_SYNC_DATA_KEY);
}

function withLayoutInMeta(meta: NNSyncMeta, layoutKey: string): NNSyncMeta {
  if (meta.layoutIndex.includes(layoutKey)) {
    return meta;
  }
  return { ...meta, layoutIndex: [...meta.layoutIndex, layoutKey] };
}

function removeNoteIdFromIndex(index: NNNoteIndex, noteId: string): NNNoteIndex {
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

function removeNoteIdsFromIndex(
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

async function pruneNotesFromAllLayouts(noteIds: string[]): Promise<void> {
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
    await storageService.sync.removeMany(
      emptyLayoutKeys.map(layoutStorageKey),
    );
    await setMeta({
      ...meta,
      layoutIndex: meta.layoutIndex.filter(
        (key) => !emptyLayoutKeys.includes(key),
      ),
    });
  }
}

async function pruneNoteFromAllLayouts(noteId: string): Promise<void> {
  await pruneNotesFromAllLayouts([noteId]);
}

function reorderNotesArray(
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

export async function ensureNNSyncInitialized(): Promise<NNSyncPayload> {
  await migrateLegacyBlobIfNeeded();

  const metaRaw = await storageService.sync.get(NN_SYNC_META_KEY);
  if (metaRaw === undefined) {
    await storageService.sync.set(NN_SYNC_META_KEY, DEFAULT_META);
  }

  const indexRaw = await storageService.sync.get(NN_NOTE_INDEX_KEY);
  if (indexRaw === undefined) {
    await storageService.sync.set(NN_NOTE_INDEX_KEY, DEFAULT_INDEX);
  }

  return getNNSync();
}

/**
 * Adds a subject tab folder. Empty / whitespace-only names are ignored (returns null).
 */
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

/**
 * Renames an existing subject tab. Empty / whitespace-only names are ignored (no-op).
 */
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

/**
 * Removes a subject tab and all notes that belong to it.
 */
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

/**
 * Creates a new note at the top of the global note list, expanded by default.
 */
export async function addNote(input: {
  subjectTabId: string;
  url: string;
}): Promise<NNSyncNote> {
  const index = await getIndex();
  const newNote: NNSyncNote = {
    id: crypto.randomUUID(),
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

/**
 * Updates editable note fields. Unknown note id is a no-op.
 */
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

/**
 * Sets `isExpanded` on a batch of notes in a single write.
 */
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

/**
 * Deletes one note by id. Unknown note id is a no-op.
 */
export async function deleteNote(noteId: string): Promise<void> {
  const index = await getIndex();
  if (!index.noteIds.includes(noteId)) {
    return;
  }

  await storageService.sync.removeMany([noteStorageKey(noteId)]);
  await setIndex(removeNoteIdFromIndex(index, noteId));
  await pruneNoteFromAllLayouts(noteId);
}

/**
 * Reorders a subset of notes (identified by `newOrderedIds`) within the global index,
 * preserving the relative positions of notes not in the subset.
 */
export async function reorderNotes(newOrderedIds: string[]): Promise<void> {
  const index = await getIndex();
  const notes = await loadAllNotesInIndexOrder(index);
  const reordered = reorderNotesArray(notes, newOrderedIds);
  await setIndex({ ...index, noteIds: reordered.map((n) => n.id) });
}

/**
 * Persists section layout + gap metadata and matches global note order to the flattened layout.
 */
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

/** Assembles the in-memory payload from sharded local storage keys. */
export async function getNNSync(): Promise<NNSyncPayload> {
  await migrateLegacyBlobIfNeeded();

  const meta = await getMeta();
  const index = await getIndex();
  const notes = await loadAllNotesInIndexOrder(index);
  const noteLayouts = await loadAllLayouts(meta);

  return {
    subjectTabs: meta.subjectTabs,
    notes,
    noteLayouts:
      Object.keys(noteLayouts).length > 0 ? noteLayouts : undefined,
  };
}

/** Writes a full payload to sharded local keys (used for migration / bulk replace). */
export async function setNNSync(payload: NNSyncPayload): Promise<void> {
  const normalized = migrateNNSyncPayload(payload);
  const meta = await getMeta();
  const index = await getIndex();

  const nextNoteIds = new Set(normalized.notes.map((n) => n.id));
  const staleNoteKeys = index.noteIds
    .filter((id) => !nextNoteIds.has(id))
    .map(noteStorageKey);

  const nextLayoutKeys = new Set(Object.keys(normalized.noteLayouts ?? {}));
  const staleLayoutKeys = meta.layoutIndex
    .filter((key) => !nextLayoutKeys.has(key))
    .map(layoutStorageKey);

  await writeShardedFromPayload(normalized);

  const keysToRemove = [...staleNoteKeys, ...staleLayoutKeys];
  if (keysToRemove.length > 0) {
    await storageService.sync.removeMany(keysToRemove);
  }
}

export function subscribeNNSync(
  listener: (value: NNSyncPayload | undefined) => void,
): () => void {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const notify = (): void => {
    void getNNSync().then((payload) => {
      listener(payload);
    });
  };

  const onChanged: Parameters<
    typeof chrome.storage.onChanged.addListener
  >[0] = (changes, areaName) => {
    if (areaName !== "local") {
      return;
    }
    const relevant = Object.keys(changes).some(isNNSyncStorageKey);
    if (!relevant) {
      return;
    }
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    debounceTimer = setTimeout(notify, 50);
  };

  chrome.storage.onChanged.addListener(onChanged);
  return () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    chrome.storage.onChanged.removeListener(onChanged);
  };
}
