/** Radix's a11y check reads the host doc, not our iframe dialogs — filter only those two false-positive messages. */
export function suppressRadixCrossRealmDialogWarnings(): void {
  const SUPPRESS_FLAG = "__nnRadixDialogWarningsSuppressed";
  const flags = window as unknown as Record<string, boolean>;
  if (flags[SUPPRESS_FLAG]) {
    return;
  }
  flags[SUPPRESS_FLAG] = true;

  const FALSE_POSITIVES = [
    "`DialogContent` requires a `DialogTitle`",
    "Missing `Description` or `aria-describedby={undefined}`",
  ];
  const isRadixFalsePositive = (args: unknown[]): boolean =>
    typeof args[0] === "string" &&
    FALSE_POSITIVES.some((message) => (args[0] as string).includes(message));

  const originalError = console.error;
  console.error = (...args: unknown[]): void => {
    if (isRadixFalsePositive(args)) {
      return;
    }
    originalError(...args);
  };

  const originalWarn = console.warn;
  console.warn = (...args: unknown[]): void => {
    if (isRadixFalsePositive(args)) {
      return;
    }
    originalWarn(...args);
  };
}

/** Dev-only: CRXJS HMR client floods orphaned content scripts with harmless "Extension context invalidated"; swallow only that message. */
export function suppressExtensionContextInvalidatedDevErrors(): void {
  const matches = (text: unknown): boolean =>
    typeof text === "string" && text.includes("Extension context invalidated");

  window.addEventListener(
    "error",
    (event) => {
      const errorMessage =
        event.error instanceof Error ? event.error.message : undefined;
      if (matches(event.message) || matches(errorMessage)) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    },
    true,
  );

  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    const message = reason instanceof Error ? reason.message : reason;
    if (matches(message)) {
      event.preventDefault();
    }
  });
}
