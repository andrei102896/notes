import { expect, test, toggleOverlay } from "./fixtures";

import type { BrowserContext, FrameLocator, Page } from "@playwright/test";

/** Purchase modal: the STATEMENT box and the BG SQUARES behind it. Own spec — `paywall.spec.ts` is at the
 *  300-line cap. */
async function openPaywall(
  context: BrowserContext,
  page: Page,
): Promise<FrameLocator> {
  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  }
  // Stamped from the WORKER's clock: the page clock is frozen in the past, so elapsed goes negative.
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      nn_trial_started_at: Date.now() - 60_000,
      nn_trial_banner_open: true,
    });
  });
  await page.reload({ waitUntil: "load" });
  await toggleOverlay(context, page);
  const overlay = page.frameLocator(
    "#nn-scroll-bookmarks-overlay-shell iframe",
  );
  await expect(overlay.locator('[data-slot="dialog-content"]')).toBeVisible({
    timeout: 15_000,
  });
  await page.waitForTimeout(800);
  return overlay;
}

test("the purchase modal carries the client's statement box", async ({
  context,
  page,
}, testInfo) => {
  const overlay = await openPaywall(context, page);
  const dialog = overlay.locator('[data-slot="dialog-content"]');
  const statement = overlay.locator("[data-paywall-statement]");
  await expect(statement).toBeVisible();

  // All four of the client's paragraphs, in order.
  const paragraphs = await statement.locator("p").allInnerTexts();
  expect(paragraphs).toHaveLength(4);
  expect(paragraphs[0]).toContain("payment and licensing manager");
  expect(paragraphs[1]).toContain("Stripe Financial Services");
  expect(paragraphs[2]).toContain("confirmation of your purchase");
  expect(paragraphs[3]).toContain("ready to use immediately");

  const spec = await statement.evaluate((el) => {
    const box = el.parentElement!;
    const frame = box.parentElement!;
    const cs = getComputedStyle(box);
    const textCs = getComputedStyle(el.querySelector("p")!);
    const root = parseFloat(
      getComputedStyle(el.ownerDocument.documentElement).fontSize,
    );
    const b = box.getBoundingClientRect();
    const f = frame.getBoundingClientRect();
    return {
      // Figma: 665×219 against a 665-wide frame — full width, height as a root-font share.
      widthShare: b.width / f.width,
      heightRem: b.height / root,
      topShareOfFrame: (b.top - f.top) / f.height,
      bg: cs.backgroundColor,
      border: `${cs.borderTopWidth} ${cs.borderTopColor}`,
      fontFamily: textCs.fontFamily.split(",")[0],
      fontSizeRem: parseFloat(textCs.fontSize) / root,
      lineHeightRem: parseFloat(textCs.lineHeight) / root,
    };
  });
  console.log("statement box:", JSON.stringify(spec));

  expect(spec.widthShare, "spans the inner frame").toBeGreaterThan(0.98);
  // 219px at the 16px reference root = 13.6875rem.
  expect(spec.heightRem).toBeCloseTo(13.6875, 2);
  expect(spec.topShareOfFrame, "sits in the frame's top area").toBeLessThan(
    0.15,
  );
  // Tailwind v4 renders `/10` through oklab, so match the alpha rather than an rgba() string.
  expect(spec.bg, "accent at 10%").toMatch(/\/\s*0\.1\)$/);
  // The client's 0.3px hairline: Chrome reports 0.5px, its floor for a visible border at dpr 2.
  expect(parseFloat(spec.border)).toBeLessThanOrEqual(0.5);
  expect(spec.border, "accent hairline").toContain("rgb(41, 171, 226)");
  // 17px/21px at the reference, in the client's Familjen Grotesk (bundled like the other faces).
  expect(spec.fontSizeRem).toBeCloseTo(1.0625, 2);
  expect(spec.lineHeightRem).toBeCloseTo(1.3125, 2);
  expect(spec.fontFamily.replace(/"/g, "")).toBe("Familjen Grotesk");

  // Painted symmetry: the box height is fixed at the client's 219px while our text wraps shorter than their
  // 189px block, so a top-aligned stack put all the slack at the bottom (client: "vreau simetrie").
  const box = await statement.evaluateHandle((el) => el.parentElement!);
  const boxBox = await (
    box.asElement() as never as typeof statement
  ).boundingBox();
  if (!boxBox) {
    throw new Error("statement box not measurable");
  }
  const shot = await page.screenshot({
    clip: {
      x: boxBox.x + boxBox.width * 0.02,
      y: boxBox.y,
      width: 1,
      height: boxBox.height,
    },
  });
  const gaps = await page.evaluate(
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
      const px = ctx.getImageData(0, 0, 1, c.height).data;
      // White text on the translucent accent box: ink is far brighter than any background row.
      let first = -1;
      let last = -1;
      for (let y = 2; y < c.height - 2; y += 1) {
        const lum =
          0.299 * px[y * 4] + 0.587 * px[y * 4 + 1] + 0.114 * px[y * 4 + 2];
        if (lum > 200) {
          if (first < 0) first = y;
          last = y;
        }
      }
      return { above: first, below: c.height - 1 - last, height: c.height };
    },
    `data:image/png;base64,${shot.toString("base64")}`,
  );
  console.log(
    `statement ink: ${gaps.above} above / ${gaps.below} below (box ${gaps.height} device px)`,
  );
  expect(
    Math.abs(gaps.above - gaps.below) / gaps.height,
    `top and bottom padding must match (got ${gaps.above} vs ${gaps.below} device px)`,
  ).toBeLessThan(0.03);

  await dialog.screenshot({
    path: testInfo.outputPath("purchase-statement.png"),
  });
});

