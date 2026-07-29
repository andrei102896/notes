import React from "react";

import { cn } from "@/lib/utils";
import { NnModalBox } from "@/overlay/NnModalBox";
import { NnModalShell } from "@/overlay/NnModalShell";

/** Figma CANCEL BOX / OK BOX: 109.11×39.34, 0.5px white edge, Fjalla 24px. */
const CONFIRM_BUTTON_CLASS =
  "inline-flex h-[2.46rem] w-[6.82rem] cursor-pointer items-center justify-center border-[0.5px] border-white text-subject-label uppercase leading-none transition-colors";

type DeleteConfirmModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visually-hidden accessible title (Radix requires one). */
  title: string;
  onConfirm: () => void | Promise<void>;
};

/** Universal destructive confirm (Figma "DELETE NOTE | SUB TAB UNIVERSAL MODAL", 467×189) — shared by delete note, delete subject tab and delete all notes. */
export function DeleteConfirmModal({
  open,
  onOpenChange,
  title,
  onConfirm,
}: DeleteConfirmModalProps): React.ReactElement {
  return (
    <NnModalShell open={open} onOpenChange={onOpenChange} title={title}>
      <NnModalBox>
        {/* Non-breaking space keeps the design's double gap after the colon (plain double spaces collapse in HTML). */}
        <p className="mt-[1.125rem] text-center text-[1.25rem] leading-[1.5625rem] uppercase text-modal-foreground">
          {"This cannot be undone:\u00a0 proceed?"}
        </p>

        <div className="mt-[2rem] flex justify-center gap-[0.5625rem]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(
              CONFIRM_BUTTON_CLASS,
              "bg-accent/30 text-white hover:bg-accent/40",
            )}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            className={cn(
              CONFIRM_BUTTON_CLASS,
              "bg-modal-delete text-modal-foreground hover:bg-modal-delete/90",
            )}
          >
            OK
          </button>
        </div>
      </NnModalBox>
    </NnModalShell>
  );
}
