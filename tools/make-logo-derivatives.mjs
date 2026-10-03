// Resized copies of the original logo for display and the site icon.
// The original public/assets/ka-nails-logo.png is never modified (its SHA-256
// is pinned by tests); these are scaled-down derivatives of it, not redraws.
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const source = path.resolve("public/assets/ka-nails-logo.png");
const assets = path.resolve("public/assets");
const app = path.resolve("app");

for (const size of [320, 640]) {
  const out = path.join(assets, `ka-nails-logo-${size}.webp`);
  await sharp(source)
    .resize(size, size, { kernel: "lanczos3" })
    .webp({ quality: 90, effort: 6 })
    .toFile(out);
  const { size: bytes } = await fs.stat(out);
  console.log(`${path.relative(process.cwd(), out)}: ${bytes} bytes`);
}

// favicon.ico with embedded PNG images (supported by every current browser).
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(
  icoSizes.map((size) =>
    sharp(source)
      .resize(size, size, { kernel: "lanczos3" })
      .ensureAlpha()
      .png()
      .toBuffer(),
  ),
);
const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(icoSizes.length, 4);
const entries = [];
let offset = 6 + 16 * icoSizes.length;
icoSizes.forEach((size, i) => {
  const entry = Buffer.alloc(16);
  entry.writeUInt8(size, 0); // width
  entry.writeUInt8(size, 1); // height
  entry.writeUInt8(0, 2); // palette colours
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // colour planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(pngs[i].length, 8);
  entry.writeUInt32LE(offset, 12);
  offset += pngs[i].length;
  entries.push(entry);
});
const ico = Buffer.concat([header, ...entries, ...pngs]);
await fs.writeFile(path.join(app, "favicon.ico"), ico);
console.log(`app/favicon.ico: ${ico.length} bytes`);

// Home-screen icons referenced by app/manifest.ts.
const icons = path.resolve("public/icons");
await fs.mkdir(icons, { recursive: true });
for (const size of [192, 512]) {
  const out = path.join(icons, `icon-${size}.png`);
  await sharp(source)
    .resize(size, size, { kernel: "lanczos3" })
    .png({ compressionLevel: 9 })
    .toFile(out);
  const { size: bytes } = await fs.stat(out);
  console.log(`${path.relative(process.cwd(), out)}: ${bytes} bytes`);
}

const apple = path.join(app, "apple-icon.png");
await sharp(source)
  .resize(180, 180, { kernel: "lanczos3" })
  .png({ compressionLevel: 9 })
  .toFile(apple);
const { size: appleBytes } = await fs.stat(apple);
console.log(`app/apple-icon.png: ${appleBytes} bytes`);
