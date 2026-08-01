import { type BrowserContext, type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { toggleOverlayForTab } from "./helpers";

/**
 * The same scenarios as `session-persistence.spec.ts`, against the REAL sites the client used. Stub pages
 * are trivial documents that the bfcache always accepts; real ones bring redirects, heavy JS, analytics
 * sockets and unload handlers, and are often bfcache-INELIGIBLE — the opposite path. Opt in:
 * `npm run test:e2e:live` (needs network; excluded from the default suite in playwright.config.ts).
 */

const SITE_A = "https://www.ford.com/";
const SITE_B = "https://www.bugatti.com/";

const SHELL = "#nn-scroll-bookmarks-overlay-shell";

/** Same document_start probe as the hermetic spec: a flash lasts fewer frames than a test can poll. */
const PAGE_PROBE = `
  window.__nnRestoredFromBfcache = false;
  window.__nnOnScreenFrames = 0;
  window.__nnShownFractions = [];
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.__nnRestoredFromBfcache = true;
  });
  (() => {
    const start = performance.now();
    const tick = () => {
      const shell = document.querySelector("#nn-scroll-bookmarks-overlay-shell");
      if (shell instanceof HTMLElement && getComputedStyle(shell).visibility !== "hidden") {
        const rect = shell.getBoundingClientRect();
        if (rect.width > 0) {
          window.__nnShownFractions.push((window.innerWidth - rect.left) / rect.width);
          if (rect.left < window.innerWidth - 1) window.__nnOnScreenFrames += 1;
        }
      }
      if (performance.now() - start < 4000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();
`;

type Probe = {
  bfcache: boolean;
  onScreenFrames: number;
  shown: number[];
};

async function readProbe(page: Page): Promise<Probe> {
  return page.evaluate(() => {
    const w = window as unknown as {
      __nnRestoredFromBfcache?: boolean;
      __nnOnScreenFrames?: number;
      __nnShownFractions?: number[];
    };
    return {
      bfcache: w.__nnRestoredFromBfcache === true,
      onScreenFrames: w.__nnOnScreenFrames ?? 0,
      shown: w.__nnShownFractions ?? [],
    };
  });
}

async function overlayOnScreen(page: Page): Promise<boolean> {
  return page.evaluate((selector) => {
    const shell = document.querySelector(selector);
    if (!(shell instanceof HTMLElement)) {
      return false;
    }
    if (getComputedStyle(shell).visibility === "hidden") {
      return false;
    }
    return shell.getBoundingClientRect().left < window.innerWidth - 1;
  }, SHELL);
}

/** Real sites redirect and load slowly; domcontentloaded is the only reliable gate. */
async function visit(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
}

/**
 * Drives NN to `want` and confirms it. TOGGLE_OVERLAY is dropped when the content script is not listening
 * yet, which on a slow real site is a coin flip — so re-toggle until the state matches instead of assuming
 * one message landed. Re-checking before each toggle keeps a dropped message from flipping it back.
 */
async function setOverlay(
  context: BrowserContext,
  page: Page,
  want: boolean,
): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if ((await overlayOnScreen(page)) === want) {
      return;
    }
    await toggleOverlayForTab(context, page);
    try {
      await expect
        .poll(() => overlayOnScreen(page), { timeout: 8000 })
        .toBe(want);
      return;
    } catch {
      // Message dropped or the page was still booting — try again.
    }
  }
  throw new Error(`NN never reached ${want ? "maximized" : "minimized"}`);
}

test.describe("live sites", () => {
  test.slow();

  test("minimizing on framed-shot.com keeps NN minimized after Back to tesla.com", async ({
    context,
    page,
  }) => {
    await page.addInitScript(PAGE_PROBE);
    await visit(page, SITE_A);
    await setOverlay(context, page, true);

    await visit(page, SITE_B);
    await expect
      .poll(() => overlayOnScreen(page), { timeout: 20_000 })
      .toBe(true);

    await setOverlay(context, page, false);

    await page.goBack({ waitUntil: "commit" });
    await page.waitForTimeout(3000);
    const probe = await readProbe(page);
    console.log(
      `back to ${SITE_A}: bfcache=${probe.bfcache}, panel painted in ${probe.onScreenFrames} frame(s)`,
    );

    // On a bfcache restore the frozen frame repaints before any script runs — one or two frames is the
    // floor. A rebuilt page must never paint it at all.
    expect(
      probe.onScreenFrames,
      "no visible flash of a stale panel",
    ).toBeLessThan(probe.bfcache ? 4 : 1);
    expect(await overlayOnScreen(page), "still minimized").toBe(false);
  });

  test("leaving NN maximized survives Back to tesla.com", async ({
    context,
    page,
  }) => {
    await page.addInitScript(PAGE_PROBE);
    await visit(page, SITE_A);
    await setOverlay(context, page, true);

    await visit(page, SITE_B);
    await expect
      .poll(() => overlayOnScreen(page), { timeout: 20_000 })
      .toBe(true);

    await page.goBack({ waitUntil: "commit" });
    const probe = await readProbe(page);
    console.log(`back to ${SITE_A} maximized: bfcache=${probe.bfcache}`);
    await expect
      .poll(() => overlayOnScreen(page), { timeout: 20_000 })
      .toBe(true);
  });

  test("NN slides back in on a real cross-site load, and is back fast", async ({
    context,
    page,
  }) => {
    await page.addInitScript(PAGE_PROBE);
    await visit(page, SITE_A);
    await setOverlay(context, page, true);

    const startedAt = Date.now();
    await visit(page, SITE_B);
    await expect
      .poll(() => overlayOnScreen(page), { timeout: 20_000 })
      .toBe(true);
    const backOnScreenMs = Date.now() - startedAt;

    await page.waitForTimeout(2000);
    const { shown } = await readProbe(page);
    const midSlide = shown.filter((f) => f > 0.01 && f < 0.99).length;
    const landed = shown.filter((f) => f >= 0.99).length;
    console.log(
      `${SITE_B}: NN on screen ${backOnScreenMs}ms after navigation started; ${midSlide} mid-slide frame(s), ${landed} landed`,
    );

    // Travels across frames rather than snapping, and settles fully in view.
    expect(midSlide, "slides rather than snaps").toBeGreaterThan(1);
    expect(landed, "ends fully on screen").toBeGreaterThan(0);
  });
});
