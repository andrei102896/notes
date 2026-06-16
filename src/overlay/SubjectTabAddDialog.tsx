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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-[calc(50%+var(--spacing)*10)] w-80"
      >
        <DialogHeader>
          <DialogTitle>New subject tab</DialogTitle>
          <DialogDescription className="sr-only">
            Enter a name for the new subject tab.
          </DialogDescription>
        </DialogHeader>

        <Input
          id={fieldId}
          ref={inputRef}
          className="w-full min-w-0"
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
