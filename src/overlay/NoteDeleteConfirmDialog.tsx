import React from "react";

import { DeleteConfirmModal } from "@/overlay/DeleteConfirmModal";

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
    <DeleteConfirmModal
      open={open}
      onOpenChange={onOpenChange}
      title="Permanently delete this note. This action cannot be undone."
      onConfirm={onConfirm}
    />
  );
}
