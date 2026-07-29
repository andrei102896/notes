import React from "react";

import { SubjectTabNameModal } from "@/overlay/SubjectTabNameModal";

export type SubjectTabAddDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void | Promise<void>;
};

/** Same modal as rename, opened with an empty name. */
export function SubjectTabAddDialog({
  open,
  onOpenChange,
  onConfirm,
}: SubjectTabAddDialogProps): React.ReactElement {
  return (
    <SubjectTabNameModal
      open={open}
      onOpenChange={onOpenChange}
      label="Add subject tab"
      inputAriaLabel="New subject tab name"
      initialValue=""
      onConfirm={onConfirm}
    />
  );
}
