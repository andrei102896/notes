import { expect, test } from "./fixtures";
import { createSubjectTab, dblclickSubjectTab, subjectTab } from "./helpers";

/** Canvas-measured, not scrollWidth: the trigger's invisible `after:` indicator sits outside the right
 *  edge and inflates scrollWidth by ~3px. Tabs are rotate-90, so on-strip length is offsetWidth. */
async function tabMetrics(
  overlay: Parameters<typeof subjectTab>[0],
  name: string,
): Promise<{ boxWidth: number; textWidth: number; padding: number }> {
  const metrics = await subjectTab(overlay, name).evaluate((el) => {
    const cs = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) {
      throw new Error("no 2d context");
    }
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return {
      boxWidth: (el as HTMLElement).offsetWidth,
      textWidth: ctx.measureText(el.textContent ?? "").width,
      padding: parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight),
    };
  });
  return metrics;
}

/** Client rule: tab length is dictated ONLY by the character count (+1 blank char each end), with no
 *  minimum. Rounding up to whole A–Z cells is the one allowed addition, so edges stay on cell lines. */
test("subject tab length follows the character count with no 3-cell floor", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "Z");
  await createSubjectTab(overlay, "GOLF");
  await createSubjectTab(overlay, "AADSADADA");
  await createSubjectTab(overlay, "Astronomy Basics 01 WDKLW");
  await page.waitForTimeout(400);

  const cellPx = await overlay
    .locator("[data-air-cell]")
    .first()
    .evaluate((el) => el.getBoundingClientRect().height);

  const names = ["Z", "GOLF", "AADSADADA", "Astronomy Basics 01 WDKLW"];
  const measured = [];
  for (const name of names) {
    const m = await tabMetrics(overlay, name);
    const cells = m.boxWidth / cellPx;
    const needed = m.textWidth + m.padding;
    console.log(
      `"${name}": ${m.boxWidth.toFixed(1)}px = ${cells.toFixed(2)} cells, label+padding needs ${needed.toFixed(1)}px`,
    );

    expect(
      Math.abs(cells - Math.round(cells)),
      `"${name}" spans a whole number of cells (got ${cells.toFixed(2)})`,
    ).toBeLessThan(0.05);
    expect(m.boxWidth, `"${name}" box holds label + padding`).toBeGreaterThan(
      needed - 1,
    );
    // The discriminating check: a minimum span would over-pad a short label past this.
    expect(
      m.boxWidth,
      `"${name}" adds at most one cell of rounding (no minimum span)`,
    ).toBeLessThan(needed + cellPx);
    measured.push({ name, ...m, cells: Math.round(cells) });
  }

  expect(
    measured[0].cells,
    "a 1-character tab is under the old 3-cell floor",
  ).toBeLessThan(3);
  for (let i = 1; i < measured.length; i += 1) {
    expect(
      measured[i].boxWidth,
      `"${measured[i].name}" is longer than "${measured[i - 1].name}"`,
    ).toBeGreaterThan(measured[i - 1].boxWidth);
  }

  await overlay
    .locator('[aria-label="Subject tabs"]')
    .screenshot({ path: testInfo.outputPath("dynamic-tabs.png") });
});

/** Client rule: naming/renaming allows upper AND lower case — the strip must not force caps. */
test("subject tab labels keep the case they were typed in", async ({
  overlay,
  page,
}, testInfo) => {
  const MIXED = "Astro physics gy";
  await createSubjectTab(overlay, MIXED);
  await page.waitForTimeout(400);

  const tab = subjectTab(overlay, MIXED);
  expect(await tab.textContent()).toBe(MIXED);
  await expect(tab).not.toHaveCSS("text-transform", "uppercase");

  // Descenders must not clip in the rotated tab.
  await overlay
    .locator('[aria-label="Subject tabs"]')
    .screenshot({ path: testInfo.outputPath("mixed-case-tabs.png") });

  // A–Z matching stays case-insensitive: "Astro…" still flags the A cell.
  await expect(
    overlay.locator('[aria-label="Jump to subject tabs starting with A"]'),
  ).toHaveAttribute("data-air-match", "true");

  // The rename path preserves case too.
  await dblclickSubjectTab(overlay, MIXED);
  const input = overlay.locator("input[data-subject-name-input]");
  await expect(input).toHaveValue(MIXED);
  await input.fill("lower case only");
  await overlay.getByRole("button", { name: "OK" }).click();
  await expect(overlay.locator("[data-nn-modal-box]")).toBeHidden();
  expect(await subjectTab(overlay, "lower case only").textContent()).toBe(
    "lower case only",
  );
});

