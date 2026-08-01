import React from "react";

import { Button } from "@/components/ui/button";
import { useNoteLinkAnchor } from "@/hooks/useNoteLinkAnchor";
import type { NNSyncNote } from "@/types/nnData";

type CollapsedNoteNavProps = {
  note: NNSyncNote;
  isReadOnly: boolean;
  onActivate: (noteId: string) => void;
  onHighlightNote: (noteId: string | null) => void;
  onUpdateNote: (
    noteId: string,
    patch: Partial<Pick<NNSyncNote, "anchor">>,
  ) => void | Promise<void>;
};

/** Collapsed-bar LINK/ANCHOR — same handlers as the expanded URL row, sourced from the persisted URL. */
export function CollapsedNoteNav({
  note,
  isReadOnly,
  onActivate,
  onHighlightNote,
  onUpdateNote,
}: CollapsedNoteNavProps): React.ReactElement | null {
  const nav = useNoteLinkAnchor({
    linkUrl: note.url,
    anchorUrl: note.url,
    anchor: note.anchor ?? null,
    isReadOnly,
    onSaveAnchor: (anchor) => {
      if (isReadOnly) {
        return;
      }
      onHighlightNote(note.id);
      void onUpdateNote(note.id, { anchor });
    },
    onInteract: () => {
      onActivate(note.id);
      onHighlightNote(note.id);
    },
  });

  // No URL, no commands: the collapsed header shows nothing here, not greyed buttons (client 2026-08-01).
  if (note.url.trim() === "") {
    return null;
  }

  return (
    <div className="flex shrink-0 items-stretch">
      <Button
        variant="secondary"
        aria-label="Navigate to URL"
        disabled={!nav.canOpenLink}
        onClick={nav.handleLinkClick}
        onContextMenu={nav.handleLinkContextMenu}
        className="h-full w-12 shrink-0 rounded-none bg-note-action px-0 font-normal text-md text-white hover:bg-note-action/90"
      >
        LINK
      </Button>
      {note.anchor ? (
        <Button
          aria-label="Navigate to anchor position"
          onClick={nav.handleAnchorClick}
          onContextMenu={nav.handleAnchorContextMenu}
          className="h-full w-15 shrink-0 rounded-none bg-accent px-0 font-normal text-md text-white hover:bg-accent/90"
        >
          ANCHOR
        </Button>
      ) : null}
    </div>
  );
}
