import { expect, test } from "./fixtures";
import { addNote, createSubjectTab, noteTitles, toggleOverlayForTab } from "./helpers";

/** `crypto.randomUUID` is secure-context-only (undefined on http → threw, so create silently failed); `generateId`
 * falls back to `getRandomValues`. The rest of the suite is https, so this spec drives a non-secure http host. */
const HTTP_URL = "http://nn-http-test.local/";

test("tabs and notes can be created on a plain-http (non-secure) page", async ({
  context,
}) => {
  test.setTimeout(60_000);
  await context.route(`${HTTP_URL}**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><title>http host</title></head><body style="margin:0"><h1>HTTP host</h1></body></html>`,
    }),
  );
  const page = await context.newPage();
  await page.goto(HTTP_URL, { waitUntil: "load" });

  // Precondition: this really is the non-secure context that makes crypto.randomUUID undefined.
  expect(await page.evaluate(() => window.isSecureContext)).toBe(false);
  expect(await page.evaluate(() => typeof crypto.randomUUID)).toBe("undefined");

  await toggleOverlayForTab(context, page);
  const overlay = page.frameLocator("#nn-scroll-bookmarks-overlay-shell iframe");
  await overlay
    .locator("#nn-scroll-bookmarks-overlay-host")
    .waitFor({ state: "attached", timeout: 10_000 });

  // Both fail without the fallback: createSubjectTab waits for the dialog to close (it can't — the id
  // mint throws before onOpenChange(false)); addNote waits for the note count to grow.
  await createSubjectTab(overlay, "HTTP TAB");
  await addNote(overlay, "HTTP NOTE");
  await expect(noteTitles(overlay).first()).toHaveValue("HTTP NOTE");
});
