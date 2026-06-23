/** Notes For Net data model (see anchor-keep-pm/jira.md): persisted in `chrome.storage.local` via sharded keys (`nnSyncMeta`/`nnNoteIndex`/`nnNote:<id>`/`nnLayout:<context>`), assembled in memory as {@link NNSyncPayload}; per-tab UI ({@link NNPageSessionState}) lives in `chrome.storage.session` keyed by tabId, not per URL. */

export type NNSubjectTab = {
  id: string;
  /** Display name (UI may render ALL CAPS per SUBJECT-TABS). */
  name: string;
  createdAt: number;
};

/** UI subset of {@link NNSubjectTab} for the tab strip + alphabetical index. */
export type SubjectTabStripItem = {
  id: string;
  name: string;
};

/** Stored page-anchor position (ANCHOR pick flow); document-relative coords so it survives scrolling. */
export type NNAnchorPosition = {
  pageX: number;
  pageY: number;
  scrollX: number;
  scrollY: number;
  elementSelector: string;
};

/** Full note shape (NOTES-CORE); body stored as a string for now (may later hold rich text/HTML). */
export type NNSyncNote = {
  id: string;
  /** Parent folder — subject tab id. */
  subjectTabId: string;
  /** Page URL (NOTES-CORE-4) matched against host tab URL for THIS TAB NOTES + highlight; empty string means no URL (LINK disabled). */
  url: string;
  heading: string;
  body: string;
  createdAt: number;
  /** Page-position anchor set via the ANCHOR pick flow. Null means no anchor is set. */
  anchor?: NNAnchorPosition | null;
  /** Persisted expand/collapse state — true means expanded. Defaults to true for new notes. */
  isExpanded?: boolean;
};

/** Snapshot of a note stored in the in-app copy buffer (NOTE-COPYPASTE). */
export type NNCopiedNote = {
  heading: string;
  body: string;
  url: string;
  /** Creation date of the copied note — pasted note reproduces it (doc 3_NN_NOTES). */
  createdAt: number;
  anchor: NNAnchorPosition | null;
};

/** One visual section in a dashboard note list; group order is stable — reordering happens only inside a group (or via a new-group drop target). */
export type NNNoteListGroup = {
  id: string;
  noteIds: string[];
};

/** Layout for one dashboard list context: a subject tab list or the default URL-filtered list. */
export type NNNoteListLayout = {
  groups: NNNoteListGroup[];
  /** Extra leading space before a note (px), additive on top of the default flex gap, persisted through expand/collapse (NOTES-BEHAVIOR-2 separation). */
  gapBeforePxByNoteId: Record<string, number>;
};

/** Synced subject tabs + layout index (small metadata blob). */
export type NNSyncMeta = {
  subjectTabs: NNSubjectTab[];
  /** Context keys with persisted layouts (`st:…`, `url:…`). */
  layoutIndex: string[];
};

/** Global note order and per-folder membership (note ids only — bodies live in `nnNote:<id>`). */
export type NNNoteIndex = {
  noteIds: string[];
  bySubjectTab: Record<string, string[]>;
};

/** In-memory aggregate assembled from sharded sync keys (API surface for React hooks). */
export type NNSyncPayload = {
  subjectTabs: NNSubjectTab[];
  notes: NNSyncNote[];
  /** Per-context ordered sections (`st:<subjectTabId>` or `url:<browserTabUrlKey>`); missing keys fall back to a single group in global sync note order. */
  noteLayouts?: Record<string, NNNoteListLayout>;
};

/** Local-only per-browser-tab UI state (`chrome.storage.session` keyed by tabId, see `src/lib/tabSession.ts`): follows the tab across navigation, clears on close, and holds only subject-tab selection (note rows live in {@link NNSyncPayload}). */
export type NNPageSessionState = {
  /** Selected subject tab (folder), or null for the default view: notes matching this tab's URL. */
  activeSubjectTabId: string | null;
};
