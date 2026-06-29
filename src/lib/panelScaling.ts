/** Panel sizing calibration (one source of truth): at REFERENCE_VIEWPORT_PX renders 1:1; width scales proportionally and iframe root font-size is the single knob the rem-based UI rides. */
export const REFERENCE_PANEL_WIDTH_PX = 686;
export const REFERENCE_VIEWPORT_PX = 1920;
export const PANEL_MIN_WIDTH_PX = 480;
export const PANEL_MAX_WIDTH_PX = 860;
export const BASE_ROOT_FONT_PX = 16;

/** Snap to whole device pixels so the iframe layer lands on the physical grid; at fractional DPR (Windows 125% = 1.25) a sub-pixel edge rasterizes the whole overlay blurry. */
export function snapToDevicePx(px: number, dpr: number): number {
  return Math.round(px * dpr) / dpr;
}

export function clampPanelWidth(viewportWidth: number): number {
  const proportionalWidth =
    viewportWidth * (REFERENCE_PANEL_WIDTH_PX / REFERENCE_VIEWPORT_PX);
  return Math.min(
    Math.max(proportionalWidth, PANEL_MIN_WIDTH_PX),
    PANEL_MAX_WIDTH_PX,
  );
}

export function rootFontPxForPanelWidth(panelWidth: number): number {
  return (panelWidth / REFERENCE_PANEL_WIDTH_PX) * BASE_ROOT_FONT_PX;
}
