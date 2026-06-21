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

/**
 * New subject tab: empty name field, OK / Cancel, empty submit blocked (same flow as rename modal).
 */
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
      widthClassName="w-[30rem]"
    >
      <label
        htmlFor={fieldId}
        className="text-subject-label uppercase leading-none text-modal-foreground"
      >
        Add subject tab
      </label>

      <div className="flex items-stretch gap-3">
        <Input
          id={fieldId}
          ref={inputRef}
          className="h-auto w-44 min-w-0 border-white bg-note-field"
          value={draft}
          maxLength={SUBJECT_TAB_NAME_MAX_LEN}
          placeholder="Name"
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

        <div className="ml-auto flex gap-3">
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
