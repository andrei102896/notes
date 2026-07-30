import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { buildDefaultNoteListLayout } from "@/lib/nnNoteLayout";
import { getTabSession, patchTabSession } from "@/lib/tabSession";
import { AddSubjectTabButton } from "@/overlay/AddSubjectTabButton";
import { NnModalBox } from "@/overlay/NnModalBox";
import { NoteDeleteConfirmDialog } from "@/overlay/NoteDeleteConfirmDialog";
import { NotesList } from "@/overlay/NotesList";
import { storageService } from "@/services/storageService";
import type {
  NNCopiedNote,
  NNNoteListLayout,
  NNSyncNote,
} from "@/types/nnData";

type DashboardContentProps = {
  notes: NNSyncNote[];
  browserTabUrlKey: string | null;
  activeSubjectTabId: string | null;
  activeNoteId: string | null;
  emptyState: "first-run" | "select-or-create" | null;
  /** Opens the strip's Add Subject Tab dialog; wired to the first-run "+". */
  onRequestAddSubjectTab: () => void;
  onUpdateNote: (
    noteId: string,
    patch: Partial<Pick<NNSyncNote, "url" | "heading" | "body">>,
  ) => void | Promise<void>;
  onHighlightNote: (noteId: string | null) => void;
  onHasInvalidUrlDraftChange: (hasInvalidUrlDraft: boolean) => void;
  isNoteExpanded: (noteId: string) => boolean;
  onSetNoteExpanded: (noteId: string, expanded: boolean) => void;
  onDeleteNote: (noteId: string) => void | Promise<void>;
  onActivateNote: (noteId: string) => void;
  resolvedNoteListLayout: NNNoteListLayout | null;
  onCommitNoteListLayout: (layout: NNNoteListLayout) => Promise<void>;
  /** Disables edits, deletes, sort, copy-paste — see Note/NotesList for details. */
  isReadOnly?: boolean;
};

export type DashboardContentHandle = {
  /** Scroll the note list to the very top (DASHBOARD/NOTES-BEHAVIOR: reveal new note). */
  scrollNotesToTop: () => void;
};

export const DashboardContent = forwardRef<
  DashboardContentHandle,
  DashboardContentProps
