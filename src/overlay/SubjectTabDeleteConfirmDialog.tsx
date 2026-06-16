import React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type SubjectTabDeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

/**
 * SUBJECT-TABS-3 — delete subject tab: confirm before removing tab and its notes.
 */
export function SubjectTabDeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: SubjectTabDeleteConfirmDialogProps): React.ReactElement {
  async function confirm(): Promise<void> {
    await onConfirm();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-[calc(50%+var(--spacing)*10)]"
      >
        <DialogHeader>
          <DialogTitle>THIS CANNOT BE UNDONE: PROCEED?</DialogTitle>
          <DialogDescription className="sr-only">
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            type="button"
            variant="muted"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            NO
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => void confirm()}
          >
            YES
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
