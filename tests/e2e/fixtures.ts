import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  test as base,
  chromium,
  expect,
  type BrowserContext,
  type FrameLocator,
  type Page,
} from "@playwright/test";

const DIST_DIR = join(dirname(fileURLToPath(import.meta.url)), "../../dist-e2e");

/** Fake host page: matches <all_urls> so the content script injects; fulfilled via route so no server or network is needed. Must be httpS: id minting uses crypto.randomUUID, which needs a secure context. */
export const TEST_URL = "https://nn-test.local/";
const PAGE_HTML = `<!doctype html><html><head><title>NN e2e host</title></head>
<body style="margin:0;font-family:sans-serif;background:#e8e8e8">
<h1 style="padding:24px">NN e2e host page</h1>
</body></html>`;

/** Notes stamp their created date from the clock; freeze it so flows and screenshots are stable. */
export const FIXED_NOW = new Date("2026-07-02T10:00:00");

type ExtensionFixtures = {
  context: BrowserContext;
  page: Page;
  /** The overlay app iframe, toggled open and fonts settled. */
  overlay: FrameLocator;
};

export const test = base.extend<ExtensionFixtures>({
  // eslint-disable-next-line no-empty-pattern
  context: async ({}, use) => {
    const userDataDir = mkdtempSync(join(tmpdir(), "nn-e2e-"));
    const context = await chromium.launchPersistentContext(userDataDir, {
      // Headed: this Chromium build doesn't bring the extension up headless (verified — every spec fails). PW_HEADLESS=1 to retry after Playwright upgrades.
      headless: process.env.PW_HEADLESS === "1",
      viewport: { width: 1400, height: 900 },
      deviceScaleFactor: 2,
      args: [
        `--disable-extensions-except=${DIST_DIR}`,
        `--load-extension=${DIST_DIR}`,
        "--no-first-run",
        "--hide-crash-restore-bubble",
        // Headed is mandatory (the extension's service worker never starts headless), so park the window
        // off-screen instead: it still composites and screenshots normally, but stops stealing the desktop.
        "--window-position=-2400,-2400",
      ],
    });
    await use(context);
    await context.close();
  },

  page: async ({ context }, use) => {
    await context.route(`${TEST_URL}**`, (route) =>
      route.fulfill({ contentType: "text/html", body: PAGE_HTML }),
    );
    const page = context.pages()[0] ?? (await context.newPage());
    await page.clock.setFixedTime(FIXED_NOW);
    await page.goto(TEST_URL, { waitUntil: "load" });
    await use(page);
  },

  overlay: async ({ context, page }, use) => {
    await toggleOverlay(context, page);
    const frame = page.frameLocator("#nn-scroll-bookmarks-overlay-shell iframe");
    const host = frame.locator("#nn-scroll-bookmarks-overlay-host");
    await host.waitFor({ state: "attached", timeout: 10_000 });
    // Self-hosted fonts load async; visual + geometry assertions need them settled.
    await host.evaluate((el) => el.ownerDocument.fonts.ready);
    await use(frame);
  },
});

/** Sends the toolbar-click message (TOGGLE_OVERLAY) to the test tab via the extension service worker. */
export async function toggleOverlay(
  context: BrowserContext,
  page: Page,
): Promise<void> {
  // The content script injects at document_idle; the message is dropped if it isn't listening yet.
  await page.waitForTimeout(1000);
  let [worker] = context.serviceWorkers();
  if (!worker) {
    worker = await context.waitForEvent("serviceworker", { timeout: 15_000 });
  }
  await worker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url?.startsWith(url));
    if (!tab?.id) {
      throw new Error("e2e: test tab not found");
    }
    await chrome.tabs.sendMessage(tab.id, { type: "TOGGLE_OVERLAY" });
  }, TEST_URL);
}

export { expect };
