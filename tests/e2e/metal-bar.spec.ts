import { expect, test } from "./fixtures";
import { createSubjectTab, dblclickSubjectTab } from "./helpers";

import type { Locator } from "@playwright/test";

/** Plate spans the FULL bar height with metal visible left and right (client render beats the Figma-CSS
 *  29-in-35). One evaluate: separate boundingBox() calls straddle the open animation and report a shift. */
async function expectPlateSpansBar(bar: Locator, label: string) {
  const { barBox, plateBox } = await bar.evaluate((el) => {
    const plate = el.querySelector(":scope > [data-nn-plate]");
    const r = el.getBoundingClientRect();
    const p = plate?.getBoundingClientRect();
    return {
      barBox: { x: r.x, y: r.y, width: r.width, height: r.height },
      plateBox: p && { x: p.x, y: p.y, width: p.width, height: p.height },
    };
  });
  if (!plateBox) {
    throw new Error(`${label}: plate not found in the metal bar`);
  }

  const top = plateBox.y - barBox.y;
  const bottom = barBox.y + barBox.height - (plateBox.y + plateBox.height);
  const left = plateBox.x - barBox.x;
  const right = barBox.x + barBox.width - (plateBox.x + plateBox.width);
  console.log(
    `${label}: bar ${barBox.height.toFixed(1)}px, plate ${plateBox.height.toFixed(1)}px, gaps top ${top.toFixed(1)} bottom ${bottom.toFixed(1)} left ${left.toFixed(1)} right ${right.toFixed(1)}`,
  );

  // No gap top or bottom, so no strip of the bar's inset shadow shows under the logo.
  expect(Math.abs(top), `${label} top gap`).toBeLessThan(0.6);
  expect(Math.abs(bottom), `${label} bottom gap`).toBeLessThan(0.6);
  // Metal visible left and right, plate centred horizontally.
  expect(left, `${label} left metal`).toBeGreaterThan(0.5);
  expect(right, `${label} right metal`).toBeGreaterThan(0.5);
  expect(Math.abs(left - right), `${label} horizontal centering`).toBeLessThan(
    1.5,
  );
}

