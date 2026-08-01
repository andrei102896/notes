import React from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ModalBackdrop, ModalMetalBar } from "@/overlay/ModalBackdrop";

/** Figma TRIAL PERIOD BOX — shared with the BUY box, which the client outlines identically. */
const HEADER_BOX_CLASS =
  "flex items-center justify-center border-2 border-accent-deep bg-accent/60 shadow-[inset_0_0_0.45625rem_0.25rem_rgba(0,0,0,0.25)]";

export type PaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trialDaysLeft: number | null;
  trialUnit?: "days" | "minutes";
  onBuy: () => void;
};

/** Figma STATEMENT copy, verbatim from the client (Familjen Grotesk Regular 17/21 per their type panel). */
const STATEMENT_PARAGRAPHS = [
  "Clicking the buy button will take you to our payment and licensing manager, Extension Pay where you place your one time order.",
  "Once your order is placed you will be directed to Stripe Financial Services to enter in your payment details.",
  "Once payment is approved you will be given a confirmation of your purchase details.",
  "Your paid version of Notes For Net is ready to use immediately.",
];

export function PaywallDialog({
  open,
  onOpenChange,
  trialDaysLeft,
  trialUnit = "days",
  onBuy,
}: PaywallDialogProps): React.ReactElement {
  const trialLabel =
    trialDaysLeft !== null
      ? trialUnit === "minutes"
        ? `TRIAL PERIOD: ${trialDaysLeft}-MINUTE${trialDaysLeft === 1 ? "" : "S"} LEFT`
        : `TRIAL PERIOD: ${trialDaysLeft}-DAY${trialDaysLeft === 1 ? "" : "S"} LEFT`
      : "TRIAL ENDED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-0 left-0 block h-full w-full max-w-none translate-x-0 translate-y-0 gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-none"
      >
        <DialogTitle className="sr-only">
          Notes for Net trial status
        </DialogTitle>

        {/* The modal fills the panel, so Radix has no "outside" to close on: any click but BUY dismisses it. */}
        <div
          data-paywall-dismiss=""
          className="absolute inset-0"
          onClick={() => onOpenChange(false)}
        >
          <ModalBackdrop
            statement={
              <div
                data-paywall-statement=""
                className="flex flex-col gap-[0.8125rem] font-statement text-[1.0625rem] leading-[1.3125rem] text-white"
              >
                {STATEMENT_PARAGRAPHS.map((text) => (
                  <p key={text}>{text}</p>
                ))}
              </div>
            }
            header={
              <ModalMetalBar
                left={
                  <div
                    data-paywall-trial-box=""
                    className={`${HEADER_BOX_CLASS} h-[1.875rem] w-[11.52rem]`}
                  >
                    <span className="text-[1rem] uppercase leading-none text-white">
                      {trialLabel}
                    </span>
                  </div>
                }
                right={
                  <button
                    type="button"
                    aria-label="Buy now"
                    onClick={() => {
                      onBuy();
                      onOpenChange(false);
                    }}
                    className={`${HEADER_BOX_CLASS} h-[2rem] w-[5.4rem] cursor-pointer gap-1.5`}
                  >
                    <span className="text-[1.5rem] uppercase leading-none text-white">
                      BUY
                    </span>
                    <span className="flex items-start">
                      <span className="text-[0.875rem] leading-none text-white">
                        $
                      </span>
                      <span className="text-[1.5rem] leading-none text-white">
                        5
                      </span>
                    </span>
                  </button>
                }
              />
            }
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
