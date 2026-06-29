import { migrateNNSyncPayload } from "@/lib/nnStorageNormalize";
import {
  isNNSyncStorageKey,
  LEGACY_NN_SYNC_DATA_KEY,
  NN_SYNC_META_KEY,
} from "@/lib/nnSyncKeys";
import { writeShardedFromPayload } from "@/services/nnStorageShards";
import { storageService } from "@/services/storageService";

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

export async function migrateLegacyBlobIfNeeded(): Promise<void> {
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
