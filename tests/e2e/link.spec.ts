import { type FrameLocator, type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { addNote, createSubjectTab, toggleOverlayForTab } from "./helpers";

/** A homepage whose real URL carries a significant trailing slash (audi.com redirects to a locale path like /en/). */
const HOME_URL = "https://www.audi.com/en/";
/** The same path WITHOUT the trailing slash — a distinct route that 404s, mirroring the reported behavior. */
const NO_SLASH_URL = "https://www.audi.com/en";
const AWAY_URL = "https://www.example.org/";

function overlayFrame(page: Page): FrameLocator {
  return page.frameLocator("#nn-scroll-bookmarks-overlay-shell iframe");
}

async function waitForOverlay(page: Page): Promise<void> {
  await overlayFrame(page)
    .locator("#nn-scroll-bookmarks-overlay-host")
    .waitFor({ state: "attached", timeout: 10_000 });
}

test.describe("LINK opens the captured URL", () => {
  test("LINK preserves a significant trailing slash (does not 404)", async ({
    context,
  }) => {
    test.setTimeout(90_000);
    await context.route(HOME_URL, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>Audi</title></head><body><h1>AUDI EN HOME</h1></body></html>`,
      }),
    );
    await context.route(NO_SLASH_URL, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>404</title></head><body><h1>NOT FOUND 404</h1></body></html>`,
      }),
    );
    await context.route(`${AWAY_URL}**`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>Away</title></head><body><h1>AWAY</h1></body></html>`,
      }),
    );

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(HOME_URL, { waitUntil: "load" });
    await toggleOverlayForTab(context, page);
    await waitForOverlay(page);

    // Note auto-captures the current page URL (the /en/ homepage).
    await createSubjectTab(overlayFrame(page), "CARS");
    await addNote(overlayFrame(page), "AUDI");

    // Navigate away; the overlay reopens with the selected tab's note still visible.
    await page.goto(AWAY_URL, { waitUntil: "load" });
    await waitForOverlay(page);

    const link = overlayFrame(page).getByRole("button", {
      name: "Navigate to URL",
    });
    await link.waitFor({ state: "visible", timeout: 10_000 });
    await link.click();

    await page.waitForURL(`${NO_SLASH_URL}**`, { timeout: 15_000 });
    // Must land on the /en/ homepage, not the /en 404.
    await expect(page.locator("h1")).toHaveText("AUDI EN HOME");
  });

  test("typing a path with slashes into the URL field keeps every slash", async ({
    context,
  }) => {
    test.setTimeout(90_000);
    await context.route(`${AWAY_URL}**`, (route) =>
      route.fulfill({
        contentType: "text/html",
        body: `<!doctype html><html><head><title>Host</title></head><body><h1>HOST</h1></body></html>`,
      }),
    );

    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto(AWAY_URL, { waitUntil: "load" });
    await toggleOverlayForTab(context, page);
    await waitForOverlay(page);

    await createSubjectTab(overlayFrame(page), "CARS");
    await addNote(overlayFrame(page), "AUDI");

    const urlInput = overlayFrame(page).getByLabel("Note URL");
    await urlInput.fill("");
    await urlInput.pressSequentially("www.audi.com/en/", { delay: 30 });
    // The field must not strip slashes as they are typed.
    await expect(urlInput).toHaveValue("www.audi.com/en/");
  });
});
