import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import {
  addNote,
  createSubjectTab,
  titleValues,
  toggleOverlayForTab,
} from "./helpers";

/** Three distinct origins: every hop below is a real cross-site navigation in one browser tab. */
const PAGE_A = "https://www.ford.com/";
const PAGE_B = "https://www.tesla.com/";
const PAGE_C = "https://www.rivian.com/";

const SHELL = "#nn-scroll-bookmarks-overlay-shell";

/**
 * Runs at document_start in the page itself: records whether this document came from the bfcache, and
 * samples the panel every frame from the very first one. A flash lasting a few frames is over long before
 * a `page.evaluate` from the test could start, so it has to be measured from inside.
 */
const PAGE_PROBE = `
  window.__nnRestoredFromBfcache = false;
  window.__nnOnScreenFrames = 0;
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) window.__nnRestoredFromBfcache = true;
  });
  (() => {
    const start = performance.now();
    const tick = () => {
      const shell = document.querySelector("#nn-scroll-bookmarks-overlay-shell");
      if (shell instanceof HTMLElement &&
          getComputedStyle(shell).visibility !== "hidden" &&
          shell.getBoundingClientRect().left < window.innerWidth - 1) {
        window.__nnOnScreenFrames += 1;
      }
      if (performance.now() - start < 2000) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  })();
`;

const stubPage = (title: string, linkTo?: string): string =>
  `<!doctype html><html><head><title>${title}</title></head>` +
  `<body style="margin:0;font-family:sans-serif;background:#e8e8e8">` +
  `<h1 style="padding:24px">${title}</h1>` +
  (linkTo ? `<a id="go" href="${linkTo}" style="padding:24px">next</a>` : "") +
  `</body></html>`;

async function routeStubs(page: Page): Promise<void> {
  await page.context().route(`${PAGE_A}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: stubPage("Ford", PAGE_B) }),
  );
  await page.context().route(`${PAGE_B}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: stubPage("Tesla", PAGE_C) }),
  );
  await page.context().route(`${PAGE_C}**`, (route) =>
    route.fulfill({ contentType: "text/html", body: stubPage("Rivian") }),
  );
  await page.addInitScript(PAGE_PROBE);
}

/** Frames in which the panel was on screen since this document started — 0 means no flash at all. */
async function onScreenFramesSincePageStart(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __nnOnScreenFrames?: number })
        .__nnOnScreenFrames ?? 0,
  );
}

/** On-screen = mounted, visible and slid in. Absent counts as off-screen: minimized never mounts a shell. */
async function overlayOnScreen(page: Page): Promise<boolean> {
  return page.evaluate((selector) => {
    const shell = document.querySelector(selector);
    if (!(shell instanceof HTMLElement)) {
      return false;
    }
    const cs = getComputedStyle(shell);
    if (cs.visibility === "hidden") {
      return false;
    }
    return shell.getBoundingClientRect().left < window.innerWidth - 1;
  }, SHELL);
}

async function expectOnScreen(page: Page, on: boolean): Promise<void> {
  await expect
    .poll(() => overlayOnScreen(page), { timeout: 6000 })
    .toBe(on);
}

async function logRestoreMode(page: Page, label: string): Promise<void> {
  const bfcache = await page.evaluate(
    () => (window as unknown as { __nnRestoredFromBfcache?: boolean }).__nnRestoredFromBfcache === true,
  );
  console.log(`${label}: restored from bfcache = ${bfcache}`);
}

/** A → maximize → follow a link to B → minimize on B → Back. The client's exact report. */
test("minimizing on one page keeps NN minimized after the back button", async ({
  context,
  page,
}) => {
  await routeStubs(page);
  await page.goto(PAGE_A, { waitUntil: "load" });
  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, true);

  await page.click("#go");
  await page.waitForURL(PAGE_B);
  await expectOnScreen(page, true);

  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, false);

  await page.goBack({ waitUntil: "commit" });
  await page.waitForURL(PAGE_A, { waitUntil: "commit" });
  await logRestoreMode(page, "back to A");

  // A bfcache restore repaints the frozen DOM — panel included — before any script can run, so the
  // correction costs one frame. Measured in painted frames rather than asserted at t=0, which no
  // implementation could satisfy; a regression to a real flash shows up as tens of frames.
  const staleFrames = await page.evaluate(async (selector) => {
    let frames = 0;
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const tick = (): void => {
        const shell = document.querySelector(selector);
        const onScreen =
          shell instanceof HTMLElement &&
          getComputedStyle(shell).visibility !== "hidden" &&
          shell.getBoundingClientRect().left < window.innerWidth - 1;
        if (!onScreen || performance.now() - start > 2000) {
          resolve();
          return;
        }
        frames += 1;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    return frames;
  }, SHELL);
  console.log(`stale panel visible for ${staleFrames} frame(s) after Back`);
  expect(staleFrames, "NN is corrected within a frame or two").toBeLessThan(4);

  // And it stays gone — the async restore must not put it back a moment later.
  for (let i = 0; i < 20; i += 1) {
    expect(
      await overlayOnScreen(page),
      `sample ${i}: NN must stay minimized after Back`,
    ).toBe(false);
    await page.waitForTimeout(50);
  }
});

