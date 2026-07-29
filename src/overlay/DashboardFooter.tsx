import React from "react";

import {
  BrandMetalHeaderBar,
  NN_PLATE_CLASS,
} from "@/overlay/BrandLockup";

/** Bottom metal bar (Figma BTTM METAL BAR DB) — deliberately identical to the header band: same bar,
 *  same plate, same 5px rim. */
export function DashboardFooter(): React.ReactElement {
  return (
    <footer className="shrink-0">
      <BrandMetalHeaderBar
        className="h-[var(--air-cell)]"
        plateClassName={NN_PLATE_CLASS}
        rimClassName="border-[5px]"
      />
    </footer>
  );
}
