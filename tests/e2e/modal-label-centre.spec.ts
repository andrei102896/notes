import { expect, test, toggleOverlay } from "./fixtures";
import { createSubjectTab, dblclickSubjectTab } from "./helpers";

import type {
  BrowserContext,
  FrameLocator,
  Locator,
  Page,
} from "@playwright/test";

/** Client 2026-08-02: "centering text in modal buttons should include all modals", not just the
 *  delete-confirm one. `align-items: center` centres the LINE box, and Fjalla One's ascent/descent are
 *  asymmetric, so caps paint ~1–1.5px high in every box that does it. Asserted in painted pixels: an
 *  element-scoped rect read is even whether the glyphs are centred or not (trap 19). */

/** Label-ink floor on the min channel: white and #e0e0e0 cores clear it, and so must nothing else —
 *  #9ee2ff (the metal-bar hilite, visible through the purchase boxes' 60% fill) sits at 158. */
const INK_MIN_CHANNEL = 200;

type Ink = { top: number; bottom: number; left: number; right: number };

/** Gaps in DEVICE px between a box's inner (padding-box) edges and its label's painted ink. The clip
 *  origin is floored to whole CSS px and the edges are derived arithmetically — clipping AT the inner
 *  edge instead rounds a fractionally-positioned box onto a half device row and biases the read by 1px,
 *  flipping the very defect under test. `inkOf` narrows the columns scanned to one child (the purchase
 *  box's "$5" rides above the cap band by design). */
async function inkGaps(
  page: Page,
  target: Locator,
  inkOf?: Locator,
): Promise<Ink> {
  const box = await target.boundingBox();
  const inkBox = inkOf ? await inkOf.boundingBox() : box;
  if (!box || !inkBox) {
    throw new Error("modal button is not measurable");
  }
  const border = await target.evaluate((el) =>
    parseFloat(getComputedStyle(el).borderTopWidth),
  );
  const dpr = await page.evaluate(() => window.devicePixelRatio);
  const originX = Math.floor(box.x) - 1;
  const originY = Math.floor(box.y) - 1;
  const shot = await page.screenshot({
    clip: {
      x: originX,
      y: originY,
      width: Math.ceil(box.x + box.width) + 1 - originX,
      height: Math.ceil(box.y + box.height) + 1 - originY,
    },
  });
  // Inner edges of the box in the clip's device-pixel frame.
  const edge = {
    top: (box.y + border - originY) * dpr,
    bottom: (box.y + box.height - border - originY) * dpr,
    left: (Math.max(box.x + border, inkBox.x) - originX) * dpr,
    right:
      (Math.min(box.x + box.width - border, inkBox.x + inkBox.width) -
        originX) *
      dpr,
  };
  return page.evaluate(
    async ({ dataUrl, inkMin, edge }) => {
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
      const rowFrom = Math.ceil(edge.top);
      const rowTo = Math.floor(edge.bottom) - 1;
      const colFrom = Math.ceil(edge.left);
      const colTo = Math.floor(edge.right) - 1;
      let firstRow = -1;
      let lastRow = -1;
      let firstCol = -1;
      let lastCol = -1;
      for (let y = rowFrom; y <= rowTo; y += 1) {
        for (let x = colFrom; x <= colTo; x += 1) {
          const at = (y * canvas.width + x) * 4;
          if (Math.min(data[at], data[at + 1], data[at + 2]) < inkMin) {
            continue;
          }
          if (firstRow < 0) {
            firstRow = y;
          }
          lastRow = y;
          if (firstCol < 0 || x < firstCol) {
            firstCol = x;
          }
          if (x > lastCol) {
            lastCol = x;
          }
        }
      }
      if (firstRow < 0) {
        throw new Error("no label ink inside the box");
      }
      // Ink against the scan window's edge is ink the box clipped: that side's gap is unmeasurable.
      if (firstRow === rowFrom || lastRow === rowTo) {
        throw new Error(
          `label ink reaches the box's inner edge (rows ${firstRow}..${lastRow} of ${rowFrom}..${rowTo})`,
        );
      }
      // Pixel rows/cols cover [i, i+1), so the ink's far edge is last + 1.
      return {
        top: firstRow - edge.top,
        bottom: edge.bottom - (lastRow + 1),
        left: firstCol - edge.left,
        right: edge.right - (lastCol + 1),
      };
    },
    {
      dataUrl: `data:image/png;base64,${shot.toString("base64")}`,
      inkMin: INK_MIN_CHANNEL,
      edge,
    },
  );
}

