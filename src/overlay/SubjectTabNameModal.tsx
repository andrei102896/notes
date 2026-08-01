import React, { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  clampSubjectTabName,
  SUBJECT_TAB_NAME_MAX_LEN,
} from "@/lib/subjectTabName";
import { cn } from "@/lib/utils";
import { NnModalBox } from "@/overlay/NnModalBox";
import { NnModalShell } from "@/overlay/NnModalShell";

/** Figma CANCEL BOX / OK BOX: 109.11×39.34, 0.5px white edge, Fjalla 24px. */
const NAME_BUTTON_CLASS =
  "inline-flex h-[2.46rem] w-[6.82rem] cursor-pointer items-center justify-center border-[0.5px] border-white text-subject-label uppercase leading-none text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50";

type SubjectTabNameModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Label above the field, e.g. "Add subject tab" — also the modal's accessible title. */
  label: string;
  inputAriaLabel: string;
  /** Pre-filled name; empty to add. Selected on open when non-empty (rename). */
  initialValue: string;
  onConfirm: (name: string) => void | Promise<void>;
  /** See NnModalShell: false while the first-run panel already paints the backdrop. */
  showBackdrop?: boolean;
};

/** Add / rename subject tab (Figma "ADD SUBJECT TAB MODAL 1", 467×211); empty submit blocked. */
export function SubjectTabNameModal({
  open,
  onOpenChange,
  label,
  inputAriaLabel,
  initialValue,
  onConfirm,
  showBackdrop,
}: SubjectTabNameModalProps): React.ReactElement {
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => clampSubjectTabName(initialValue));

  useEffect(() => {
    if (open) {
      setDraft(clampSubjectTabName(initialValue));
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      // Pre-filled (rename) opens with the name selected so typing replaces it.
      if (initialValue) {
        inputRef.current?.select();
      }
    });
    return () => cancelAnimationFrame(id);
  }, [open, initialValue]);

  const trimmed = draft.trim();
  const canSubmit = trimmed.length > 0;

  async function submit(): Promise<void> {
    if (!canSubmit) {
      return;
    }
    await onConfirm(clampSubjectTabName(trimmed));
    onOpenChange(false);
  }

  return (
    <NnModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={label}
      showBackdrop={showBackdrop}
    >
      <NnModalBox className="h-[13.1875rem] items-center">
        <label
          htmlFor={fieldId}
          className="mt-[0.625rem] text-[1.25rem] leading-[1.5625rem] uppercase text-white"
        >
          {label}
        </label>

        <Input
          id={fieldId}
          ref={inputRef}
          data-subject-name-input
          /* Figma TAB BOX ORIG, fixed width. 1ch each side is the client's "1 additional character at
             front and back"; text-center is their "populates from center". */
          className="mt-[1.3125rem] h-[2.4375rem] w-[15.3125rem] rounded-none border border-white bg-accent/30 px-[1ch] text-center leading-none text-white shadow-none focus-visible:ring-0"
          value={draft}
          maxLength={SUBJECT_TAB_NAME_MAX_LEN}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === " ") {
              e.stopPropagation();
            }
            if (e.key === "Enter") {
              e.preventDefault();
              void submit();
            }
          }}
          aria-label={inputAriaLabel}
        />

        <div className="mt-[1.1875rem] flex gap-[1.5rem]">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={cn(NAME_BUTTON_CLASS, "bg-accent/30 hover:bg-accent/40")}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className={cn(NAME_BUTTON_CLASS, "bg-accent hover:bg-accent/90")}
          >
            OK
          </button>
        </div>
      </NnModalBox>
    </NnModalShell>
  );
}
