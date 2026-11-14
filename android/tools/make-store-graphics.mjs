// Google Play store graphics, derived from the original logo (never modified,
// see CLAUDE.md) and authentic portfolio works. Run from the repository root:
//   node android/tools/make-store-graphics.mjs
// - icon-512.png: 512x512 32-bit PNG (Play requires an alpha channel), the
//   logo on its own cream, the same artwork as public/icons/icon-512.png.
// - feature-graphic-1024x500.png: 24-bit PNG (Play rejects alpha here), the
//   composition of tools/make-share-image.mjs laid out for 1024x500.
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const logoPath = path.resolve("public/assets/ka-nails-logo.png");
const outDir = path.resolve("android/store-listing/graphics");
// The logo's own corner colour, as in android/tools/make-launcher-icons.mjs.
const CREAM = { r: 252, g: 247, b: 240 };
const ROSE = "#b8937f";

await fs.mkdir(outDir, { recursive: true });

const icon = path.join(outDir, "icon-512.png");
await sharp(logoPath)
  .resize(512, 512, { kernel: "lanczos3" })
  .ensureAlpha()
  .png({ compressionLevel: 9 })
  .toFile(icon);

const WIDTH = 1024;
const HEIGHT = 500;
const logoSize = 420;
const logo = await sharp(logoPath)
  .resize(logoSize, logoSize, { kernel: "lanczos3" })
  .toBuffer();

const ARCH_W = 150;
const ARCH_H = 330;
const archMask = Buffer.from(
  `<svg width="${ARCH_W}" height="${ARCH_H}"><path d="M0 ${ARCH_W / 2} A${ARCH_W / 2} ${ARCH_W / 2} 0 0 1 ${ARCH_W} ${ARCH_W / 2} V${ARCH_H} H0 Z" fill="#fff"/></svg>`,
);
const works = [
  "bordeaux-luxury-editorial",
  "pastel-lilac-bliss",
  "royal-cobalt-gloss",
];
const arches = await Promise.all(
  works.map((slug) =>
    sharp(path.resolve(`public/photos/${slug}-med.webp`))
      .resize(ARCH_W, ARCH_H, { fit: "cover" })
      .composite([{ input: archMask, blend: "dest-in" }])
      .png()
      .toBuffer(),
  ),
);
const archLeft = [500, 670, 840];
const archTop = [70, 105, 70];
const decor = Buffer.from(
  `<svg width="${WIDTH}" height="${HEIGHT}"><path d="M470 480 C 590 450, 900 420, 1000 60" fill="none" stroke="${ROSE}" stroke-width="2"/></svg>`,
);

const feature = path.join(outDir, "feature-graphic-1024x500.png");
await sharp({
  create: { width: WIDTH, height: HEIGHT, channels: 3, background: CREAM },
})
  .composite([
    { input: decor, left: 0, top: 0 },
    { input: logo, left: 40, top: Math.round((HEIGHT - logoSize) / 2) },
    ...arches.map((input, i) => ({
      input,
      left: archLeft[i],
      top: archTop[i],
    })),
  ])
  .removeAlpha()
  .png({ compressionLevel: 9 })
  .toFile(feature);

for (const file of [icon, feature]) {
  const meta = await sharp(file).metadata();
  const { size } = await fs.stat(file);
  console.log(
    `${path.relative(process.cwd(), file)}: ${meta.width}x${meta.height}, ` +
      `${meta.channels} channels, ${size} bytes`,
  );
}
