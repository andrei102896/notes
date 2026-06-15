import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "src/assets/icons/extension-icon.svg");
const outPath = join(root, "src/assets/icons/extension-icon.png");

const SIZE = 128;
const PADDING = 4;
const INNER = SIZE - PADDING * 2;

const innerPng = await sharp(await readFile(svgPath))
  .resize(INNER, INNER, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  })
  .png()
  .toBuffer();

await sharp({
  create: {
    width: SIZE,
    height: SIZE,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite([{ input: innerPng, left: PADDING, top: PADDING }])
  .png()
  .toFile(outPath);
