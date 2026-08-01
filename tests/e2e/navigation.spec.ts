import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { createSubjectTab, subjectTab, toggleOverlayForTab } from "./helpers";

/** Two distinct origins so this exercises a real cross-site hard navigation in one browser tab. */
const FORD_URL = "https://www.ford.com/";
const TESLA_URL = "https://www.tesla.com/";

const stubPage = (title: string): string =>
  `<!doctype html><html><head><title>${title}</title></head>` +
  `<body style="margin:0;font-family:sans-serif;background:#e8e8e8">` +
  `<h1 style="padding:24px">${title}</h1></body></html>`;

const toggleOverlayForCurrentTab = toggleOverlayForTab;

function overlayFrame(page: Page) {
  return page.frameLocator("#nn-scroll-bookmarks-overlay-shell iframe");
}

async function waitForOverlay(page: Page): Promise<void> {
  await overlayFrame(page)
    .locator("#nn-scroll-bookmarks-overlay-host")
    .waitFor({ state: "attached", timeout: 10_000 });
}

test.describe("temporary persistence across single-tab navigation", () => {
  test("the selected subject tab stays selected after navigating to another site", async ({
    context,
  }) => {
    await context.route(`${FORD_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: stubPage("Ford") }),
    );
    await context.route(`${TESLA_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: stubPage("Tesla") }),
    );

    const page = context.pages()[0] ?? (await context.newPage());

    // 1. Land on ford.com and maximize NN.
    await page.goto(FORD_URL, { waitUntil: "load" });
    await toggleOverlayForCurrentTab(context, page);
    await waitForOverlay(page);

    // 2. Create + select a subject tab (create auto-selects; same persistence path as selecting an existing one).
    await createSubjectTab(overlayFrame(page), "GARAGE");
    await expect(subjectTab(overlayFrame(page), "GARAGE")).toHaveAttribute(
      "aria-selected",
      "true",
    );

    // 3. Minimize NN.
    await toggleOverlayForCurrentTab(context, page);

    // 4. Navigate the same tab to tesla.com (cross-origin hard nav → content script + React remount).
    await page.goto(TESLA_URL, { waitUntil: "load" });

    // 5. Maximize NN again.
    await toggleOverlayForCurrentTab(context, page);
    await waitForOverlay(page);

    // Expected: dashboard is exactly where it was left — GARAGE still selected, no "select or create" prompt.
    await expect(subjectTab(overlayFrame(page), "GARAGE")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      overlayFrame(page).getByText("to view, edit or add notes to"),
    ).toHaveCount(0);
  });

  test("the strip scroll position is preserved on reopen (selected tab is not scrolled to the fold)", async ({
    context,
  }) => {
    test.setTimeout(90_000);
    await context.route(`${FORD_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: stubPage("Ford") }),
    );
    await context.route(`${TESLA_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: stubPage("Tesla") }),
    );

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(FORD_URL, { waitUntil: "load" });
    await toggleOverlayForCurrentTab(context, page);
    await waitForOverlay(page);

    // Overflow the strip; alphabetical sort keeps the last-created tab at the bottom, selected.
    const names = Array.from(
      { length: 16 },
      (_, i) => `TAB${String(i + 1).padStart(2, "0")}`,
    );
    for (const name of names) {
      await createSubjectTab(overlayFrame(page), name);
    }
    const last = names[names.length - 1];

    // Creating an off-screen tab still reveals it (behavior kept for genuine selection changes).
    await expect
      .poll(async () =>
        subjectTab(overlayFrame(page), last).evaluate((el) => {
          const c = el.offsetParent as HTMLElement;
          const top = (el as HTMLElement).offsetTop;
          const bottom = top + (el as HTMLElement).offsetHeight;
          return (
            top >= c.scrollTop - 1 && bottom <= c.scrollTop + c.clientHeight + 1
          );
        }),
      )
      .toBe(true);

    // Scroll the strip to the middle so the selected bottom tab is now below the fold; let the
    // debounced session write land.
    const savedTop = await subjectTab(overlayFrame(page), last).evaluate(
      (el) => {
        const c = el.offsetParent as HTMLElement;
        c.scrollTop = Math.round((c.scrollHeight - c.clientHeight) / 2);
        return c.scrollTop;
      },
    );
    expect(savedTop).toBeGreaterThan(1);
    await page.waitForTimeout(400); // > the strip-scroll save debounce

    await toggleOverlayForCurrentTab(context, page); // minimize
    await page.goto(TESLA_URL, { waitUntil: "load" }); // cross-site hard nav → remount
    await toggleOverlayForCurrentTab(context, page); // maximize
    await waitForOverlay(page);

    await expect(subjectTab(overlayFrame(page), last)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // Strip returns to where it was left (± subpixel) — NOT scrolled to reveal the selected tab
    // (the old bug scrolled it to the bottom, i.e. ~2×savedTop).
    await expect
      .poll(async () =>
        subjectTab(overlayFrame(page), last).evaluate(
          (el, saved) =>
            Math.abs((el.offsetParent as HTMLElement).scrollTop - saved) <= 1.5,
          savedTop,
        ),
      )
      .toBe(true);
  });
});
