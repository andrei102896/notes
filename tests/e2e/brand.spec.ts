import { expect, test, toggleOverlay } from "./fixtures";
import { createSubjectTab } from "./helpers";

const NN_UPDATES_URL = "https://www.notesfornet.com/updates";

/** Geometric, not a screenshot: vector math, so it is stable across machines/DPR unlike the antialiasing-sensitive visual baselines. */
test.describe("brand mark centering", () => {
  // Standalone header logo box (red on trial / blue when paid): the fat NN must sit dead-center in the
  // bordered box. Geometric like the test above — the box is symmetric (uniform 3px border), so ink center
  // == box center and left/right + top/bottom gaps are equal when centered.
  test("fat NN glyph is centered in the header logo box", async ({
    overlay,
  }) => {
    const svg = overlay
      .locator('header [aria-label="Open trial info"] svg')
      .first();

    const { offset, gaps } = await svg.evaluate((el) => {
      const s = el as unknown as SVGSVGElement;
      const box = (
        s.closest('[aria-label="Open trial info"]') as HTMLElement
      ).getBoundingClientRect();
      const svgR = s.getBoundingClientRect();
      const vb = s.viewBox.baseVal;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;
      for (const p of Array.from(s.querySelectorAll("path"))) {
        const b = (p as SVGGraphicsElement).getBBox();
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
      const cx = (u: number) => svgR.x + ((u - vb.x) / vb.width) * svgR.width;
      const cy = (u: number) => svgR.y + ((u - vb.y) / vb.height) * svgR.height;
      const ink = {
        left: cx(minX),
        right: cx(maxX),
        top: cy(minY),
        bottom: cy(maxY),
      };

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

    expect(Math.abs(offset.dx)).toBeLessThan(0.5);
    expect(Math.abs(offset.dy)).toBeLessThan(0.5);
    expect(Math.abs(gaps.left - gaps.right)).toBeLessThan(0.5);
    expect(Math.abs(gaps.top - gaps.bottom)).toBeLessThan(0.5);
  });
});

/** Off-trial, the blue logo opens the client's updates page in a NEW tab (background chrome.tabs.create,
 *  window.open fallback). The URL is routed to a stub: no test may depend on the live site. */
test("the header NN logo opens the NN updates page in a new tab", async ({
  context,
  page,
}) => {
  await context.route("https://www.notesfornet.com/**", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>NN updates stub</title>",
    }),
  );

  // Default e2e state starts a fresh local trial (red logo). An expired start reaches the off-trial
  // branch; ExtPay is compiled out of this build, so expiry does NOT flip the panel to read-only.
  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  }
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      nn_trial_started_at: new Date("2020-01-01T00:00:00Z").getTime(),
    });
  });
  await page.reload({ waitUntil: "load" });
  await toggleOverlay(context, page);

  const overlay = page.frameLocator(
    "#nn-scroll-bookmarks-overlay-shell iframe",
  );
  // A subject tab first: with zero tabs the first-run backdrop covers the nav row, this logo included.
  await createSubjectTab(overlay, "ALPHA");
  const logo = overlay.locator('header [aria-label="Open NN updates page"]');
  await expect(logo).toBeVisible();
  await expect(
    overlay.locator('header [aria-label="Open trial info"]'),
  ).toHaveCount(0);

  const [updatesTab] = await Promise.all([
    context.waitForEvent("page"),
    logo.click(),
  ]);
  await updatesTab.waitForURL(/notesfornet\.com\/updates/, { timeout: 15_000 });
  expect(updatesTab.url()).toBe(NN_UPDATES_URL);
  // Opened alongside the host page, never in place of it.
  expect(page.url()).toContain("nn-test.local");
  await updatesTab.close();
});
