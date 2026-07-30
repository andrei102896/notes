import { OVERLAY_SHELL_ID } from "@/content/constants";
import {
  airCellPxForPanelHeight,
  clampPanelWidth,
  rootFontPxForPanelWidth,
  snapToDevicePx,
} from "@/lib/panelScaling";

let overlayViewportListenersAttached = false;

export function syncOverlayViewportMetrics(shell: HTMLElement): void {
  const viewport = window.visualViewport;
  const top = Math.max(0, viewport?.offsetTop ?? 0);
  const height = viewport?.height ?? window.innerHeight;
  const viewportWidth = viewport?.width ?? window.innerWidth;

  const clampedWidth = clampPanelWidth(viewportWidth);
  const dpr = window.devicePixelRatio || 1;

  // Never exceed the viewport; scale font-size from the applied width so width and font stay locked even when a clamp binds.
  const panelWidth = snapToDevicePx(Math.min(clampedWidth, viewportWidth), dpr);
  const rootFontPx = rootFontPxForPanelWidth(panelWidth);

  const panelHeight = snapToDevicePx(height, dpr);

  shell.style.top = `${snapToDevicePx(top, dpr)}px`;
  shell.style.height = `${panelHeight}px`;
  shell.style.width = `${panelWidth}px`;

  // Measured host scrollbar width: panel hugs the right edge, so the UI insets by this (+2px margin) to clear it; 0 for overlay scrollbars.
  const scrollbarPx = Math.max(
    0,
    window.innerWidth - document.documentElement.clientWidth,
  );
  const scrollbarGutter = scrollbarPx > 0 ? `${scrollbarPx + 2}px` : "0px";

  // Null-guard: the first call runs before the iframe is appended/mounted.
  const iframeDoc = shell.querySelector("iframe")?.contentDocument;
  if (iframeDoc) {
    iframeDoc.documentElement.style.fontSize = `${rootFontPx}px`;
    iframeDoc.documentElement.style.setProperty(
      "--nn-scrollbar-gutter",
      scrollbarGutter,
    );
    iframeDoc.documentElement.style.setProperty(
      "--air-cell-snapped",
      `${airCellPxForPanelHeight(panelHeight, dpr)}px`,
    );
  }
}

export function attachOverlayViewportListeners(): void {
  if (overlayViewportListenersAttached) {
    return;
  }

  const updateMetrics = (): void => {
    const shell = document.getElementById(OVERLAY_SHELL_ID);
    if (!(shell instanceof HTMLDivElement)) {
      return;
    }
    syncOverlayViewportMetrics(shell);
  };

  window.addEventListener("resize", updateMetrics);
  window.visualViewport?.addEventListener("resize", updateMetrics);
  window.visualViewport?.addEventListener("scroll", updateMetrics);
  overlayViewportListenersAttached = true;
}