test("header logo plate spans the metal band top to bottom", async ({
  overlay,
  page,
}, testInfo) => {
  // The panel's slide-in must finish first or the artifact catches the band still translated.
  await page.waitForTimeout(600);
  const bar = overlay.locator("[data-nn-metal-bar]").first();
  await expectPlateSpansBar(bar, "header");

  // Against the OUTER edge, not just the bar: any border above the band leaves the plate flush to the
  // bar yet short of the panel's true top.
  const hostGap = await bar.evaluate((el) => {
    const host = el.ownerDocument.getElementById(
      "nn-scroll-bookmarks-overlay-host",
    )!;
    const plate = el.querySelector(":scope > [data-nn-plate]")!;
    return plate.getBoundingClientRect().top - host.getBoundingClientRect().top;
  });
  expect(
    Math.abs(hostGap),
    "plate flush to the panel's outer top",
  ).toBeLessThan(0.6);

  // The client's anchor: the plate reads a little wider than the ADD NOTE button under it.
  const vsAddNote = await overlay.locator("header").evaluate((header) => {
    const plate = header.querySelector("[data-nn-plate]")!;
    const addNote = [...header.querySelectorAll("button")].find(
      (b) => b.textContent?.trim().toLowerCase() === "add note",
    )!;
    return (
      plate.getBoundingClientRect().width /
      addNote.getBoundingClientRect().width
    );
  });
  console.log(`header plate is ${vsAddNote.toFixed(2)}× the ADD NOTE button`);
  expect(vsAddNote, "plate wider than ADD NOTE").toBeGreaterThan(1);
  expect(vsAddNote, "plate not far wider than ADD NOTE").toBeLessThan(1.55);

  // What the client eyeballs: the NN ink's share of the plate. 52.5% is the artwork's own fraction
  // (63/120 viewBox); widening past it read as "too bulky". A ratio, so it holds at any panel width.
  const ink = await bar.evaluate((el) => {
    const plate = el.querySelector(":scope > [data-nn-plate]")!;
    const svg = plate.querySelector("svg")!;
    const rects = [...svg.querySelectorAll("path")].map((p) =>
      p.getBoundingClientRect(),
    );
    const box = plate.getBoundingClientRect();
    const left = Math.min(...rects.map((r) => r.left));
    const right = Math.max(...rects.map((r) => r.right));
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));
    return {
      pctW: (right - left) / box.width,
      pctH: (bottom - top) / box.height,
      gapL: left - box.left,
      gapR: box.right - right,
      gapT: top - box.top,
      gapB: box.bottom - bottom,
    };
  });
  console.log(
    `NN ink covers ${(ink.pctW * 100).toFixed(1)}% of the plate width, ${(ink.pctH * 100).toFixed(1)}% of its height`,
  );
  expect(ink.pctW, "NN ink keeps the artwork's 52.5% width share").toBeCloseTo(
    0.525,
    2,
  );
  expect(ink.pctH, "NN ink height share").toBeCloseTo(0.494, 2);
  // Centred in the plate on both axes.
  expect(Math.abs(ink.gapL - ink.gapR), "NN centred horizontally").toBeLessThan(
    0.6,
  );
  expect(Math.abs(ink.gapT - ink.gapB), "NN centred vertically").toBeLessThan(
    0.6,
  );

  const plate = await bar.evaluate((el) => {
    const p = el.querySelector(":scope > [data-nn-plate]")!;
    const rim = getComputedStyle(p.lastElementChild!);
    const r = p.getBoundingClientRect();
    return {
      ratio: r.width / r.height,
      top: r.top,
      rims: [
        rim.borderTopWidth,
        rim.borderRightWidth,
        rim.borderBottomWidth,
        rim.borderLeftWidth,
      ],
    };
  });
  // Narrower than the modals' 3.5:1 (client: closer to the ADD NOTE button's width).
  expect(plate.ratio, "header plate box ratio").toBeCloseTo(3.1, 1);
  expect(plate.rims, "header rim on all four sides").toEqual([
    "5px",
    "5px",
    "5px",
    "5px",
  ]);
  // The hilite crossing the plate must FADE through the rim, never switch between two flat colours —
  // sampled top→bottom, monotonically darkening with no step.
  const ramp = await bar.evaluate((el) => {
    const rim = el.querySelector(":scope > [data-nn-plate] > div:last-child")!;
    const src = getComputedStyle(rim).borderImageSource;
    const stops = [...src.matchAll(/rgba?\(([^)]+)\)/g)].map((m) =>
      m[1]
        .split(",")
        .slice(0, 3)
        .map((n) => parseFloat(n)),
    );
    return { src, stops };
  });
  expect(ramp.src, "rim carries a gradient, not a flat colour").toContain(
    "linear-gradient",
  );
  expect(ramp.stops.length, "gradient has intermediate stops").toBeGreaterThan(
    2,
  );
  // Blue channel darkens step by step; no stop may jump more than a third of the full range.
  const blues = ramp.stops.map((s) => s[2]);
  const range = blues[0] - blues[blues.length - 1];
  for (let i = 1; i < blues.length; i += 1) {
    expect(blues[i], `stop ${i} keeps darkening`).toBeLessThan(blues[i - 1]);
    expect(
      blues[i - 1] - blues[i],
      `stop ${i} is a gradual step, not a jump`,
    ).toBeLessThan(range * 0.6);
  }
  // Nothing above the iframe's top edge: clipping there thins the top rim while getComputedStyle
  // still reports its full width.
  expect(plate.top, "plate not clipped by the iframe edge").toBeGreaterThan(
    -0.01,
  );

  await bar.screenshot({ path: testInfo.outputPath("header-metal-bar.png") });
});

/** Header bottom edge: 2px white over a 4px accent line, and no seam between the metal band and the nav
 *  row — a border there also pushes the logo plate 1px off centre. */
