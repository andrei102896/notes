import React from "react";

import { SubjectTabNameModal } from "@/overlay/SubjectTabNameModal";

export type SubjectTabRenameDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialName: string;
  onConfirm: (name: string) => void | Promise<void>;
};

/** SUBJECT-TABS-2 — the double-click rename entry point; same modal as add, name pre-filled. */
export function SubjectTabRenameDialog({
  open,
  onOpenChange,
  initialName,
  onConfirm,
}: SubjectTabRenameDialogProps): React.ReactElement {
  return (
    <SubjectTabNameModal
      open={open}
      onOpenChange={onOpenChange}
      label="Rename subject tab"
      inputAriaLabel="Subject tab name"
      initialValue={initialName}
      onConfirm={onConfirm}
    />
  );
}
