import React from "react";

import { cn } from "@/lib/utils";
import { BrandMetalHeaderBar } from "@/overlay/BrandLockup";
import { ModalWatermark } from "@/overlay/NnModalShell";

/** Small-modal header: the shared metal bar at the Figma TOP METAL BAR DB height (35px). */
export function ModalMetalHeaderBar(): React.ReactElement {
  return <BrandMetalHeaderBar className="h-[2.1875rem]" />;
}

/** Figma MODAL BG (467×189), shared by the destructive confirm and the dashboard empty state. */
export function NnModalBox({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div
      data-nn-modal-box=""
      /* isolate scopes the watermark's -z-10 behind the content but above bg-modal. */
      className={cn(
        /* No border-t: the metal bar IS the top edge, so the plate touches the box's outer top — the
           client requires no gap above the logo, and overflow-hidden would clip an overlap instead. */
        "relative isolate flex h-[11.8125rem] w-[29.1875rem] max-w-full flex-col overflow-hidden border-x-2 border-b-2 border-accent bg-modal shadow-[inset_0_1.4375rem_6.3125rem_var(--color-accent)]",
        className,
      )}
    >
      <ModalWatermark
        fill="var(--color-accent)"
        className="w-[70.5%] opacity-[0.14] blur-[0.390625rem]"
      />
      <ModalMetalHeaderBar />
      {children}
    </div>
  );
}
