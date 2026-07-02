import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

/** Baselines = the app's current approved design (tests/e2e/__screenshots__). Refresh deliberately with `npm run test:e2e:update` after an intended design change. */
test.describe("visual baselines", () => {
  test("dashboard header band", async ({ overlay }) => {
    await expect(overlay.locator("header")).toHaveScreenshot("header.png");
  });

  test("first-run empty state", async ({ overlay }) => {
    await expect(
      overlay.locator('[aria-label="Dashboard content"]'),
    ).toHaveScreenshot("first-run.png");
  });

  test("add subject tab modal", async ({ overlay }) => {
    await overlay
      .locator('[aria-label="Subject tabs"] button[aria-haspopup="dialog"]')
      .click();
    const dialog = overlay.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: "visible" });
    await expect(dialog).toHaveScreenshot("add-subject-tab-modal.png");
  });

  test("destructive confirm modal", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await overlay.getByRole("button", { name: "Delete Tab" }).click();
    const dialog = overlay.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: "visible" });
    await expect(dialog).toHaveScreenshot("delete-confirm-modal.png");
  });

  test("note card expanded", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "NOTE TITLE");
    await overlay.locator("[data-note-body]").fill("Body sample text");
    // Park focus on the header so no caret/focus ring is in frame.
    await overlay.locator("header").click();
    await expect(overlay.locator('[data-slot="card"]')).toHaveScreenshot(
      "note-card.png",
    );
  });

  test("full panel with two tabs and notes", async ({ overlay, page }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "ALPHA NOTE");
    await createSubjectTab(overlay, "BRAVO");
    await addNote(overlay, "TOP NOTE");
    await addNote(overlay, "SECOND NOTE");
    await overlay.locator("header").click();
    // The iframe element itself — captures the whole panel incl. A–Z strip and frosted area.
    await expect(
      page.locator("#nn-scroll-bookmarks-overlay-shell iframe"),
    ).toHaveScreenshot("full-panel.png");
  });
});
