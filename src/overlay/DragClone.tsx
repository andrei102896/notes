import React from "react";

import { noteUrlMatchesBrowserTab } from "@/lib/nnDashboardNotes";
import { Note } from "@/overlay/Note";
import type { NNSyncNote } from "@/types/nnData";

type DragCloneProps = {
  note: NNSyncNote;
  /** Up to 2 other dragged notes, stacked faintly behind the active one. */
  backNotes: NNSyncNote[];
  /** Multi-note drag — show the count badge. */
  isMulti: boolean;
  count: number;
  activeSubjectTabId: string | null;
  browserTabUrlKey: string | null;
  isNoteExpanded: (noteId: string) => boolean;
};

/** Cursor-riding clone; dnd-kit sizes the overlay wrapper to the dragged row's rect. A multi-drag stacks up to 2 faint clones behind + a count badge. */
export function DragClone({
  note,
  backNotes,
  isMulti,
  count,
  activeSubjectTabId,
  browserTabUrlKey,
  isNoteExpanded,
}: DragCloneProps): React.ReactElement {
  const renderNoteClone = (n: NNSyncNote): React.ReactNode => {
    const matchesCurrentPage =
      browserTabUrlKey !== null &&
      noteUrlMatchesBrowserTab(n.url, browserTabUrlKey);
    return (
      <Note
        note={n}
        activeSubjectTabId={activeSubjectTabId}
        expanded={isNoteExpanded(n.id)}
        isActive={false}
        matchesCurrentPage={matchesCurrentPage}
        isReadOnly
        onActivate={() => {}}
        onSetExpanded={() => {}}
        onUpdateNote={() => {}}
        onHighlightNote={() => {}}
        onValidityChange={() => {}}
        onRequestDelete={() => {}}
        copiedNote={null}
        onCopyNote={() => {}}
      />
    );
  };

  return (
    <div className="relative">
      {backNotes.map((backNote, i) => (
        <div
          key={backNote.id}
          aria-hidden
          className="pointer-events-none absolute inset-0 shadow-lg"
          style={{
            transform: `translate(${(i + 1) * 6}px, ${(i + 1) * 6}px)`,
            opacity: 0.45,
            zIndex: -(i + 1),
          }}
        >
          {renderNoteClone(backNote)}
        </div>
      ))}
      <div className="relative shadow-lg">
        {isMulti && (
          <span className="absolute -top-2 -right-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[0.75rem] font-semibold text-accent-foreground">
            {count}
          </span>
        )}
        {renderNoteClone(note)}
      </div>
    </div>
  );
}
