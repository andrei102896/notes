import { expect, test } from "./fixtures";
import { clickSubjectTab, createSubjectTab } from "./helpers";

test.describe("A–Z index highlight (one-way street)", () => {
  test("only tapping an AI letter highlights it; selecting a tab never changes it", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "APPLE"); // letter A
    await createSubjectTab(overlay, "MANGO"); // letter M (freshly created → selected)

    const letterA = overlay.getByRole("button", {
      name: "Jump to subject tabs starting with A",
    });
    const letterM = overlay.getByRole("button", {
      name: "Jump to subject tabs starting with M",
    });

    // Selecting subject tabs must NOT highlight any AI letter.
    await expect(letterA).toHaveAttribute("aria-pressed", "false");
    await expect(letterM).toHaveAttribute("aria-pressed", "false");

    // Tapping an AI letter highlights it (and cues; it does not select a subject tab).
    await letterM.click();
    await expect(letterM).toHaveAttribute("aria-pressed", "true");
    await expect(letterA).toHaveAttribute("aria-pressed", "false");

    // Selecting a different-letter subject tab must NOT move the AI highlight.
    await clickSubjectTab(overlay, "APPLE");
    await expect(letterM).toHaveAttribute("aria-pressed", "true");
    await expect(letterA).toHaveAttribute("aria-pressed", "false");
  });
});
