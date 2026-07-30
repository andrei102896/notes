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

const AIR_CELL_COUNT = 26;

/** One A–Z cell on the device grid; the raw `100vh / 26` is fractional and rasterizes its bottom border
 *  thicker than its top. Snap to DEVICE px — whole CSS px is 35 where dpr 2 needs 34.5, and regresses it. */
export function airCellPxForPanelHeight(
  panelHeight: number,
  dpr: number,
): number {
  return snapToDevicePx(panelHeight / AIR_CELL_COUNT, dpr);
}
