import React from "react";

import { DeleteConfirmModal } from "@/overlay/DeleteConfirmModal";

export type SubjectTabDeleteConfirmDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
};

/** SUBJECT-TABS-3 — delete subject tab: confirm before removing tab and its notes. */
export function SubjectTabDeleteConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: SubjectTabDeleteConfirmDialogProps): React.ReactElement {
  return (
    <DeleteConfirmModal
      open={open}
      onOpenChange={onOpenChange}
      title="This action cannot be undone. Proceed?"
      onConfirm={async () => {
        await onConfirm();
        onOpenChange(false);
      }}
    />
  );
}
