import { expect, test, toggleOverlay } from "./fixtures";
import { createSubjectTab } from "./helpers";

import type { BrowserContext, FrameLocator, Page } from "@playwright/test";

/** Seeds an active trial + open banner into chrome.storage.local. Stamped from the WORKER's clock: the
 *  page clock is frozen in the past, so elapsed goes negative — still an active trial. */
async function seedTrialState(context: BrowserContext): Promise<void> {
  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  }
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      nn_trial_started_at: Date.now() - 60_000,
      nn_trial_banner_open: true,
    });
  });
}

/** Fraction of pixels whose r/g/b differ by >6 between two same-size PNGs; decoded via canvas in the page (no node deps). */
async function pixelDiffRatio(
  page: Page,
  a: Buffer,
  b: Buffer,
): Promise<number> {
  return page.evaluate(
    async ([dataA, dataB]) => {
      const load = (src: string) =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = reject;
          img.src = src;
        });
      const [imgA, imgB] = await Promise.all([load(dataA), load(dataB)]);
      const canvas = document.createElement("canvas");
      canvas.width = imgA.width;
      canvas.height = imgA.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("no 2d context");
      }
      ctx.drawImage(imgA, 0, 0);
      const pxA = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(imgB, 0, 0);
      const pxB = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let changed = 0;
      for (let i = 0; i < pxA.length; i += 4) {
        if (
          Math.abs(pxA[i] - pxB[i]) > 6 ||
          Math.abs(pxA[i + 1] - pxB[i + 1]) > 6 ||
          Math.abs(pxA[i + 2] - pxB[i + 2]) > 6
        ) {
          changed += 1;
        }
      }
      return changed / (canvas.width * canvas.height);
    },
    [
      `data:image/png;base64,${a.toString("base64")}`,
      `data:image/png;base64,${b.toString("base64")}`,
    ] as const,
  );
}

/** Seed happens after the fixture page already loaded, so reload to remount the app, then toggle the overlay. */
async function openPaywall(
  context: BrowserContext,
  page: Page,
): Promise<FrameLocator> {
  await seedTrialState(context);
  await page.reload({ waitUntil: "load" });
  await toggleOverlay(context, page);
  const overlay = page.frameLocator(
    "#nn-scroll-bookmarks-overlay-shell iframe",
  );
  const host = overlay.locator("#nn-scroll-bookmarks-overlay-host");
  await host.waitFor({ state: "attached", timeout: 10_000 });
  await host.evaluate((el) => el.ownerDocument.fonts.ready);
  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();
  // Let the Radix open animation (duration-200) settle before geometry/pixel reads.
  await page.waitForTimeout(400);
  return overlay;
}

