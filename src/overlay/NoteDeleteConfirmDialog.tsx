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

type NoteDeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

export function NoteDeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: NoteDeleteConfirmDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="left-[calc(50%+var(--spacing)*10)]"
      >
        <DialogHeader>
          <DialogTitle>THIS CANNOT BE UNDONE: PROCEED?</DialogTitle>
          <DialogDescription className="sr-only">
            Permanently delete this note. This action cannot be undone.
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
            onClick={() => void onConfirm()}
          >
            YES
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
