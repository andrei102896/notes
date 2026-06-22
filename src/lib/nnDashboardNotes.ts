import { sessionUrlKey } from "@/lib/sessionUrlKey";
import type { NNSyncNote } from "@/types/nnData";

function parseUrlLike(value: string): URL | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  try {
    return new URL(trimmed);
  } catch {
    try {
      return new URL(`https://${trimmed}`);
    } catch {
      return null;
    }
  }
}

function comparableUrlKey(value: string): string | null {
  const parsed = parseUrlLike(value);
  if (!parsed) {
    return null;
  }
  const hostAndPath = `${parsed.host.toLowerCase()}${parsed.pathname}${parsed.search}${parsed.hash}`;
  return hostAndPath.length > 1 && hostAndPath.endsWith("/")
    ? hostAndPath.slice(0, -1)
    : hostAndPath;
}

/**
 * True when the note’s stored URL refers to the same page as the current browser tab
 * (NOTES-CORE-6 exact match; normalized via {@link sessionUrlKey}).
 */
export function noteUrlMatchesBrowserTab(
  noteUrl: string,
  browserTabUrlKey: string,
): boolean {
  const trimmed = noteUrl.trim();
  if (!trimmed) {
    return false;
  }
  const noteKey = comparableUrlKey(trimmed);
  const browserKey = comparableUrlKey(sessionUrlKey(browserTabUrlKey));
  if (!noteKey || !browserKey) {
    return false;
  }
  return noteKey === browserKey;
}

/**
 * Notes belonging to one subject tab (folder).
 */
export function notesInSubjectTab(
  notes: NNSyncNote[],
  subjectTabId: string,
): NNSyncNote[] {
  return notes.filter((n) => n.subjectTabId === subjectTabId);
}

/**
 * Notes whose stored URL matches the host tab (default view when no subject tab is selected).
 */
export function filterNotesByThisTabUrl(
  notes: NNSyncNote[],
  browserTabUrlKey: string,
): NNSyncNote[] {
  return notes.filter((n) => noteUrlMatchesBrowserTab(n.url, browserTabUrlKey));
}

/**
 * List content: **no subject tab** → notes for this browser URL (any folder). **Subject tab
 * selected** → all notes in that folder.
 */
export function visibleNotesForDashboard(input: {
  notes: NNSyncNote[];
  activeSubjectTabId: string | null;
  browserTabUrlKey: string | null;
}): NNSyncNote[] {
  const { notes, activeSubjectTabId, browserTabUrlKey } = input;

  if (activeSubjectTabId) {
    return notesInSubjectTab(notes, activeSubjectTabId);
  }

  if (browserTabUrlKey === null) {
    return [];
  }
  return filterNotesByThisTabUrl(notes, browserTabUrlKey);
}
