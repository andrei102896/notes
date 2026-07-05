import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

/** Fjalla One loads only weight 400, so a bold utility (font-semibold/bold) faux-bolds the action
 * labels instead of using a real face — they must stay Regular. And the action button-group needs a
 * divider after PASTE, mirroring the B/I/U group's left border (like the URL/date row above). */
test.describe("note action row", () => {
  test("LINK/ANCHOR/COPY/PASTE are Fjalla Regular, and a divider closes the group after PASTE", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "NOTE TITLE");

    for (const name of [/navigate to url/i, /pick page anchor/i, /copy note/i, /paste/i]) {
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
        return { width: parseFloat(cs.borderRightWidth), style: cs.borderRightStyle };
      });
    expect(border.width).toBeGreaterThan(0);
    expect(border.style).not.toBe("none");
  });
});
