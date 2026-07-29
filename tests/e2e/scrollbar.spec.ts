import { expect, test } from "./fixtures";
import { addNote, createSubjectTab } from "./helpers";

/** Blue notes-list scrollbar (Figma NN_SCROLL BAR: 6px accent thumb, hairline black edge, radius 6px). */
test("notes list shows the accent scrollbar once it overflows", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "DESKS");
  // Enough expanded notes to overflow the notes column.
  for (const title of ["ONE", "TWO", "THREE", "FOUR"]) {
    await addNote(overlay, title);
  }
  await overlay.locator("header").click();
  await page.waitForTimeout(400);

  const list = overlay.locator('[aria-label="Dashboard content"] > div');
  await expect(list).toHaveClass(/nn-scrollbar/);

  const geom = await list.evaluate((el) => ({
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    // Gutter the classic (non-overlay) scrollbar reserves.
    gutter: el.offsetWidth - el.clientWidth,
  }));
  expect(geom.scrollHeight).toBeGreaterThan(geom.clientHeight);
  // Thumb 6px + an 8px right gutter at the reference panel, scaled by the root font.
  const rootPx = await list.evaluate((el) =>
    parseFloat(getComputedStyle(el.ownerDocument.documentElement).fontSize),
  );
  expect((geom.gutter / rootPx) * 16, "thumb + 8px gutter at the 16px reference").toBeCloseTo(
    14,
    0,
  );

  // The gutter must be EMPTY in painted pixels: a transparent border only shows with padding-box clip,
  // so computed style alone would pass with the thumb still against the edge.
  const box = await list.boundingBox();
  if (!box) {
    throw new Error("notes list not measurable");
  }
  const strip = await page.screenshot({
    clip: {
      x: box.x + box.width - geom.gutter - 2,
      y: box.y + box.height / 2,
      width: geom.gutter + 2,
      height: 1,
    },
  });
  const edgeGapPx = await page.evaluate(async (dataUrl) => {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, canvas.width, 1).data;
    const isAccent = (i: number) =>
      Math.abs(px[i] - 41) < 60 && Math.abs(px[i + 1] - 171) < 60 && px[i + 2] > 150;
    let last = -1;
    for (let x = 0; x < canvas.width; x += 1) {
      if (isAccent(x * 4)) {
        last = x;
      }
    }
    // Device px from the rightmost accent pixel to the container edge.
    return last < 0 ? -1 : canvas.width - 1 - last;
  }, `data:image/png;base64,${strip.toString("base64")}`);
  expect(edgeGapPx, "accent thumb found in the gutter strip").toBeGreaterThan(0);
  console.log(`scrollbar right gap: ${edgeGapPx} device px`);

  // Park the thumb mid-track: at the ends it sits beside the notes' own blue card edges. The radius must
  // survive the gutter — a padding-box corner gets (radius − border-width), which computed style hides.
  await list.evaluate((el) => {
    el.scrollTop = (el.scrollHeight - el.clientHeight) / 2;
  });
  await page.waitForTimeout(300);
  const listBox = await list.boundingBox();
  if (!listBox) {
    throw new Error("notes list not measurable");
  }
  const column = await page.screenshot({
    clip: {
      x: listBox.x + listBox.width - geom.gutter - 2,
      y: listBox.y,
      width: geom.gutter + 2,
      height: listBox.height,
    },
  });
  const thumb = await page.evaluate(async (dataUrl) => {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = dataUrl;
    });
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    const px = ctx.getImageData(0, 0, c.width, c.height).data;
    const isBlue = (i: number) => px[i + 2] > 150 && px[i] < 140 && px[i + 1] > 90;
    const widths: number[] = [];
    for (let y = 0; y < c.height; y += 1) {
      let n = 0;
      for (let x = 0; x < c.width; x += 1) {
        if (isBlue((y * c.width + x) * 4)) n += 1;
      }
      widths.push(n);
    }
    // Thumb-sized runs only; wider rows are other blue chrome caught by the clip.
    const isThumb = (w: number) => w > 0 && w <= 12;
    const first = widths.findIndex(isThumb);
    const last = widths.length - 1 - [...widths].reverse().findIndex(isThumb);
    return {
      head: widths.slice(first, first + 4),
      tail: widths.slice(last - 3, last + 1),
      mid: widths[Math.round((first + last) / 2)],
    };
  }, `data:image/png;base64,${column.toString("base64")}`);

  console.log(`thumb rows: head ${thumb.head}, mid ${thumb.mid}, tail ${thumb.tail}`);
  expect(thumb.mid, "thumb has a body").toBeGreaterThan(2);
  expect(thumb.head[0], "top end is rounded, not square").toBeLessThan(thumb.mid);
  expect(thumb.tail[thumb.tail.length - 1], "bottom end is rounded, not square").toBeLessThan(
    thumb.mid,
  );
  // Rounding is the same at both ends.
  expect(
    Math.abs(thumb.head[0] - thumb.tail[thumb.tail.length - 1]),
    "top and bottom rounded alike",
  ).toBeLessThanOrEqual(1);

  await overlay
    .locator('[aria-label="Dashboard content"]')
    .screenshot({ path: testInfo.outputPath("notes-scrollbar.png") });
});
