import React from "react";

import {
  ModalCancelButton,
  ModalOkButton,
  NnModalFrame,
} from "@/overlay/NnModalFrame";

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
  async function confirm(): Promise<void> {
    await onConfirm();
    onOpenChange(false);
  }

  return (
    <NnModalFrame
      open={open}
      onOpenChange={onOpenChange}
      title="This action cannot be undone. Proceed?"
    >
      <p className="text-center text-subject-label uppercase leading-tight text-modal-foreground">
        This cannot be undone: proceed?
      </p>
      <div className="flex justify-center gap-3">
        <ModalCancelButton onClick={() => onOpenChange(false)}>
          No
        </ModalCancelButton>
        <ModalOkButton destructive onClick={() => void confirm()}>
          Yes
        </ModalOkButton>
      </div>
    </NnModalFrame>
  );
}
