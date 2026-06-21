import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import { BrandLockup, BrandLogo } from "@/overlay/BrandLockup";
import { SubjectTabDeleteConfirmDialog } from "@/overlay/SubjectTabDeleteConfirmDialog";

type DashboardHeaderProps = {
  /** When set, “Delete Tab” removes this subject folder. */
  activeSubjectTabId: string | null;
  onDeleteActiveSubjectTab: () => void | Promise<void>;
  onAddNote: () => void | Promise<void>;
  disableAddNote?: boolean;
  onMinAllNotes: () => void;
  onMaxAllNotes: () => void;
  onDeleteAllNotes: () => void | Promise<void>;
  trialDaysLeft?: number | null;
  onTrialBannerOpenChange?: (open: boolean) => void;
  isReadOnly?: boolean;
};

export function DashboardHeader({
  activeSubjectTabId,
  onDeleteActiveSubjectTab,
  onAddNote,
  disableAddNote = false,
  onMinAllNotes,
  onMaxAllNotes,
  onDeleteAllNotes,
  trialDaysLeft = null,
  onTrialBannerOpenChange,
  isReadOnly = false,
}: DashboardHeaderProps): React.ReactElement {
  const canDeleteSubjectTab = activeSubjectTabId !== null && !isReadOnly;
  const canAddNote = activeSubjectTabId !== null && !disableAddNote && !isReadOnly;
  const canActOnNotes = activeSubjectTabId !== null;
  const canDeleteNotes = canActOnNotes && !isReadOnly;
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteAllNotesConfirmOpen, setDeleteAllNotesConfirmOpen] =
    useState(false);

  const isOnTrial = trialDaysLeft !== null;

  useEffect(() => {
    if (activeSubjectTabId === null) {
      setDeleteConfirmOpen(false);
    }
  }, [activeSubjectTabId]);

  return (
    <header className="sticky top-0 z-20 flex h-auto flex-col bg-air-box">
      <div className="relative z-[1] flex h-[var(--air-cell)] shrink-0 items-center justify-center gap-2 border-b border-black bg-air-box px-2 shadow-[0px_9px_10.3px_rgba(0,0,0,0.52)]">
        <BrandLockup />
      </div>
      <div className="flex h-[var(--air-cell)] items-stretch justify-start bg-air-box">
        <Button
          variant="default"
          size="sm"
          className="shrink-0 h-full border-[3px] border-background whitespace-nowrap px-3.5 text-navlabel uppercase text-accent-foreground"
          disabled={!canAddNote}
          aria-disabled={!canAddNote}
          onClick={() => {
            if (canAddNote) {
              void onAddNote();
            }
          }}
        >
          Add Note
        </Button>

        <ButtonGroup className="items-stretch gap-0.5 bg-muted [&_button]:h-full [&_button]:px-2 [&_button]:text-navmin [&_button]:uppercase [&_button]:text-mintext">
          <ButtonGroupText className="nn-tab-notes-ribbon whitespace-nowrap rounded-none bg-ribbon pr-4 text-navribbon text-accent-foreground">
            This Tab Notes
          </ButtonGroupText>
          <Button
            variant="ghost"
            size="sm"
            disabled={!canActOnNotes}
            onClick={onMinAllNotes}
          >
            Min
          </Button>
          <ButtonGroupSeparator />
          <Button
            variant="ghost"
            size="sm"
            disabled={!canActOnNotes}
            onClick={onMaxAllNotes}
          >
            Max
          </Button>
          <ButtonGroupSeparator />
          <Button
            variant="ghost"
            size="sm"
            disabled={!canDeleteNotes}
            onClick={() => setDeleteAllNotesConfirmOpen(true)}
          >
            Delete
          </Button>
        </ButtonGroup>

        {/* Gray filler extends the "This Tab Notes" bar to absorb the row's horizontal
            slack, so the header background never shows between the macro group and
            Delete Tab at any panel width (css.txt nav bar is one contiguous strip). */}
        <div aria-hidden className="flex-1 self-stretch bg-muted" />

        {/* DELETE TAB + NN form one unit: each keeps its 3px white border and they
            sit flush, so the abutting borders read as a white divider between them
            and a white surround around the pair (css.txt BOX_DELETE TAB + BOX_NN). */}
        <div className="flex items-stretch">
          <Button
            variant="default"
            size="sm"
            className="shrink-0 h-full border-[3px] border-background whitespace-nowrap px-3.5 text-navlabel uppercase text-accent-foreground"
            disabled={!canDeleteSubjectTab}
            aria-disabled={!canDeleteSubjectTab}
            onClick={() => {
              if (canDeleteSubjectTab) {
                setDeleteConfirmOpen(true);
              }
            }}
          >
            Delete Tab
          </Button>

          {isOnTrial || isReadOnly ? (
            <button
              type="button"
              className="flex h-full cursor-pointer items-center border-[3px] border-background bg-[#FF3131] px-2 leading-none [&_path]:stroke-white [&_path]:[stroke-linejoin:round] [&_path]:[stroke-width:1px]"
              onClick={() => onTrialBannerOpenChange?.(true)}
              aria-label="Open trial info"
            >
              <BrandLogo />
            </button>
          ) : (
            <div className="flex h-full items-center border-[3px] border-background bg-accent px-2 [&_path]:stroke-white [&_path]:[stroke-linejoin:round] [&_path]:[stroke-width:1px]">
              <BrandLogo />
            </div>
          )}
        </div>

        {/* Right-edge gutter. The panel hugs the browser's right edge, where the host
            scrollbar paints over the panel and would clip the NN box. Width is the host
            scrollbar measured in content.ts (--nn-scrollbar-gutter), so it self-corrects
            per screen/zoom instead of a fixed guess; 18px fallback before first sync.
            Solid white per design feedback ("white, not gray"). */}
        <div
          aria-hidden
          className="w-[var(--nn-scrollbar-gutter,18px)] shrink-0 bg-background"
        />
      </div>

      <SubjectTabDeleteConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        onConfirm={onDeleteActiveSubjectTab}
      />

      <SubjectTabDeleteConfirmDialog
        open={deleteAllNotesConfirmOpen}
        onOpenChange={setDeleteAllNotesConfirmOpen}
        onConfirm={onDeleteAllNotes}
      />
    </header>
  );
}
