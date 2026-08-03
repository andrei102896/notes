import React from "react";

import { cn } from "@/lib/utils";

/** Figma "BG_NOTE_01" watermark, from the client's own `N.svg` + `N (1).svg` exports (2026-08-02): two
 *  glyphs of UNEQUAL width — 160×100 and 170×100 — in #E4E8E9 at their exported half opacity, which on the
 *  #D9D9D9 body is 6 levels of contrast: barely a shade, and that is the point ("they are not that evident,
 *  see the shade of them barely"). The 10-unit channel between them is the client's floor, and their frame
 *  is 1:1 with these units (mark 340 wide in a 543.52 note interior), so 10 units IS their 10px.
 *  Deliberately not `ModalWatermark`: that artwork ("OLD LOGO REDO 4") is a different export, 3.19:1 against
 *  this one's 3.40:1, and belongs to the modal boxes. */
export function NoteWatermark({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 340 100"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 -z-10 h-auto -translate-x-1/2 -translate-y-1/2",
        className,
      )}
    >
      <path
        d="M60.0688 52.7221L35.8893 32.6648H34.9372V100H0V0H42.2361C65.3493 18.75 77.4705 28.8462 99.9312 47.2779L124.111 67.3352H125.063V0H160V100H117.764L60.0688 52.7221Z"
        fill="#E4E8E9"
        fillOpacity="0.5"
      />
      <path
        transform="translate(170 0)"
        d="M104.78 52.7221L128.96 32.6648H129.912V100H169.697V0H122.613C99.4995 18.75 87.3783 28.8462 64.9176 47.2779L40.738 67.3352H39.786V0H0.000305176V100H47.0849L104.78 52.7221Z"
        fill="#E4E8E9"
        fillOpacity="0.5"
      />
    </svg>
  );
}
