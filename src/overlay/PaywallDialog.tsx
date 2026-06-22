import React from "react";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { BrandLockup } from "@/overlay/BrandLockup";

export type PaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trialDaysLeft: number | null;
  trialUnit?: "days" | "minutes";
  onBuy: () => void;
  onLogin: () => void;
};

export function PaywallDialog({
  open,
  onOpenChange,
  trialDaysLeft,
  trialUnit = "days",
  onBuy,
  onLogin,
}: PaywallDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-[4.25rem] right-0 left-0 h-[2.3125rem] w-auto max-w-none translate-x-0 translate-y-0 flex flex-row items-stretch gap-0 overflow-hidden rounded-none border-none bg-[#d9d9d9] p-0 sm:max-w-none"
      >
        <DialogTitle className="sr-only">Notes for Net trial status</DialogTitle>

        {/* Same brand header used everywhere else in the app. */}
        <div className="flex shrink-0 items-center gap-2 pl-2">
          <BrandLockup />
        </div>

        <div className="flex flex-1 items-center justify-end px-4">
          <span className="text-[1rem] uppercase leading-none text-[#646464]">
            {trialDaysLeft !== null
              ? trialUnit === "minutes"
                ? `TRIAL PERIOD: ${trialDaysLeft}-MINUTE${trialDaysLeft === 1 ? "" : "S"} LEFT`
                : `TRIAL PERIOD: ${trialDaysLeft}-DAY${trialDaysLeft === 1 ? "" : "S"} LEFT`
              : "TRIAL ENDED"}
          </span>
        </div>

        {/* Restore a prior purchase on a fresh install — opens the ExtPay login page. */}
        <button
          className="flex h-full shrink-0 cursor-pointer items-center justify-center px-3"
          onClick={() => {
            onLogin();
            onOpenChange(false);
          }}
          aria-label="Log in to restore purchase"
          type="button"
        >
          <span className="text-[1rem] uppercase leading-none text-[#646464] underline">
            Log in
          </span>
        </button>

        {/* BUY — full-height accent button. Functionality unchanged. */}
        <button
          className="flex h-full shrink-0 cursor-pointer items-center justify-center bg-accent px-3.5"
          onClick={() => {
            onBuy();
            onOpenChange(false);
          }}
          aria-label="Buy now"
          type="button"
        >
          <span className="text-[1.625rem] uppercase leading-none text-white">
            BUY
          </span>
        </button>

        <div className="flex h-full shrink-0 items-center justify-center pr-3 pl-2">
          <span className="text-[1.5rem] uppercase leading-none text-[#585858]">
            $5
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
