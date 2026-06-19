import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useBrowserTabLocation } from "@/hooks/useBrowserTabLocation";
import { visibleNotesForDashboard } from "@/lib/nnDashboardNotes";
import { noteListLayoutKey, resolveNoteListLayout } from "@/lib/nnNoteLayout";
import { PENDING_SUBJECT_TAB_PREFIX } from "@/lib/nnSyncKeys";
import {
  DEFAULT_NN_SYNC,
  DEFAULT_PAGE_SESSION,
  ensureNNSyncInitialized,
  getNNSync,
  migrateNNSyncPayload,
  addNote as persistAddNote,
  addSubjectTab as persistAddSubjectTab,
  commitNoteListLayout as persistCommitNoteListLayout,
  deleteAllNotesInSubjectTab as persistDeleteAllNotesInSubjectTab,
  deleteNote as persistDeleteNote,
  deleteSubjectTab as persistDeleteSubjectTab,
  renameSubjectTab as persistRenameSubjectTab,
  reorderNotes as persistReorderNotes,
  setNotesExpanded as persistSetNotesExpanded,
  updateNote as persistUpdateNote,
  subscribeNNSync,
} from "@/services/nnStorage";
import type {
  NNNoteListLayout,
  NNPageSessionState,
  NNSyncNote,
  NNSyncPayload,
} from "@/types/nnData";

function trimTrailingSlash(url: string): string {
  return url.length > 1 && url.endsWith("/") ? url.slice(0, -1) : url;
}

function pendingSubjectTabKeysForUrl(href: string): string[] {
  const keys = new Set<string>([
    `${PENDING_SUBJECT_TAB_PREFIX}${href}`,
    `${PENDING_SUBJECT_TAB_PREFIX}${trimTrailingSlash(href)}`,
  ]);
  try {
    const canonicalHref = trimTrailingSlash(new URL(href).href);
    keys.add(`${PENDING_SUBJECT_TAB_PREFIX}${canonicalHref}`);
  } catch {
    /* best-effort key generation */
  }
  return Array.from(keys);
}