/** 2 device px = 1 CSS px here. Glyph rows are integers and these boxes are fractionally tall, so a
 *  perfectly centred cap band still splits unevenly — the purchase boxes' floor is 1.2. Every defect this
 *  guards was 3.2–5.2 device px, so the gap is not close. */
const TOLERANCE = 2;

/** Collects instead of throwing: one run must name EVERY off-centre box, not just the first. */
async function checkLabel(
  page: Page,
  target: Locator,
  what: string,
  offCentre: string[],
  inkOf?: Locator,
): Promise<void> {
  const ink = await inkGaps(page, target, inkOf);
  const px = (n: number): string => n.toFixed(2);
  const note =
    `${what}: ink gaps top/bottom ${px(ink.top)}/${px(ink.bottom)} (delta ${px(ink.top - ink.bottom)}), ` +
    `left/right ${px(ink.left)}/${px(ink.right)} (delta ${px(ink.left - ink.right)}) device px`;
  console.log(note);
  if (Math.abs(ink.top - ink.bottom) > TOLERANCE) {
    offCentre.push(`${note}  <-- VERTICAL`);
  }
}

/** Both CANCEL and OK of whichever modal is open, then dismisses it. */
async function checkDialogButtons(
  page: Page,
  overlay: FrameLocator,
  modal: string,
  offCentre: string[],
): Promise<void> {
  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await dialog.waitFor({ state: "visible" });
  // Radix opens with a duration-200 animation; pixels read mid-fade are not the shipped frame.
  await page.waitForTimeout(400);
  for (const name of ["Cancel", "OK"] as const) {
    await checkLabel(
      page,
      dialog.getByRole("button", { name, exact: true }),
      `${modal} ${name.toUpperCase()}`,
      offCentre,
    );
  }
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
}

test("every modal's CANCEL/OK centres its label glyphs vertically", async ({
  overlay,
  page,
}) => {
  const offCentre: string[] = [];

  // First run: the backdrop covers the strip, so the box's "+" is the reachable one (same dialog).
  await overlay
    .locator('[data-nn-modal-box] [aria-label="Add subject tab"]')
    .click();
  // A name enables OK: the disabled state is opacity-50, which drops the ink below the channel floor.
  await overlay.locator("input[data-subject-name-input]").fill("ALPHA");
  await checkDialogButtons(page, overlay, "add subject tab", offCentre);

  await createSubjectTab(overlay, "ALPHA");

  await dblclickSubjectTab(overlay, "ALPHA");
  await checkDialogButtons(page, overlay, "rename subject tab", offCentre);

  await overlay.getByRole("button", { name: "Delete Tab" }).click();
  await checkDialogButtons(page, overlay, "delete confirm", offCentre);

  expect(
    offCentre,
    `${offCentre.length} modal button label(s) are off-centre:\n${offCentre.join("\n")}`,
  ).toEqual([]);
});

/** Seeds an active trial so the purchase modal opens (same shape as paywall.spec.ts). */
async function openPaywall(
  context: BrowserContext,
  page: Page,
): Promise<FrameLocator> {
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
  await page.reload({ waitUntil: "load" });
  await toggleOverlay(context, page);
  const overlay = page.frameLocator(
    "#nn-scroll-bookmarks-overlay-shell iframe",
  );
  const host = overlay.locator("#nn-scroll-bookmarks-overlay-host");
  await host.waitFor({ state: "attached", timeout: 10_000 });
  await host.evaluate((el) => el.ownerDocument.fonts.ready);
  await expect(overlay.locator('[data-slot="dialog-content"]')).toBeVisible();
  await page.waitForTimeout(400);
  return overlay;
}

test("the purchase modal's TRIAL PERIOD and BUY boxes centre their glyphs", async ({
  context,
  page,
}) => {
  const overlay = await openPaywall(context, page);
  const offCentre: string[] = [];
  await checkLabel(
    page,
    overlay.locator("[data-paywall-trial-box]"),
    "purchase TRIAL PERIOD",
    offCentre,
  );
  const buy = overlay.getByRole("button", { name: "Buy now" });
  await checkLabel(
    page,
    buy,
    "purchase BUY",
    offCentre,
    // The word only: the "$" of the "$5" lockup rides above the cap band by design.
    buy.locator("> span").first(),
  );
  expect(
    offCentre,
    `${offCentre.length} purchase-modal label(s) are off-centre:\n${offCentre.join("\n")}`,
  ).toEqual([]);
});
