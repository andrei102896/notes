/**
 * Notes For Net — data model (see anchor-keep-pm/jira.md).
 *
 * - **Subject tabs** — folders: each note belongs to exactly one subject tab (`subjectTabId`).
 * - **Notes** — live inside a subject tab; each has a **url** (page it was created for; editable;
 *   used for LINK/ANCHOR, “THIS TAB NOTES” filter, and current-page highlight vs the host tab URL).
 * - **Default list** — with no subject tab selected, show notes whose `url` matches this browser tab
 *   (any folder). **Subject tab selected** — show all notes in that folder; **deselect** subject tab
 *   to return to the current-tab view (NOTES-CORE-6, DASHBOARD-UI-3 intent).
 *
 * Persistent data: `chrome.storage.local` — sharded keys (`nnSyncMeta`, `nnNoteIndex`, `nnNote:<id>`,
 * `nnLayout:<context>`). Assembled in memory as {@link NNSyncPayload}. Per–browser-tab UI:
 * `chrome.storage.local` (`nnSessionsByUrl` + `NNPageSessionState`).
 */

export type NNSubjectTab = {
  id: string;
  /** Display name (UI may render ALL CAPS per SUBJECT-TABS). */
  name: string;
  createdAt: number;
};

/**
 * Stored position of a page anchor set by the user via the ANCHOR pick flow.
 * Uses document-relative coordinates so the position survives scrolling.
 */
export type NNAnchorPosition = {
  pageX: number;
  pageY: number;
  scrollX: number;
  scrollY: number;
  elementSelector: string;
};

/**
 * Full note shape (NOTES-CORE). Body may later hold rich text / HTML; stored as string for now.
 */
export type NNSyncNote = {
  id: string;
  /** Parent folder — subject tab id. */
  subjectTabId: string;
  /**
   * Page URL for this note (NOTES-CORE-4); used with the host tab URL for THIS TAB NOTES + highlight.
   * Empty string means no URL (LINK disabled).
   */
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
  anchor: NNAnchorPosition | null;
};

/**
 * One visual section within a dashboard note list (multiple sortable lists per spec).
 * Group order is stable — users reorder notes only inside groups (or create a new group via drop target).
 */
export type NNNoteListGroup = {
  id: string;
  noteIds: string[];
};

/** Layout for one dashboard list context: a subject tab list or the default URL-filtered list. */
export type NNNoteListLayout = {
  groups: NNNoteListGroup[];
  /**
   * Extra leading space before a note (px), persisted through expand/collapse.
   * Additive on top of the default flex gap (NOTES-BEHAVIOR-2 separation).
   */
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
  /**
   * Per-context ordered sections (`st:<subjectTabId>` or `url:<browserTabUrlKey>`).
   * Missing keys fall back to a single group in global sync note order.
   */
  noteLayouts?: Record<string, NNNoteListLayout>;
};

/**
 * Local-only UI for this host URL (one map entry per normalized tab URL in `nnSessionsByUrl`).
 * When the tab navigates to another URL, a different entry loads — note *rows* live in
 * {@link NNSyncPayload}; this only holds subject-tab selection.
 */
export type NNPageSessionState = {
  /**
   * Selected subject tab (folder), or null for the default view: notes matching this tab’s URL.
   */
  activeSubjectTabId: string | null;
};
