export const NN_SYNC_META_KEY = "nnSyncMeta";
export const NN_NOTE_INDEX_KEY = "nnNoteIndex";
export const NN_NOTE_KEY_PREFIX = "nnNote:";
export const NN_LAYOUT_KEY_PREFIX = "nnLayout:";
/** Legacy monolithic blob — migrated to sharded keys on first read. */
export const LEGACY_NN_SYNC_DATA_KEY = "nnSyncData";

/** Local key prefix: pending subject-tab handoff across navigation. */
export const PENDING_SUBJECT_TAB_PREFIX = "nn_pending_subject_tab_";

export function noteStorageKey(noteId: string): string {
  return `${NN_NOTE_KEY_PREFIX}${noteId}`;
}

export function layoutStorageKey(layoutKey: string): string {
  return `${NN_LAYOUT_KEY_PREFIX}${layoutKey}`;
}

export function isNNSyncStorageKey(key: string): boolean {
  return (
    key === NN_SYNC_META_KEY ||
    key === NN_NOTE_INDEX_KEY ||
    key === LEGACY_NN_SYNC_DATA_KEY ||
    key.startsWith(NN_NOTE_KEY_PREFIX) ||
    key.startsWith(NN_LAYOUT_KEY_PREFIX)
  );
}
