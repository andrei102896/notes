import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/overlay/BrandLockup";

/** Modal header bar: NN brand lockup on the gray header band (Figma HEADER BOX); shared by the modal frame and the inline empty-state panel. */
export function ModalBrandBar(): React.ReactElement {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-x border-t border-accent bg-air-box px-2 py-1.5 shadow-[0px_4px_6.5px_rgba(0,0,0,0.25)]">
      <BrandLockup />
    </div>
  );
}

/** The two NN letterforms, dimmed and centered behind a modal/empty-state body (Figma: ~3% opacity). Parent must be `relative isolate overflow-hidden` so the -z-10 sits behind the content but above bg-modal. */
export function ModalWatermark({
  className,
}: {
  className?: string;
} = {}): React.ReactElement {
  return (
    <svg
      /* Figma "OLD LOGO REDO 4" watermark: the two N glyphs (N_LEFT 189w + N_RIGHT 191.19w from the client's export) INLINED — the app has no SVG-import pipeline (bundled asset URLs break in the host-origin iframe), so a glyph change is edited here. Laid side by side with the design's 3px gap → 383.19×120 box. Centered at ~71% of body width; opacity from the className (0.04 modals / 0.15 note) so the fills stay plain white. */
      viewBox="0 0 383.19 120"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 -z-10 h-auto w-[71%] -translate-x-1/2 -translate-y-1/2 opacity-[0.04]",
        className,
      )}
    >
      <path
        d="M72.3016 63.2665L45.3717 39.1977H44.3113V120H0V0H52.4405C78.1828 22.5 91.6828 34.6154 116.698 56.7335L143.628 80.8023H144.689V0H189V120H136.56L72.3016 63.2665Z"
        fill="white"
      />
      <path
        transform="translate(192 0)"
        d="M119.409 63.2665L148.301 39.1977H149.439V120H191.186V0H140.717C113.099 22.5 98.6153 34.6154 71.7768 56.7335L42.8844 80.8023H41.7468V0H-4.57764e-05V120H50.4683L119.409 63.2665Z"
        fill="white"
      />
    </svg>
  );
}

type NnModalFrameProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visually-hidden accessible title (Radix requires one). */
  title: string;
  /** Width utility for the panel (e.g. "w-80"). */
  widthClassName?: string;
  /** Extra classes for the modal body (e.g. padding overrides). */
  bodyClassName?: string;
  children: React.ReactNode;
};

/** Shared modal shell (Figma MODAL BG): 7px accent border, brand header, padded body; portaled into the overlay host, no close (X) — actions use CANCEL. */
export function NnModalFrame({
  open,
  onOpenChange,
  title,
  widthClassName,
  bodyClassName,
  children,
}: NnModalFrameProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          // Width = Figma MODAL BG 577px (36.0625rem), overriding DialogContent's max-w-lg (512px) so the 577×214 body keeps its ~2.7 aspect (else it reads too tall). The contained max-w-[calc] still caps it to the panel-safe width.
          "left-[calc(50%+var(--spacing)*10)] gap-0 border-0 bg-transparent p-0 shadow-none sm:max-w-[36.0625rem]",
          widthClassName,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        <ModalBrandBar />
        {/* No top border (header shadow separates it); 7px frame on sides + bottom only. isolate scopes the watermark's -z-10 behind the body content but above bg-modal. */}
        <div
          className={cn(
            "relative isolate flex min-h-[13.375rem] flex-col justify-center gap-4 overflow-hidden border-x-[7px] border-b-[7px] border-accent bg-modal px-6 py-5",
            bodyClassName,
          )}
        >
          <ModalWatermark />
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ModalButtonProps = {
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
};

// Fixed Figma box (≈109×39) + flex-centered label so CANCEL/OK sit centered on both axes; matches the Add-tab input box.
const MODAL_BUTTON_BASE =
  "inline-flex h-[2.46rem] min-w-[7rem] items-center justify-center border-[0.5px] border-white px-4 text-subject-label uppercase leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

/** CANCEL: white box, gray label (Figma CANCEL BOX). */
export function ModalCancelButton({
  onClick,
  children,
}: ModalButtonProps): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(MODAL_BUTTON_BASE, "bg-background text-modal-cancel")}
    >
      {children}
    </button>
  );
}

/** OK: blue box by default, red when destructive (Figma OK BOX), light text. */
export function ModalOkButton({
  onClick,
  children,
  disabled = false,
  destructive = false,
}: ModalButtonProps & { destructive?: boolean }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        MODAL_BUTTON_BASE,
        "text-modal-foreground",
        destructive
          ? "bg-modal-delete hover:bg-modal-delete/90"
          : "bg-accent hover:bg-accent/90",
      )}
    >
      {children}
    </button>
  );
}
