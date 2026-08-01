import React from "react";

import { SubjectTabNameModal } from "@/overlay/SubjectTabNameModal";

export type SubjectTabAddDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void | Promise<void>;
  /** False on first run: that panel's backdrop stays put and only the box swaps. */
  showBackdrop?: boolean;
};

/** Same modal as rename, opened with an empty name. */
export function SubjectTabAddDialog({
  open,
  onOpenChange,
  onConfirm,
  showBackdrop,
}: SubjectTabAddDialogProps): React.ReactElement {
  return (
    <SubjectTabNameModal
      open={open}
      onOpenChange={onOpenChange}
      label="Add subject tab"
      inputAriaLabel="New subject tab name"
      initialValue=""
      onConfirm={onConfirm}
      showBackdrop={showBackdrop}
    />
  );
}