/** The "+" fills its A–Z cell so its own border is the only white. The cell is not square, so the glyph is
 *  capped on the tight axis instead: off width alone a 620px-tall window crushed it to 1.75px vs 3.25px. */
test("the + button fills its cell with an even border and an uncrushed glyph", async ({
  overlay,
  page,
}, testInfo) => {
  await page.waitForTimeout(300);
  const geom = await overlay
    .locator('[aria-label="Subject tabs"] [aria-label="Add subject tab"]')
    .evaluate((el) => {
      const box = el.getBoundingClientRect();
      const cell = el.ownerDocument
        .querySelector("[data-air-cell]")!
        .getBoundingClientRect();
      const wrap = el.parentElement!.getBoundingClientRect();
      const glyph = el.querySelector("svg")?.getBoundingClientRect();
      if (!glyph) {
        throw new Error("no + glyph");
      }
      const cs = getComputedStyle(el);
      const border = {
        top: parseFloat(cs.borderTopWidth),
        right: parseFloat(cs.borderRightWidth),
        bottom: parseFloat(cs.borderBottomWidth),
        left: parseFloat(cs.borderLeftWidth),
      };
      return {
        border,
        // Must be 0 all round, or the leftover shows as a sliver and breaks the even white frame.
        margins: [
          box.top - wrap.top,
          wrap.right - box.right,
          wrap.bottom - box.bottom,
          box.left - wrap.left,
        ],
        cellHeight: cell.height,
        boxHeight: box.height,
        glyphWidth: glyph.width,
        glyphHeight: glyph.height,
        contentWidth: box.width - border.left - border.right,
        contentHeight: box.height - border.top - border.bottom,
        glyphSquare: Math.abs(glyph.width - glyph.height),
        gapLeft: glyph.left - (box.left + border.left),
        gapRight: box.right - border.right - glyph.right,
        gapTop: glyph.top - (box.top + border.top),
        gapBottom: box.bottom - border.bottom - glyph.bottom,
      };
    });

  expect(Math.abs(geom.boxHeight - geom.cellHeight)).toBeLessThan(0.5);
  for (const margin of geom.margins) {
    expect(Math.abs(margin)).toBeLessThan(0.5);
  }
  const borders = Object.values(geom.border);
  for (const b of borders) {
    expect(Math.abs(b - borders[0])).toBeLessThan(0.1);
  }
  expect(geom.glyphSquare).toBeLessThan(0.5);
  expect(Math.abs(geom.gapLeft - geom.gapRight)).toBeLessThan(0.5);
  expect(Math.abs(geom.gapTop - geom.gapBottom)).toBeLessThan(0.5);
  // Ratios, not px, so they hold at any panel size. 0.71 = Figma crop (181 of 255); a cap on both axes
  // rather than an exact fit, since the cell is not square. Asserting height guards the crush regression.
  const widthRatio = geom.glyphWidth / geom.contentWidth;
  const heightRatio = geom.glyphHeight / geom.contentHeight;
  console.log(
    `+ glyph is ${(widthRatio * 100).toFixed(1)}% wide / ${(heightRatio * 100).toFixed(1)}% tall ` +
      `of the blue box (Figma 71% cap), gaps ${geom.gapLeft.toFixed(2)} side / ${geom.gapTop.toFixed(2)} top`,
  );
  expect(
    widthRatio,
    "glyph never wider than the Figma crop",
  ).toBeLessThanOrEqual(0.72);
  expect(
    heightRatio,
    "glyph never taller than the Figma crop",
  ).toBeLessThanOrEqual(0.72);
  expect(
    Math.max(widthRatio, heightRatio),
    "glyph fills its tight axis",
  ).toBeCloseTo(0.71, 2);
  // Never touching the border on any axis.
  for (const gap of [
    geom.gapLeft,
    geom.gapRight,
    geom.gapTop,
    geom.gapBottom,
  ]) {
    expect(gap).toBeGreaterThan(0.5);
  }
  // Painted pixels ACROSS THE NEIGHBOURHOOD, not just the button: the A–Z cell's white border-r hugs the
  // button's left border, so the eye sees 5px of white left vs 4px right while the button measures 4/4.
  const box = await overlay
    .locator('[aria-label="Subject tabs"] [aria-label="Add subject tab"]')
    .boundingBox();
  if (!box) {
    throw new Error("+ not measurable");
  }
  const PAD = 14;
  const row = await page.screenshot({
    clip: {
      x: box.x - PAD,
      y: box.y + box.height / 2,
      width: box.width + PAD * 2,
      height: 1,
    },
  });
  const white = await page.evaluate(
    async ({ dataUrl, leftEdge, rightEdge }) => {
      const img = await new Promise<HTMLImageElement>((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = dataUrl;
      });
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = 1;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(img, 0, 0);
      const px = ctx.getImageData(0, 0, c.width, 1).data;
      const isWhite = (x: number) => {
        const i = x * 4;
        return px[i] > 235 && px[i + 1] > 235 && px[i + 2] > 235;
      };
      const walk = (from: number, step: number) => {
        let n = 0;
        for (let x = from; x >= 0 && x < c.width && isWhite(x); x += step) {
          n += 1;
        }
        return n;
      };
      const scale = c.width / leftEdge.clipWidth;
      const lx = Math.round(leftEdge.offset * scale);
      const rx = Math.round(rightEdge.offset * scale);
      return {
        // Total white either side of the blue interior, inner border + whatever abuts it outside.
        left: walk(lx - 1, -1) + walk(lx, 1),
        right: walk(rx, -1) + walk(rx + 1, 1),
      };
    },
    {
      dataUrl: `data:image/png;base64,${row.toString("base64")}`,
      leftEdge: { offset: PAD, clipWidth: box.width + PAD * 2 },
      rightEdge: {
        offset: PAD + box.width - 1,
        clipWidth: box.width + PAD * 2,
      },
    },
  );

  console.log(
    `+ white either side (device px): left ${white.left}, right ${white.right}`,
  );
  expect(white.left, "white to the left of the + interior").toBeGreaterThan(0);
  expect(
    Math.abs(white.left - white.right),
    `white left ${white.left} vs right ${white.right} device px`,
  ).toBeLessThanOrEqual(1);

  console.log(
    `+ gaps: sides ${geom.gapLeft.toFixed(2)}/${geom.gapRight.toFixed(2)}, ` +
      `top-bottom ${geom.gapTop.toFixed(2)}/${geom.gapBottom.toFixed(2)} ` +
      `(axes differ by ${Math.abs(geom.gapTop - geom.gapLeft).toFixed(2)}px — the cell is not square)`,
  );

  // The "+" next to the A box: review artifact for the grid alignment.
  const strip = await overlay
    .locator('[aria-label="Subject tabs"]')
    .boundingBox();
  if (strip) {
    await page.screenshot({
      path: testInfo.outputPath("plus-vs-air-cell.png"),
      clip: {
        x: strip.x - strip.width - 6,
        y: strip.y - 3,
        width: strip.width * 2 + 12,
        height: strip.height / 8,
      },
    });
  }
});

