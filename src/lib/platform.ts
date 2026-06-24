const uaData = (navigator as Navigator & { userAgentData?: { platform?: string } })
  .userAgentData;

/** True on Windows; gate OS-specific optical tweaks here (DirectWrite renders text wider than macOS CoreText). */
export const IS_WINDOWS = /win/i.test(
  uaData?.platform || navigator.platform || navigator.userAgent,
);
