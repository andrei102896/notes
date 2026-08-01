import { expect, test } from "./fixtures";
import { createSubjectTab } from "./helpers";

import type { FrameLocator, Locator, Page } from "@playwright/test";

/** Pins the metal bar's LOOK from the client's render, not their Figma CSS (copy-as-CSS drops strokes,
 *  blend modes and layer order): deep top line, capped sheen, monotonic fade, plate standing clear of the bands. */
const HILITE = [158, 226, 255];

const lum = ([r, g, b]: number[]) => 0.299 * r + 0.587 * g + 0.114 * b;
const dist = (a: number[], b: number[]) =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);

/** Decode a 1px-wide/tall screenshot strip into rgb triples, in the page (no node image deps). */
async function strip(
  page: Page,
  clip: { x: number; y: number; width: number; height: number },
  vertical: boolean,
): Promise<number[][]> {
  const shot = await page.screenshot({ clip });
  return page.evaluate(
    async ({ dataUrl, isVertical }) => {
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
      const n = isVertical ? c.height : c.width;
      const out: number[][] = [];
      for (let i = 0; i < n; i += 1) {
        const idx = isVertical ? i * c.width * 4 : i * 4;
        out.push([px[idx], px[idx + 1], px[idx + 2]]);
      }
      return out;
    },
    {
      dataUrl: `data:image/png;base64,${shot.toString("base64")}`,
      isVertical: vertical,
    },
  );
}

async function expectLayeredBar(
  page: Page,
  bar: Locator,
  label: string,
): Promise<void> {
  // boundingBox(), not getBoundingClientRect(): screenshot clips are in PAGE coordinates and these
  // elements live in the overlay iframe, so an in-frame rect samples the host page instead.
  const barBox = await bar.boundingBox();
  const plateBox = await bar.locator(":scope > [data-nn-plate]").boundingBox();
  if (!barBox || !plateBox) {
    throw new Error(`${label}: bar or plate not measurable`);
  }
  const geom = { bar: barBox, plate: plateBox };

  // 1–3: a column down the left band, clear of the plate.
  const bandX = geom.bar.x + (geom.plate.x - geom.bar.x) / 2;
  const col = await strip(
    page,
    { x: bandX, y: geom.bar.y, width: 1, height: geom.bar.height },
    true,
  );
  const at = (frac: number) =>
    col[Math.min(col.length - 1, Math.round(frac * (col.length - 1)))];
  const peakIndex = col.reduce(
    (best, c, i) => (lum(c) > lum(col[best]) ? i : best),
    0,
  );
  const peak = col[peakIndex];
  console.log(
    `${label}: band top ${col[0].join(",")} peak ${peak.join(",")} (lum ${lum(peak).toFixed(0)}) ` +
      `mid ${at(0.5).join(",")} bottom ${at(0.95).join(",")}`,
  );

  expect(
    lum(col[0]),
    `${label}: top edge is a deep line, not light`,
  ).toBeLessThan(120);
  // The sheen must not become the hilite: #9EE2FF is lum ~205 and is what a band painted UNDER it looks like.
  expect(
    dist(peak, HILITE),
    `${label}: band peak ${peak.join(",")} is washed to the hilite colour`,
  ).toBeGreaterThan(120);
  expect(
    lum(peak),
    `${label}: band never reaches hilite brightness`,
  ).toBeLessThan(175);
  // The sheen sits at the TOP of the bar (client CSS: 14px of 39 = the top 36%), not mid-bar.
  expect(
    peakIndex / (col.length - 1),
    `${label}: sheen peak is in the bar's top third (at ${((peakIndex / (col.length - 1)) * 100).toFixed(0)}%)`,
  ).toBeLessThan(0.45);
  // The sheen is still there — the band is not flat.
  expect(
    lum(peak) - lum(at(0.95)),
    `${label}: sheen at the top, shadow at the bottom`,
  ).toBeGreaterThan(15);
  // Monotonic-ish fade over the lower half (the inset shadow), no band or step.
  for (let f = 0.6; f <= 0.95; f += 0.05) {
    expect(
      lum(at(f)),
      `${label}: ${(f * 100).toFixed(0)}% down is not lighter than ${((f - 0.05) * 100).toFixed(0)}%`,
    ).toBeLessThan(lum(at(f - 0.05)) + 4);
  }

  // 4: a row across band → plate → band at the plate's middle.
  const row = await strip(
    page,
    {
      x: geom.bar.x,
      y: geom.plate.y + geom.plate.height / 2,
      width: geom.bar.width,
      height: 1,
    },
    false,
  );
  const scale = row.length / geom.bar.width;
  const px = (cssX: number) =>
    row[
      Math.min(
        row.length - 1,
        Math.max(0, Math.round((cssX - geom.bar.x) * scale)),
      )
    ];
  const plateMid = px(geom.plate.x + geom.plate.width / 2);
  const bandMid = px(geom.bar.x + (geom.plate.x - geom.bar.x) / 2);
  const seam = [1, 2, 3, 4].map((d) => px(geom.plate.x - d));
  const seamMin = seam.reduce(
    (best, c) => (lum(c) < lum(best) ? c : best),
    seam[0],
  );
  console.log(
    `${label}: plate ${plateMid.join(",")} (lum ${lum(plateMid).toFixed(0)}) vs band ${bandMid.join(",")} ` +
      `(lum ${lum(bandMid).toFixed(0)}), seam outside the plate ${seamMin.join(",")} (lum ${lum(seamMin).toFixed(0)})`,
  );

  expect(lum(plateMid), `${label}: plate interior is white`).toBeGreaterThan(
    225,
  );
  expect(
    lum(plateMid) / lum(bandMid),
    `${label}: the logo stands clear of the band beside it`,
  ).toBeGreaterThan(1.5);
  expect(
    lum(seamMin),
    `${label}: a darker seam separates the band from the plate`,
  ).toBeLessThan(lum(bandMid) - 10);
}

async function bars(
  overlay: FrameLocator,
): Promise<{ header: Locator; footer: Locator }> {
  const all = overlay.locator("[data-nn-metal-bar]");
  await expect(all).toHaveCount(2);
  return { header: all.nth(0), footer: all.nth(1) };
}

test("the dashboard band's flanking layers read as in the client's crop", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "ALPHA");
  await page.waitForTimeout(500);
  const { header } = await bars(overlay);
  await expectLayeredBar(page, header, "header band");
  await header.screenshot({ path: testInfo.outputPath("header-band.png") });
});

test("the footer bar reads the same as the header band", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "ALPHA");
  await page.waitForTimeout(500);
  const { footer } = await bars(overlay);
  await expectLayeredBar(page, footer, "footer bar");
  await footer.screenshot({ path: testInfo.outputPath("footer-bar.png") });
});
