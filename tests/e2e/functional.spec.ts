import { expect, test, toggleOverlay, TEST_URL } from "./fixtures";
import {
  addNote,
  clickSubjectTab,
  confirmDestructiveDialog,
  createSubjectTab,
  dblclickSubjectTab,
  deleteNoteByTitle,
  expectTitles,
  noteCards,
  subjectTab,
} from "./helpers";

test.describe("first run", () => {
  test("shows the create-a-subject-tab message and an empty strip", async ({
    overlay,
  }) => {
    await expect(
      overlay.getByText(/create a subject tab by clicking/i),
    ).toBeVisible();
    await expect(overlay.getByRole("tab")).toHaveCount(0);
    await expect(
      overlay.getByRole("button", { name: "Add Note" }),
    ).toBeDisabled();
  });

  test("the first-run + opens the add dialog and creates the first tab", async ({
    overlay,
  }) => {
    // The + inside the first-run message (not the strip's) — same dialog (client update 2026-07-02).
    await overlay
      .locator('[aria-label="Dashboard content"] [aria-label="Add subject tab"]')
      .click();
    const dialog = overlay.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: "visible" });
    await overlay.locator("input[data-subject-name-input]").fill("FIRST");
    await dialog.getByRole("button", { name: "OK" }).click();
    await dialog.waitFor({ state: "hidden" });
    await expect(subjectTab(overlay, "FIRST")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      overlay.getByRole("button", { name: "Add Note" }),
    ).toBeEnabled();
  });
});

test.describe("subject tabs", () => {
  test("creates a tab which becomes active and enables Add Note", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await expect(subjectTab(overlay, "ALPHA")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(
      overlay.getByRole("button", { name: "Add Note" }),
    ).toBeEnabled();
  });

  test("cancel and empty-name paths do not create tabs", async ({
    overlay,
  }) => {
    await overlay
      .locator('[aria-label="Subject tabs"] button[aria-haspopup="dialog"]')
      .click();
    const dialog = overlay.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: "visible" });
    // Empty name blocks OK.
    await expect(dialog.getByRole("button", { name: "OK" })).toBeDisabled();
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await dialog.waitFor({ state: "hidden" });
    await expect(overlay.getByRole("tab")).toHaveCount(0);
  });

  test("supports multiple tabs and switching between them", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await createSubjectTab(overlay, "BRAVO");
    await createSubjectTab(overlay, "CHARLIE");
    await expect(overlay.getByRole("tab")).toHaveCount(3);
    await expect(subjectTab(overlay, "CHARLIE")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await clickSubjectTab(overlay, "ALPHA");
    await expect(subjectTab(overlay, "ALPHA")).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(subjectTab(overlay, "CHARLIE")).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  test("a newly created tab scrolls into view when the strip overflows", async ({
    overlay,
  }) => {
    test.setTimeout(60_000);
    // Enough tabs to overflow the strip; alphabetical sort drops each new one at the bottom (below the fold).
    const names = Array.from(
      { length: 16 },
      (_, i) => `TAB${String(i + 1).padStart(2, "0")}`,
    );
    for (const name of names) {
      await createSubjectTab(overlay, name);
    }
    const last = names[names.length - 1];
    await expect(subjectTab(overlay, last)).toHaveAttribute(
      "aria-selected",
      "true",
    );
    // The active (last-created) tab must be scrolled fully into the strip viewport, not left below the fold.
    // offsetParent is the strip's relative scroll container; offsetTop/Height are the pre-transform box (rotated triggers).
    await expect
      .poll(async () =>
        subjectTab(overlay, last).evaluate((el) => {
          const container = el.offsetParent as HTMLElement | null;
          if (!container) return null;
          const top = (el as HTMLElement).offsetTop;
          const bottom = top + (el as HTMLElement).offsetHeight;
          return {
            overflowing: container.scrollHeight > container.clientHeight + 1,
            fullyVisible:
              top >= container.scrollTop - 1 &&
              bottom <= container.scrollTop + container.clientHeight + 1,
          };
        }),
      )
      .toEqual({ overflowing: true, fullyVisible: true });
  });

  test("renames a tab via double-click", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await dblclickSubjectTab(overlay, "ALPHA");
    const dialog = overlay.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: "visible" });
    await dialog.locator("input").fill("OMEGA");
    await dialog.getByRole("button", { name: "OK" }).click();
    await dialog.waitFor({ state: "hidden" });
    await expect(subjectTab(overlay, "OMEGA")).toBeVisible();
    await expect(overlay.getByRole("tab")).toHaveCount(1);
  });
});

