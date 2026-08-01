import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

const TEST_URL = "https://nn-test.local/";
const LINK_TARGET = "https://nn-test.local/target/";

/** Records the host shell's state + whether a pick layer / navigation happened, sampled over `ms`. */
async function sampleShell(page: import("@playwright/test").Page, ms: number) {
  return page.evaluate(async (total) => {
    const samples: Array<{
      t: number;
      attached: boolean;
      visibility: string;
      transform: string;
      pickLayer: boolean;
      url: string;
    }> = [];
    const steps = Math.floor(total / 100);
    for (let i = 0; i < steps; i += 1) {
      const shell = document.getElementById(
        "nn-scroll-bookmarks-overlay-shell",
      );
      const cs = shell ? getComputedStyle(shell) : null;
      samples.push({
        t: i * 100,
        attached: Boolean(shell),
        visibility: cs?.visibility ?? "-",
        transform: cs?.transform ?? "-",
        pickLayer: Boolean(
          document.getElementById("nn-scroll-bookmarks-anchor-pick-layer"),
        ),
        url: location.href,
      });
      await new Promise((r) => setTimeout(r, 100));
    }
    return samples;
  }, ms);
}

test("anchor pick on inert content keeps the overlay", async ({
  page,
  overlay,
}) => {
  test.setTimeout(60_000);
  await createSubjectTab(overlay, "GARAGE");
  await addNote(overlay, "NOTE");
  await overlay.getByLabel("Note URL").fill(TEST_URL);
  await overlay.getByLabel("Note URL").blur();

  await overlay.getByRole("button", { name: "Pick page anchor" }).click();
  const layer = page.locator("#nn-scroll-bookmarks-anchor-pick-layer");
  await layer.waitFor({ state: "visible", timeout: 5000 });
  await page.mouse.click(150, 400);
  await layer.waitFor({ state: "detached", timeout: 5000 });

  const timeline = await sampleShell(page, 2000);
  console.log("INERT TIMELINE:\n" + JSON.stringify(timeline.at(-1)));
  const shell = page.locator("#nn-scroll-bookmarks-overlay-shell");
  await expect(shell).toHaveCSS("visibility", "visible");
});

test("anchor pick whose click lands on a link", async ({ context, page }) => {
  test.setTimeout(60_000);
  // A page that is one big navigating link, so a leaked pick-click hits it.
  await context.route(`${TEST_URL}`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><title>host</title></head><body style="margin:0">
        <a href="${LINK_TARGET}" id="big" style="display:block;width:100vw;height:100vh;background:#dde">BIG LINK</a>
        </body></html>`,
    }),
  );
  await context.route(`${LINK_TARGET}`, (route) =>
    route.fulfill({
      contentType: "text/html",
      body: `<!doctype html><html><head><title>target</title></head><body style="margin:0"><h1>TARGET PAGE</h1></body></html>`,
    }),
  );
  await page.goto(TEST_URL, { waitUntil: "load" });

  const { toggleOverlay } = await import("./fixtures");
  await toggleOverlay(context, page);
  const overlay = page.frameLocator(
    "#nn-scroll-bookmarks-overlay-shell iframe",
  );
  await overlay
    .locator("#nn-scroll-bookmarks-overlay-host")
    .waitFor({ state: "attached", timeout: 10_000 });

  await createSubjectTab(overlay, "GARAGE");
  await addNote(overlay, "NOTE");
  await overlay.getByLabel("Note URL").fill(TEST_URL);
  await overlay.getByLabel("Note URL").blur();

  await overlay.getByRole("button", { name: "Pick page anchor" }).click();
  const layer = page.locator("#nn-scroll-bookmarks-anchor-pick-layer");
  await layer.waitFor({ state: "visible", timeout: 5000 });
  // Drop the anchor squarely on the link.
  await page.mouse.click(400, 400);

  const timeline = await sampleShell(page, 2500);
  console.log("LINK TIMELINE:\n" + JSON.stringify(timeline, null, 2));

  // Did the click leak into a navigation?
  const navigated = timeline.some((s) => s.url.includes("/target"));
  console.log(
    "NAVIGATED:",
    navigated,
    "FINAL:",
    JSON.stringify(timeline.at(-1)),
  );

  // Whatever happened, the overlay must end up visible (persistent).
  const shell = page.locator("#nn-scroll-bookmarks-overlay-shell");
  await expect(shell).toHaveCSS("visibility", "visible", { timeout: 8000 });
});
