import { expect, test } from "./fixtures";
import {
  addNote,
  clickSubjectTab,
  createSubjectTab,
  dblclickSubjectTab,
} from "./helpers";


/** The dashboard modal BG behind every small modal (Figma DASHBOARD MODAL BG): full-panel, logo-only header, no tagline. */
test("dashboard modal backdrop fills the panel behind the rename modal", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "ASTRO");
  await dblclickSubjectTab(overlay, "ASTRO");

  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);

  const host = overlay.locator("#nn-scroll-bookmarks-overlay-host");
  const dialogBox = await dialog.boundingBox();
  const hostBox = await host.boundingBox();
  if (!dialogBox || !hostBox) {
    throw new Error("dialog or host not measurable");
  }
  expect(dialogBox.width).toBeGreaterThan(hostBox.width * 0.95);
  expect(dialogBox.height).toBeGreaterThan(hostBox.height * 0.95);

  // Plate flush to the panel's outer top: no border may sit above the bar.
  const backdropPlateGap = await host.evaluate((hostEl) => {
    const plate = hostEl.ownerDocument.querySelector(
      '[data-slot="dialog-content"] [data-nn-metal-bar] [data-nn-plate]',
    )!;
    return (
      plate.getBoundingClientRect().top - hostEl.getBoundingClientRect().top
    );
  });
  expect(Math.abs(backdropPlateGap)).toBeLessThan(0.6);

  // Client rule: the backdrop bar stands where the brand band was, so it carries the DASHBOARD plate, not
  // the purchase one — same artwork as the modal box's own bar. The visual baselines cannot guard this: the
  // plate is small enough that swapping its artwork stays under maxDiffPixelRatio and they still pass.
  const artwork = await overlay
    .locator('[data-slot="dialog-content"]')
    .evaluate((dlg) => {
      const read = (el: Element) => {
        const svg = el.querySelector("svg") as unknown as SVGSVGElement;
        const vb = svg.viewBox.baseVal;
        return `${vb.width}x${vb.height} ${getComputedStyle(svg.querySelector("path")!).stroke}`;
      };
      const plates = [...dlg.querySelectorAll("[data-nn-plate]")];
      return {
        topBar: read(plates.find((p) => !p.closest("[data-nn-modal-box]"))!),
        modalBox: read(plates.find((p) => p.closest("[data-nn-modal-box]"))!),
      };
    });
  console.log(`backdrop plate ${artwork.topBar} vs modal box ${artwork.modalBox}`);
  expect(artwork.topBar, "backdrop bar carries the dashboard plate").toBe(
    artwork.modalBox,
  );

  // Backdrop chrome present: ghost NN + logo plate; tagline and trial/buy boxes are purchase-only.
  await expect(overlay.locator("[data-modal-ghost]")).toBeVisible();
  await expect(overlay.getByText("NOTESFORNET")).toBeVisible();
  await expect(overlay.getByText(/PRECISE WEBPAGE/)).toHaveCount(0);
  await expect(overlay.locator("[data-paywall-trial-box]")).toHaveCount(0);
  await expect(overlay.getByRole("button", { name: "Buy now" })).toHaveCount(0);

  // Inspection artifact for design review.
  await page.screenshot({ path: testInfo.outputPath("dashboard-backdrop.png") });

  // The rename modal still works on top of the backdrop.
  const input = overlay.locator("input[data-subject-name-input]");
  await expect(input).toBeVisible();
  await input.fill("NEBULA");
  await overlay.getByRole("button", { name: "OK" }).click();
  await expect(dialog).toBeHidden();
  await expect(overlay.getByRole("tab", { name: "NEBULA" })).toBeVisible();
});

