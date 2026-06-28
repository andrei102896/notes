import React from "react";

import {
  ModalCancelButton,
  ModalOkButton,
  NnModalFrame,
} from "@/overlay/NnModalFrame";

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
    <NnModalFrame
      open={open}
      onOpenChange={onOpenChange}
      title="Permanently delete this note. This action cannot be undone."
    >
      <p className="text-center text-subject-label uppercase leading-tight text-modal-foreground">
        This cannot be undone: proceed?
      </p>
      <div className="flex justify-center gap-3">
        <ModalCancelButton onClick={() => onOpenChange(false)}>
          Cancel
        </ModalCancelButton>
        <ModalOkButton destructive onClick={() => void onConfirm()}>
          OK
        </ModalOkButton>
      </div>
    </NnModalFrame>
  );
}
