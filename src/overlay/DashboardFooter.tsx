import React from "react";

/** Blue "metal" footer bar (Figma BTTM METAL BAR DB) with the copyright line; symmetric with the header. */
export function DashboardFooter(): React.ReactElement {
  return (
    <footer className="nn-metal-bar flex h-[var(--air-cell)] shrink-0 items-center justify-center">
      <span className="font-ui text-brand-sub font-bold uppercase tracking-[0.25em] text-accent-foreground">
        © 2026 Notes for Net
      </span>
    </footer>
  );
}
