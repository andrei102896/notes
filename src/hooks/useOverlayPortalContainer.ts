import { useMemo, useState } from "react";

/** Dialog portal target: React's `document` is the host page, so resolve the overlay host via the iframe shell, not `document` (see OVERLAY_SHELL_ID in content.ts). */
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