/** Universal destructive confirm (Figma DELETE NOTE | SUB TAB UNIVERSAL MODAL): fixed 467×189, never stretched. */
test("delete confirm modal keeps its fixed Figma box", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "ASTRO");
  await addNote(overlay, "DOOMED");
  await overlay.locator('[aria-label="Delete note"]').first().click();

  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);

  const cancel = overlay.getByRole("button", { name: "Cancel" });
  const ok = overlay.getByRole("button", { name: "OK" });
  await expect(cancel).toBeVisible();
  await expect(ok).toBeVisible();

  // Assert the Figma 467×189 ratio, not a stretched panel.
  const box = await overlay.locator("[data-nn-modal-box]").boundingBox();
  const host = await overlay
    .locator("#nn-scroll-bookmarks-overlay-host")
    .boundingBox();
  if (!box || !host) {
    throw new Error("confirm box or host not measurable");
  }
  expect(box.width / box.height).toBeCloseTo(467 / 189, 1);
  expect(box.width).toBeLessThan(host.width * 0.9);

  // Buttons sit side by side, equal width (Figma 109.11 each).
  const cancelBox = await cancel.boundingBox();
  const okBox = await ok.boundingBox();
  if (!cancelBox || !okBox) {
    throw new Error("confirm buttons not measurable");
  }
  expect(Math.abs(cancelBox.width - okBox.width)).toBeLessThan(2);
  expect(Math.abs(cancelBox.y - okBox.y)).toBeLessThan(2);

  await page.screenshot({ path: testInfo.outputPath("delete-confirm.png") });

  // CANCEL dismisses without deleting.
  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect(overlay.locator("[data-note-title]")).toHaveCount(1);
});

/** Dashboard empty state (Figma "SELECT A SUB TAB.. VIEW EDIT, ETC"): same 467×189 modal box, message only. */
test("empty-state modal box matches the confirm modal shell", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "ASTRO");
  // Clicking the active tab deselects it → "select or create" empty state.
  await clickSubjectTab(overlay, "ASTRO");

  const box = overlay.locator("[data-nn-modal-box]");
  await expect(box).toBeVisible();
  await expect(overlay.getByText(/to view, edit or add notes to/i)).toBeVisible();

  const boxSize = await box.boundingBox();
  if (!boxSize) {
    throw new Error("empty-state box not measurable");
  }
  expect(boxSize.width / boxSize.height).toBeCloseTo(467 / 189, 1);

  await page.screenshot({ path: testInfo.outputPath("empty-state.png") });
});

/** First-run modal (Figma "CREATE A SUBJECT TAB..."): same 467×189 shell, message + the square "+". */
test("first-run modal shows the + inside the shared modal shell", async ({
  overlay,
  page,
}, testInfo) => {
  const box = overlay.locator("[data-nn-modal-box]");
  await expect(box).toBeVisible();
  // Let the overlay's slide-in settle before geometry/pixel reads.
  await page.waitForTimeout(400);
  await expect(
    overlay.getByText(/create a subject tab by clicking/i),
  ).toBeVisible();

  const plus = overlay.locator(
    '[aria-label="Dashboard content"] [aria-label="Add subject tab"]',
  );
  await expect(plus).toBeVisible();

  const boxSize = await box.boundingBox();
  const plusSize = await plus.boundingBox();
  if (!boxSize || !plusSize) {
    throw new Error("first-run box or + not measurable");
  }
  expect(boxSize.width / boxSize.height).toBeCloseTo(467 / 189, 1);
  // Square, superseding Figma "Rectangle 28" (41×39), which left 5.5px of blue at the sides vs 4.5px above.
  expect(plusSize.width / plusSize.height).toBeCloseTo(1, 2);

  await overlay
    .locator('[aria-label="Dashboard content"]')
    .screenshot({ path: testInfo.outputPath("first-run-modal.png") });
});

/** Add/rename modal (Figma "ADD SUBJECT TAB MODAL 1", 467×211) plus the client's input notes: fixed
 *  field, 25-char cap including spaces, centred text. */
