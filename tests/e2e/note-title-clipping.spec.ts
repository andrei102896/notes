import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

import type { Locator, Page } from "@playwright/test";

/** Client 2026-08-02: the note header's title input was cut off top AND bottom. Cause was `.nn-cap-trim`
 *  (`text-box: trim-both cap alphabetic`) on the `<input>`: it shrinks the inner editor's line box to the cap
 *  band, and an input clips that editor (`overflow: clip`), so the caps' tops and every descender were
 *  cropped. Two traps this spec encodes:
 *  - Padding does NOT restore the cropped ink, and the clip is at the TRIMMED box, not the input's own box —
 *    so a gap check against the input's border box passes while the defect is plainly visible.
 *  - "The top edge is abrupt" is NOT a usable clipping signal: whether the cap top gets an antialiased row
 *    depends on where it lands on the device grid, so a clean edge reads as a cut at some panel widths.
 *  What is phase-independent: total ink height (the cap band alone is ~0.83em; caps+descenders ~1.07em) and
 *  the presence of ink below the baseline. */

/** Caps for the band, `p`/`y` for descenders, a digit for good measure. */
const SAMPLE = "Rapty S398";

/** Panel width rides the viewport, so the input's box height is fractional at most of them. */
const WIDTHS = [1180, 1280, 1400, 1460, 1520];

/** Caps + descenders span ~1.07em in Fjalla; the cap band alone is 0.83em. Anything under this means the
 *  glyphs are being confined to the band — i.e. clipped. */
const MIN_INK_EM = 0.95;

/** Chrome centres a single-line input's editor from FONT METRICS (line-height and padding cannot tune it in
 *  sub-pixel steps — both were measured as no-ops/overshoots), so the cap band sits up to ~1 CSS px high at
 *  some panel widths. Measured 0–2 device px after the fix; this guard only has to catch a gross regression. */
const MAX_CENTRE_DELTA = 4;

type Profile = {
  height: number;
  capTop: number;
  baseline: number;
  inkTop: number;
  inkBottom: number;
  fontPx: number;
};

/** Ink per device-pixel row inside the input: white glyphs on #666, nothing else in frame. */
async function rowProfile(page: Page, input: Locator): Promise<Profile> {
  const fontPx = await input.evaluate((el) =>
    parseFloat(getComputedStyle(el).fontSize),
  );
  const shot = await input.screenshot();
  const measured = await page.evaluate(
    async ({ dataUrl }) => {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const rows: number[] = [];
      for (let y = 0; y < canvas.height; y += 1) {
        let n = 0;
        for (let x = 0; x < canvas.width; x += 1) {
          if (data[(y * canvas.width + x) * 4] > 200) n += 1;
        }
        rows.push(n);
      }
      // Cap-band rows carry an order of magnitude more mass than the descender tail.
      const heavy = rows.map((n, y) => (n > 30 ? y : -1)).filter((y) => y >= 0);
      const any = rows.map((n, y) => (n > 3 ? y : -1)).filter((y) => y >= 0);
      if (heavy.length === 0 || any.length === 0) {
        throw new Error("no title ink inside the input");
      }
      return {
        height: canvas.height,
        capTop: heavy[0],
        baseline: heavy[heavy.length - 1],
        inkTop: any[0],
        inkBottom: any[any.length - 1],
      };
    },
    { dataUrl: `data:image/png;base64,${shot.toString("base64")}` },
  );
  return { ...measured, fontPx };
}

test("the note title paints its descenders and neither edge is clipped", async ({
  overlay,
  page,
}) => {
  await createSubjectTab(overlay, "ALPHA");
  await addNote(overlay, SAMPLE);
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const failures: string[] = [];

  for (const state of ["expanded", "collapsed"] as const) {
    if (state === "collapsed") {
      await overlay
        .getByRole("button", { name: "Collapse note" })
        .first()
        .click();
      await expect(
        overlay.getByRole("button", { name: "Expand note" }).first(),
      ).toBeVisible();
    }
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      // The panel re-measures on a visualViewport resize; let the root font settle.
      await page.waitForTimeout(350);
      const p = await rowProfile(
        page,
        overlay.locator("[data-note-title]").first(),
      );

      const inkEm = (p.inkBottom - p.inkTop + 1) / (p.fontPx * dpr);
      const descenderRows = p.inkBottom - p.baseline;
      const capGapTop = p.capTop;
      const capGapBottom = p.height - 1 - p.baseline;
      const note =
        `${state} @${width}: box ${p.height} rows, cap band ${p.capTop}..${p.baseline} ` +
        `(gaps ${capGapTop}/${capGapBottom}, delta ${capGapTop - capGapBottom}), ` +
        `descender rows ${descenderRows}, ink ${inkEm.toFixed(2)}em`;
      console.log(note);

      if (inkEm < MIN_INK_EM) {
        failures.push(`${note}  <-- INK CONFINED TO THE CAP BAND (clipped)`);
      }
      if (descenderRows < 3) {
        failures.push(`${note}  <-- DESCENDERS CLIPPED`);
      }
      if (Math.abs(capGapTop - capGapBottom) > MAX_CENTRE_DELTA) {
        failures.push(`${note}  <-- CAP BAND GROSSLY OFF-CENTRE`);
      }
    }
  }

  expect(
    failures,
    `${failures.length} note-title failure(s):\n${failures.join("\n")}`,
  ).toEqual([]);
});
