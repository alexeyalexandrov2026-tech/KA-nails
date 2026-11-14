// The Android launcher icon: an adaptive icon whose foreground is a scaled-down
// copy of the original logo and whose background is the logo's own cream. The
// original public/assets/ka-nails-logo.png is never modified (see CLAUDE.md);
// these are resized derivatives, not redraws. Run from the repository root
// after the logo changes, then commit the PNGs it writes:
//   node android/tools/make-launcher-icons.mjs
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const source = path.resolve("public/assets/ka-nails-logo.png");
const res = path.resolve("android/app/src/main/res");

// Sampled from the logo's corners; values/ic_launcher_background.xml matches.
const cream = { r: 252, g: 247, b: 240, alpha: 1 };

// An adaptive icon layer is 108 dp; a circular mask keeps only the central
// 66 dp. The logo's artwork reaches 37.5% of its side from the centre, so an
// 84 dp logo keeps every stroke within 31.5 dp of the centre.
const layerDp = 108;
const logoDp = 84;
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

for (const [name, scale] of Object.entries(densities)) {
  const layer = Math.round(layerDp * scale);
  const logo = Math.round(logoDp * scale);
  const inset = Math.round((layer - logo) / 2);
  const dir = path.join(res, `mipmap-${name}`);
  await mkdir(dir, { recursive: true });
  const out = path.join(dir, "ic_launcher_foreground.png");
  const resized = await sharp(source)
    .resize(logo, logo, { kernel: "lanczos3" })
    .toBuffer();
  await sharp({
    create: { width: layer, height: layer, channels: 4, background: cream },
  })
    .composite([{ input: resized, top: inset, left: inset }])
    .png({ compressionLevel: 9 })
    .toFile(out);

  // Themed icons (Android 13+) tint this layer: the logo's strokes as an
  // alpha mask, the darker the stroke the more opaque, over transparency.
  const mask = await sharp(source)
    .resize(logo, logo, { kernel: "lanczos3" })
    .greyscale()
    .negate({ alpha: false })
    .linear(1.25, -10)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const strokes = await sharp({
    create: { width: logo, height: logo, channels: 3, background: "#000" },
  })
    .joinChannel(mask, { raw: { width: logo, height: logo, channels: 1 } })
    .png()
    .toBuffer();
  const mono = path.join(dir, "ic_launcher_monochrome.png");
  await sharp({
    create: {
      width: layer,
      height: layer,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: strokes, top: inset, left: inset }])
    .png({ compressionLevel: 9 })
    .toFile(mono);
  console.log(
    `${path.relative(process.cwd(), out)}, monochrome: ${layer}x${layer}`,
  );
}
