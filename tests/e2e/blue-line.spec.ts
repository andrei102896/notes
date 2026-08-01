import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

import type { Page } from "@playwright/test";

/** The nav bar's bottom stack: 4px accent line, 3px white bar, blurred dark solid hugging it, all fading
 *  out before the first note. Painted pixels only — the defect it guards (the band's blur washing the line)
 *  is invisible to `getComputedStyle`, which reports a clean accent shadow either way. */
const ACCENT = [41, 171, 226];

const lum = ([r, g, b]: number[]) => 0.299 * r + 0.587 * g + 0.114 * b;

/** Decode a 1px-wide screenshot column into rgb triples, top to bottom. */
async function column(
  page: Page,
  clip: { x: number; y: number; height: number },
): Promise<number[][]> {
  const shot = await page.screenshot({ clip: { ...clip, width: 1 } });
  return page.evaluate(
    async (dataUrl) => {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, c.height).data;
      return Array.from({ length: c.height }, (_, y) => {
        const i = y * c.width * 4;
        return [px[i], px[i + 1], px[i + 2]];
      });
    },
    `data:image/png;base64,${shot.toString("base64")}`,
  );
}

test("the blue line reads as accent, white bar, then a shadow stuck to the bar", async ({
  overlay,
  page,
}, testInfo) => {
  // No note: a card here would put its own dark title row where the background reference is sampled.
  await createSubjectTab(overlay, "DESKS");
  await page.waitForTimeout(600);

  const header = await overlay.locator("header").boundingBox();
  if (!header) {
    throw new Error("header not measurable");
  }
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const rows = await column(page, {
    x: header.x + header.width * 0.35,
    y: header.y + header.height,
    height: 40,
  });
  const px = (cssPx: number) => rows[Math.round(cssPx * dpr)];

  // 1. The 4px line is the accent, end to end. The pre-fix wash (44,146,190) fails both channels; the one
  //    antialiased row where the line meets the white bar still passes.
  const lineRows = rows.slice(0, Math.round(4 * dpr));
  console.log(`line: ${lineRows.map((c) => c.join(",")).join(" | ")}`);
  for (const [i, c] of lineRows.entries()) {
    expect(
      c[2],
      `line row ${i} = ${c.join(",")}, blue washed (accent ${ACCENT[2]})`,
    ).toBeGreaterThanOrEqual(205);
    expect(
      c[1],
      `line row ${i} = ${c.join(",")}, green washed (accent ${ACCENT[1]})`,
    ).toBeGreaterThanOrEqual(155);
  }

  // 2. The 3px white bar under it.
  const barRows = rows.slice(Math.round(4 * dpr), Math.round(7 * dpr));
  const brightest = barRows.reduce(
    (b, c) => (lum(c) > lum(b) ? c : b),
    barRows[0],
  );
  console.log(`white bar: ${barRows.map((c) => c.join(",")).join(" | ")}`);
  expect(lum(brightest), "white bar under the line").toBeGreaterThan(240);

  // 3. The shadow is stuck to the bar: the row right below it is already dark, with no clean gap.
  const belowBar = px(7.2);
  const notesArea = rows[rows.length - 1];
  console.log(
    `below the bar ${belowBar.join(",")} (lum ${lum(belowBar).toFixed(0)}) vs notes area ${notesArea.join(",")} (lum ${lum(notesArea).toFixed(0)})`,
  );
  expect(
    lum(notesArea) - lum(belowBar),
    "shadow starts at the white bar, no clean gap between them",
  ).toBeGreaterThan(25);

  await page.screenshot({
    // Page-clipped: the line and both shadows paint OUTSIDE the header's box.
    path: testInfo.outputPath("blue-line.png"),
    clip: {
      x: header.x,
      y: header.y + header.height - 12,
      width: header.width,
      height: 40,
    },
  });
});

test("the shadow fades out before the first note and merges with its own", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "DESKS");
  await addNote(overlay, "SECRET LAB MAGNUS PRO $899 BLACK");
  await page.waitForTimeout(700);

  const header = await overlay.locator("header").boundingBox();
  const card = await overlay
    .locator('[data-slot="card"]')
    .first()
    .boundingBox();
  if (!header || !card) {
    throw new Error("header or card not measurable");
  }
  const edgeY = header.y + header.height;
  const gap = card.y - edgeY;
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  console.log(`gap between the header and the first note: ${gap.toFixed(1)}px`);

  // The notes list's top padding has to leave room for the 7px line+bar plus the blur.
  expect(gap, "room for the blue-line stack to fade out").toBeGreaterThan(15);

  const rows = await column(page, {
    x: card.x + card.width * 0.5,
    y: edgeY,
    height: gap + 6,
  });
  const inGap = rows.slice(
    Math.round(7.5 * dpr),
    Math.round((gap - 0.5) * dpr),
  );
  const onCard = rows.slice(Math.round(gap * dpr), Math.round((gap + 3) * dpr));
  const darkest = inGap.reduce((d, c) => (lum(c) < lum(d) ? c : d), inGap[0]);
  const cardEdge = onCard.reduce((b, c) => (c[2] > b[2] ? c : b), onCard[0]);
  console.log(
    `gap darkest ${darkest.join(",")} (lum ${lum(darkest).toFixed(0)}), card top border best ${cardEdge.join(",")} (accent blue ${ACCENT[2]})`,
  );

  // The shadow lives in the gap…
  expect(lum(darkest), "the shadow is present in the gap").toBeLessThan(180);
  // …and does NOT wash the note's accent border: a band reaching onto the card painted it 47,126,159.
  expect(
    cardEdge[2],
    `first note's top border is ${cardEdge.join(",")} — the header shadow is painting over it`,
  ).toBeGreaterThanOrEqual(205);

  await page.screenshot({
    path: testInfo.outputPath("header-to-note.png"),
    clip: { x: header.x, y: edgeY - 10, width: header.width, height: gap + 30 },
  });
});
