import React from "react";

import { GHOST_NN_PNG } from "@/assets/ghostNnPng";
import { cn } from "@/lib/utils";
import {
  HEADER_BOX_CLASS,
  MetalBarPlate,
  NN_PLATE_CLASS,
  PLATE_GLYPH_SQUEEZE_Y,
} from "@/overlay/BrandLockup";

/** This svg's viewBox is 31 units tall where NnLogoPlate's is 29, so the same numeric squeeze would render
 *  its NN 6% shorter. Scaled by 31/29 the ink comes out the same height — the client requires the purchase
 *  plate to match the dashboard's size AND proportions. */
const MODAL_GLYPH_SQUEEZE_Y = (PLATE_GLYPH_SQUEEZE_Y * 31) / 29;

/** Ghost NN watermark (Figma OLD LOGO REDO 4): the client PNG export — blur and layer compositing already baked in, which the SVG export dropped. */
function GhostLogo({ className }: { className?: string }): React.ReactElement {
  return (
    <img
      src={GHOST_NN_PNG}
      alt=""
      aria-hidden
      data-modal-ghost=""
      className={cn("pointer-events-none h-auto select-none", className)}
    />
  );
}

/** White logo plate with blue N glyphs + inset glow (Figma LOGO + BOX), inlined — bundled asset URLs break in the host-origin iframe. */
export function ModalLogoBox({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <svg
      viewBox="0 0 121 31"
      preserveAspectRatio="none"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-auto shrink-0", className)}
    >
      <g filter="url(#filter0_i_643_385)">
        <rect width="120.523" height="31" fill="white" />
      </g>
      {/* Rim lives in MetalBarPlate as a CSS-border overlay — an svg stroke rescaled with the artwork and landed sub-pixel. */}
      {/* Same 10.5% vertical compression as NnLogoPlate — see there. */}
      <g
        transform={`translate(0 15.5) scale(1 ${MODAL_GLYPH_SQUEEZE_Y}) translate(0 -15.65)`}
      >
        <path
          d="M83.3682 7.65039L83.2393 7.74121C81.236 9.1479 79.7082 10.2305 78.1953 11.3066L73.2383 14.834L73.2363 14.8359L69.6729 17.3945V7.65039H61.7793V23.6504H70.5977L70.7275 23.5576L80.7256 16.4668L80.7275 16.4648L84.291 13.9053V23.6504H92.1855V7.65039H83.3682Z"
          fill="#0D7DAD"
          stroke="#0081B8"
          vectorEffect="non-scaling-stroke"
        />
        <path
          d="M36.5137 7.65039L36.6426 7.74121C40.6492 10.5546 42.7528 12.071 46.6426 14.834L46.6445 14.8359L50.208 17.3945V7.65039H57.2627V23.6504H49.2842L49.1543 23.5576L39.1562 16.4668L39.1533 16.4648V16.4639L35.5908 13.9053V23.6504H28.5361V7.65039H36.5137Z"
          fill="#0D7DAD"
          stroke="#0081B8"
          vectorEffect="non-scaling-stroke"
        />
      </g>
      <defs>
        <filter
          id="filter0_i_643_385"
          x="0"
          y="0"
          width="120.523"
          height="31"
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
            result="effect1_innerShadow_643_385"
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
            result="effect1_innerShadow_643_385"
          />
        </filter>
      </defs>
    </svg>
  );
}

/** The shared flanking band (Figma UPDATE HEADER BOX LEFT/RIGHT) plus the layout this bar's left/right
 *  slots need. One source, so the edge cannot go missing on one bar again. */
const HEADER_BAND_CLASS = `flex items-center ${HEADER_BOX_CLASS}`;

/** Blue metal top bar (Figma TOP METAL BAR DB); `left`/`right` fill the flanking bands, both empty on
 *  the dashboard variant. */
export function ModalMetalBar({
  left,
  right,
  plate,
}: {
  left?: React.ReactNode;
  right?: React.ReactNode;
  /** Plate artwork. Defaults to the purchase export; the small modals pass the dashboard one, since the
   *  bar replaces the dashboard band on screen and must not swap the logo design under the user. */
  plate?: React.ReactNode;
} = {}): React.ReactElement {
  return (
    <div
      data-nn-metal-bar=""
      /* No border-t: nothing may sit between the plate and the top edge. The +1px offsets the border-b so
         the content height matches the dashboard band and the h-full plate comes out the header's size. */
      className="relative flex h-[calc(var(--air-cell)+1px)] shrink-0 items-center border-x border-b border-accent-deep bg-accent shadow-[inset_0_-1.125rem_0.7rem_0.1875rem_rgba(0,0,0,0.45)]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-1 top-px h-[40%] bg-accent-hilite blur-[0.184375rem]"
      />
      <div className={cn(HEADER_BAND_CLASS, "justify-center")}>{left}</div>
      {/* Client rule: this plate is the dashboard band's plate size, whichever artwork it carries. */}
      <MetalBarPlate className={NN_PLATE_CLASS} rimClassName="border-[5px]">
        {plate ?? <ModalLogoBox className="h-full w-full" />}
      </MetalBarPlate>
      <div className={cn(HEADER_BAND_CLASS, "justify-end pr-[1.5rem]")}>
        {right}
      </div>
    </div>
  );
}

