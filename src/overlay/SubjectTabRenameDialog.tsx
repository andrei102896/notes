import React, { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  clampSubjectTabName,
  SUBJECT_TAB_NAME_MAX_LEN,
} from "@/lib/subjectTabName";

export type SubjectTabRenameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onConfirm: (name: string) => void | Promise<void>;
};

/**
 * SUBJECT-TABS-2 — double-click rename: pre-filled name, OK / Escape+Cancel, empty blocked.
 */
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-[calc(50%+var(--spacing)*10)] w-80"
      >
        <DialogHeader>
          <DialogTitle>Rename subject tab</DialogTitle>
          <DialogDescription className="sr-only">
            Enter a new name for this subject tab.
          </DialogDescription>
        </DialogHeader>

        <Input
          id={fieldId}
          ref={inputRef}
          className="w-full min-w-0"
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

        <DialogFooter>
          <Button
            type="button"
            variant="muted"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!canSubmit}
            onClick={() => void submit()}
          >
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