/**
 * The other half of the same bug. On a page the bfcache refuses, Back re-runs the content script, and its
 * per-origin open-hint still says "open" — the minimize happened on another origin, which cannot clear it.
 * Blocked here with an `unload` handler, the one bfcache disqualifier that needs no network.
 */
test("a page the bfcache refuses keeps NN minimized after the back button", async ({
  context,
  page,
}) => {
  await routeStubs(page);
  await page.context().route(`${PAGE_A}**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: stubPage("Ford", PAGE_B).replace(
        "</body>",
        "<script>window.addEventListener('unload', () => {});</script></body>",
      ),
    }),
  );

  await page.goto(PAGE_A, { waitUntil: "load" });
  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, true);

  await page.click("#go");
  await page.waitForURL(PAGE_B);
  await expectOnScreen(page, true);

  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, false);

  await page.goBack({ waitUntil: "commit" });
  await page.waitForURL(PAGE_A, { waitUntil: "commit" });
  await logRestoreMode(page, "back to a bfcache-ineligible A");

  // This page is built fresh, so nothing may paint the panel at all — measured from its first frame,
  // because the optimistic hint paint happens long before the test could sample it.
  await page.waitForTimeout(1200);
  const flashFrames = await onScreenFramesSincePageStart(page);
  console.log(`panel painted in ${flashFrames} frame(s) of the rebuilt page`);
  expect(flashFrames, "no flash of a stale open panel").toBe(0);
  expect(await overlayOnScreen(page), "still minimized").toBe(false);
});

/** The inverse: the re-sync must not close a panel the user left open. */
test("staying maximized survives the back button", async ({
  context,
  page,
}) => {
  await routeStubs(page);
  await page.goto(PAGE_A, { waitUntil: "load" });
  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, true);

  await page.click("#go");
  await page.waitForURL(PAGE_B);
  await expectOnScreen(page, true);

  await page.goBack({ waitUntil: "commit" });
  await page.waitForURL(PAGE_A, { waitUntil: "commit" });
  await logRestoreMode(page, "back to A");

  await expectOnScreen(page, true);
});

/** Client: "or navigate somewhere else even not using NN to navigate". */
test("minimized survives a forward navigation to a third site", async ({
  context,
  page,
}) => {
  await routeStubs(page);
  await page.goto(PAGE_A, { waitUntil: "load" });
  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, true);

  await page.click("#go");
  await page.waitForURL(PAGE_B);
  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, false);

  await page.goto(PAGE_C, { waitUntil: "load" });
  for (let i = 0; i < 10; i += 1) {
    expect(await overlayOnScreen(page), `sample ${i}`).toBe(false);
    await page.waitForTimeout(50);
  }
});

/** Client #2: the restore must slide in, not appear behind a fading frost. */
test("a cross-site restore slides NN in instead of fading it in", async ({
  context,
  page,
}) => {
  await routeStubs(page);
  await page.goto(PAGE_A, { waitUntil: "load" });
  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, true);

  // Sample the shell's left edge every frame from the moment the next page starts loading.
  await page.click("#go");
  await page.waitForURL(PAGE_B);
  const track = await page.evaluate(
    async ({ selector, ms }) => {
      // Fraction of the panel that is on screen: 0 = parked off the right edge, 1 = fully in view.
      const shown: number[] = [];
      let veilSeen = false;
      const deadline = performance.now() + ms;
      await new Promise<void>((resolve) => {
        const tick = (): void => {
          const shell = document.querySelector(selector);
          if (shell instanceof HTMLElement) {
            const rect = shell.getBoundingClientRect();
            if (getComputedStyle(shell).visibility !== "hidden" && rect.width > 0) {
              shown.push((window.innerWidth - rect.left) / rect.width);
            }
            if (shell.querySelector("#nn-overlay-loading-veil")) {
              veilSeen = true;
            }
          }
          if (performance.now() >= deadline) {
            resolve();
            return;
          }
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      });
      return { shown, veilSeen };
    },
    { selector: SHELL, ms: 2500 },
  );

  const offScreen = track.shown.filter((f) => f <= 0.01).length;
  const midSlide = track.shown.filter((f) => f > 0.01 && f < 0.99).length;
  const landed = track.shown.filter((f) => f >= 0.99).length;
  console.log(
    `slide samples: ${offScreen} parked, ${midSlide} mid-slide, ${landed} landed (veil seen: ${track.veilSeen})`,
  );

  expect(track.veilSeen, "the frosted veil is gone").toBe(false);
  expect(landed, "NN ends up fully on screen").toBeGreaterThan(0);
  // A jump-cut would go straight from parked to landed with nothing in between.
  expect(midSlide, "NN travels across frames (slide, not snap)").toBeGreaterThan(1);
});

/** The reveal waits for the panel's first frame — but never on a page that will not finish loading. */
test("a page that never finishes loading still gets NN back", async ({
  context,
  page,
}) => {
  await routeStubs(page);
  // A subresource that never responds: the document stays in "loading" for the whole test.
  await page.context().route("https://www.tesla.com/never-ends.js", () => {
    /* deliberately never fulfilled */
  });
  await page.context().route(`${PAGE_B}**`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body:
        `<!doctype html><html><head><title>Tesla</title>` +
        `<script src="https://www.tesla.com/never-ends.js"></script></head>` +
        `<body style="margin:0;background:#e8e8e8"><h1>Tesla</h1></body></html>`,
    }),
  );

  await page.goto(PAGE_A, { waitUntil: "load" });
  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, true);

  await page.click("#go");
  await page.waitForURL(PAGE_B, { waitUntil: "commit" });

  // Cap is 700ms after the panel mounts; 4s covers the content-script injection on a stalled document.
  await expect
    .poll(() => overlayOnScreen(page), { timeout: 4000 })
    .toBe(true);
});

/** Reads the panel through the iframe's document: Playwright's frame handle goes stale across a bfcache
 *  restore, so any frameLocator hangs even though the panel is right there. */
async function panelState(
  page: Page,
): Promise<{ titles: string[]; tabs: string[] }> {
  return page.evaluate((selector) => {
    const frame = document
      .querySelector(selector)
      ?.querySelector("iframe") as HTMLIFrameElement | null;
    const doc = frame?.contentDocument;
    return {
      titles: [...(doc?.querySelectorAll("[data-note-title]") ?? [])].map(
        (input) => (input as HTMLInputElement).value,
      ),
      tabs: [...(doc?.querySelectorAll('[data-slot="tabs-trigger"]') ?? [])].map(
        (tab) => `${tab.textContent}:${tab.getAttribute("aria-selected")}`,
      ),
    };
  }, SHELL);
}

/**
 * A bfcache-restored panel resumes with the data it was frozen with: `chrome.storage.onChanged` events
 * fired while frozen were never delivered, so a note added on the other page would be missing until a
 * manual refresh.
 */
test("a note added on the next page is there after the back button", async ({
  context,
  page,
}) => {
  test.setTimeout(90_000);
  await routeStubs(page);
  await page.goto(PAGE_A, { waitUntil: "load" });
  await toggleOverlayForTab(context, page);
  await expectOnScreen(page, true);

  const overlay = page.frameLocator("#nn-scroll-bookmarks-overlay-shell iframe");
  await createSubjectTab(overlay, "GARAGE");
  await addNote(overlay, "FIRST");
  expect(await titleValues(overlay)).toEqual(["FIRST"]);

  await page.click("#go");
  await page.waitForURL(PAGE_B);
  await expectOnScreen(page, true);
  await addNote(overlay, "SECOND");
  expect(await titleValues(overlay)).toEqual(["SECOND", "FIRST"]);

  await page.goBack({ waitUntil: "commit" });
  await page.waitForURL(PAGE_A, { waitUntil: "commit" });
  await logRestoreMode(page, "back to A");
  await expectOnScreen(page, true);

  // The frozen panel knew only about FIRST; the restore has to pull SECOND in.
  await expect
    .poll(async () => (await panelState(page)).titles, { timeout: 8000 })
    .toEqual(["SECOND", "FIRST"]);
  expect((await panelState(page)).tabs, "subject tab still selected").toEqual([
    "GARAGE:true",
  ]);
});
