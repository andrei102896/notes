import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { NnLogoPlate } from "@/overlay/BrandLockup";
import { ModalBackdrop, ModalMetalBar } from "@/overlay/ModalBackdrop";

/** Dimmed NN letterforms behind a modal body. Parent MUST be `relative isolate overflow-hidden` or the
 *  -z-10 falls behind bg-modal instead of between it and the content. */
export function ModalWatermark({
  className,
  fill = "white",
}: {
  className?: string;
  fill?: string;
} = {}): React.ReactElement {
  return (
    <svg
      /* Figma "OLD LOGO REDO 4", inlined because bundled asset URLs break in the host-origin iframe — a
         glyph change is edited here. Opacity comes from the className so the fills stay plain white. */
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
        fill={fill}
      />
      <path
        transform="translate(192 0)"
        d="M119.409 63.2665L148.301 39.1977H149.439V120H191.186V0H140.717C113.099 22.5 98.6153 34.6154 71.7768 56.7335L42.8844 80.8023H41.7468V0H-4.57764e-05V120H50.4683L119.409 63.2665Z"
        fill={fill}
      />
    </svg>
  );
}

type NnModalShellProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visually-hidden accessible title (Radix requires one). */
  title: string;
  children: React.ReactNode;
  /** False when a full-panel backdrop is already on screen: a second one makes the box swap read as a reload. */
  showBackdrop?: boolean;
};

/** Wrapper for every small modal: the full-panel NN backdrop (Figma DASHBOARD MODAL BG) with the box
 *  centred over it. No close (X) by design — the client's modals dismiss through CANCEL. */
export function NnModalShell({
  open,
  onOpenChange,
  title,
  children,
  showBackdrop = true,
}: NnModalShellProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        showOverlay={showBackdrop}
        className="top-0 left-0 block h-full w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        {/* Dashboard plate, not the purchase one: this bar stands where the brand band was, so the logo
            design must not change when a modal opens. */}
        {showBackdrop ? (
          <ModalBackdrop
            header={
              <ModalMetalBar
                plate={<NnLogoPlate className="h-full w-full" />}
              />
            }
            showTagline={false}
          />
        ) : null}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
