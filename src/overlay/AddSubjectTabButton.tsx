import React from "react";

import { Button } from "@/components/ui/button";
import { useSymmetricAddGlyph } from "@/hooks/useSymmetricAddGlyph";
import { cn } from "@/lib/utils";

type AddSubjectTabButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  /** Drives aria-expanded for the strip's dialog trigger. */
  addDialogOpen?: boolean;
  /** Context sizing override (the first-run modal passes its own square box). */
  className?: string;
};

/** Used twice: at the top of the subject-tab strip and in the first-run panel, each sizing it itself. */
export function AddSubjectTabButton({
  onClick,
  disabled = false,
  addDialogOpen,
  className,
}: AddSubjectTabButtonProps): React.ReactElement {
  const glyphRef = useSymmetricAddGlyph();

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
      {/* Vector, not a font glyph — a font glyph rendered off-centre on Windows. */}
      <svg
        ref={glyphRef}
        data-add-tab-glyph
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M9.45 24V14.55H0V9.45H9.45V0H14.55V9.45H24V14.55H14.55V24H9.45Z" />
      </svg>
    </Button>
  );
}
