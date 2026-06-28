import React, { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  clampSubjectTabName,
  SUBJECT_TAB_NAME_MAX_LEN,
} from "@/lib/subjectTabName";
import {
  ModalCancelButton,
  ModalOkButton,
  NnModalFrame,
} from "@/overlay/NnModalFrame";

export type SubjectTabAddDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void | Promise<void>;
};

/** New subject tab: empty name field, OK / Cancel, empty submit blocked (same flow as rename modal). */
export function SubjectTabAddDialog({
  open,
  onOpenChange,
  onConfirm,
}: SubjectTabAddDialogProps): React.ReactElement {
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (open) {
      setDraft("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

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
    <NnModalFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Add subject tab"
      bodyClassName="px-12"
    >
      <div className="flex items-end gap-3">
        {/* Label + input stacked; items-center centers the narrower input box under the ADD SUBJECT TAB label (Figma). */}
        <div className="flex flex-col items-center gap-4">
          <label
            htmlFor={fieldId}
            className="text-subject-label uppercase leading-none text-modal-foreground"
          >
            Add subject tab
          </label>
          <Input
            id={fieldId}
            ref={inputRef}
            data-subject-name-input
            /* Box matches the OK/CANCEL buttons (Figma TAB BOX #515151, light text); label Fjalla One Regular 26 centered — size is ID-scoped in styles.css to dodge the text-size/color twMerge clash. */
            className="h-auto w-28 border-[0.5px] border-white bg-[#515151] px-4 py-1 text-center leading-none text-white"
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
            aria-label="New subject tab name"
          />
        </div>

        {/* h-fit + self-end: don't stretch to the tall label+input column; sit at the input's level. */}
        <div className="ml-auto flex h-fit gap-3 self-end">
          <ModalCancelButton onClick={() => onOpenChange(false)}>
            Cancel
          </ModalCancelButton>
          <ModalOkButton disabled={!canSubmit} onClick={() => void submit()}>
            OK
          </ModalOkButton>
        </div>
      </div>
    </NnModalFrame>
  );
}
