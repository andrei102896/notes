import React, { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  ButtonGroup,
  ButtonGroupSeparator,
  ButtonGroupText,
} from "@/components/ui/button-group";
import { SubjectTabDeleteConfirmDialog } from "@/overlay/SubjectTabDeleteConfirmDialog";

function NNLogoTrial(): React.ReactElement {
  return (
    <svg width="62" height="34" viewBox="0 0 62 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="1.5" width="59" height="31" fill="#FF3131" stroke="white" strokeWidth="3"/>
      <path d="M50.9556 26.8984V19.0063C50.9556 15.9378 51.0422 13.7177 51.2604 11.3871L51.1288 11.3579C49.6431 13.3602 47.676 15.4697 45.6224 17.524L36.2684 26.8952H32.4243V8.4292H36.0087V16.1556C36.0087 19.0323 35.9221 21.2816 35.5689 23.7455L35.6554 23.7747C37.0545 21.8829 38.7584 19.9391 40.9437 17.7743L50.3877 8.4292H54.54V26.8984H50.9556Z" fill="white"/>
      <path d="M8.26172 26.8985V8.54956H12.4417L21.9515 17.8329C24.1541 19.9848 25.8684 21.9155 27.2779 23.7943L27.3679 23.7683C27.0147 21.3174 26.9281 19.0844 26.9281 16.2272V8.54956H30.5367V26.8985H26.6649L17.2451 17.5859C15.1742 15.5446 13.1967 13.448 11.7006 11.4587L11.569 11.4847C11.7872 13.7991 11.8772 16.0029 11.8772 19.0551V26.8953H8.26172V26.8985Z" fill="white"/>
    </svg>
  );
}



function NNLogo(): React.ReactElement {
  return (
    <svg
      width="63"
      height="30"
      viewBox="0 0 63 30"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        x="0.5"
        y="0.5"
        width="62"
        height="29"
        fill="white"
        stroke="black"
      />
      <path
        d="M35.5083 4.92908V12.1556C35.5083 15.0218 35.4221 17.2442 35.0737 19.6742L35.0151 20.0863L35.4087 20.2191L35.4956 20.2484L35.8403 20.3646L36.0571 20.0717C37.2652 18.4381 38.7074 16.7609 40.5034 14.9261L41.2954 14.1293L50.5933 4.92908H54.0396V22.3978H51.4556V15.0062C51.4556 11.9485 51.542 9.74468 51.7583 7.43396L51.7993 6.99451L50.9204 6.79919L50.7271 7.05994C49.2637 9.03214 47.3176 11.121 45.269 13.1703H45.2681L36.061 22.3949H32.9243V4.92908H35.5083Z"
        fill="black"
        stroke="black"
      />
      <path
        d="M12.2393 5.04956L21.6025 14.1912V14.1902C23.7909 16.3281 25.4869 18.2403 26.8779 20.0945L27.085 20.3708L27.417 20.2751L27.5068 20.2488L27.9248 20.1277L27.8633 19.697C27.5149 17.2801 27.4277 15.0739 27.4277 12.2273V5.04956H30.0371V22.3982H26.8701L17.5967 13.2302H17.5957C15.5302 11.1943 13.5743 9.1175 12.1006 7.15796L11.9111 6.90698L11.6035 6.96851L11.4717 6.9939L11.0293 7.08179L11.0713 7.53198C11.2876 9.82672 11.377 12.0146 11.377 15.0554V22.3953H8.76172V5.04956H12.2393Z"
        fill="black"
        stroke="black"
      />
    </svg>
  );
}

/** Brand-cluster NN mark (white NN) — NOT the off-limits payment logo. */
function BrandLogo(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 63 30"
      className="h-5 w-auto shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M35.5083 4.92908V12.1556C35.5083 15.0218 35.4221 17.2442 35.0737 19.6742L35.0151 20.0863L35.4087 20.2191L35.4956 20.2484L35.8403 20.3646L36.0571 20.0717C37.2652 18.4381 38.7074 16.7609 40.5034 14.9261L41.2954 14.1293L50.5933 4.92908H54.0396V22.3978H51.4556V15.0062C51.4556 11.9485 51.542 9.74468 51.7583 7.43396L51.7993 6.99451L50.9204 6.79919L50.7271 7.05994C49.2637 9.03214 47.3176 11.121 45.269 13.1703H45.2681L36.061 22.3949H32.9243V4.92908H35.5083Z"
        fill="white"
      />
      <path
        d="M12.2393 5.04956L21.6025 14.1912V14.1902C23.7909 16.3281 25.4869 18.2403 26.8779 20.0945L27.085 20.3708L27.417 20.2751L27.5068 20.2488L27.9248 20.1277L27.8633 19.697C27.5149 17.2801 27.4277 15.0739 27.4277 12.2273V5.04956H30.0371V22.3982H26.8701L17.5967 13.2302H17.5957C15.5302 11.1943 13.5743 9.1175 12.1006 7.15796L11.9111 6.90698L11.6035 6.96851L11.4717 6.9939L11.0293 7.08179L11.0713 7.53198C11.2876 9.82672 11.377 12.0146 11.377 15.0554V22.3953H8.76172V5.04956H12.2393Z"
        fill="white"
      />
    </svg>
  );
}

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
      <div className="relative z-[1] flex h-10 shrink-0 items-center justify-center gap-2 border-b border-black bg-air-box px-2">
        <div className="flex items-stretch border-2 border-mn-stroke bg-accent">
          <span className="flex items-center bg-logo-box">
            <BrandLogo />
          </span>
          <div className="flex items-center justify-center px-2">
            {/* nudge down 1px — Inter caps sit above the optical center */}
            <span className="relative top-px font-ui text-brand-title font-bold uppercase leading-none tracking-widest text-accent-foreground">
              Notes for Net
            </span>
          </div>
        </div>
        <div className="flex items-center justify-center bg-chrome-ext px-1 py-1">
          <span className="relative top-px font-ui text-brand-sub font-semibold uppercase leading-none tracking-wide text-accent-foreground">
            Chrome Extension
          </span>
        </div>
      </div>
      <div className="flex h-8 items-center justify-start gap-0.5 border-y-2 border-background bg-background pr-0.5">
        <Button
          variant="default"
          size="sm"
          className="shrink-0 h-7 border-[3px] border-background whitespace-nowrap p-3.5 text-navlabel uppercase text-accent-foreground"
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

        <ButtonGroup className="items-center gap-0.5 bg-muted [&_button]:h-7 [&_button]:px-2 [&_button]:text-navmin [&_button]:uppercase [&_button]:text-mintext">
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

        <Button
          variant="default"
          size="sm"
          className="shrink-0 h-7 border-[3px] border-background whitespace-nowrap p-3.5 text-navlabel uppercase text-accent-foreground"
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
            className="h-8 cursor-pointer p-0 leading-none [&>svg]:h-full [&>svg]:w-auto"
            onClick={() => onTrialBannerOpenChange?.(true)}
            aria-label="Open trial info"
          >
            <NNLogoTrial />
          </button>
        ) : (
          <div className="h-7 [&>svg]:h-full [&>svg]:w-auto">
            <NNLogo />
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
