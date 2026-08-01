import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

import type { FrameLocator } from "@playwright/test";

async function clearNoteUrl(overlay: FrameLocator): Promise<void> {
  const url = overlay.getByLabel("Note URL");
  await url.fill("");
  await url.blur(); // commit: the URL persists on blur
  await expect(url).toHaveValue("");
}

/** Fjalla One ships only weight 400, so a bold utility faux-bolds the action labels — they must stay Regular;
 * and the action group needs a divider after PASTE, mirroring the B/I/U group's left border. */
test.describe("note action row", () => {
  test("LINK/ANCHOR/COPY/PASTE are Fjalla Regular, and a divider closes the group after PASTE", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "NOTE TITLE");

    for (const name of [
      /navigate to url/i,
      /pick page anchor/i,
      /copy note/i,
      /paste/i,
    ]) {
      const weight = await overlay
        .getByRole("button", { name })
        .first()
        .evaluate((el) => getComputedStyle(el).fontWeight);
      expect(weight).toBe("400");
    }

    // Divider after PASTE = a right border on the action button-group (LINK's nearest group).
    const border = await overlay
      .getByRole("button", { name: /navigate to url/i })
      .evaluate((el) => {
        const group = el.closest('[data-slot="button-group"]') as HTMLElement;
        const cs = getComputedStyle(group);
        return {
          width: parseFloat(cs.borderRightWidth),
          style: cs.borderRightStyle,
        };
      });
    expect(border.width).toBeGreaterThan(0);
    expect(border.style).not.toBe("none");
  });
});

/** Client 2026-08-01: deleting the URL devoids every command that needs one — expanded LINK/ANCHOR grey
 *  out whether or not an anchor is set, and the collapsed header shows nothing at all. */
test.describe("a deleted URL devoids LINK and ANCHOR", () => {
  test("with no anchor set", async ({ overlay }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "NOTE TITLE");

    const link = overlay.getByRole("button", { name: "Navigate to URL" });
    const anchor = overlay.getByRole("button", { name: "Pick page anchor" });
    await expect(link).toBeEnabled();
    await expect(anchor).toBeEnabled();

    await clearNoteUrl(overlay);

    await expect(link).toBeDisabled();
    await expect(anchor).toBeDisabled();
  });

  test("with an anchor set, expanded and collapsed", async ({
    overlay,
    page,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "NOTE TITLE");

    // ANCHOR pick: the overlay hides and a pick layer covers the host page.
    await overlay.getByRole("button", { name: "Pick page anchor" }).click();
    const layer = page.locator("#nn-scroll-bookmarks-anchor-pick-layer");
    await layer.waitFor({ state: "visible", timeout: 5000 });
    await page.mouse.click(60, 60);
    await layer.waitFor({ state: "detached", timeout: 5000 });

    const link = overlay.getByRole("button", { name: "Navigate to URL" });
    const anchor = overlay.getByRole("button", {
      name: "Navigate to anchor position",
    });
    await expect(anchor).toBeEnabled();

    // exact: the dnd-kit drag row is itself role=button and absorbs these labels.
    const collapse = overlay.getByRole("button", {
      name: "Collapse note",
      exact: true,
    });
    const expand = overlay.getByRole("button", {
      name: "Expand note",
      exact: true,
    });
    // Only one surface renders the pair at a time; the hidden one keeps its buttons in the DOM.
    const onScreenPair = overlay
      .getByRole("button", { name: /^Navigate to (URL|anchor position)$/ })
      .filter({ visible: true });

    await collapse.click();
    await expect(onScreenPair).toHaveCount(2);
    await expand.click();

    await clearNoteUrl(overlay);
    await expect(link).toBeDisabled();
    await expect(anchor).toBeDisabled();

    // Collapsed with no URL shows nothing at all — not greyed buttons.
    await collapse.click();
    await expect(onScreenPair).toHaveCount(0);
  });
});