test("the background squares spread across the panel, not a smear down the middle", async ({
  context,
  page,
}) => {
  const overlay = await openPaywall(context, page);
  const dialog = overlay.locator('[data-slot="dialog-content"]');

  const grid = await dialog.evaluate((el) => {
    const squares = Array.from(
      el.querySelectorAll<HTMLElement>("[aria-hidden] > div > div"),
    ).filter((n) => getComputedStyle(n).borderTopWidth !== "0px");
    const gridEl = squares[0]?.parentElement;
    if (!gridEl) {
      return null;
    }
    const g = gridEl.getBoundingClientRect();
    const p = el.getBoundingClientRect();
    return {
      count: squares.length,
      widthShare: g.width / p.width,
      heightShare: g.height / p.height,
      squareWidth: squares[0].getBoundingClientRect().width,
      columnSpread:
        (squares[2].getBoundingClientRect().right -
          squares[0].getBoundingClientRect().left) /
        p.width,
    };
  });
  if (!grid) {
    throw new Error("background squares not found");
  }
  console.log("squares grid:", JSON.stringify(grid));

  expect(grid.count, "3×5 grid").toBe(15);
  // The regression: as `absolute left-1/2` with no width the grid shrink-to-fit to HALF the panel (0.50)
  // and the columns overlapped into one vertical smear.
  expect(grid.widthShare, "grid spans most of the panel width").toBeGreaterThan(
    0.75,
  );
  expect(
    grid.columnSpread,
    "three distinct columns, edge to edge",
  ).toBeGreaterThan(0.75);
  expect(grid.heightShare).toBeGreaterThan(0.6);

  // Painted proof: blue reaches the left and right thirds low in the panel, where nothing else paints.
  const box = await dialog.boundingBox();
  if (!box) {
    throw new Error("dialog not measurable");
  }
  const y = box.y + box.height * 0.82;
  const sample = async (fx: number) => {
    const shot = await page.screenshot({
      clip: { x: box.x + box.width * fx, y, width: 1, height: 1 },
    });
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
        const px = ctx.getImageData(0, 0, 1, 1).data;
        return [px[0], px[1], px[2]];
      },
      `data:image/png;base64,${shot.toString("base64")}`,
    );
  };
  const [left, mid, right] = [
    await sample(0.15),
    await sample(0.5),
    await sample(0.85),
  ];
  console.log(
    `squares painted at 82% height: left ${left.join(",")} mid ${mid.join(",")} right ${right.join(",")}`,
  );
  for (const [name, c] of [
    ["left", left],
    ["mid", mid],
    ["right", right],
  ] as [string, number[]][]) {
    // #333333 base is neutral; a square's glow pushes blue well above red.
    expect(c[2] - c[0], `${name} third carries the blue glow`).toBeGreaterThan(
      20,
    );
  }
});