/** Tagline words; white ones alternate against accent per the design screenshot. */
const TAGLINE_WORDS: Array<{ word: string; white: boolean }> = [
  { word: "YOUR", white: false },
  { word: "FAST", white: true },
  { word: "AND", white: false },
  { word: "PRECISE", white: true },
  { word: "WEBPAGE", white: false },
  { word: "BOOKMARKING", white: true },
  { word: "AND", white: false },
  { word: "NOTATION", white: true },
  { word: "TOOL.", white: false },
];

/** Two-tone NOTESFORNET (Figma). */
function BrandWordmark({
  className,
}: {
  className?: string;
}): React.ReactElement {
  return (
    <div
      className={cn(
        "text-[4rem] leading-[5rem] whitespace-nowrap opacity-45",
        className,
      )}
    >
      <span className="text-accent">NOTES</span>
      <span className="text-white">FOR</span>
      <span className="text-accent">NET</span>
    </div>
  );
}

function Tagline({ className }: { className?: string }): React.ReactElement {
  return (
    <p
      className={cn(
        "text-center text-[2.5rem] leading-[3.125rem] opacity-[0.64]",
        className,
      )}
    >
      {TAGLINE_WORDS.map(({ word, white }, i) => (
        <span key={i} className={white ? "text-white" : "text-accent"}>
          {i > 0 ? " " : ""}
          {word}
        </span>
      ))}
    </p>
  );
}

type ModalBackdropProps = {
  /** Top bar content (purchase: trial box + logo + buy; dashboard: logo only). */
  header: React.ReactNode;
  showTagline?: boolean;
  /** Figma STATEMENT + BOX — the purchase modal's payment explainer, pinned to the top of the inner frame. */
  statement?: React.ReactNode;
};

/** Full-panel opaque modal background (Figma BUY MODAL ALL); fills its nearest positioned ancestor. */
export function ModalBackdrop({
  header,
  showTagline = true,
  statement,
}: ModalBackdropProps): React.ReactElement {
  // No border-t: the metal bar IS the top edge, so the plate touches the panel's true top. Same rule as
  // the header band and NnModalBox — overflow-hidden here would clip a negative-margin overlap instead.
  return (
    <div className="absolute inset-0 overflow-hidden border-x-2 border-b-2 border-accent bg-[#333333]">
      {/* BG SQUARES: 3×5 grid, right column thin-bordered, middle row darker (Figma GRAY OUT BUY SCREEN).
          The centring wrapper is load-bearing: `absolute left-1/2` alone shrink-to-fits the grid to half the
          panel and overlaps the columns into one vertical smear. */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center"
      >
        <div className="grid grid-cols-3 gap-x-[3.075rem] gap-y-[3.3125rem] opacity-65 blur-[1.6375rem]">
          {Array.from({ length: 15 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "h-[7.9375rem] w-[9.6669rem] border-accent-deep opacity-90 blur-[1.05625rem]",
                i % 3 === 2 ? "border-[0.125rem]" : "border-[2.5rem]",
                Math.floor(i / 3) === 2
                  ? "bg-[rgba(20,144,196,0.73)]"
                  : "bg-[rgba(41,171,226,0.73)]",
              )}
            />
          ))}
        </div>
      </div>

      <div className="relative flex h-full flex-col">
        {header}

        {/* Inner accent frame (Figma TOP BLUE OUT BUY SCREEN, inner). */}
        <div className="relative mx-[0.5625rem] mt-[0.5625rem] mb-[0.5625rem] flex-1 border border-accent-deep bg-accent/[0.07] backdrop-blur-[0.925rem]">
          {/* STATEMENT BOX BG (Figma): the frame's full width, 219px tall, rgba(41,171,226,0.1) behind a
              0.3px accent hairline. Height in rem so it scales with the text it holds. */}
          {statement ? (
            /* items-center: the box height is fixed, so a top-aligned stack dumps all the slack at the
               bottom. Centring keeps the gaps equal whatever the text does. */
            <div className="absolute inset-x-0 top-[9%] flex h-[13.6875rem] items-center border-[0.3px] border-accent bg-accent/10 px-2 py-[0.9375rem]">
              {statement}
            </div>
          ) : null}
          {statement ? (
            /* With the statement box the design decouples the ghost from the wordmark — the grouped layout
               below cannot express that, its texts being pinned to percentages OF the ghost box. */
            <>
              <GhostLogo className="absolute top-[1%] left-1/2 w-[74%] -translate-x-1/2" />
              <BrandWordmark className="absolute top-[41%] left-1/2 -translate-x-1/2 -translate-y-1/2" />
              {showTagline ? (
                <Tagline className="absolute top-[53%] left-1/2 w-[82%] -translate-x-1/2 -translate-y-1/2" />
              ) : null}
            </>
          ) : (
            /* Ghost box drives the layout — both texts sit at a measured % of it, so the Figma spacing
               holds at any panel size. The group is intentionally high: midpoint at 32% of the frame. */
            <div className="absolute top-[32%] left-1/2 w-[74%] -translate-x-1/2 -translate-y-[75%]">
              <GhostLogo className="w-full" />
              <BrandWordmark className="absolute top-[67%] left-1/2 -translate-x-1/2 -translate-y-1/2" />
              {showTagline ? (
                <Tagline className="absolute top-[113%] left-1/2 w-[110%] -translate-x-1/2 -translate-y-1/2" />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
