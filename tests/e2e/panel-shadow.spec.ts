import { expect, test } from "./fixtures";

/** Host page background (fixtures.ts) — the shadow must read darker than this. */
const PAGE_BG = 0xe8;

/** Client "SHADOW UNDER AI BOXES". Measured in painted host-page pixels: getComputedStyle reports a
 *  box-shadow that is entirely clipped just as happily as one that renders. */
test("the panel casts a shadow down its left edge onto the page", async ({
  overlay,
  page,
}, testInfo) => {
  // The slide-in must finish or the edge is still moving.
  await page.waitForTimeout(600);
  await expect(overlay.locator("header")).toBeVisible();

  const shell = await page
    .locator("#nn-scroll-bookmarks-overlay-shell")
    .boundingBox();
  if (!shell) {
    throw new Error("overlay shell not measurable");
  }

  const REACH = 90;
  const row = await page.screenshot({
    clip: {
      x: shell.x - REACH,
      y: shell.y + shell.height / 2,
      width: REACH,
      height: 1,
    },
  });

  // Canvas-decode in the page: a hand-rolled PNG reader gets the row filters wrong.
  const scan = await page.evaluate(
    async (dataUrl) => {
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
      const px = ctx.getImageData(0, 0, canvas.width, 1).data;
      // Left → right = away from the panel → towards it. Reverse so index 0 abuts the edge.
      const luma: number[] = [];
      for (let x = canvas.width - 1; x >= 0; x -= 1) {
        luma.push(px[x * 4]);
      }
      return { luma, devicePx: canvas.width };
    },
    `data:image/png;base64,${row.toString("base64")}`,
  );

  const perCssPx = scan.devicePx / REACH;
  const at = (cssPx: number) => scan.luma[Math.round(cssPx * perCssPx)];
  console.log(
    `luma away from the panel edge: 0px ${at(0)}, 10px ${at(10)}, 25px ${at(25)}, 45px ${at(45)}, 85px ${at(85)} (page bg ${PAGE_BG})`,
  );

  // Darkest right at the edge, and clearly darker than the page.
  expect(at(0), "shadow at the panel edge").toBeLessThan(PAGE_BG - 30);
  // A wide, soft fade — still visibly shadowed well out from the edge, clean by 85px.
  expect(at(25), "25px out still carries the shadow").toBeLessThan(PAGE_BG - 8);
  expect(at(25), "25px out is lighter than the edge").toBeGreaterThan(at(0));
  expect(at(85), "85px out is back to the page background").toBeGreaterThan(
    PAGE_BG - 6,
  );
  // Monotonic fade — no band, no step.
  for (let d = 2; d <= 60; d += 2) {
    expect(at(d), `${d}px out is not darker than ${d - 2}px`).toBeGreaterThan(
      at(d - 2) - 2,
    );
  }

  // Same shadow at the top and bottom of the edge, not just mid-panel.
  for (const [label, y] of [
    ["top", shell.y + 8],
    ["bottom", shell.y + shell.height - 9],
  ] as const) {
    const strip = await page.screenshot({
      clip: { x: shell.x - 6, y, width: 5, height: 1 },
    });
    const dark = await page.evaluate(
      async (dataUrl) => {
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
        const px = ctx.getImageData(0, 0, canvas.width, 1).data;
        return px[(canvas.width - 1) * 4];
      },
      `data:image/png;base64,${strip.toString("base64")}`,
    );
    console.log(`${label} of the edge: luma ${dark}`);
    expect(dark, `shadow present at the ${label} of the edge`).toBeLessThan(
      PAGE_BG - 30,
    );
  }

  await page.screenshot({
    path: testInfo.outputPath("panel-left-shadow.png"),
    clip: {
      x: shell.x - 60,
      y: shell.y,
      width: 90,
      height: Math.min(shell.height, 520),
    },
  });
});
