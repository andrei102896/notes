import React from "react";

import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";

function NNLogoForBanner(): React.ReactElement {
  return (
    <svg width="62" height="34" viewBox="0 0 62 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="62" height="34" fill="#5F5C5C"/>
      <path d="M50.9556 26.8984V19.0063C50.9556 15.9378 51.0422 13.7177 51.2604 11.3871L51.1288 11.3579C49.6431 13.3602 47.676 15.4697 45.6224 17.524L36.2684 26.8952H32.4243V8.4292H36.0087V16.1556C36.0087 19.0323 35.9221 21.2816 35.5689 23.7455L35.6554 23.7747C37.0545 21.8829 38.7584 19.9391 40.9437 17.7743L50.3877 8.4292H54.54V26.8984H50.9556Z" fill="white"/>
      <path d="M8.26172 26.8985V8.54956H12.4417L21.9515 17.8329C24.1541 19.9848 25.8684 21.9155 27.2779 23.7943L27.3679 23.7683C27.0147 21.3174 26.9281 19.0844 26.9281 16.2272V8.54956H30.5367V26.8985H26.6649L17.2451 17.5859C15.1742 15.5446 13.1967 13.448 11.7006 11.4587L11.569 11.4847C11.7872 13.7991 11.8772 16.0029 11.8772 19.0551V26.8953H8.26172V26.8985Z" fill="white"/>
    </svg>
  );
}

export type PaywallDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trialDaysLeft: number | null;
  trialUnit?: "days" | "minutes";
  onBuy: () => void;
};

export function PaywallDialog({
  open,
  onOpenChange,
  trialDaysLeft,
  trialUnit = "days",
  onBuy,
}: PaywallDialogProps): React.ReactElement {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="top-10 left-20 translate-x-0 translate-y-0 h-11 max-w-none sm:max-w-none w-[calc(100%-5rem)] p-0 rounded-none border-none flex flex-row items-center bg-[#D9D9D9] gap-0"
      >
        <div className="pl-2">
          <NNLogoForBanner />
        </div>
        <div className="flex flex-1 items-center justify-between px-4">
          <span className="text-2xl uppercase leading-none text-[#6C6C6C]">
            N O T E S &nbsp; F O R &nbsp; N E T
          </span>
          <span className="text-base uppercase leading-none text-[#646464]">
            {trialDaysLeft !== null
              ? trialUnit === "minutes"
                ? `TRIAL PERIOD: ${trialDaysLeft}-MINUTE${trialDaysLeft === 1 ? "" : "S"} LEFT`
                : `TRIAL PERIOD: ${trialDaysLeft}-DAY${trialDaysLeft === 1 ? "" : "S"} LEFT`
              : "TRIAL ENDED"}
          </span>
        </div>
        <button
          className="flex h-full w-13.5 cursor-pointer items-center justify-center bg-[#FF0404]"
          onClick={() => {
            onBuy();
            onOpenChange(false);
          }}
          aria-label="Buy now"
          type="button"
        >
          <span className="text-2xl uppercase leading-none text-white">BUY</span>
        </button>
      </DialogContent>
    </Dialog>
  );
}
