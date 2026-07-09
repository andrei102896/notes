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
      {/* nn-metal-bar: Figma TOP METAL BAR (blue metallic) on the brand band only; the id-scoped rule overrides the shared band's bg/shadow for the dashboard header, leaving modals/trial bar gray. py-0: the --air-cell height already sets the band. */}
      <BrandHeaderBar className="nn-metal-bar relative z-[1] h-[var(--air-cell)] border-b border-black py-0" />
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
            <BrandLogo />
          </button>
        ) : (
          <div className="flex h-full shrink-0 items-center bg-accent px-2 [&_path]:stroke-white [&_path]:[stroke-linejoin:round] [&_path]:[stroke-width:1px]">
            <BrandLogo />
          </div>
        )}

        {/* WHITE HILITE ON NAV BAR (Figma): the soft translucent "fog", pinned to the TOP of the nav row. clip-path clips the upward blur at the seam so it is never seen on row 1's bottom. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-4 bg-[rgba(217,217,217,0.63)] blur-[5px] [clip-path:inset(0_0_-20px_0)]"
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