test("label padding is one character at each end", async ({
  overlay,
  page,
}) => {
  await createSubjectTab(overlay, "DESKS");
  await page.waitForTimeout(400);

  const oneCharWidth = await subjectTab(overlay, "DESKS").evaluate((el) => {
    const cs = getComputedStyle(el);
    const ctx = document.createElement("canvas").getContext("2d");
    if (!ctx) {
      throw new Error("no 2d context");
    }
    ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    return ctx.measureText("0").width;
  });
  const { padding } = await tabMetrics(overlay, "DESKS");

  // px-[1ch] = one "0" glyph per side (client: "blank space equating to one character").
  expect(Math.abs(padding / 2 - oneCharWidth)).toBeLessThan(1.5);
});

/** A 25-char name (the input cap) must render whole, not clipped by the tab box. */
test("a full-length subject tab name is not clipped", async ({
  overlay,
  page,
}, testInfo) => {
  const NAME_25 = "Astronomy Basics 01 WDKLW";
  await createSubjectTab(overlay, NAME_25);
  await page.waitForTimeout(400);

  const m = await tabMetrics(overlay, NAME_25);
  expect(m.boxWidth).toBeGreaterThanOrEqual(m.textWidth + m.padding - 2);

  await overlay
    .locator('[aria-label="Subject tabs"]')
    .screenshot({ path: testInfo.outputPath("long-tab.png") });
});
