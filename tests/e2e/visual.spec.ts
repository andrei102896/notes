import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

/** Baselines = the app's current approved design (tests/e2e/__screenshots__). Refresh deliberately with `npm run test:e2e:update` after an intended design change. */
test.describe("visual baselines", () => {
  // A tab first: on first run the full-panel backdrop covers the nav row, which is not what this depicts.
  test("dashboard header band", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await expect(overlay.locator("header")).toHaveScreenshot("header.png");
  });

  // Whole panel, not just the content area: first run IS the full-panel backdrop (client 2026-07-31).
  test("first-run empty state", async ({ overlay }) => {
    await expect(
      overlay.locator("#nn-scroll-bookmarks-overlay-host"),
    ).toHaveScreenshot("first-run.png");
  });

  test("add subject tab modal", async ({ overlay }) => {
    // First run's backdrop covers the strip, so the box's "+" is the reachable one (same dialog).
    await overlay
      .locator('[data-nn-modal-box] [aria-label="Add subject tab"]')
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