>(function DashboardContent(
  {
    notes,
    browserTabUrlKey,
    activeSubjectTabId,
    activeNoteId,
    emptyState,
    onRequestAddSubjectTab,
    onUpdateNote,
    onHighlightNote,
    onHasInvalidUrlDraftChange,
    isNoteExpanded,
    onSetNoteExpanded,
    onDeleteNote,
    onActivateNote,
    resolvedNoteListLayout,
    onCommitNoteListLayout,
    isReadOnly = false,
  },
  ref,
) {
  const notesScrollRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(
    ref,
    () => ({
      scrollNotesToTop() {
        // Defer one frame so the just-added (prepended) note is committed first.
        requestAnimationFrame(() => {
          notesScrollRef.current?.scrollTo({ top: 0 });
        });
      },
    }),
    [],
  );

  // Notes-list scroll restore across navigation: apply the saved offset once when notes first render, never again.
  const [restoreScrollTop, setRestoreScrollTop] = useState<number | null>(null);
  const didRestoreScrollRef = useRef(false);
  const scrollSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getTabSession().then((session) => {
      if (
        !cancelled &&
        session &&
        typeof session.notesScrollTop === "number" &&
        session.notesScrollTop > 0
      ) {
        setRestoreScrollTop(session.notesScrollTop);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useLayoutEffect(() => {
    if (didRestoreScrollRef.current || restoreScrollTop === null) {
      return;
    }
    const el = notesScrollRef.current;
    if (!el || notes.length === 0) {
      return;
    }
    el.scrollTop = restoreScrollTop;
    didRestoreScrollRef.current = true;
  }, [restoreScrollTop, notes]);

  useEffect(
    () => () => {
      if (scrollSaveTimerRef.current) {
        clearTimeout(scrollSaveTimerRef.current);
      }
    },
    [],
  );

  // Debounced so a scroll burst sends one patch.
  function handleNotesScroll(): void {
    const el = notesScrollRef.current;
    if (!el) {
      return;
    }
    const top = el.scrollTop;
    if (scrollSaveTimerRef.current) {
      clearTimeout(scrollSaveTimerRef.current);
    }
    scrollSaveTimerRef.current = setTimeout(() => {
      patchTabSession({ notesScrollTop: top });
      scrollSaveTimerRef.current = null;
    }, 200);
  }

  const [invalidUrlByNoteId, setInvalidUrlByNoteId] = useState<
    Record<string, boolean>
  >({});
  const [notePendingDelete, setNotePendingDelete] = useState<string | null>(
    null,
  );
  const [copiedNote, setCopiedNote] = useState<NNCopiedNote | null>(null);

  useEffect(() => {
    void storageService.local.get("nnCopyBuffer").then((stored) => {
      if (stored) setCopiedNote(stored);
    });
    return storageService.local.subscribe("nnCopyBuffer", (value) => {
      setCopiedNote(value ?? null);
    });
  }, []);

  useEffect(() => {
    const noteIds = new Set(notes.map((note) => note.id));
    setInvalidUrlByNoteId((prev) => {
      const next: Record<string, boolean> = {};
      let changed = false;
      for (const [noteId, invalid] of Object.entries(prev)) {
        if (noteIds.has(noteId)) {
          next[noteId] = invalid;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [notes]);

  useEffect(() => {
    onHasInvalidUrlDraftChange(Object.values(invalidUrlByNoteId).some(Boolean));
  }, [invalidUrlByNoteId, onHasInvalidUrlDraftChange]);

  const notesById = useMemo(
    () => new Map(notes.map((n) => [n.id, n] as const)),
    [notes],
  );

  const noteLayoutForList =
    resolvedNoteListLayout ??
    buildDefaultNoteListLayout(notes.map((n) => n.id));

  if (emptyState !== null) {
    return (
      <section
        className="nn-dashboard-content-frosted flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        aria-label="Dashboard content"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center p-4">
          <NnModalBox>
            <div className="flex flex-1 flex-col items-center justify-center px-3 text-center text-subject-label leading-[1.875rem] uppercase text-modal-foreground">
              {emptyState === "first-run" ? (
                // Figma "CREATE A SUBJECT TAB...": the "+" here opens the strip's Add dialog.
                <div className="flex items-center justify-center gap-4">
                  <p>
                    <span className="text-accent">Create</span> a{" "}
                    <span className="text-accent">subject tab</span> by clicking
                  </p>
                  {/* Square, superseding Figma "Rectangle 28" (41×39): only a square box sits the square
                      glyph equidistant, and 41×39 also threw off centring against the sentence. */}
                  <AddSubjectTabButton
                    onClick={onRequestAddSubjectTab}
                    disabled={isReadOnly}
                    className="size-[2.5625rem]"
                  />
                </div>
              ) : (
                // Figma "SELECT A SUB TAB..": message block 296×59 (two 30px lines).
                <>
                  <p>
                    <span className="text-accent">Select</span> or{" "}
                    <span className="text-accent">create</span> a{" "}
                    <span className="text-accent">subject tab</span>
                  </p>
                  <p>to view, edit or add notes to</p>
                </>
              )}
            </div>
          </NnModalBox>
        </div>
      </section>
    );
  }

  return (
    <section
      className="nn-dashboard-content-frosted flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      aria-label="Dashboard content"
    >
      <div
        ref={notesScrollRef}
        onScroll={handleNotesScroll}
        className="nn-scrollbar min-h-0 flex-1 overflow-auto py-4 px-6"
      >
        {notes.length > 0 ? (
          <NotesList
            notesById={notesById}
            noteLayout={noteLayoutForList}
            browserTabUrlKey={browserTabUrlKey}
            activeSubjectTabId={activeSubjectTabId}
            activeNoteId={activeNoteId}
            isReadOnly={isReadOnly}
            isNoteExpanded={isNoteExpanded}
            onSetNoteExpanded={onSetNoteExpanded}
            onUpdateNote={onUpdateNote}
            onHighlightNote={onHighlightNote}
            onValidityChange={(noteId, isInvalid) => {
              setInvalidUrlByNoteId((prev) =>
                prev[noteId] === isInvalid
                  ? prev
                  : { ...prev, [noteId]: isInvalid },
              );
            }}
            onActivateNote={onActivateNote}
            onRequestDelete={(noteId) => {
              if (isReadOnly) {
                return;
              }
              setNotePendingDelete(noteId);
            }}
            onCommitNoteLayout={onCommitNoteListLayout}
            copiedNote={copiedNote}
            onCopyNote={(noteId) => {
              const note = notes.find((n) => n.id === noteId);
              if (!note) return;
              const snapshot: NNCopiedNote = {
                heading: note.heading,
                body: note.body,
                url: note.url,
                createdAt: note.createdAt,
                anchor: note.anchor ?? null,
              };
              setCopiedNote(snapshot);
              void storageService.local.set("nnCopyBuffer", snapshot);
            }}
          />
        ) : null}
      </div>

      <NoteDeleteConfirmDialog
        open={notePendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setNotePendingDelete(null);
          }
        }}
        onConfirm={() => {
          const noteId = notePendingDelete;
          if (!noteId) {
            return;
          }
          void onDeleteNote(noteId);
          setNotePendingDelete(null);
        }}
      />
    </section>
  );
});
