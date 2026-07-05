import { expect, test } from "./fixtures";

/** The NN glyph must sit at the center of the *visible* dark box. That box is the .bg-logo-box span PLUS the row's 2px left border (no border on the right, where the blue bar begins), so centering the glyph in the span alone leaves it ~1px right of the box the eye sees. Geometric, not a screenshot: vector math, so it's stable across machines/DPR unlike the antialiasing-sensitive visual baselines. */
test.describe("brand mark centering", () => {
  test("NN glyphs are centered in the logo box", async ({ overlay }) => {
    const svg = overlay.locator("header .bg-logo-box svg").first();

    const { offset, gaps } = await svg.evaluate((el) => {
      const s = el as unknown as SVGSVGElement;
      const span = s.closest(".bg-logo-box") as HTMLElement;
      const spanR = span.getBoundingClientRect();
      const rowR = span.parentElement!.getBoundingClientRect(); // includes the 2px border
      const svgR = s.getBoundingClientRect();
      const vb = s.viewBox.baseVal;

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const p of Array.from(s.querySelectorAll("path"))) {
        const b = (p as SVGGraphicsElement).getBBox();
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
      // Glyph ink bounds (userspace) → client px through the svg's own rect + viewBox
      // (svgR already reflects the -1px translate, so no need to add it back).
      const cx = (u: number) => svgR.x + ((u - vb.x) / vb.width) * svgR.width;
      const cy = (u: number) => svgR.y + ((u - vb.y) / vb.height) * svgR.height;
      const ink = { left: cx(minX), right: cx(maxX), top: cy(minY), bottom: cy(maxY) };

      // Visible dark box: left/top/bottom from the bordered row, right where the span ends (blue begins).
      const box = { left: rowR.x, right: spanR.x + spanR.width, top: rowR.y, bottom: rowR.y + rowR.height };
      return {
        offset: {
          dx: (ink.left + ink.right) / 2 - (box.left + box.right) / 2,
          dy: (ink.top + ink.bottom) / 2 - (box.top + box.bottom) / 2,
        },
        gaps: {
          left: ink.left - box.left,
          right: box.right - ink.right,
          top: ink.top - box.top,
          bottom: box.bottom - ink.bottom,
        },
      };
    });

    // Tolerance separates centered (~0) from the pre-fix offsets (~1px horizontal, ~0.65px vertical).
    expect(Math.abs(offset.dx)).toBeLessThan(0.4);
    expect(Math.abs(offset.dy)).toBeLessThan(0.4);
    expect(Math.abs(gaps.left - gaps.right)).toBeLessThan(0.4);
    expect(Math.abs(gaps.top - gaps.bottom)).toBeLessThan(0.4);
  });

  // Uppercase caps with letter-spacing leave a trailing track after the last glyph; each line adds
  // pl = its tracking so the visible caps sit with equal gaps in their box. Guards those pl values.
  // Horizontal only — vertical cap centering is optical/font-metric-dependent and not asserted here.
  test("brand text lines have equal horizontal gaps in their boxes", async ({ overlay }) => {
    const gaps = await overlay.locator("header").evaluate((h) => {
      const measure = (span: HTMLElement) => {
        const box = span.parentElement!.getBoundingClientRect();
        const ls = parseFloat(getComputedStyle(span).letterSpacing) || 0;
        const range = document.createRange();
        range.selectNode(span.firstChild!);
        const r = range.getBoundingClientRect();
        return { left: r.left - box.left, right: box.right - (r.right - ls) }; // strip trailing track
      };
      const notes = h.querySelector("span.tracking-widest") as HTMLElement;
      const chrome = Array.from(h.querySelectorAll("span")).find((s) =>
        /chrome extension/i.test(s.textContent || ""),
      ) as HTMLElement;
      return { notes: measure(notes), chrome: measure(chrome) };
    });

    // Pre-fix "Notes for Net" (no pl) had ~1px gap asymmetry; ~0 once the trailing track is offset.
    expect(Math.abs(gaps.notes.left - gaps.notes.right)).toBeLessThan(0.4);
    expect(Math.abs(gaps.chrome.left - gaps.chrome.right)).toBeLessThan(0.4);
  });
});
