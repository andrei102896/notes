import React from "react";

import type { DropIndicatorState } from "@/lib/notesListGeometry";

/** Drop cue during a drag: a dashed new-section box (past the last note), a labeled new-section line, or a plain reorder line. Rendered as a sibling of the rows so per-move updates don't reconcile them. */
export function DropIndicator({
  indicator,
}: {
  indicator: DropIndicatorState | null;
}): React.ReactElement | null {
  if (!indicator) {
    return null;
  }

  if (indicator.isSection && indicator.boxHeight > 0) {
    // New section past the last note: dashed item-sized box (where the block lands) + a line under it.
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 left-0 z-20"
        style={{ top: indicator.top }}
      >
        <div
          className="relative rounded-md border-2 border-dashed border-muted-foreground/50 bg-muted-foreground/10"
          style={{ height: indicator.boxHeight }}
        >
          {indicator.label && (
            <span className="absolute top-1 left-1 rounded bg-[#111111] px-1 text-[0.75rem] font-semibold uppercase leading-none tracking-wide text-white">
              {indicator.label}
            </span>
          )}
        </div>
        <div className="mt-1 h-[3px] rounded-full bg-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
      </div>
    );
  }

  if (indicator.isSection) {
    // New section between/above rows: a labeled line at the slot (the frozen list leaves no room for a box).
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 left-0 z-20 -translate-y-1/2"
        style={{ top: indicator.top }}
      >
        <div className="h-[3px] rounded-full bg-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
        {indicator.label && (
          <span className="absolute top-1/2 left-1 -translate-y-1/2 rounded bg-[#111111] px-1 text-[0.75rem] font-semibold uppercase leading-none tracking-wide text-white">
            {indicator.label}
          </span>
        )}
      </div>
    );
  }

  // Plain reorder: one thin high-contrast line (#111 + white ring) at the drop slot.
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-0 z-20"
      style={{ top: indicator.top, left: indicator.indent ? "0.75rem" : 0 }}
    >
      <div className="-translate-y-1/2 h-[3px] rounded-full bg-[#111111] shadow-[0_0_0_1px_rgba(255,255,255,0.85)]" />
    </div>
  );
}
