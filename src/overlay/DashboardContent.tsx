import React, { useEffect, useMemo, useState } from "react";

import { buildDefaultNoteListLayout } from "@/lib/nnNoteLayout";
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
  /** Show instructional empty state when no subject tab is selected/available. */
  showSubjectTabInstruction: boolean;
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

export function DashboardContent({
  notes,
  browserTabUrlKey,
  activeSubjectTabId,
  activeNoteId,
  showSubjectTabInstruction,
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
}: DashboardContentProps): React.ReactElement {
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

  if (showSubjectTabInstruction) {
    return (
      <section
        className="nn-dashboard-content-frosted flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
        aria-label="Dashboard content"
      >
        <div className="flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="flex flex-col items-center gap-4 rounded bg-white px-12 py-8 text-center shadow-sm">
            <p className="text-base font-medium text-foreground">
              Select a subject tab to view, edit or add notes to.
            </p>
            <p className="text-sm font-semibold text-muted-foreground">OR</p>
            <p className="text-base font-medium text-foreground">
              Create a new subject tab to add notes to.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="nn-dashboard-content-frosted flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
      aria-label="Dashboard content"
    >
      <div className="min-h-0 flex-1 overflow-auto py-6 px-4">
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
}
