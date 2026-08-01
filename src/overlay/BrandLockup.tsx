import React from "react";

import { cn } from "@/lib/utils";

/** Plate box ratio for the dashboard band, the footer and the modal backdrops. Must stay in step with
 *  NN_PLATE_CLASS below — Tailwind's scanner cannot read a template literal, so the class is a literal. */
export const NN_PLATE_ASPECT = 3.1;

/** Vertical squeeze on the plate glyphs: undoes part of the preserveAspectRatio="none" stretch. Deliberately
 *  NOT counter-scaled horizontally — the client's comps keep the NN at 52.5% of the plate; wider reads bulky. */
export const PLATE_GLYPH_SQUEEZE_Y = 0.895;

/** Fat NN mark (Figma "NN FAT LOGO"). The N's are nudged ±0.5u apart (viewBox widened to 47) or the
 *  shared 1px stroke closes the gap; width stays pinned to 2.625rem so the badge footprint never grows. */
export function BrandLogoFat({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="-0.5 0 47 17"
      className={cn("h-auto w-[2.625rem] shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        transform="translate(0.5 0)"
        d="M37.1427 8.96275L40.4417 5.55301H40.5716V17H46V0H39.5758C36.4222 3.1875 34.7684 4.90385 31.7038 8.03725L28.4048 11.447H28.2749V0H22.8465V17H29.2707L37.1427 8.96275Z"
        fill="white"
      />
      <path
        transform="translate(-0.5 0)"
        d="M8.19581 8.96275L4.89675 5.55301H4.76685V17H0V0H5.76272C8.91628 3.1875 10.5701 4.90385 13.6347 8.03725L16.9337 11.447H17.0636V0H21.8305V17H16.0678L8.19581 8.96275Z"
        fill="white"
      />
    </svg>
  );
}

/** NN plate (Figma LOGO BOX / LOGO ALL, 120×29) for the header band and every modal bar. Inlined
 *  because bundled asset URLs break in the host-origin iframe. */
export function NnLogoPlate({
  className,
}: {
  className?: string;
} = {}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 120 29"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-auto shrink-0", className)}
    >
      <g filter="url(#filter0_d_718_11)">
        <g filter="url(#filter1_i_718_11)">
          <rect width="120" height="29" fill="white" />
        </g>
        {/* Rim lives in MetalBarPlate as a CSS-border overlay — an svg stroke rescaled with the artwork and landed sub-pixel. */}
        <g
          transform={`translate(0 14.5) scale(1 ${PLATE_GLYPH_SQUEEZE_Y}) translate(0 -14.66)`}
        >
          <path
            d="M82.7412 6.65039L82.6113 6.74219C78.6338 9.5556 76.5451 11.072 72.6836 13.835L72.6816 13.8369L69.1514 16.3896V6.65039H61.3066V22.6504H70.0664L70.1973 22.5566L80.123 15.4658L80.125 15.4639L83.6553 12.9102V22.6504H91.5V6.65039H82.7412Z"
            fill="#0D7DAD"
            stroke="black"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d="M36.4248 6.65039L36.5547 6.74219C40.5323 9.55562 42.6208 11.0719 46.4824 13.835L46.4844 13.8369L50.0146 16.3896V6.65039H57.0254V22.6504H49.0986L48.9688 22.5566L39.043 15.4658L39.041 15.4639L35.5107 12.9102V22.6504H28.5V6.65039H36.4248Z"
            fill="#0D7DAD"
            stroke="black"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </g>
      <defs>
        <filter
          id="filter0_d_718_11"
          x="0"
          y="0"
          width="120"
          height="29"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feOffset />
          <feComposite in2="hardAlpha" operator="out" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0.83 0"
          />
          <feBlend
            mode="normal"
            in2="BackgroundImageFix"
            result="effect1_dropShadow_718_11"
          />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="effect1_dropShadow_718_11"
            result="shape"
          />
        </filter>
        <filter
          id="filter1_i_718_11"
          x="0"
          y="0"
          width="120"
          height="29"
          filterUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend
            mode="normal"
            in="SourceGraphic"
            in2="BackgroundImageFix"
            result="shape"
          />
          <feColorMatrix
            in="SourceAlpha"
            type="matrix"
            values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0"
            result="hardAlpha"
          />
          <feMorphology
            radius="3"
            operator="erode"
            in="SourceAlpha"
            result="effect1_innerShadow_718_11"
          />
          <feOffset />
          <feGaussianBlur stdDeviation="5" />
          <feComposite in2="hardAlpha" operator="arithmetic" k2="-1" k3="1" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.160784 0 0 0 0 0.670588 0 0 0 0 0.886275 0 0 0 1 0"
          />
          <feBlend
            mode="normal"
            in2="shape"
            result="effect1_innerShadow_718_11"
          />
        </filter>
      </defs>
    </svg>
  );
}

