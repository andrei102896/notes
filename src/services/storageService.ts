import { LEGACY_NN_SYNC_DATA_KEY } from "@/lib/nnSyncKeys";
import type { ScrollBookmark } from "@/types/bookmark";
import type {
  NNCopiedNote,
  NNNoteIndex,
  NNPageSessionState,
  NNSyncMeta,
  NNSyncPayload,
} from "@/types/nnData";

type StorageNamespace = "sync" | "local";

type PendingSyncMergeState = {
  upserts: string[];
  deletions: string[];
  clearAll: boolean;
  updatedAt: number;
};

type SyncStorageSchema = {
  scrollBookmarks: ScrollBookmark[];
  /** @deprecated Migrated to sharded keys — kept for one-time legacy read. */
  [LEGACY_NN_SYNC_DATA_KEY]?: NNSyncPayload;
  nnSyncMeta: NNSyncMeta;
  nnNoteIndex: NNNoteIndex;
};

type LocalStorageSchema = {
  pendingSyncMergeState: PendingSyncMergeState;
  /** Keyed by normalized page URL (see `sessionUrlKey`). */
  nnSessionsByUrl: Record<string, NNPageSessionState>;
  /** In-app note copy buffer (NOTE-COPYPASTE). Persisted across tabs/navigations. */
  nnCopyBuffer: NNCopiedNote;
};

type StorageSchema = {
  sync: SyncStorageSchema;
  local: LocalStorageSchema;
};

type KeyOfNamespace<N extends StorageNamespace> = keyof StorageSchema[N] &
  string;

class StorageService {
  private getArea(namespace: StorageNamespace): chrome.storage.StorageArea {
    return this.getAreaName(namespace) === "sync"
      ? chrome.storage.sync
      : chrome.storage.local;
  }

  private getAreaName(namespace: StorageNamespace): chrome.storage.AreaName {
    return namespace === "sync" ? "local" : namespace;
  }

  async get<N extends StorageNamespace, K extends KeyOfNamespace<N>>(
    namespace: N,
    key: K,
  ): Promise<StorageSchema[N][K] | undefined> {
    const area = this.getArea(namespace);
    const result = await area.get(key);
    return result[key] as StorageSchema[N][K] | undefined;
  }

  async set<N extends StorageNamespace, K extends KeyOfNamespace<N>>(
    namespace: N,
    key: K,
    value: StorageSchema[N][K],
  ): Promise<void> {
    const area = this.getArea(namespace);
    await area.set({ [key]: value });
  }

  async remove<N extends StorageNamespace, K extends KeyOfNamespace<N>>(
    namespace: N,
    key: K,
  ): Promise<void> {
    const area = this.getArea(namespace);
    await area.remove(key);
  }

  async clear(namespace: StorageNamespace): Promise<void> {
    const area = this.getArea(namespace);
    await area.clear();
  }

  /** Batch read for dynamic sync keys (`nnNote:*`, `nnLayout:*`, …). */
  async getMany(
    namespace: StorageNamespace,
    keys: string[],
  ): Promise<Record<string, unknown>> {
    if (keys.length === 0) {
      return {};
    }
    const area = this.getArea(namespace);
    return area.get(keys) as Promise<Record<string, unknown>>;
  }

  /** Batch write for dynamic sync keys. */
  async setMany(
    namespace: StorageNamespace,
    items: Record<string, unknown>,
  ): Promise<void> {
    if (Object.keys(items).length === 0) {
      return;
    }
    const area = this.getArea(namespace);
    await area.set(items);
  }

  /** Batch remove for dynamic sync keys. */
  async removeMany(namespace: StorageNamespace, keys: string[]): Promise<void> {
    if (keys.length === 0) {
      return;
    }
    const area = this.getArea(namespace);
    await area.remove(keys);
  }

  subscribe<N extends StorageNamespace, K extends KeyOfNamespace<N>>(
    namespace: N,
    key: K,
    listener: (value: StorageSchema[N][K] | undefined) => void,
  ): () => void {
    const onChanged: Parameters<
      typeof chrome.storage.onChanged.addListener
    >[0] = (changes, areaName) => {
      if (areaName !== this.getAreaName(namespace)) {
        return;
      }
      const change = changes[key];
      if (!change) {
        return;
      }
      listener(change.newValue as StorageSchema[N][K] | undefined);
    };

    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      chrome.storage.onChanged.removeListener(onChanged);
    };
  }

  readonly sync = {
    get: <K extends KeyOfNamespace<"sync">>(key: K) => this.get("sync", key),
    set: <K extends KeyOfNamespace<"sync">>(
      key: K,
      value: StorageSchema["sync"][K],
    ) => this.set("sync", key, value),
    remove: <K extends KeyOfNamespace<"sync">>(key: K) =>
      this.remove("sync", key),
    clear: () => this.clear("sync"),
    getMany: (keys: string[]) => this.getMany("sync", keys),
    setMany: (items: Record<string, unknown>) => this.setMany("sync", items),
    removeMany: (keys: string[]) => this.removeMany("sync", keys),
    subscribe: <K extends KeyOfNamespace<"sync">>(
      key: K,
      listener: (value: StorageSchema["sync"][K] | undefined) => void,
    ) => this.subscribe("sync", key, listener),
  };

  readonly local = {
    get: <K extends KeyOfNamespace<"local">>(key: K) => this.get("local", key),
    set: <K extends KeyOfNamespace<"local">>(
      key: K,
      value: StorageSchema["local"][K],
    ) => this.set("local", key, value),
    remove: <K extends KeyOfNamespace<"local">>(key: K) =>
      this.remove("local", key),
    clear: () => this.clear("local"),
    subscribe: <K extends KeyOfNamespace<"local">>(
      key: K,
      listener: (value: StorageSchema["local"][K] | undefined) => void,
    ) => this.subscribe("local", key, listener),
  };
}

export const storageService = new StorageService();
export type { PendingSyncMergeState };
