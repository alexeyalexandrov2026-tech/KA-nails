// Web copies of the master's portrait for the home page profile.
// Sources live in source-assets/master/ (not published, metadata removed);
// each becomes public/photos/master/<name>.webp, cropped to the 4:5 frame the
// profile shows (components/facts/master-profile.tsx) at twice its 480 px width.
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

const sourceDir = path.resolve("source-assets/master");
const outDir = path.resolve("public/photos/master");
const WIDTH = 960;
const HEIGHT = 1200;

await fs.mkdir(outDir, { recursive: true });

for (const file of await fs.readdir(sourceDir)) {
  if (!/\.(jpe?g|png|webp)$/i.test(file)) continue;
  const out = path.join(outDir, `${path.parse(file).name}.webp`);
  // `cover` keeps the centre of the frame, as the profile's CSS does.
  await sharp(path.join(sourceDir, file))
    .rotate()
    .resize(WIDTH, HEIGHT, { fit: "cover", position: "centre" })
    .webp({ quality: 80, effort: 6 })
    .toFile(out);
  const { size } = await fs.stat(out);
  console.log(`${path.relative(process.cwd(), out)}: ${size} bytes`);
}
