import { expect, type FrameLocator, type Locator } from "@playwright/test";

/** Strip "+" → name dialog → OK. The new tab becomes the active one. */
export async function createSubjectTab(
  overlay: FrameLocator,
  name: string,
): Promise<void> {
  await overlay
    .locator('[aria-label="Subject tabs"] button[aria-haspopup="dialog"]')
    .click();
  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await dialog.waitFor({ state: "visible" });
  await overlay.locator("input[data-subject-name-input]").fill(name);
  await dialog.getByRole("button", { name: "OK" }).click();
  await dialog.waitFor({ state: "hidden" });
  await expect(subjectTab(overlay, name)).toBeVisible();
}

export function subjectTab(overlay: FrameLocator, name: string): Locator {
  return overlay.getByRole("tab", { name });
}

/** Tabs paint correctly but their rotate-90+translate combo skews getBoundingClientRect into a square overlapping the A–Z strip, so locator.click() (rect center) hits a letter and synthetic el.click() skips the mousedown Radix Tabs selects on. Real mouse click at the painted point: strip column x + tab box y. */
export async function clickSubjectTab(
  overlay: FrameLocator,
  name: string,
): Promise<void> {
  const tab = subjectTab(overlay, name);
  const box = await tab.boundingBox();
  const strip = await overlay
    .locator('[aria-label="Subject tabs"]')
    .boundingBox();
  if (!box || !strip) {
    throw new Error(`subject tab "${name}" or its strip is not on screen`);
  }
  await tab
    .page()
    .mouse.click(strip.x + strip.width / 2, box.y + box.height / 2);
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

/** Retrying titles assertion — the notes list re-renders async after a tab switch, so a one-shot read races it. */
export async function expectTitles(
  overlay: FrameLocator,
  expected: string[],
): Promise<void> {
  await expect.poll(() => titleValues(overlay)).toEqual(expected);
}

/** Double-click a tab (rename trigger); same rect quirk as clickSubjectTab. */
export async function dblclickSubjectTab(
  overlay: FrameLocator,
  name: string,
): Promise<void> {
  await subjectTab(overlay, name).evaluate((el) =>
    el.dispatchEvent(
      new MouseEvent("dblclick", { bubbles: true, cancelable: true }),
    ),
  );
}

export function noteCards(overlay: FrameLocator): Locator {
  return overlay.locator('[data-slot="card"]');
}

export function noteTitles(overlay: FrameLocator): Locator {
  return overlay.locator("[data-note-title]");
}

/** ADD NOTE; waits for the count to grow, then titles the new top note when given. */
export async function addNote(
  overlay: FrameLocator,
  title?: string,
): Promise<void> {
  const cards = noteCards(overlay);
  const before = await cards.count();
  await overlay.getByRole("button", { name: "Add Note" }).click();
  await expect(cards).toHaveCount(before + 1);
  if (title !== undefined) {
    // New notes populate to the top (docs/1_NN_DASHBOARD), so the fresh title input is first.
    await noteTitles(overlay).first().fill(title);
  }
}

/** Clicks the trash icon on the note that has the given title and answers the confirm modal. */
export async function deleteNoteByTitle(
  overlay: FrameLocator,
  title: string,
  action: "OK" | "Cancel",
): Promise<void> {
  const index = (await titleValues(overlay)).indexOf(title);
  expect(index, `note titled "${title}" exists`).toBeGreaterThanOrEqual(0);
  await noteCards(overlay)
    .nth(index)
    .locator('[aria-label="Delete note"]')
    .click();
  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: action }).click();
  await dialog.waitFor({ state: "hidden" });
}

/** Current note titles, top to bottom. */
export async function titleValues(overlay: FrameLocator): Promise<string[]> {
  const inputs = noteTitles(overlay);
  const count = await inputs.count();
  const values: string[] = [];
  for (let i = 0; i < count; i += 1) {
    values.push(await inputs.nth(i).inputValue());
  }
  return values;
}

/** Confirms the destructive modal opened by DELETE TAB / DELETE (all notes). */
export async function confirmDestructiveDialog(
  overlay: FrameLocator,
  action: "OK" | "Cancel",
): Promise<void> {
  const dialog = overlay.locator('[data-slot="dialog-content"]');
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: action }).click();
  await dialog.waitFor({ state: "hidden" });
}