test("subject tab name modal matches the fixed-field spec", async ({
  overlay,
  page,
}, testInfo) => {
  await overlay
    .locator('[aria-label="Subject tabs"] button[aria-haspopup="dialog"]')
    .click();
  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await expect(dialog).toBeVisible();
  await page.waitForTimeout(400);

  const box = overlay.locator("[data-nn-modal-box]");
  const input = overlay.locator("input[data-subject-name-input]");
  await expect(box).toBeVisible();
  await expect(input).toBeVisible();

  const boxSize = await box.boundingBox();
  const emptySize = await input.boundingBox();
  if (!boxSize || !emptySize) {
    throw new Error("name modal box or input not measurable");
  }
  expect(boxSize.width / boxSize.height).toBeCloseTo(467 / 211, 1);

  // 25 chars incl. spaces is accepted whole; the 26th is refused.
  const NAME_25 = "Astronomy Basics 01 WDKLW";
  await input.fill(NAME_25);
  await expect(input).toHaveValue(NAME_25);
  await input.pressSequentially("X");
  await expect(input).toHaveValue(NAME_25);

  // Field width is fixed — a full name must not grow the box.
  const fullSize = await input.boundingBox();
  if (!fullSize) {
    throw new Error("filled input not measurable");
  }
  expect(Math.abs(fullSize.width - emptySize.width)).toBeLessThan(1);
  await expect(input).toHaveCSS("text-align", "center");

  await overlay
    .locator("[data-nn-modal-box]")
    .screenshot({ path: testInfo.outputPath("name-modal.png") });

  await overlay.getByRole("button", { name: "OK" }).click();
  await expect(dialog).toBeHidden();
  await expect(overlay.getByRole("tab")).toHaveCount(1);

  // How a full-length name lands in the strip.
  await overlay
    .locator('[aria-label="Subject tabs"]')
    .screenshot({ path: testInfo.outputPath("strip-long-name.png") });
});

/** Rename modal (Figma "RENAME SUB TAB MODAL 25-CHARACTER"): same box and field as add, its own label
 *  size, name pre-filled and selected. */
test("rename subject tab modal matches the rename spec", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "ASTRO");
  await dblclickSubjectTab(overlay, "ASTRO");

  const box = overlay.locator("[data-nn-modal-box]");
  const label = box.locator("label");
  const input = overlay.locator("input[data-subject-name-input]");
  await expect(box).toBeVisible();
  await page.waitForTimeout(400);

  await expect(label).toHaveText("Rename subject tab");
  await expect(label).toHaveCSS("text-transform", "uppercase");
  await expect(input).toHaveValue("ASTRO");

  // Pre-filled name opens selected so typing replaces it.
  const selection = await input.evaluate((el) => {
    const field = el as HTMLInputElement;
    return field.value.slice(field.selectionStart ?? 0, field.selectionEnd ?? 0);
  });
  expect(selection).toBe("ASTRO");

  // Figma sizes as a share of the panel's root font / box, so the check holds at any panel width.
  const geom = await box.evaluate((el) => {
    const rootPx = parseFloat(
      getComputedStyle(el.ownerDocument.documentElement).fontSize,
    );
    const rect = el.getBoundingClientRect();
    const field = el.querySelector("input")!.getBoundingClientRect();
    const ok = el.querySelector("button:last-of-type")!;
    return {
      boxRatio: rect.width / rect.height,
      fieldWidthShare: field.width / rect.width,
      fieldHeightRem: field.height / rootPx,
      labelRem: parseFloat(getComputedStyle(el.querySelector("label")!).fontSize) / rootPx,
      okRem: parseFloat(getComputedStyle(ok).fontSize) / rootPx,
    };
  });
  expect(geom.boxRatio).toBeCloseTo(467 / 211, 1);
  expect(geom.fieldWidthShare).toBeCloseTo(245 / 467, 2);
  expect(geom.fieldHeightRem).toBeCloseTo(39 / 16, 1);
  expect(geom.labelRem).toBeCloseTo(20 / 16, 2);
  expect(geom.okRem).toBeCloseTo(24 / 16, 2);

  await box.screenshot({ path: testInfo.outputPath("rename-modal.png") });

  await input.fill("Astronomy Basics 01 WDKLW");
  await overlay.getByRole("button", { name: "OK" }).click();
  await expect(box).toBeHidden();
  await expect(
    overlay.getByRole("tab", { name: "ASTRONOMY BASICS 01 WDKLW" }),
  ).toBeVisible();
});
