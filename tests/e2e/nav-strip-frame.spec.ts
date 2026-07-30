import { expect, test } from "./fixtures";

/** Client rule: the white frame around the nav strip must read equally thick on all four sides. The
 *  bottom is the trap — the header's own 2px white border-b stacks under the strip's padding, so an even
 *  3px padding paints 5px there. Measured in painted pixels: the two whites merge into one run, which no
 *  element-scoped geometry check can see. */
test("the nav strip's white frame is even on all four sides", async ({
  overlay,
  page,
}, testInfo) => {
  await page.waitForTimeout(600);
  const strip = overlay.locator("header > div:has(> button)");
  const box = await strip
    .getByRole("button", { name: "Add Note" })
    .boundingBox();
  const stripBox = await strip.boundingBox();
  if (!box || !stripBox) {
    throw new Error("nav strip not measurable");
  }

  const pad = await strip.evaluate((el) => {
    const cs = getComputedStyle(el);
    const header = getComputedStyle(el.parentElement!);
    return {
      top: cs.paddingTop,
      right: cs.paddingRight,
      bottom: cs.paddingBottom,
      left: cs.paddingLeft,
      headerBorder: header.borderBottomWidth,
    };
  });
  console.log(
    `strip padding ${pad.top}/${pad.right}/${pad.bottom}/${pad.left} + header border-b ${pad.headerBorder}`,
  );
  // 1px + the header's 2px border = the 3px the other three sides get from padding alone.
  expect(pad.bottom, "strip padding-bottom").toBe("1px");
  expect(
    parseFloat(pad.bottom) + parseFloat(pad.headerBorder),
    "white under the strip",
  ).toBeCloseTo(parseFloat(pad.top), 1);

  // Painted check: a 1px column through the ADD NOTE button, from inside the metal band above the strip
  // to inside the accent line below it. Both frame edges must come out the same run of white.
  const REACH = 10;
  const column = await page.screenshot({
    clip: {
      x: box.x + box.width / 2,
      y: box.y - REACH,
      width: 1,
      height: box.height + REACH * 2,
    },
  });
  const scan = await page.evaluate(
    async (dataUrl) => {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, 1, canvas.height).data;
      // Light and achromatic: the frame carries the button's soft shadow, so it is not pure #fff, while
      // everything bounding it (metal band above, accent line below) is blue.
      const white: boolean[] = [];
      for (let y = 0; y < canvas.height; y += 1) {
        const [r, g, b] = [px[y * 4], px[y * 4 + 1], px[y * 4 + 2]];
        white.push(r > 200 && Math.max(r, g, b) - Math.min(r, g, b) < 14);
      }
      return { white, devicePx: canvas.height };
    },
    `data:image/png;base64,${column.toString("base64")}`,
  );

  const perCssPx = scan.devicePx / (box.height + REACH * 2);
  // Walk outwards from each button edge, past at most one blended edge row.
  const runFrom = (start: number, step: number) => {
    let y = start;
    for (let skipped = 0; skipped < 2 && !scan.white[y]; skipped += 1) {
      y += step;
    }
    let n = 0;
    for (; y >= 0 && y < scan.white.length && scan.white[y]; y += step) {
      n += 1;
    }
    return n / perCssPx;
  };
  const above = runFrom(Math.round(REACH * perCssPx) - 1, -1);
  const below = runFrom(Math.round((REACH + box.height) * perCssPx), 1);
  console.log(
    `white above the ADD NOTE button ${above.toFixed(1)}px, below ${below.toFixed(1)}px`,
  );

  expect(above, "white above the button").toBeGreaterThan(2);
  expect(above, "white above the button is the 3px frame").toBeLessThan(4.5);
  expect(below, "white below the button matches above").toBeCloseTo(above, 0);

  await page.screenshot({
    path: testInfo.outputPath("nav-strip-frame.png"),
    clip: {
      x: stripBox.x,
      y: stripBox.y - 6,
      width: Math.min(stripBox.width, 240),
      height: stripBox.height + 14,
    },
  });
});
