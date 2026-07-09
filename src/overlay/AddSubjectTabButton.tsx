import React from "react";

import { Button } from "@/components/ui/button";
import { IS_WINDOWS } from "@/lib/platform";
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
        "relative z-30 h-[var(--air-cell)] shrink-0 border-2 border-border bg-accent text-accent-foreground hover:brightness-90 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:bg-accent disabled:text-accent-foreground disabled:opacity-100",
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
      {/* Vector "+" (font glyph off-center on Windows); square viewBox + symmetric arms → uniform padding. Windows shifts viewBox min-y to -1 to cancel a ~1px top-lean from its SVG pixel-snapping (Mac renders centered). */}
      <svg
        data-add-tab-glyph
        viewBox={IS_WINDOWS ? "0 -1 24 24" : "0 0 24 24"}
        fill="currentColor"
        aria-hidden
      >
        <path d="M9.45 24V14.55H0V9.45H9.45V0H14.55V9.45H24V14.55H14.55V24H9.45Z" />
      </svg>
    </Button>
  );
}
