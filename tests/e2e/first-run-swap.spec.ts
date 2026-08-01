import { expect, test } from "./fixtures";

/** From the first-run screen, "+" must SWAP the box for the add-subject one without the full-panel backdrop
 *  reloading (that read as a flicker): one backdrop in the DOM, and its pixels steady through the swap. */
test("the first-run + swaps the box without reloading the backdrop", async ({
  overlay,
  page,
}, testInfo) => {
  await page.waitForTimeout(700);
  const host = overlay.locator("#nn-scroll-bookmarks-overlay-host");
  const backdrops = overlay.locator("[data-modal-ghost]");
  const box = overlay.locator("[data-nn-modal-box]");

  await expect(backdrops, "one backdrop on first run").toHaveCount(1);
  await expect(
    overlay.getByText(/create a subject tab by clicking/i),
  ).toBeVisible();

  // Sample the backdrop where no box covers it: it must stay dark through the whole transition.
  const hostBox = await host.boundingBox();
  if (!hostBox) {
    throw new Error("host not measurable");
  }
  const probe = {
    x: hostBox.x + hostBox.width * 0.5,
    y: hostBox.y + hostBox.height * 0.85,
  };
  const sample = async () => {
    const shot = await page.screenshot({
      clip: { x: probe.x, y: probe.y, width: 1, height: 1 },
    });
    return page.evaluate(
      async (dataUrl) => {
        const img = await new Promise<HTMLImageElement>((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = dataUrl;
        });
        const c = document.createElement("canvas");
        c.width = img.width;
        c.height = img.height;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(img, 0, 0);
        const px = ctx.getImageData(0, 0, 1, 1).data;
        return 0.299 * px[0] + 0.587 * px[1] + 0.114 * px[2];
      },
      `data:image/png;base64,${shot.toString("base64")}`,
    );
  };

  const before = await sample();
  await overlay
    .locator('[data-nn-modal-box] [aria-label="Add subject tab"]')
    .click();

  // Frames through the transition: the dashboard behind is light (frosted white), the backdrop is dark.
  const frames: number[] = [];
  for (let i = 0; i < 12; i += 1) {
    frames.push(await sample());
  }
  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);
  const after = await sample();
  console.log(
    `backdrop luminance — before ${before.toFixed(0)}, during ${frames.map((f) => f.toFixed(0)).join(",")}, after ${after.toFixed(0)}`,
  );

  // Still exactly one backdrop: the dialog draws only its box on first run.
  await expect(
    backdrops,
    "the dialog must not add a second backdrop",
  ).toHaveCount(1);
  await expect(
    box,
    "one box at a time — the create box swapped out",
  ).toHaveCount(1);
  await expect(overlay.locator("input[data-subject-name-input]")).toBeVisible();
  await expect(
    overlay.getByText(/create a subject tab by clicking/i),
  ).toBeHidden();

  // The backdrop pixel must not move in EITHER direction: lighter = it unmounted and the dashboard showed
  // through; darker = the dialog's own dimming overlay landed on top. Both read as a reload.
  for (const [i, frame] of [...frames, after].entries()) {
    expect(
      Math.abs(frame - before),
      `frame ${i} shifted the backdrop from ${before.toFixed(0)} to ${frame.toFixed(0)}`,
    ).toBeLessThan(6);
  }

  await host.screenshot({ path: testInfo.outputPath("first-run-add-box.png") });

  // CANCEL swaps back to the create box, still on the same backdrop.
  await overlay.getByRole("button", { name: "Cancel" }).click();
  await expect(
    overlay.getByText(/create a subject tab by clicking/i),
  ).toBeVisible();
  await expect(backdrops).toHaveCount(1);
});
