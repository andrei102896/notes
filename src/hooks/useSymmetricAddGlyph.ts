import { useCallback, useEffect, useRef } from "react";

/** Figma crop (181 of 255) — the share the glyph may never exceed. */
const GLYPH_SHARE = 0.71;

/**
 * Lays the "+" on the device grid so its accent gap is equal on each axis — left == right AND top == bottom.
 * The two axes still differ from each other, which the client accepts: the A–Z cell is not square.
 *
 * Flex centring splits the leftover in CSS px, and at fractional DPR (Windows at 125%) the rasteriser rounds
 * that split a whole device px onto one side — read by the client as "the + is half a pixel to the left".
 * Inert at integer DPR, so the Mac keeps the plain 71% rule in styles.css and renders unchanged.
 */
export function useSymmetricAddGlyph(): React.RefObject<SVGSVGElement | null> {
  const glyphRef = useRef<SVGSVGElement>(null);

  // Parent, not a second ref: shadcn's Button is a plain function component, so React 18 cannot forward one.
  const layOut = useCallback((): void => {
    const glyph = glyphRef.current;
    const box = glyph?.parentElement;
    if (!glyph || !box) {
      return;
    }
    const dpr = box.ownerDocument.defaultView?.devicePixelRatio ?? 1;
    // NOT Number.isInteger: Chrome reports 2.0000000298023224 for a plain 2x screen, so an exact test leaks
    // the correction onto displays that never needed it.
    if (Math.abs(dpr - Math.round(dpr)) < 1e-3) {
      glyph.removeAttribute("style");
      glyph.removeAttribute("preserveAspectRatio");
      return;
    }

    const rect = box.getBoundingClientRect();
    const cs = getComputedStyle(box);
    const left = rect.left + parseFloat(cs.borderLeftWidth);
    const top = rect.top + parseFloat(cs.borderTopWidth);
    const right = rect.right - parseFloat(cs.borderRightWidth);
    const bottom = rect.bottom - parseFloat(cs.borderBottomWidth);
    // The content box AS PAINTED, in whole device px — the only frame the eye reads (trap 13).
    const x0 = Math.round(left * dpr);
    const y0 = Math.round(top * dpr);
    const width = Math.round(right * dpr) - x0;
    const height = Math.round(bottom * dpr) - y0;
    if (width <= 0 || height <= 0) {
      return;
    }

    // One size for both axes, dropped a device px on whichever needs it: the leftover has to be EVEN to split
    // equally, and the two axes' parities need not agree. A 1-device-px difference is invisible on a plus.
    const base = Math.floor(GLYPH_SHARE * Math.min(width, height));
    const gapX = (width - ((width - base) % 2 === 0 ? base : base - 1)) / 2;
    const gapY = (height - ((height - base) % 2 === 0 ? base : base - 1)) / 2;

    // "none": the two axes can differ by a device px, and the default would letterbox instead of filling.
    glyph.setAttribute("preserveAspectRatio", "none");
    glyph.style.position = "absolute";
    glyph.style.left = `${(x0 + gapX) / dpr - left}px`;
    glyph.style.top = `${(y0 + gapY) / dpr - top}px`;
    glyph.style.width = `${(width - gapX * 2) / dpr}px`;
    glyph.style.height = `${(height - gapY * 2) / dpr}px`;
    glyph.style.maxHeight = "none";
  }, []);

  useEffect(() => {
    layOut();
    const box = glyphRef.current?.parentElement;
    const view = box?.ownerDocument.defaultView;
    const observer = box ? new ResizeObserver(layOut) : null;
    observer?.observe(box!);
    // The panel can move the button without resizing it, which shifts its sub-pixel origin.
    view?.addEventListener("resize", layOut);
    return () => {
      observer?.disconnect();
      view?.removeEventListener("resize", layOut);
    };
  }, [layOut]);

  return glyphRef;
}
