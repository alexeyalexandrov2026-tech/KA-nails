// Link preview image (Open Graph / Twitter), 1200x630 JPEG under 300 KB
// (WhatsApp drops larger previews). The original logo is placed unmodified on
// its own cream ground; three portfolio works sit beside it in arches.
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const WIDTH = 1200;
const HEIGHT = 630;
const CREAM = "#fdf8f2";
const ROSE = "#b8937f";
const out = path.resolve("public/og/ka-nails-share.jpg");

const logoSize = 470;
const logo = await sharp("public/assets/ka-nails-logo.png")
  .resize(logoSize, logoSize, { kernel: "lanczos3" })
  .toBuffer();

const ARCH_W = 170;
const ARCH_H = 380;
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
    sharp(`public/photos/${slug}-med.webp`)
      .resize(ARCH_W, ARCH_H, { fit: "cover" })
      .composite([{ input: archMask, blend: "dest-in" }])
      .png()
      .toBuffer(),
  ),
);

const archTop = [110, 150, 110];
const archLeft = [590, 790, 990];
// Thin rose-gold arc behind the arches (decoration, clear of the logo).
const decor = Buffer.from(
  `<svg width="${WIDTH}" height="${HEIGHT}"><path d="M560 600 C 700 560, 1050 520, 1170 80" fill="none" stroke="${ROSE}" stroke-width="2"/></svg>`,
);

await fs.mkdir(path.dirname(out), { recursive: true });
await sharp({
  create: { width: WIDTH, height: HEIGHT, channels: 3, background: CREAM },
})
  .composite([
    { input: decor, left: 0, top: 0 },
    { input: logo, left: 60, top: Math.round((HEIGHT - logoSize) / 2) },
    ...arches.map((input, i) => ({
      input,
      left: archLeft[i],
      top: archTop[i],
    })),
  ])
  .jpeg({ quality: 84, mozjpeg: true })
  .toFile(out);

const { size } = await fs.stat(out);
console.log(`${path.relative(process.cwd(), out)}: ${size} bytes`);
if (size > 300 * 1024) {
  throw new Error("Share image is over 300 KB; WhatsApp would drop it.");
}