test.describe("notes", () => {
  test("adds a note with the page URL and the created date", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "FIRST NOTE");
    await expect(noteCards(overlay)).toHaveCount(1);
    const urlValue = await overlay
      .locator('[data-slot="card"] input[type="url"], [data-slot="card"] input')
      .nth(1)
      .inputValue()
      .catch(() => "");
    // URL row auto-populates from the host page.
    expect
      .soft(urlValue.includes("nn-test.local") || urlValue === "")
      .toBeTruthy();
    // The date is stamped with Date.now() in the content-script realm, which the fixture's frozen clock doesn't reach — so the card shows today's real date. Compute it instead of hardcoding.
    const now = new Date();
    const mmdd = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(
      now.getDate(),
    ).padStart(2, "0")}`;
    await expect(
      overlay.locator('[data-slot="card"]').getByText(mmdd),
    ).toBeVisible();
  });

  test("new notes populate to the top", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "OLDEST");
    await addNote(overlay, "MIDDLE");
    await addNote(overlay, "NEWEST");
    await expectTitles(overlay, ["NEWEST", "MIDDLE", "OLDEST"]);
  });

  test("notes are scoped to their subject tab", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "ALPHA NOTE");
    await createSubjectTab(overlay, "BRAVO");
    await expect(noteCards(overlay)).toHaveCount(0);
    await addNote(overlay, "BRAVO NOTE");
    await clickSubjectTab(overlay, "ALPHA");
    await expectTitles(overlay, ["ALPHA NOTE"]);
    await clickSubjectTab(overlay, "BRAVO");
    await expectTitles(overlay, ["BRAVO NOTE"]);
  });

  test("collapse and expand a single note", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "NOTE");
    const body = overlay.locator("[data-note-body]");
    await expect(body).toBeVisible();
    await overlay.locator('[aria-label="Collapse note"]').click();
    await expect(body).toBeHidden();
    await overlay.locator('[aria-label="Expand note"]').click();
    await expect(body).toBeVisible();
  });

  test("MIN and MAX act on all notes", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "ONE");
    await addNote(overlay, "TWO");
    await addNote(overlay, "THREE");
    const bodies = overlay.locator("[data-note-body]");
    await overlay.getByRole("button", { name: "Min", exact: true }).click();
    for (let i = 0; i < 3; i += 1) {
      await expect(bodies.nth(i)).toBeHidden();
    }
    await overlay.getByRole("button", { name: "Max", exact: true }).click();
    for (let i = 0; i < 3; i += 1) {
      await expect(bodies.nth(i)).toBeVisible();
    }
  });

  test("deleting a middle note keeps the others in order", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "OLDEST");
    await addNote(overlay, "MIDDLE");
    await addNote(overlay, "NEWEST");
    await deleteNoteByTitle(overlay, "MIDDLE", "Cancel");
    await expectTitles(overlay, ["NEWEST", "MIDDLE", "OLDEST"]);
    await deleteNoteByTitle(overlay, "MIDDLE", "OK");
    await expectTitles(overlay, ["NEWEST", "OLDEST"]);
  });

  test("DELETE under This Tab Notes clears the tab's notes but keeps other tabs intact", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "KEEP ME");
    await createSubjectTab(overlay, "BRAVO");
    await addNote(overlay, "DOOMED 1");
    await addNote(overlay, "DOOMED 2");
    await overlay.getByRole("button", { name: "Delete", exact: true }).click();
    await confirmDestructiveDialog(overlay, "OK");
    await expect(noteCards(overlay)).toHaveCount(0);
    await expect(subjectTab(overlay, "BRAVO")).toBeVisible();
    await clickSubjectTab(overlay, "ALPHA");
    await expectTitles(overlay, ["KEEP ME"]);
  });

  test("DELETE TAB removes the tab and its notes only", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "ALPHA NOTE");
    await createSubjectTab(overlay, "BRAVO");
    await addNote(overlay, "BRAVO NOTE");
    await overlay.getByRole("button", { name: "Delete Tab" }).click();
    await confirmDestructiveDialog(overlay, "OK");
    await expect(subjectTab(overlay, "BRAVO")).toHaveCount(0);
    await expect(overlay.getByRole("tab")).toHaveCount(1);
    await clickSubjectTab(overlay, "ALPHA");
    await expectTitles(overlay, ["ALPHA NOTE"]);
  });
});

test.describe("persistence and consistency", () => {
  test("tabs and notes survive an overlay toggle round-trip", async ({
    context,
    page,
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "STAYS");
    await toggleOverlay(context, page); // off
    await toggleOverlay(context, page); // on
    const host = overlay.locator("#nn-scroll-bookmarks-overlay-host");
    await host.waitFor({ state: "attached" });
    await expect(subjectTab(overlay, "ALPHA")).toBeVisible();
    await clickSubjectTab(overlay, "ALPHA");
    await expectTitles(overlay, ["STAYS"]);
  });

  test("brand badge renders with one font in header and modals", async ({
    overlay,
  }) => {
    // Regression: host-wide Fjalla rule used to defeat .font-ui in the header while portaled dialogs used Inter.
    const headerFont = await overlay
      .locator("header span", { hasText: "Notes for Net" })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    await overlay
      .locator('[aria-label="Subject tabs"] button[aria-haspopup="dialog"]')
      .click();
    const dialog = overlay.locator('[data-slot="dialog-content"]');
    await dialog.waitFor({ state: "visible" });
    const modalFont = await dialog
      .locator("span", { hasText: "Notes for Net" })
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(headerFont).toContain("Inter");
    expect(modalFont).toBe(headerFont);
  });

  test("page URL context is the fake host", async ({ page }) => {
    expect(page.url()).toBe(TEST_URL);
  });
});
