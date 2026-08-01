import { expect, test } from "./fixtures";
import { createSubjectTab } from "./helpers";

import type { Page } from "@playwright/test";

/** Own file: subject-tab-sizing.spec.ts is already over the 300-LOC house cap (AGENTS §9). */

/** Panel width rides the viewport continuously, and the glyph is a PERCENTAGE of a content box that is
 *  fractional at most of them — so one width proves nothing. These bracket real laptop windows. */
const WIDTHS = [1180, 1280, 1360, 1400, 1440, 1460, 1480, 1520];

type Run = { kind: "W" | "B" | "?"; n: number };

/** Run-length encode a 1px screenshot row into white / accent / blend, left to right. */
function encode(px: number[], width: number): Run[] {
  const kindAt = (x: number): Run["kind"] => {
    const [r, g, b] = [px[x * 4], px[x * 4 + 1], px[x * 4 + 2]];
    if (r > 235 && g > 235 && b > 235) return "W";
    if (b > 150 && g > 110 && r < 130) return "B";
    return "?";
  };
  const runs: Run[] = [];
  for (let x = 0; x < width; x += 1) {
    const kind = kindAt(x);
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) {
      last.n += 1;
    } else {
      runs.push({ kind, n: 1 });
    }
  }
  return runs;
}

/** The accent gap either side of the glyph, in DEVICE px — what the eye reads, and the only frame that
 *  sees this: getBoundingClientRect reports the same 3.52/3.54 at every dpr, before and after the bug. */
async function glyphGaps(
  page: Page,
  box: { x: number; y: number; width: number; height: number },
): Promise<{ left: number; right: number; row: string }> {
  const PAD = 10;
  const shot = await page.screenshot({
    clip: {
      x: box.x - PAD,
      y: box.y + box.height / 2,
      width: box.width + PAD * 2,
      height: 1,
    },
  });
  const decoded = await page.evaluate(async (dataUrl) => {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    return {
      width: canvas.width,
      data: Array.from(ctx.getImageData(0, 0, canvas.width, 1).data),
    };
  }, `data:image/png;base64,${shot.toString("base64")}`);

  const runs = encode(decoded.data, decoded.width);
  // The glyph is the widest white run in the row; the border runs either side of it are narrower.
  let glyph = -1;
  runs.forEach((run, i) => {
    if (run.kind === "W" && (glyph < 0 || run.n > runs[glyph].n)) {
      glyph = i;
    }
  });
  const nearestAccent = (from: number, step: number): number => {
    for (let i = from; i >= 0 && i < runs.length; i += step) {
      if (runs[i].kind === "B") {
        return runs[i].n;
      }
    }
    throw new Error("no accent gap beside the glyph");
  };
  return {
    left: nearestAccent(glyph - 1, -1),
    right: nearestAccent(glyph + 1, 1),
    row: runs.map((r) => `${r.kind}${r.n}`).join(" "),
  };
}

/** The client reads a 1-device-px bias as "the + is half a pixel to the left" (2026-08-01, Windows at 125%,
 *  where 1 device px = 0.8 css px). The suite missed it by asserting at ONE viewport: 1400 is one of the few
 *  widths where the remainder happens to split evenly. Measured before the fix: 14 of 18 widths off. */
test("the + glyph is optically centred at every panel width", async ({
  overlay,
  page,
}) => {
  await createSubjectTab(overlay, "ALPHA");
  const plus = overlay.locator(
    '[aria-label="Subject tabs"] [aria-label="Add subject tab"]',
  );

  const offCentre: string[] = [];
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    // The panel re-measures on a visualViewport resize; let it settle before reading pixels.
    await page.waitForTimeout(350);

    const box = await plus.boundingBox();
    if (!box) {
      throw new Error(`+ not measurable at ${width}`);
    }
    const { left, right, row } = await glyphGaps(page, box);
    const boxWidth = await plus.evaluate(
      (el) => el.getBoundingClientRect().width,
    );
    const note =
      `vw ${width}: box ${boxWidth.toFixed(3)} css, accent gap ` +
      `${left}/${right} device px (delta ${left - right}) — ${row}`;
    console.log(note);
    if (left !== right) {
      offCentre.push(note);
    }
  }

  expect(
    offCentre,
    `the + glyph is off-centre at ${offCentre.length}/${WIDTHS.length} widths:\n${offCentre.join("\n")}`,
  ).toEqual([]);
});
