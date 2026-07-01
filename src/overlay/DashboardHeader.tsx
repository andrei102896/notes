import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import { BrandHeaderBar, BrandLogo } from "@/overlay/BrandLockup";
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
      {/* py-0: fixed --air-cell height already sets the band; the shared bar's default vertical padding would squeeze the cluster. */}
      <BrandHeaderBar className="relative z-[1] h-[var(--air-cell)] border-b border-black py-0" />
      {/* One white frame around the whole strip: bg-background is the 3px surround (padding) and dividers (gap); no button has its own border. */}
      <div className="flex h-[var(--air-cell)] items-stretch gap-[3px] bg-background p-[3px]">
        <Button
          variant="default"
          size="sm"
          className="shrink-0 h-full whitespace-nowrap bg-accent px-3.5 text-navlabel uppercase text-accent-foreground hover:bg-accent/90"
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

        {/* Nav bar fills the slack (flex-1 → basis 0 beats w-fit); Min/Max/Delete grow equally so the gap reads as distance between them. */}
        <ButtonGroup className="flex-1 items-stretch gap-0.5 bg-muted [&_button]:h-full [&_button]:flex-1 [&_button]:px-2 [&_button]:text-navmin [&_button]:uppercase [&_button]:text-mintext">
          <ButtonGroupText className="nn-tab-notes-ribbon shrink-0 whitespace-nowrap rounded-none bg-ribbon pr-4 text-navribbon text-accent-foreground">
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

        <Button
          variant="default"
          size="sm"
          className="shrink-0 h-full whitespace-nowrap px-3.5 text-navlabel uppercase text-accent-foreground"
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
            className="flex h-full shrink-0 cursor-pointer items-center bg-[#FF3131] px-2 leading-none [&_path]:stroke-white [&_path]:[stroke-linejoin:round] [&_path]:[stroke-width:1px]"
            onClick={() => onTrialBannerOpenChange?.(true)}
            aria-label="Open trial info"
          >
            <BrandLogo />
          </button>
        ) : (
          <div className="flex h-full shrink-0 items-center bg-accent px-2 [&_path]:stroke-white [&_path]:[stroke-linejoin:round] [&_path]:[stroke-width:1px]">
            <BrandLogo />
          </div>
        )}
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
