import React from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/overlay/BrandLockup";

/**
 * Modal header bar: the NN brand lockup on the gray header band (Figma HEADER BOX —
 * #686868 / --color-air-box, drop shadow). Shared by the modal frame and the inline
 * empty-state panel so both match the dashboard's top header.
 */
export function ModalBrandBar(): React.ReactElement {
  return (
    <div className="flex shrink-0 items-center justify-center gap-2 border-x border-t border-accent bg-air-box px-2 py-1.5 shadow-[0px_4px_6.5px_rgba(0,0,0,0.25)]">
      <BrandLockup />
    </div>
  );
}

type NnModalFrameProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Visually-hidden accessible title (Radix requires one). */
  title: string;
  /** Width utility for the panel (e.g. "w-80"). */
  widthClassName?: string;
  children: React.ReactNode;
};

/**
 * Shared modal shell (Figma MODAL BG): dark #3C3C3C panel, 7px accent border, NN brand
 * header bar, then a padded body. Reuses the base Dialog primitive; non-modal + portaled
 * into the overlay host like the dialogs it replaces. No close (X) — actions use CANCEL.
 */
export function NnModalFrame({
  open,
  onOpenChange,
  title,
  widthClassName,
  children,
}: NnModalFrameProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "left-[calc(50%+var(--spacing)*10)] gap-0 border-0 bg-transparent p-0 shadow-none",
          widthClassName,
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
        <ModalBrandBar />
        {/* No border under the header (its shadow separates it); thick 7px frame on the
            content's sides + bottom only. */}
        <div className="flex flex-col gap-4 border-x-[7px] border-b-[7px] border-accent bg-modal px-6 py-5">
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
