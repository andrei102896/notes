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

export type SubjectTabRenameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onConfirm: (name: string) => void | Promise<void>;
};

/** SUBJECT-TABS-2 — double-click rename: pre-filled name, OK / Escape+Cancel, empty blocked. */
export function SubjectTabRenameDialog({
  open,
  onOpenChange,
  initialName,
  onConfirm,
}: SubjectTabRenameDialogProps): React.ReactElement {
  const fieldId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState(() => clampSubjectTabName(initialName));

  useEffect(() => {
    if (open) {
      setDraft(clampSubjectTabName(initialName));
    }
  }, [open, initialName]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
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
      title="Rename subject tab"
      bodyClassName="px-12"
    >
      <div className="flex items-end gap-3">
        {/* Label + input stacked; items-center centers the narrower box under the label (mirrors SubjectTabAddDialog / Figma). */}
        <div className="flex flex-col items-center gap-4">
          <label
            htmlFor={fieldId}
            className="text-subject-label uppercase leading-none text-modal-foreground"
          >
            Rename subject tab
          </label>
          <Input
            id={fieldId}
            ref={inputRef}
            data-subject-name-input
            className="h-[2.46rem] w-28 border-[0.5px] border-white bg-[#515151] px-2 text-center uppercase leading-none text-white"
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
            aria-label="Subject tab name"
          />
        </div>

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
