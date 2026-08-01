import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

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
