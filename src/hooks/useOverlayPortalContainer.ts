import { useMemo, useState } from "react";

/**
 * Portal target for Radix/shadcn dialogs inside the extension overlay.
 *
 * React runs in the content script realm where global `document` is the **host**
 * page. The dashboard UI lives in an iframe, so we must resolve
 * `#nn-scroll-bookmarks-overlay-host` via the overlay shell, not `document` alone.
 *
 * @see OVERLAY_SHELL_ID in content.ts
 */
const OVERLAY_SHELL_ID = "nn-scroll-bookmarks-overlay-shell";
const OVERLAY_HOST_ID = "nn-scroll-bookmarks-overlay-host";

function resolveOverlayPortalContainer(): HTMLElement | null {
  if (typeof document === "undefined") {
    return null;
  }
  const shell = document.getElementById(OVERLAY_SHELL_ID);
  const frame = shell?.querySelector("iframe");
  const doc = frame?.contentDocument;
  if (!doc) {
    return null;
  }
  return doc.getElementById(OVERLAY_HOST_ID) ?? doc.body;
}

export function useOverlayPortalContainer(): HTMLElement | null {
  const resolved = useMemo(() => resolveOverlayPortalContainer(), []);
  const [container] = useState(resolved);
  return container;
}
