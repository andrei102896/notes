import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import { openInNewTab } from "@/lib/openInNewTab";
import {
  BrandLogoFat,
  BrandMetalHeaderBar,
  NN_PLATE_CLASS,
} from "@/overlay/BrandLockup";
import { SubjectTabDeleteConfirmDialog } from "@/overlay/SubjectTabDeleteConfirmDialog";

const NN_UPDATES_URL = "https://www.notesfornet.com/updates";

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

  // The accent line under the white border-b is a box-shadow: one element carries only one border-bottom.
  return (
    <header className="sticky top-0 z-20 flex h-auto flex-col border-b-2 border-white bg-air-box shadow-[0_4px_0_0_var(--color-accent)]">
      {/* Narrower than the modals' plate: the client anchors its width to the ADD NOTE button below. */}
      <BrandMetalHeaderBar
        className="relative z-[1] h-[var(--air-cell)]"
        plateClassName={NN_PLATE_CLASS}
        rimClassName="border-[5px]"
      />
      {/* One white frame around the whole strip: bg-background is the 3px surround (padding, incl. the white separator line under the metal band) and dividers (gap); no button has its own border. relative: positions the nav-bar hilite. */}
      <div className="relative flex h-[var(--air-cell)] items-stretch gap-[3px] bg-background p-[3px]">
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
        <ButtonGroup className="flex-1 items-stretch gap-0.5 bg-[#b7b5b5] [&_button]:h-full [&_button]:flex-1 [&_button]:px-2 [&_button]:text-navmin [&_button]:uppercase [&_button]:text-mintext">
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
            <BrandLogoFat />
          </button>
        ) : (
          <button
            type="button"
            className="flex h-full shrink-0 cursor-pointer items-center bg-accent px-2 [&_path]:stroke-white [&_path]:[stroke-linejoin:round] [&_path]:[stroke-width:1px]"
            onClick={() => openInNewTab(NN_UPDATES_URL)}
            aria-label="Open NN updates page"
          >
            <BrandLogoFat />
          </button>
        )}

        {/* WHITE HILITE ON NAV BAR (Figma), pinned to the TOP of the nav row. clip-path cuts the upward
            blur at the seam so it never shows on the metal band's bottom. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-4 bg-[rgba(217,217,217,0.63)] blur-[5px] [clip-path:inset(0_0_-20px_0)]"
        />
      </div>

      {/* SHADOW __BLUE LINE (Figma). The bottom offset clears the 2px white border plus the 4px accent
          line so the band starts right beneath them. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-[0.40625rem] -bottom-[0.8125rem] h-2 bg-[rgba(55,55,55,0.77)] blur-[0.3rem]"
      />

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
