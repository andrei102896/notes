import React from "react";

import { AddSubjectTabButton } from "@/overlay/AddSubjectTabButton";
import { NnLogoPlate } from "@/overlay/BrandLockup";
import { ModalBackdrop, ModalMetalBar } from "@/overlay/ModalBackdrop";
import { NnModalBox } from "@/overlay/NnModalBox";

type FirstRunPanelProps = {
  onRequestAddSubjectTab: () => void;
  isReadOnly: boolean;
  /** False while the add-tab dialog is open: its box takes this one's place over the same backdrop. */
  showBox?: boolean;
};

/** First run (no subject tabs): the full-panel NN backdrop carrying the CREATE A SUBJECT TAB box.
 *  Deliberately not a dialog — nothing to dismiss, and a focus trap would fight the add-tab dialog. */
export function FirstRunPanel({
  onRequestAddSubjectTab,
  isReadOnly,
  showBox = true,
}: FirstRunPanelProps): React.ReactElement {
  return (
    /* z-40 covers the header row (z-20) and the strip's "+" (z-30): the whole panel is the backdrop. */
    <div className="absolute inset-0 z-40">
      <ModalBackdrop
        header={
          <ModalMetalBar plate={<NnLogoPlate className="h-full w-full" />} />
        }
        showTagline={false}
      />
      {showBox ? (
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <NnModalBox>
            <div className="flex flex-1 flex-col items-center justify-center px-3 text-center text-subject-label leading-[1.875rem] uppercase text-modal-foreground">
              {/* Figma "CREATE A SUBJECT TAB...": this "+" opens the strip's Add dialog. */}
              <div className="flex items-center justify-center gap-4">
                <p>
                  <span className="text-accent">Create</span> a{" "}
                  <span className="text-accent">subject tab</span> by clicking
                </p>
                {/* Square, superseding Figma "Rectangle 28" (41×39): only a square box sits the square glyph
                  equidistant, and 41×39 also threw off centring against the sentence. */}
                <AddSubjectTabButton
                  onClick={onRequestAddSubjectTab}
                  disabled={isReadOnly}
                  className="size-[2.5625rem]"
                />
              </div>
            </div>
          </NnModalBox>
        </div>
      ) : null}
    </div>
  );
}
