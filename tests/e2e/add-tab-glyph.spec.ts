import { expect, test } from "./fixtures";
import { createSubjectTab } from "./helpers";

import type { Page } from "@playwright/test";

/** Own file: subject-tab-sizing.spec.ts is already over the 300-LOC house cap (AGENTS §9). */

/** Panel width rides the viewport continuously, and the glyph is a PERCENTAGE of a content box that is
 *  fractional at most of them — so one width proves nothing. These bracket real laptop windows. */
const WIDTHS = [1180, 1280, 1360, 1400, 1440, 1460, 1480, 1520];

type Run = { kind: "W" | "B" | "?"; n: number };

/** Run-length encode a 1px strip of pixels into white / accent / blend. */
function encode(px: number[], from: number, to: number): Run[] {
  const kindAt = (i: number): Run["kind"] => {
    const [r, g, b] = [px[i * 4], px[i * 4 + 1], px[i * 4 + 2]];
    if (r > 235 && g > 235 && b > 235) return "W";
    if (b > 150 && g > 110 && r < 130) return "B";
    return "?";
  };
  const runs: Run[] = [];
  for (let i = from; i < to; i += 1) {
    const kind = kindAt(i);
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) {
      last.n += 1;
    } else {
      runs.push({ kind, n: 1 });
    }
  }
  return runs;
}

/** Accent gap either side of the glyph's ink. The glyph is the widest white run; the border runs flanking
 *  the box are narrower. Returns device px — the only frame that sees this defect. */
function gaps(runs: Run[]): { near: number; far: number; row: string } {
  let glyph = -1;
  runs.forEach((run, i) => {
    if (run.kind === "W" && (glyph < 0 || run.n > runs[glyph].n)) {
      glyph = i;
    }
  });
  const accent = (from: number, step: number): number => {
    for (let i = from; i >= 0 && i < runs.length; i += step) {
      if (runs[i].kind === "B") {
        return runs[i].n;
      }
    }
    throw new Error("no accent gap beside the glyph");
  };
  return {
    near: accent(glyph - 1, -1),
    far: accent(glyph + 1, 1),
    row: runs.map((r) => `${r.kind}${r.n}`).join(" "),
  };
}

/** Decode a 1px-wide/tall screenshot into pixels. Clip origin is clamped: the strip "+" sits at y = 0, and a
 *  negative origin makes Playwright drop rows unevenly rather than error (trap 21). */
async function scan(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  vertical: boolean,
): Promise<number[]> {
  const shot = await page.screenshot({ clip });
  return page.evaluate(
    async ({ dataUrl, isVertical }) => {
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
      const count = isVertical ? canvas.height : canvas.width;
      // Flatten to one line of rgba so both axes share the same run encoder.
      const out: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const at = isVertical ? i * canvas.width * 4 : i * 4;
        out.push(data[at], data[at + 1], data[at + 2], data[at + 3]);
      }
      return out;
    },
    { dataUrl: `data:image/png;base64,${shot.toString("base64")}`, isVertical: vertical },
  );
}

/** Client rule (2026-08-01, Windows at 125%): the "+" must sit the same distance from the blue box's edge on
 *  each axis — left == right AND top == bottom. The two axes need NOT equal each other; the A–Z cell is not
 *  square and that difference is accepted. The old check missed this by asserting getBoundingClientRect
 *  (3.52/3.54 at every dpr, off or not) at a single viewport — 1400, one of the few widths that splits evenly. */
test("the + glyph sits symmetrically on both axes at every panel width", async ({
  overlay,
  page,
}) => {
  await createSubjectTab(overlay, "ALPHA");
  const plus = overlay.locator(
    '[aria-label="Subject tabs"] [aria-label="Add subject tab"]',
  );
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const PAD = 10;
  const offCentre: string[] = [];

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    // The panel re-measures on a visualViewport resize; let it settle before reading pixels.
    await page.waitForTimeout(350);

    const box = await plus.boundingBox();
    if (!box) {
      throw new Error(`+ not measurable at ${width}`);
    }

    const rowPx = await scan(
      page,
      {
        x: box.x - PAD,
        y: box.y + box.height / 2,
        width: box.width + PAD * 2,
        height: 1,
      },
      false,
    );
    const row = gaps(
      encode(rowPx, Math.round(PAD * dpr), Math.round((PAD + box.width) * dpr)),
    );

    const top = Math.max(0, box.y - PAD);
    const colPx = await scan(
      page,
      {
        x: box.x + box.width / 2,
        y: top,
        width: 1,
        height: box.y + box.height + PAD - top,
      },
      true,
    );
    const col = gaps(
      encode(
        colPx,
        Math.round((box.y - top) * dpr),
        Math.round((box.y - top + box.height) * dpr),
      ),
    );

    const note =
      `vw ${width}: sides ${row.near}/${row.far} (delta ${row.near - row.far}), ` +
      `top-bottom ${col.near}/${col.far} (delta ${col.near - col.far}) device px`;
    console.log(`${note}\n    row: ${row.row}\n    col: ${col.row}`);
    if (row.near !== row.far) {
      offCentre.push(`${note}  <-- HORIZONTAL`);
    }
    if (col.near !== col.far) {
      offCentre.push(`${note}  <-- VERTICAL`);
    }
  }

  expect(
    offCentre,
    `the + glyph is off-centre at ${offCentre.length} of ${WIDTHS.length * 2} axis checks:\n${offCentre.join("\n")}`,
  ).toEqual([]);
});
