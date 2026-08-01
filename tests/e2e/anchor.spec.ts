import { type FrameLocator, type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { addNote, createSubjectTab, toggleOverlayForTab } from "./helpers";

/** Two origins so go-to-anchor is a real cross-site navigation (where the source-origin session key orphans). */
const SOURCE_URL = "https://www.ford.com/";
const TARGET_URL = "https://www.tesla.com/";

/** A page tall enough to scroll to the anchor Y used below. */
const tallPage = (title: string): string =>
  `<!doctype html><html><head><title>${title}</title></head>` +
  `<body style="margin:0"><div style="height:6000px;` +
  `background:linear-gradient(#fff,#999)">${title}</div></body></html>`;

/** Short at load, grows tall ~1s later — mimics a video/lazy homepage (bugatti.com) whose anchor target isn't laid out yet. */
const growsLatePage = (title: string): string =>
  `<!doctype html><html><head><title>${title}</title></head>` +
  `<body style="margin:0"><div style="height:400px;background:#eee">${title} HERO</div>` +
  `<script>setTimeout(function(){var d=document.createElement('div');` +
  `d.style.height='6000px';d.style.background='linear-gradient(#fff,#ccc)';` +
  `d.textContent='LATE CONTENT';document.body.appendChild(d);},1000);</script>` +
  `</body></html>`;

function overlayFrame(page: Page): FrameLocator {
  return page.frameLocator("#nn-scroll-bookmarks-overlay-shell iframe");
}

async function waitForOverlay(page: Page): Promise<void> {
  await overlayFrame(page)
    .locator("#nn-scroll-bookmarks-overlay-host")
    .waitFor({ state: "attached", timeout: 10_000 });
}

/** Create a note whose URL is TARGET_URL and drop an anchor at the given source-page scroll offset. */
async function noteWithAnchor(
  page: Page,
  anchorScrollY: number,
): Promise<void> {
  const overlay = overlayFrame(page);
  await createSubjectTab(overlay, "GARAGE");
  await addNote(overlay, "NOTE");
  await overlay.getByLabel("Note URL").fill(TARGET_URL);
  await overlay.getByLabel("Note URL").blur(); // commit: the URL normalizes + persists on blur
  await expect(overlay.getByLabel("Note URL")).toHaveValue("www.tesla.com");

  // ANCHOR pick: overlay hides, a full-page pick layer appears on the HOST page; click it to capture the current scroll.
  await overlay.getByRole("button", { name: "Pick page anchor" }).click();
  const layer = page.locator("#nn-scroll-bookmarks-anchor-pick-layer");
  await layer.waitFor({ state: "visible", timeout: 5000 });
  await page.evaluate((y) => window.scrollTo(0, y), anchorScrollY);
  await page.mouse.click(60, 60);
  await layer.waitFor({ state: "detached", timeout: 5000 });
  await expect(
    overlay.getByRole("button", { name: "Navigate to anchor position" }),
  ).toBeVisible();
}

async function goToAnchor(page: Page): Promise<void> {
  await overlayFrame(page)
    .getByRole("button", { name: "Navigate to anchor position" })
    .click();
  await page.waitForURL(`${TARGET_URL}**`, { timeout: 15_000 });
}

test.describe("anchor navigation", () => {
  test("an anchor does not fire on an unrelated page after cross-site go-to-anchor", async ({
    context,
  }) => {
    test.setTimeout(90_000);
    await context.route(`${SOURCE_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: tallPage("Ford") }),
    );
    await context.route(`${TARGET_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: tallPage("Tesla") }),
    );

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(SOURCE_URL, { waitUntil: "load" });
    await toggleOverlayForTab(context, page);
    await waitForOverlay(page);

    await noteWithAnchor(page, 2000);
    await goToAnchor(page); // ford -> tesla (cross-origin); source-origin session key orphans here

    // Return to the SOURCE origin — the orphaned session key must NOT scroll this unrelated page.
    await page.goto(SOURCE_URL, { waitUntil: "load" });
    await page.waitForTimeout(1500); // well past the 200ms scroll delay + any settle
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("an anchor reaches its position on a page that lays out late (dynamic homepage)", async ({
    context,
  }) => {
    test.setTimeout(90_000);
    await context.route(`${SOURCE_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: tallPage("Ford") }),
    );
    await context.route(`${TARGET_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: growsLatePage("Tesla") }),
    );

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(SOURCE_URL, { waitUntil: "load" });
    await toggleOverlayForTab(context, page);
    await waitForOverlay(page);

    await noteWithAnchor(page, 3000);
    await goToAnchor(page); // navigates to the target, which is short now and grows after ~1s

    // The scroll must keep trying until the page is tall enough to honor the anchor position.
    await expect
      .poll(() => page.evaluate(() => window.scrollY), { timeout: 8000 })
      .toBeGreaterThan(2900);
  });
});
