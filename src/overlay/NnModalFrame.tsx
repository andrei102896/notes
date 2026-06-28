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
      /* Figma "UI LOGO" watermark: the two wide N glyphs (N_LEFT / N_RIGHT assets) side by side with the design's gap → 401.78×99.21 box. Centered at ~71% of the body width (3% opacity) so it sits inset/padded behind the body — natural aspect, no stretch. */
      viewBox="0 0 401.78 99.21"
      fill="none"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        "pointer-events-none absolute top-1/2 left-1/2 -z-10 h-auto w-[71%] -translate-x-1/2 -translate-y-1/2 opacity-[0.03]",
        className,
      )}
    >
      <path
        d="M0 99.2019V0H36.0592L118.096 50.1897C137.097 61.8233 151.885 72.2619 164.044 82.4193L164.821 82.2787C161.773 69.0284 161.026 56.9554 161.026 41.5084V0H192.156V99.2019H158.756L77.4959 48.8541C59.6306 37.818 42.5719 26.4831 29.6659 15.7282L28.5307 15.8688C30.4128 28.3811 31.1895 40.2958 31.1895 56.7973V99.1843H0V99.2019Z"
        fill="white"
      />
      <path
        transform="translate(209.62 0)"
        d="M161.013 99.2019V56.8115C161.013 40.3302 161.765 28.4058 163.661 15.8877L162.517 15.7305C149.609 26.4853 132.517 37.8161 114.674 48.8502L33.4002 99.1845H0V0H31.1434V41.5C31.1434 56.9512 30.3911 69.0328 27.3219 82.2667L28.0742 82.4238C40.2306 72.2627 55.0351 61.8222 74.022 50.1946L156.078 0H192.156V99.2019H161.013Z"
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

const MODAL_BUTTON_BASE =
  "min-w-[7rem] border-[0.5px] border-white px-4 py-1 text-center text-subject-label uppercase leading-none transition-colors disabled:cursor-not-allowed disabled:opacity-50";

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