test("purchase modal covers the panel with visible ghost NN and centered trial box", async ({
  context,
  page,
}, testInfo) => {
  const overlay = await openPaywall(context, page);
  const host = overlay.locator("#nn-scroll-bookmarks-overlay-host");
  const dialog = overlay.locator('[data-slot="dialog-content"]');

  await expect(overlay.getByText(/TRIAL PERIOD:/)).toBeVisible();
  await expect(overlay.getByRole("button", { name: "Buy now" })).toBeVisible();

  const dialogBox = await dialog.boundingBox();
  const hostBox = await host.boundingBox();
  if (!dialogBox || !hostBox) {
    throw new Error("paywall dialog or host not measurable");
  }
  expect(dialogBox.width).toBeGreaterThan(hostBox.width * 0.95);
  expect(dialogBox.height).toBeGreaterThan(hostBox.height * 0.95);

  // Client rule: the purchase plate is EXACTLY the dashboard band's plate size. Both are in this DOM,
  // so they are compared directly rather than against a recorded number.
  const plates = await host.evaluate((hostEl) => {
    const doc = hostEl.ownerDocument;
    const dash = doc
      .querySelector("header [data-nn-plate]")!
      .getBoundingClientRect();
    const pay = doc
      .querySelector('[data-slot="dialog-content"] [data-nn-plate]')!
      .getBoundingClientRect();
    return {
      gap: pay.top - hostEl.getBoundingClientRect().top,
      dash: { w: dash.width, h: dash.height },
      pay: { w: pay.width, h: pay.height },
    };
  });
  expect(
    Math.abs(plates.gap),
    "purchase plate flush to the outer top",
  ).toBeLessThan(0.6);
  expect(
    Math.abs(plates.pay.h - plates.dash.h),
    `purchase plate height ${plates.pay.h} vs dashboard ${plates.dash.h}`,
  ).toBeLessThan(1);
  expect(
    Math.abs(plates.pay.w - plates.dash.w),
    `purchase plate width ${plates.pay.w} vs dashboard ${plates.dash.w}`,
  ).toBeLessThan(1);
  // …and the NN inside it matches the dashboard's in BOTH dimensions (client rule: same size AND
  // proportions). Compared directly, since a shared number would not catch the two svgs' different
  // viewBox heights rendering the same squeeze 6% shorter.
  const inks = await host.evaluate((hostEl) => {
    const read = (plate: Element) => {
      const rects = [...plate.querySelectorAll("path")].map((p) =>
        p.getBoundingClientRect(),
      );
      return {
        w:
          Math.max(...rects.map((r) => r.right)) -
          Math.min(...rects.map((r) => r.left)),
        h:
          Math.max(...rects.map((r) => r.bottom)) -
          Math.min(...rects.map((r) => r.top)),
      };
    };
    const doc = hostEl.ownerDocument;
    return {
      dash: read(doc.querySelector("header [data-nn-plate]")!),
      pay: read(
        doc.querySelector('[data-slot="dialog-content"] [data-nn-plate]')!,
      ),
    };
  });
  console.log(
    `NN ink — dashboard ${inks.dash.w.toFixed(2)}×${inks.dash.h.toFixed(2)}, ` +
      `purchase ${inks.pay.w.toFixed(2)}×${inks.pay.h.toFixed(2)}`,
  );
  expect(inks.pay.w, "purchase NN ink width == dashboard's").toBeCloseTo(
    inks.dash.w,
    0,
  );
  expect(inks.pay.h, "purchase NN ink height == dashboard's").toBeCloseTo(
    inks.dash.h,
    0,
  );

  // Inspection artifact for design review.
  await page.screenshot({ path: testInfo.outputPath("paywall-full.png") });

  // Figma TRIAL PERIOD BOX; the buy box carries the same outline. Values are rem-based, so they are
  // compared back at the 16px reference.
  for (const sel of ["[data-paywall-trial-box]", '[aria-label="Buy now"]']) {
    const box = await overlay.locator(sel).evaluate((el) => {
      const cs = getComputedStyle(el);
      const rootPx = parseFloat(
        getComputedStyle(el.ownerDocument.documentElement).fontSize,
      );
      const r = el.getBoundingClientRect();
      return {
        border: `${cs.borderTopWidth} ${cs.borderTopColor}`,
        bg: cs.backgroundColor,
        shadow: cs.boxShadow,
        refWidth: (r.width / rootPx) * 16,
        refHeight: (r.height / rootPx) * 16,
      };
    });
    expect(box.border, `${sel} outline`).toBe("2px rgb(0, 129, 184)");
    expect(box.bg, `${sel} accent at 0.6`).toContain("0.6");
    expect(box.shadow, `${sel} inset depth`).toContain("inset");
    if (sel === "[data-paywall-trial-box]") {
      expect(box.refWidth, "trial box width").toBeCloseTo(184.34, 0);
      expect(box.refHeight, "trial box height").toBeCloseTo(30, 0);
    }
  }

  // Trial box floats centered in its band — the flush-left regression.
  const trialBox = await overlay
    .locator("[data-paywall-trial-box]")
    .boundingBox();
  const band = await overlay
    .locator("[data-paywall-trial-box]")
    .locator("..")
    .boundingBox();
  if (!trialBox || !band) {
    throw new Error("trial box or band not measurable");
  }
  const leftGap = trialBox.x - band.x;
  const rightGap = band.x + band.width - (trialBox.x + trialBox.width);
  expect(leftGap).toBeGreaterThan(10);
  expect(Math.abs(leftGap - rightGap)).toBeLessThan(8);

  // Ghost NN must contribute visible pixels: hiding it has to change the region.
  const ghost = dialog.locator("[data-modal-ghost]");
  const ghostBox = await ghost.boundingBox();
  if (!ghostBox) {
    throw new Error("ghost logo not measurable");
  }
  expect(ghostBox.width).toBeGreaterThan(100);
  const clip = {
    x: ghostBox.x,
    y: ghostBox.y,
    width: ghostBox.width,
    height: ghostBox.height,
  };
  const withGhost = await page.screenshot({ clip });
  await ghost.evaluate((el) => {
    (el as unknown as SVGElement).style.visibility = "hidden";
  });
  const withoutGhost = await page.screenshot({ clip });
  await ghost.evaluate((el) => {
    (el as unknown as SVGElement).style.visibility = "";
  });
  // Human-visible presence, not just "some pixel changed": the letters must alter a real share of the region.
  const ratio = await pixelDiffRatio(page, withGhost, withoutGhost);
  console.log(`ghost NN visible-pixel ratio: ${(ratio * 100).toFixed(1)}%`);
  expect(
    ratio,
    "ghost NN is not visibly present in its region",
  ).toBeGreaterThan(0.05);
});

test("purchase modal is dismissable via Escape and via BUY", async ({
  context,
  page,
}) => {
  const overlay = await openPaywall(context, page);
  const dialog = overlay.locator('[data-slot="dialog-content"]');

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // A tab first: with zero tabs the first-run backdrop covers the nav row, the trial badge included.
  await createSubjectTab(overlay, "ALPHA");
  // Client 2026-07-31: clicking anywhere but BUY returns to the trial — the modal fills the panel, so
  // Escape was the only way out and the user believed they had to purchase.
  await overlay.locator('[aria-label="Open trial info"]').click();
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  if (!box) {
    throw new Error("paywall dialog not measurable");
  }
  // Low in the panel, clear of the metal bar's trial and BUY boxes.
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.8);
  await expect(dialog).toBeHidden();

  // The trial box itself also dismisses (it is not a control).
  await overlay.locator('[aria-label="Open trial info"]').click();
  await expect(dialog).toBeVisible();
  await overlay.locator("[data-paywall-trial-box]").click();
  await expect(dialog).toBeHidden();

  // Reopen through the header logo (trial state → red logo button).
  await overlay.locator('[aria-label="Open trial info"]').click();
  await expect(dialog).toBeVisible();

  // ExtPay is off in the e2e build, so BUY only exercises the close path.
  await overlay.getByRole("button", { name: "Buy now" }).click();
  await expect(dialog).toBeHidden();
});
