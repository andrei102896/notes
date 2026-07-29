import { useEffect, useState, type RefObject } from "react";

/** Placeholder until the label is measured, NOT a minimum: tab length is purely label-driven. */
const DEFAULT_SPAN = 3;

function sameSpans(
  a: Record<string, number>,
  b: Record<string, number>,
): boolean {
  const aKeys = Object.keys(a);
  return (
    aKeys.length === Object.keys(b).length &&
    aKeys.every((key) => a[key] === b[key])
  );
}

/** One context per document: measure() is a ResizeObserver callback, so allocating a canvas there means
 *  one per frame while the window is dragged. */
const measureContexts = new WeakMap<Document, CanvasRenderingContext2D>();

function measureContextFor(doc: Document): CanvasRenderingContext2D | null {
  const cached = measureContexts.get(doc);
  if (cached) {
    return cached;
  }
  const ctx = doc.createElement("canvas").getContext("2d");
  if (ctx) {
    measureContexts.set(doc, ctx);
  }
  return ctx;
}

/** Probes --air-cell rather than re-deriving 100vh/26, so the formula lives in one place. */
function measureCellPx(container: HTMLElement): number {
  const probe = container.ownerDocument.createElement("div");
  probe.style.cssText =
    "position:absolute;visibility:hidden;width:0;height:var(--air-cell)";
  container.appendChild(probe);
  const cellPx = probe.getBoundingClientRect().height;
  probe.remove();
  return cellPx;
}

/**
 * Subject-tab length in whole A–Z cells: the label's rendered width plus one
 * character of padding each side, rounded up so tab edges stay on the A–Z grid.
 */
export function useSubjectTabCellSpans(
  names: string[],
  containerRef: RefObject<HTMLElement | null>,
): Record<string, number> {
  const [spans, setSpans] = useState<Record<string, number>>({});
  // Names are joined so the effect re-runs on rename/add/delete but not on every render.
  const namesKey = names.join("\u0000");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let cancelled = false;
    let fontRetried = false;

    const measure = (): void => {
      if (cancelled) {
        return;
      }
      const cellPx = measureCellPx(container);
      const trigger = container.querySelector<HTMLElement>(
        '[data-slot="tabs-trigger"]',
      );
      // Canvas MUST come from the container's document: this hook runs in the content-script realm, whose
      // document has no Fjalla One, so a top-document canvas silently measures with fallback metrics.
      const ctx = measureContextFor(container.ownerDocument);
      if (!cellPx || !trigger || !ctx) {
        return;
      }
      const cs = getComputedStyle(trigger);
      // First family only: fonts.check() returns true for any list holding an always-available generic,
      // which would mask an unloaded Fjalla.
      const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily.split(",")[0]}`;
      const fonts = container.ownerDocument.fonts;
      if (fonts && !fonts.check(font) && !fontRetried) {
        // Fallback metrics are much wider and would overshoot every span. Retried once only: load()
        // resolves with an empty face list for a font that will never arrive, which would loop forever.
        fontRetried = true;
        void fonts.load(font).then(measure, () => {});
        return;
      }
      ctx.font = font;
      const padding = ctx.measureText("0").width * 2;
      const next: Record<string, number> = {};
      for (const name of namesKey ? namesKey.split("\u0000") : []) {
        const needed = ctx.measureText(name).width + padding;
        next[name] = Math.ceil(needed / cellPx);
      }
      setSpans((prev) => (sameSpans(prev, next) ? prev : next));
    };

    measure();
    // Panel resize changes both the root font (text width) and --air-cell.
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => {
      // A pending fonts.load() outlives the observer, so flag it rather than only disconnecting.
      cancelled = true;
      observer.disconnect();
    };
  }, [namesKey, containerRef]);

  return spans;
}

export { DEFAULT_SPAN as SUBJECT_TAB_DEFAULT_SPAN };
