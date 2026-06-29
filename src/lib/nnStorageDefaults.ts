import type {
  NNNoteIndex,
  NNPageSessionState,
  NNSyncMeta,
  NNSyncPayload,
} from "@/types/nnData";

export const DEFAULT_NN_SYNC: NNSyncPayload = {
  subjectTabs: [],
  notes: [],
};

export const DEFAULT_META: NNSyncMeta = {
  subjectTabs: [],
  layoutIndex: [],
};

export const DEFAULT_INDEX: NNNoteIndex = {
  noteIds: [],
  bySubjectTab: {},
};

export const DEFAULT_PAGE_SESSION = (): NNPageSessionState => ({
  activeSubjectTabId: null,
});

/** Subscription change-notification debounce (ms). */
export const SUBSCRIPTION_DEBOUNCE_MS = 50;
