import React from "react";

import { IS_WINDOWS } from "@/lib/platform";

/** Brand-cluster NN mark (white NN) — NOT the off-limits payment logo. */
export function BrandLogo(): React.ReactElement {
  return (
    <svg
      viewBox="0 0 63 30"
      className="h-5 w-auto shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M35.5083 4.92908V12.1556C35.5083 15.0218 35.4221 17.2442 35.0737 19.6742L35.0151 20.0863L35.4087 20.2191L35.4956 20.2484L35.8403 20.3646L36.0571 20.0717C37.2652 18.4381 38.7074 16.7609 40.5034 14.9261L41.2954 14.1293L50.5933 4.92908H54.0396V22.3978H51.4556V15.0062C51.4556 11.9485 51.542 9.74468 51.7583 7.43396L51.7993 6.99451L50.9204 6.79919L50.7271 7.05994C49.2637 9.03214 47.3176 11.121 45.269 13.1703H45.2681L36.061 22.3949H32.9243V4.92908H35.5083Z"
        fill="white"
      />
      <path
        d="M12.2393 5.04956L21.6025 14.1912V14.1902C23.7909 16.3281 25.4869 18.2403 26.8779 20.0945L27.085 20.3708L27.417 20.2751L27.5068 20.2488L27.9248 20.1277L27.8633 19.697C27.5149 17.2801 27.4277 15.0739 27.4277 12.2273V5.04956H30.0371V22.3982H26.8701L17.5967 13.2302H17.5957C15.5302 11.1943 13.5743 9.1175 12.1006 7.15796L11.9111 6.90698L11.6035 6.96851L11.4717 6.9939L11.0293 7.08179L11.0713 7.53198C11.2876 9.82672 11.377 12.0146 11.377 15.0554V22.3953H8.76172V5.04956H12.2393Z"
        fill="white"
      />
    </svg>
  );
}

/** Brand cluster shared by the header top row and modal header bar; renders only the cluster, each caller wraps it in its own bar. */
export function BrandLockup(): React.ReactElement {
  return (
    <>
      <div className="flex items-stretch border-2 border-mn-stroke bg-accent">
        <span className="flex items-center bg-logo-box [&_path]:stroke-white [&_path]:[stroke-linejoin:round] [&_path]:[stroke-width:1px]">
          <BrandLogo />
        </span>
        <div className="flex items-center justify-center px-2">
          {/* pt is a layout offset (not relative-top) so caps stay crisp at fractional DPR; 0.22em ≈ the prior ~0.11em downward optical nudge. Windows-only 1px bottom pad offsets DirectWrite's heavier vertical metrics. */}
          <span
            className="pt-[0.22em] font-ui text-brand-title font-bold uppercase leading-none tracking-widest text-accent-foreground"
            style={{ paddingBottom: IS_WINDOWS ? "1px" : undefined }}
          >
            Notes for Net
          </span>
        </div>
      </div>
      <div
        className="flex items-center justify-center bg-chrome-ext px-1 py-1"
        style={{ paddingTop: IS_WINDOWS ? "5px" : "4px" }}
      >
        <span className="font-ui text-brand-sub font-semibold uppercase leading-none tracking-wide text-accent-foreground">
          Chrome Extension
        </span>
      </div>
    </>
  );
}
