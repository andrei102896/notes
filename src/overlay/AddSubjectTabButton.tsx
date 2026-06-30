import React from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddSubjectTabButtonProps = {
  /** Omit to render an inert "+" (first-run illustrative cue); pass to open the Add dialog (strip). */
  onClick?: () => void;
  disabled?: boolean;
  /** Drives aria-expanded for the strip's dialog trigger. */
  addDialogOpen?: boolean;
  /** Context sizing override. The strip omits it (stays w-10 to fit the 40px column); the first-run modal passes w-[var(--air-cell)] to square the button. */
  className?: string;
};

/** The blue "+" that creates a subject tab — at the top of the strip, and (handler-less) in the first-run panel. */
export function AddSubjectTabButton({
  onClick,
  disabled = false,
  addDialogOpen,
  className,
}: AddSubjectTabButtonProps): React.ReactElement {
  return (
    <Button
      variant="icon"
      size="icon"
      /* One A–Z cell tall (var(--air-cell)); width = w-10 (size icon) in the strip, squared in the modal via className. */
      className={cn(
        "relative z-30 h-[var(--air-cell)] shrink-0 border-border bg-accent text-accent-foreground hover:brightness-90 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:bg-accent disabled:text-accent-foreground disabled:opacity-100",
        className,
      )}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label="Add subject tab"
      aria-haspopup="dialog"
      aria-expanded={addDialogOpen}
    >
      <span data-add-tab-glyph aria-hidden>
        +
      </span>
    </Button>
  );
}
