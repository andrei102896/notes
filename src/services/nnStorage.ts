import {
  DEFAULT_INDEX,
  DEFAULT_META,
  SUBSCRIPTION_DEBOUNCE_MS,
} from "@/lib/nnStorageDefaults";
import {
  isNNSyncStorageKey,
  NN_NOTE_INDEX_KEY,
  NN_SYNC_META_KEY,
} from "@/lib/nnSyncKeys";
import { migrateLegacyBlobIfNeeded } from "@/services/nnStorageMigrations";
import {
  getIndex,
  getMeta,
  loadAllLayouts,
  loadAllNotesInIndexOrder,
} from "@/services/nnStorageShards";
import { storageService } from "@/services/storageService";
import type { NNSyncPayload } from "@/types/nnData";

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
    noteLayouts: Object.keys(noteLayouts).length > 0 ? noteLayouts : undefined,
  };
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
    debounceTimer = setTimeout(notify, SUBSCRIPTION_DEBOUNCE_MS);
  };

  chrome.storage.onChanged.addListener(onChanged);
  return () => {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer);
    }
    chrome.storage.onChanged.removeListener(onChanged);
  };
}