test("header rows meet with no black seam and a 4px accent bottom line", async ({
  overlay,
  page,
}) => {
  await page.waitForTimeout(400);
  const edge = await overlay.locator("header").evaluate((header) => {
    const bar = header.querySelector("[data-nn-metal-bar]")!;
    const cs = getComputedStyle(header);
    const barCs = getComputedStyle(bar);
    // The accent line is an element, not a box-shadow: it has to paint over the shadow band below it.
    const line = header.querySelector("[data-nn-blue-line] > div")!;
    const lineCs = getComputedStyle(line);
    return {
      barBottomBorder: barCs.borderBottomWidth,
      barBottomStyle: barCs.borderBottomStyle,
      whiteBorder: cs.borderBottomWidth,
      whiteColor: cs.borderBottomColor,
      lineHeight: lineCs.height,
      lineColor: lineCs.backgroundColor,
    };
  });

  // No border between the two header rows.
  expect(
    edge.barBottomStyle === "none" || parseFloat(edge.barBottomBorder) === 0,
  ).toBe(true);
  expect(edge.whiteBorder).toBe("2px");
  expect(edge.whiteColor).toBe("rgb(255, 255, 255)");
  // Accent line stacked under it: 4px tall, accent colour.
  expect(edge.lineHeight).toBe("4px");
  expect(edge.lineColor).toBe("rgb(41, 171, 226)");
});

test("small-modal logo plate spans its metal bar top to bottom", async ({
  overlay,
  page,
}, testInfo) => {
  await createSubjectTab(overlay, "ASTRO");
  await dblclickSubjectTab(overlay, "ASTRO");
  await expect(overlay.locator("[data-nn-modal-box]")).toBeVisible();
  await page.waitForTimeout(400);

  // Modals keep the flush plate: they have no ADD NOTE button to anchor a narrower one to.
  await expectPlateSpansBar(
    overlay.locator("[data-nn-modal-box] [data-nn-metal-bar]"),
    "modal",
  );

  // Same outer-edge rule as the header: no border may sit above the bar.
  const modalPlate = await overlay
    .locator("[data-nn-modal-box]")
    .evaluate((box) => {
      const plate = box.querySelector("[data-nn-metal-bar] [data-nn-plate]")!;
      const r = plate.getBoundingClientRect();
      return {
        gap: r.top - box.getBoundingClientRect().top,
        ratio: r.width / r.height,
        rim: getComputedStyle(plate.lastElementChild!).borderTopWidth,
      };
    });
  expect(
    Math.abs(modalPlate.gap),
    "plate flush to the modal's outer top",
  ).toBeLessThan(0.6);
  // Modal plates keep the client render's ~3.5:1 box and the standard 3px rim.
  expect(modalPlate.ratio, "modal plate box ratio").toBeCloseTo(3.5, 1);
  expect(modalPlate.rim, "modal rim").toBe("3px");

  await overlay
    .locator("[data-nn-modal-box]")
    .screenshot({ path: testInfo.outputPath("modal-metal-bar.png") });
});

/** Client rule: the footer is the same bar as the header — same height, same plate, same rim. */
test("footer bar matches the header band", async ({
  overlay,
  page,
}, testInfo) => {
  await page.waitForTimeout(600);
  const both = await overlay
    .locator("#nn-scroll-bookmarks-overlay-host")
    .evaluate((host) => {
      const read = (root: Element) => {
        const bar = root.querySelector("[data-nn-metal-bar]")!;
        const plate = bar.querySelector("[data-nn-plate]")!;
        const b = bar.getBoundingClientRect();
        const p = plate.getBoundingClientRect();
        return {
          barW: b.width,
          barH: b.height,
          plateW: p.width,
          plateH: p.height,
          rim: getComputedStyle(plate.lastElementChild!).borderTopWidth,
        };
      };
      return {
        header: read(host.querySelector("header")!),
        footer: read(host.querySelector("footer")!),
      };
    });

  expect(both.footer.barH, "footer bar height").toBeCloseTo(
    both.header.barH,
    1,
  );
  expect(both.footer.barW, "footer bar width").toBeCloseTo(both.header.barW, 1);
  expect(both.footer.plateH, "footer plate height").toBeCloseTo(
    both.header.plateH,
    1,
  );
  expect(both.footer.plateW, "footer plate width").toBeCloseTo(
    both.header.plateW,
    1,
  );
  expect(both.footer.rim, "footer rim").toBe(both.header.rim);

  await overlay
    .locator("footer")
    .screenshot({ path: testInfo.outputPath("footer-bar.png") });
});
