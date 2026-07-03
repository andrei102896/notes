import { type Page } from "@playwright/test";

import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

/** Computed opacity of the top note's dim wrapper (opacity-40 while it is in the dragged set). */
async function topNoteOpacity(page: Page): Promise<string> {
  return page
    .frameLocator("#nn-scroll-bookmarks-overlay-shell iframe")
    .locator("[data-note-id] > div")
    .first()
    .evaluate((el) => getComputedStyle(el).opacity);
}

test.describe("reorder drag cleanup", () => {
  test("a note is not left dimmed when a reorder drag is released outside the panel", async ({
    page,
    overlay,
  }) => {
    test.setTimeout(60_000);
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "ONE");
    await addNote(overlay, "TWO");
    // addNote's fill leaves the title focused; blur so the header is a drag handle (as when a user reorders).
    await overlay.getByLabel("Note heading").first().blur();

    const iframe = await page
      .locator("#nn-scroll-bookmarks-overlay-shell iframe")
      .boundingBox();
    const card = await overlay
      .locator('[data-slot="card"]')
      .first()
      .boundingBox();
    if (!iframe || !card) {
      throw new Error("layout not measured");
    }

    const pressX = card.x + 30;
    const pressY = card.y + 10; // note header (drag handle)

    await page.mouse.move(pressX, pressY);
    await page.mouse.down();
    await page.mouse.move(pressX, pressY + 8, { steps: 2 });
    await page.mouse.move(pressX, pressY + 20, { steps: 4 }); // exceed 4px → dragStart

    // Sanity: the drag actually started, so the row is dimmed mid-drag (state re-render is async).
    await expect.poll(() => topNoteOpacity(page), { timeout: 2000 }).toBe("0.4");

    // Release the pointer OUTSIDE the panel iframe (on the host page, to its left).
    await page.mouse.move(iframe.x - 60, pressY + 20, { steps: 3 });
    await page.mouse.up();

    // After releasing, the note must not stay stuck in the dimmed reorder state.
    await expect.poll(() => topNoteOpacity(page), { timeout: 4000 }).toBe("1");
  });
});