/** Plate slot: full bar height, 3.5:1 per the client render — the raw asset is 4.14:1, hence
 *  preserveAspectRatio="none". max-w stops a tall window's plate from crowding the flanking boxes. */
const METAL_BAR_PLATE_CLASS = "relative h-full aspect-[3.5] max-w-[40%]";

/** Dashboard band, footer and modal-backdrop plate: flush to the bar, narrower than the modals' 3.5:1 —
 *  the client anchors its width to the ADD NOTE button below. Literal, and NN_PLATE_ASPECT must match. */
export const NN_PLATE_CLASS = "aspect-[3.1]";

/** The rim is a CSS-border overlay, not an svg stroke, so changing its thickness never rescales the
 *  NN artwork. */
export function MetalBarPlate({
  className,
  rimClassName,
  children,
}: {
  className?: string;
  rimClassName?: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div data-nn-plate="" className={cn(METAL_BAR_PLATE_CLASS, className)}>
      {children}
      {/* ONE border carrying the whole ramp: the hilite has to FADE through the rim, and a clipped second
          border stepped between two flat colours. border-color is the no-border-image fallback. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 border-[3px] border-accent-deep [border-image:linear-gradient(to_bottom,#9EE2FF_0%,#7DD3F7_15%,#3EA8D8_38%,#0081B8_58%,#14709A_80%,#0B5B80_100%)_1]",
          rimClassName,
        )}
      />
    </div>
  );
}

/** Flanking bands (Figma UPDATE____HEADER BOX LEFT/RIGHT), shared with `ModalMetalBar`. `relative` is
 *  load-bearing: a static band paints under the absolutely-positioned hilite and washes out to near-white. */
export const HEADER_BOX_CLASS =
  "relative h-full flex-1 border-[0.5px] border-accent-deep bg-accent/[0.86] shadow-[inset_0_-1.125rem_0.7rem_0.1875rem_rgba(0,0,0,0.28)]";

/** Blue metal bar (Figma TOP METAL BAR DB), shared by the dashboard brand band, the footer and the
 *  small-modal header — each passes its own height and rim thickness. */
export function BrandMetalHeaderBar({
  className,
  plateClassName,
  rimClassName,
}: {
  className?: string;
  plateClassName?: string;
  rimClassName?: string;
} = {}): React.ReactElement {
  return (
    <div
      data-nn-metal-bar=""
      className={cn(
        /* w-full: a caller's items-center (the name modal) would otherwise shrink the bar to the plate's width. */
        "relative flex w-full shrink-0 items-center bg-accent shadow-[inset_0_-1.125rem_0.7rem_0.1875rem_rgba(0,0,0,0.45)]",
        className,
      )}
    >
      {/* WHITE HILITE ON TOP BAR (Figma 606×14 = the bar's full width, 36% of its height). Kept UNDER the
          plate and the bands — through their 0.86 alpha it reads as a soft sheen, not a white wash. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[36%] bg-accent-hilite blur-[0.184375rem]"
      />
      <div className={HEADER_BOX_CLASS} />
      <MetalBarPlate className={plateClassName} rimClassName={rimClassName}>
        <NnLogoPlate className="h-full w-full" />
      </MetalBarPlate>
      <div className={HEADER_BOX_CLASS} />
    </div>
  );
}
