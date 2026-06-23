import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "src/assets/icons/extension-icon.svg");
const outPath = join(root, "src/assets/icons/extension-icon.png");

// Accent blue (#29ABE2) field with a white "N", shrunk via PADDING so blue surrounds the glyph.
const SIZE = 128;
const PADDING = 26;
const INNER = SIZE - PADDING * 2;
const BLUE = { r: 41, g: 171, b: 226, alpha: 1 };

const innerPng = await sharp(await readFile(svgPath))
  .resize(INNER, INNER, {
    fit: "contain",
    background: BLUE,
  })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,
    background: BLUE,
  },
})
  .composite([{ input: innerPng, left: PADDING, top: PADDING }])
  .png()
  .toFile(outPath);