async function consumePendingSubjectTabId(
  href: string,
): Promise<string | null> {
  const keys = pendingSubjectTabKeysForUrl(href);
  if (keys.length === 0) {
    return null;
  }
  const values = await chrome.storage.local.get(keys);
  await chrome.storage.local.remove(keys);
  for (const key of keys) {
    const value = values[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return null;
}

export function useNNDashboardSession(): {
  sync: NNSyncPayload;
  pageSession: NNPageSessionState;
  patchSession: (patch: Partial<NNPageSessionState>) => void;
  /** Notes in the selected subject tab; empty when none is selected. */
  visibleNotes: NNSyncNote[];
  browserTabUrlKey: string | null;
  browserTabHref: string;
  addSubjectTab: (name: string) => Promise<string | null>;
  deleteSubjectTab: (subjectTabId: string) => Promise<void>;
  renameSubjectTab: (subjectTabId: string, name: string) => Promise<void>;
  addNote: () => Promise<string | null>;
  updateNote: (
    noteId: string,
    patch: Partial<Pick<NNSyncNote, "url" | "heading" | "body" | "anchor" | "isExpanded" | "createdAt">>,
  ) => Promise<void>;
  deleteNote: (noteId: string) => Promise<void>;
  deleteAllNotesInSubjectTab: (subjectTabId: string) => Promise<void>;
  reorderNotes: (newOrderedIds: string[]) => Promise<void>;
  /** Resolved multi-section layout for the current dashboard list, or null when no list key. */
  resolvedNoteListLayout: NNNoteListLayout | null;
  /** Persists layout + gaps + note order for the current dashboard view. */
  commitNoteListLayoutForCurrentView: (
    layout: NNNoteListLayout,
  ) => Promise<void>;
  setNotesExpanded: (noteIds: string[], expanded: boolean) => void;
} {
  const { browserTabUrlKey, browserTabHref } = useBrowserTabLocation();
  const [sync, setSync] = useState<NNSyncPayload>(DEFAULT_NN_SYNC);
  const [pageSession, setPageSession] = useState<NNPageSessionState>(
    DEFAULT_PAGE_SESSION(),
  );

  const pageStorageKey = browserTabUrlKey;

  useEffect(() => {
    if (pageStorageKey === null) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const [initialSync, pendingSubjectTabId] = await Promise.all([
        ensureNNSyncInitialized(),
        consumePendingSubjectTabId(browserTabHref),
      ]);
      if (cancelled) {
        return;
      }
      setSync(initialSync);
      const canRestorePendingSubjectTab =
        pendingSubjectTabId !== null &&
        initialSync.subjectTabs.some((tab) => tab.id === pendingSubjectTabId);

      let resolvedActiveSubjectTabId: string | null = null;
      if (canRestorePendingSubjectTab) {
        resolvedActiveSubjectTabId = pendingSubjectTabId;
      }

      setPageSession({
        activeSubjectTabId: resolvedActiveSubjectTabId,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [browserTabHref, pageStorageKey]);

  useEffect(() => {
    return subscribeNNSync((next) => {
      if (next !== undefined) {
        setSync(migrateNNSyncPayload(next));
      }
    });
  }, []);

  const patchSession = useCallback(
    (patch: Partial<NNPageSessionState>) => {
      setPageSession((prev) => ({ ...prev, ...patch }));
    },
    [],
  );

  const addSubjectTab = useCallback(
    async (name: string): Promise<string | null> => {
      const created = await persistAddSubjectTab(name);
      if (!created) {
        return null;
      }
      setSync(migrateNNSyncPayload(await getNNSync()));
      return created.id;
    },
    [],
  );

  const deleteSubjectTab = useCallback(
    async (subjectTabId: string) => {
      const wasActive = pageSession.activeSubjectTabId === subjectTabId;
      await persistDeleteSubjectTab(subjectTabId);
      setSync(migrateNNSyncPayload(await getNNSync()));
      if (wasActive) {
        patchSession({ activeSubjectTabId: null });
      }
    },
    [pageSession.activeSubjectTabId, patchSession],
  );

  const renameSubjectTab = useCallback(
    async (subjectTabId: string, name: string) => {
      await persistRenameSubjectTab(subjectTabId, name);
      setSync(migrateNNSyncPayload(await getNNSync()));
    },
    [],
  );

  const addNote = useCallback(async () => {
    const activeSubjectTabId = pageSession.activeSubjectTabId;
    if (activeSubjectTabId === null) {
      return null;
    }
    const created = await persistAddNote({
      subjectTabId: activeSubjectTabId,
      url: browserTabHref,
    });
    setSync(migrateNNSyncPayload(await getNNSync()));
    return created.id;
  }, [browserTabHref, pageSession.activeSubjectTabId]);

  const updateNote = useCallback(
    async (
      noteId: string,
      patch: Partial<Pick<NNSyncNote, "url" | "heading" | "body" | "anchor" | "isExpanded" | "createdAt">>,
    ) => {
      await persistUpdateNote(noteId, patch);
      setSync(migrateNNSyncPayload(await getNNSync()));
    },
    [],
  );

  const deleteNote = useCallback(async (noteId: string) => {
    await persistDeleteNote(noteId);
    setSync(migrateNNSyncPayload(await getNNSync()));
  }, []);

  const deleteAllNotesInSubjectTab = useCallback(
    async (subjectTabId: string) => {
      await persistDeleteAllNotesInSubjectTab(subjectTabId);
      setSync(migrateNNSyncPayload(await getNNSync()));
    },
    [],
  );

  const reorderNotes = useCallback(async (newOrderedIds: string[]) => {
    await persistReorderNotes(newOrderedIds);
    setSync(migrateNNSyncPayload(await getNNSync()));
  }, []);

  const setNotesExpanded = useCallback(
    (noteIds: string[], expanded: boolean) => {
      void persistSetNotesExpanded(noteIds, expanded).then(async () => {
        setSync(migrateNNSyncPayload(await getNNSync()));
      });
    },
    [],
  );

  const noteLayoutStorageKey = useMemo(
    () =>
      noteListLayoutKey({
        activeSubjectTabId: pageSession.activeSubjectTabId,
        browserTabUrlKey,
      }),
    [pageSession.activeSubjectTabId, browserTabUrlKey],
  );

  const visibleNotes = useMemo(() => {
    // None selected → list isn't rendered; skip the O(n) URL filter.
    if (pageSession.activeSubjectTabId === null) {
      return [];
    }
    return visibleNotesForDashboard({
      notes: sync.notes,
      activeSubjectTabId: pageSession.activeSubjectTabId,
      browserTabUrlKey,
    });
  }, [sync.notes, pageSession.activeSubjectTabId, browserTabUrlKey]);

  const resolvedNoteListLayout = useMemo(() => {
    if (noteLayoutStorageKey === null) {
      return null;
    }
    const visibleIds = visibleNotes.map((n) => n.id);
    return resolveNoteListLayout(
      visibleIds,
      sync.noteLayouts?.[noteLayoutStorageKey],
    );
  }, [noteLayoutStorageKey, visibleNotes, sync.noteLayouts]);

  const commitNoteListLayoutForCurrentView = useCallback(
    async (layout: NNNoteListLayout) => {
      if (noteLayoutStorageKey === null) {
        return;
      }
      await persistCommitNoteListLayout(noteLayoutStorageKey, layout);
      setSync(migrateNNSyncPayload(await getNNSync()));
    },
    [noteLayoutStorageKey],
  );

  return {
    sync,
    pageSession,
    patchSession,
    visibleNotes,
    browserTabUrlKey,
    browserTabHref,
    addSubjectTab,
    deleteSubjectTab,
    renameSubjectTab,
    addNote,
    updateNote,
    deleteNote,
    deleteAllNotesInSubjectTab,
    reorderNotes,
    resolvedNoteListLayout,
    commitNoteListLayoutForCurrentView,
    setNotesExpanded,
  };
}
