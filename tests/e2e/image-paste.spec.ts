import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

/** 1×1 transparent PNG. */
const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

test.describe("note body image paste", () => {
  test("pasting an image file inserts an <img> into the note body", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "PIC");

    const body = overlay.locator("[data-note-body]");
    await body.click(); // focus + caret

    // Synthesize a clipboard paste carrying an image file (a screenshot has no text/html).
    await body.evaluate((editor, b64) => {
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) {
        bytes[i] = bin.charCodeAt(i);
      }
      const file = new File([bytes], "shot.png", { type: "image/png" });
      const dt = new DataTransfer();
      dt.items.add(file);
      const ev = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(ev);
    }, PNG_B64);

    const img = overlay.locator("[data-note-body] img");
    await expect(img).toHaveCount(1);
    await expect(img).toHaveAttribute("src", /^data:image\/png/);
  });

  test("pasted HTML keeps a safe image but drops scripts and unsafe img", async ({
    overlay,
  }) => {
    await createSubjectTab(overlay, "ALPHA");
    await addNote(overlay, "SEC");

    const body = overlay.locator("[data-note-body]");
    await body.click();

    await body.evaluate((editor, b64) => {
      const html =
        `<img src="data:image/png;base64,${b64}">` +
        `<img src="x" onerror="window.__xss=1">` +
        `<script>window.__xss=1</script>` +
        `<img src="javascript:alert(1)">`;
      const dt = new DataTransfer();
      dt.setData("text/html", html);
      const ev = new ClipboardEvent("paste", {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
      });
      editor.dispatchEvent(ev);
    }, PNG_B64);

    // Only the safe data:image survives; scripts and unsafe-src images are dropped.
    await expect(overlay.locator("[data-note-body] img")).toHaveCount(1);
    await expect(overlay.locator("[data-note-body] img")).toHaveAttribute(
      "src",
      /^data:image\/png/,
    );
    const xss = await body.evaluate(
      () => (window as unknown as { __xss?: number }).__xss ?? 0,
    );
    expect(xss).toBe(0);
  });
});
