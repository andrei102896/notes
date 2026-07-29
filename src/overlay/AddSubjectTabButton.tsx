import React from "react";

import { Button } from "@/components/ui/button";
import { IS_WINDOWS } from "@/lib/platform";
import { cn } from "@/lib/utils";

type AddSubjectTabButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  /** Drives aria-expanded for the strip's dialog trigger. */
  addDialogOpen?: boolean;
  /** Context sizing override (the first-run modal passes the Figma 41×39 box). */
  className?: string;
};

/** Used twice: at the top of the subject-tab strip and in the first-run panel, each sizing it itself. */
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
      className={cn(
        // border: Figma "Rectangle 28" — 4px white, not the panel's dark stroke.
        "relative z-30 shrink-0 border-[3px] border-white bg-accent text-accent-foreground hover:brightness-90 focus-visible:ring-accent/40 disabled:cursor-not-allowed disabled:bg-accent disabled:text-accent-foreground disabled:opacity-100",
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
      {/* Vector, not a font glyph — the glyph renders off-centre on Windows. The -1 viewBox min-y cancels
          a ~1px top-lean from Windows' SVG pixel-snapping; Mac already centres. */}
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
