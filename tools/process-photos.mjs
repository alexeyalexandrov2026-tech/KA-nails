import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";

// Define the 19 unique photos and their factual artistic attributes
const PHOTO_DEFINITIONS = [
  {
    id: "work-01",
    rawPath: "raw-photos/gmail/D2A429AB-8450-4C42-A6CF-E9EBA1DEF417.png",
    slug: "bordeaux-luxury-editorial",
    title: "Bordeaux Luxury Editorial",
    category: "Classic",
    subCategory: "Pedicure",
    finish: "High-Gloss Gel",
    colorFamily: "Deep Wine / Bordeaux",
    alt: "Deep burgundy bordeaux pedicure with candle, white baby's breath flowers and gold jewelry",
    notes:
      "Editorial still life styling with candle, silk and fresh floral accents",
    featured: true,
    heroEligible: true,
    heroRole: "lead-anchor",
    crop: null, // Full original frame is pristine editorial art
    aspectRatio: "3:4",
  },
  {
    id: "work-02",
    rawPath: "raw-photos/gmail1/C2C9CCBC-8C05-4036-B8BA-3367BB0B7AA1.png",
    slug: "royal-cobalt-gloss",
    title: "Royal Cobalt Gloss",
    category: "Color",
    subCategory: "Pedicure",
    finish: "Mirror Gel",
    colorFamily: "Cobalt Blue",
    alt: "Vibrant royal cobalt blue gel pedicure on light grey linen fabric",
    notes: "Crisp square toe contour with high-pigment cobalt blue gel polish",
    featured: true,
    heroEligible: true,
    heroRole: "accent-tile-1",
    crop: null,
    aspectRatio: "1:1",
  },
  {
    id: "work-03",
    rawPath: "raw-photos/gmail1/DE9678D4-1C51-4984-81A9-391BBF8C27A7.png",
    slug: "pastel-lilac-bliss",
    title: "Pastel Lilac Bliss",
    category: "Color",
    subCategory: "Pedicure",
    finish: "Cream Gel",
    colorFamily: "Lilac / Lavender",
    alt: "Soft pastel lilac gel pedicure on white textured spa towel",
    notes:
      "Clean square shaping with immaculate cuticle line and pale lavender finish",
    featured: true,
    heroEligible: true,
    heroRole: "accent-tile-2",
    crop: null,
    aspectRatio: "1:1",
  },
  {
    id: "work-04",
    rawPath: "raw-photos/gmail/IMG_2823.jpeg",
    slug: "cornflower-sky-closeup",
    title: "Cornflower Sky Macro",
    category: "Color",
    subCategory: "Pedicure",
    finish: "Gloss Gel",
    colorFamily: "Baby Blue",
    alt: "Macro closeup of baby blue square pedicure resting on plush white spa towel",
    notes:
      "Macro studio detail showcasing surface reflection and clean square shaping",
    featured: true,
    heroEligible: true,
    heroRole: "accent-tile-3",
    crop: null,
    aspectRatio: "3:4",
  },
  {
    id: "work-05",
    rawPath: "raw-photos/gmail1/IMG_1066.jpeg",
    slug: "french-yin-yang",
    title: "Minimal French Contrast",
    category: "French",
    subCategory: "Pedicure",
    finish: "French Tip",
    colorFamily: "Sheer Blush / White",
    alt: "Classic French pedicure with crisp white smile lines on sheer blush base with mandala tattoo",
    notes:
      "Precision micro-smile line French styling on sheer translucent base",
    featured: true,
    heroEligible: true,
    heroRole: "accent-tile-4",
    crop: null,
    aspectRatio: "1:1",
  },
  {
    id: "work-06",
    rawPath: "raw-photos/gmail/IMG_2707.jpeg",
    slug: "french-bow-heart-art",
    title: "French Bow & Heart Art",
    category: "Glitter / Detail",
    subCategory: "Pedicure",
    finish: "Hand-Painted Nail Art",
    colorFamily: "White / Natural Pink",
    alt: "French pedicure featuring delicate hand-painted white bow and heart motifs on big toes",
    notes: "Hand-drawn micro bow and heart illustration on big toe tips",
    featured: true,
    heroEligible: true,
    heroRole: "accent-tile-5",
    cropBottomPx: 70,
    cropRightPx: 140, // video sound icon and progress bar at the right edge
    aspectRatio: "1:1",
  },
  {
    id: "work-07",
    rawPath: "raw-photos/gmail1/IMG_2702.jpeg",
    slug: "rose-quartz-shimmer",
    title: "Rose Quartz Shimmer",
    category: "Glitter / Detail",
    subCategory: "Pedicure",
    finish: "Glitter / Shimmer",
    colorFamily: "Pink Shimmer",
    alt: "Sparkling rose quartz glitter pedicure with multidimensional pink micro-glitter",
    notes: "High-density micro-glitter suspension with prism light reflection",
    featured: true,
    heroEligible: true,
    heroRole: "accent-tile-6",
    cropBottomPx: 75,
    cropRightPx: 140,
    aspectRatio: "1:1",
  },
  {
    id: "work-08",
    rawPath: "raw-photos/gmail1/IMG_2703.jpeg",
    slug: "scarlet-red-lacquer",
    title: "Classic Scarlet Lacquer",
    category: "Classic",
    subCategory: "Pedicure",
    finish: "High-Gloss",
    colorFamily: "True Red",
    alt: "Vibrant classic scarlet red pedicure with brilliant mirror shine",
    notes: "Timeless deep scarlet salon lacquer with ultra-glossy topcoat",
    featured: true,
    heroEligible: false,
    cropBottomPx: 70,
    cropRightPx: 140,
    aspectRatio: "1:1",
  },
  {
    id: "work-09",
    rawPath: "raw-photos/gmail/IMG_2708.jpeg",
    slug: "alabaster-pure-white",
    title: "Alabaster Pure White",
    category: "Classic",
    subCategory: "Pedicure",
    finish: "Opaque Gloss",
    colorFamily: "Pure White",
    alt: "Crisp alabaster white pedicure on draped linen fabric",
    notes: "Full-coverage bright white gel with geometric square contour",
    featured: true,
    heroEligible: false,
    cropBottomPx: 70,
    aspectRatio: "3:4",
  },
  {
    id: "work-10",
    rawPath: "raw-photos/gmail/IMG_2705.jpeg",
    slug: "midnight-onyx-gloss",
    title: "Midnight Onyx Gloss",
    category: "Classic",
    subCategory: "Pedicure",
    finish: "Mirror Gel",
    colorFamily: "Jet Black",
    alt: "High-gloss mirror jet black pedicure resting on neutral linen",
    notes: "Deep opaque black gel with liquid mirror finish",
    featured: false,
    heroEligible: false,
    cropBottomPx: 70,
    cropRightPx: 140,
    aspectRatio: "1:1",
  },
  {
    id: "work-11",
    rawPath: "raw-photos/gmail1/IMG_2704.jpeg",
    slug: "champagne-platinum-glitter",
    title: "Champagne Platinum Glitter",
    category: "Glitter / Detail",
    subCategory: "Pedicure",
    finish: "Reflective Glitter",
    colorFamily: "Champagne Gold",
    alt: "Champagne platinum glitter pedicure with dense metallic reflection",
    notes:
      "Dense platinum champagne reflective shimmer with square toe profile",
    featured: false,
    heroEligible: false,
    cropBottomPx: 75,
    cropRightPx: 140,
    aspectRatio: "1:1",
  },
  {
    id: "work-12",
    rawPath: "raw-photos/gmail1/IMG_2706.jpeg",
    slug: "porcelain-nude-spa",
    title: "Porcelain Nude Natural",
    category: "Classic",
    subCategory: "Pedicure",
    finish: "Sheer Nude",
    colorFamily: "Milky Nude",
    alt: "Porcelain nude pedicure on draped cream salon blanket with fringed edge",
    notes: "Understated sheer milky pink nude gel with natural healthy sheen",
    featured: false,
    heroEligible: false,
    aspectRatio: "4:5",
  },
  {
    id: "work-13",
    rawPath: "raw-photos/gmail1/IMG_1062.jpeg",
    slug: "peach-melon-cream",
    title: "Peach Melon Cream",
    category: "Color",
    subCategory: "Pedicure",
    finish: "Cream Gel",
    colorFamily: "Peach / Coral",
    alt: "Warm pastel peach melon cream pedicure on clean white backdrop",
    notes: "Summer-fresh coral peach pastel with smooth uniform coverage",
    featured: false,
    heroEligible: false,
    aspectRatio: "1:1",
  },
  {
    id: "work-14",
    rawPath: "raw-photos/gmail1/IMG_2701.jpeg",
    slug: "indigo-denim-gloss",
    title: "Indigo Denim Gloss",
    category: "Color",
    subCategory: "Pedicure",
    finish: "Gloss Gel",
    colorFamily: "Indigo Blue",
    alt: "Deep indigo denim blue pedicure on medical-grade salon paper",
    notes:
      "Rich twilight indigo blue pigment with square precision cuticle lines",
    featured: false,
    heroEligible: false,
    aspectRatio: "1:1",
  },
  {
    id: "work-15",
    rawPath: "raw-photos/gmail/IMG_2709.jpeg",
    slug: "rose-shimmer-french",
    title: "Rose Shimmer French",
    category: "French",
    subCategory: "Pedicure",
    finish: "French with Shimmer",
    colorFamily: "Pink Shimmer / White",
    alt: "French pedicure with sparkling shimmer pink base and crisp white micro-tips",
    notes:
      "Subtle luminous pink shimmer base paired with sharp clean French smiling curves",
    featured: false,
    heroEligible: false,
    aspectRatio: "4:5",
  },
  {
    id: "work-16",
    rawPath: "raw-photos/gmail/IMG_2710.jpeg",
    slug: "cornflower-blue-drape",
    title: "Cornflower Blue Drape",
    category: "Color",
    subCategory: "Pedicure",
    finish: "Cream Gel",
    colorFamily: "Sky Blue",
    alt: "Soft cornflower sky blue pedicure draped on sheer white textile",
    notes: "Powder blue pastel pedicure set against soft folded textile",
    featured: false,
    heroEligible: false,
    aspectRatio: "1:1",
  },
  {
    id: "work-17",
    rawPath: "raw-photos/gmail/IMG_2711.jpeg",
    slug: "french-toe-ring-accent",
    title: "French Toe-Ring Accent",
    category: "French",
    subCategory: "Pedicure",
    finish: "Classic French",
    colorFamily: "Blush / White",
    alt: "Classic French pedicure with silver band toe-ring accent",
    notes:
      "Elegant traditional French pedicure complemented by minimalist silver toe jewelry",
    featured: false,
    heroEligible: false,
    aspectRatio: "4:5",
  },
  {
    id: "work-18",
    rawPath: "raw-photos/gmail/IMG_3261.jpeg",
    slug: "deep-bordeaux-studio-portrait",
    title: "Deep Bordeaux Studio Portrait",
    category: "Classic",
    subCategory: "Pedicure",
    finish: "High-Gloss",
    colorFamily: "Bordeaux Wine",
    alt: "Full-frame portrait of deep bordeaux wine pedicure with high reflective sheen",
    notes:
      "Auto-rotated high-resolution salon master shot of deep wine pedicure",
    featured: false,
    heroEligible: false,
    aspectRatio: "3:4",
  },
  {
    id: "work-19",
    rawPath: "raw-photos/gmail/IMG_2712.jpeg",
    slug: "restorative-aesthetic-transformation",
    title: "Restorative Aesthetic Pedicure",
    category: "Restorative",
    subCategory: "Pedicure",
    finish: "Restorative Care",
    colorFamily: "Scarlet Red / Natural Care",
    alt: "Before-and-after pedicure: natural toenails before care, then neatly shaped toenails finished in scarlet red",
    notes:
      "Before and after: a careful restorative pedicure finished in classic red",
    featured: false,
    heroEligible: false,
    isTransformation: true,
    // Instagram screenshot: header (account name, date), sound icon, progress bar
    cropTopPx: 145,
    cropRightPx: 140,
    aspectRatio: "3:4",
  },
];

async function main() {
  const publicPhotosDir = path.resolve("public/photos");
  const originalsDir = path.resolve("source-assets/photos/originals");

  await fs.mkdir(publicPhotosDir, { recursive: true });
  await fs.mkdir(originalsDir, { recursive: true });

  const inventory = [];

  // `--only=work-06,work-19` re-renders just those works; every other work
  // keeps its existing files and the inventory is rebuilt from what is on disk.
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length).split(",") : null;

  for (const item of PHOTO_DEFINITIONS) {
    const baseName = item.slug;
    const fullWebp = `${baseName}.webp`;
    const medWebp = `${baseName}-med.webp`;
    const thumbWebp = `${baseName}-thumb.webp`;
    const fullJpg = `${baseName}.jpg`;

    if (only && !only.includes(item.id)) {
      console.log(`Keeping [${item.id}] ${item.title}`);
    } else {
      console.log(`Processing [${item.id}] ${item.title} ...`);

      // The raw archive is not kept in the repository; untouched copies of the
      // originals live in source-assets/photos/originals/ and are used instead.
      const originalExt = path.extname(item.rawPath);
      const originalDest = path.join(
        originalsDir,
        `${item.slug}${originalExt}`,
      );
      const hasRaw = await fs
        .access(item.rawPath)
        .then(() => true)
        .catch(() => false);
      if (hasRaw) await fs.copyFile(item.rawPath, originalDest);
      const input = hasRaw ? item.rawPath : originalDest;

      // Load with sharp and auto-rotate according to EXIF
      let pipeline = sharp(input).rotate();
      let meta = await pipeline.metadata();

      // Intentional crops remove app overlays (video sound icon, progress bar,
      // Instagram header) captured in some of the supplied screenshots.
      const top = item.cropTopPx || 0;
      const left = item.cropLeftPx || 0;
      const right = item.cropRightPx || 0;
      const bottom = item.cropBottomPx || 0;
      if (top || left || right || bottom) {
        pipeline = pipeline.extract({
          left,
          top,
          width: meta.width - left - right,
          height: meta.height - top - bottom,
        });
        meta = {
          ...meta,
          width: meta.width - left - right,
          height: meta.height - top - bottom,
        };
      }

      // Generate responsive widths: full (1200w max), medium (750w), thumb (400w)
      const fullWidth = Math.min(1200, meta.width);
      const medWidth = Math.min(750, meta.width);
      const thumbWidth = Math.min(400, meta.width);

      await pipeline
        .clone()
        .resize({ width: fullWidth, withoutEnlargement: true })
        .webp({ quality: 88, effort: 5 })
        .toFile(path.join(publicPhotosDir, fullWebp));
      await pipeline
        .clone()
        .resize({ width: medWidth, withoutEnlargement: true })
        .webp({ quality: 85, effort: 5 })
        .toFile(path.join(publicPhotosDir, medWebp));
      await pipeline
        .clone()
        .resize({ width: thumbWidth, withoutEnlargement: true })
        .webp({ quality: 82, effort: 5 })
        .toFile(path.join(publicPhotosDir, thumbWebp));
      // JPEG fallback for legacy/compatibility
      await pipeline
        .clone()
        .resize({ width: fullWidth, withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toFile(path.join(publicPhotosDir, fullJpg));
    }

    const finalMeta = await sharp(
      path.join(publicPhotosDir, fullWebp),
    ).metadata();

    inventory.push({
      id: item.id,
      slug: item.slug,
      title: item.title,
      category: item.category,
      subCategory: item.subCategory,
      finish: item.finish,
      colorFamily: item.colorFamily,
      alt: item.alt,
      notes: item.notes,
      featured: item.featured,
      heroEligible: item.heroEligible,
      heroRole: item.heroRole || "gallery-item",
      isTransformation: item.isTransformation || false,
      aspectRatio: item.aspectRatio,
      width: finalMeta.width,
      height: finalMeta.height,
      src: `/photos/${fullWebp}`,
      srcMed: `/photos/${medWebp}`,
      srcThumb: `/photos/${thumbWebp}`,
      srcJpg: `/photos/${fullJpg}`,
    });
  }

  // Write TypeScript metadata file
  const tsContent = `// Real KA Nails Work Photography Inventory
// Deterministic source of truth from user-supplied archives (Gmail.zip & Gmail (1).zip)
// Total unique authentic assets: 19 | Fake/synthetic SVGs: 0

export interface SalonPhoto {
  id: string;
  slug: string;
  title: string;
  category: "Classic" | "Color" | "French" | "Glitter / Detail" | "Restorative";
  subCategory: string;
  finish: string;
  colorFamily: string;
  alt: string;
  notes: string;
  featured: boolean;
  heroEligible: boolean;
  heroRole: string;
  isTransformation: boolean;
  aspectRatio: string;
  width: number;
  height: number;
  src: string;
  srcMed: string;
  srcThumb: string;
  srcJpg: string;
}

export const PHOTO_INVENTORY_METRICS = {
  totalFilesProvided: 20,
  uniquePhotos: 19,
  duplicatesRemoved: 1, // IMG_2705.jpeg
  minimumTarget: 30,
  idealTarget: 36,
  additionalPhotosNeededForMinimum: 11,
  additionalPhotosNeededForIdeal: 17,
  inventoryStatus: "INCOMPLETE_MEETS_INITIAL_PORTFOLIO" as const,
};

export const SALON_PHOTOS: SalonPhoto[] = ${JSON.stringify(inventory, null, 2)};

export const HERO_PHOTOS = SALON_PHOTOS.filter((p) => p.heroEligible);
export const FEATURED_PHOTOS = SALON_PHOTOS.filter((p) => p.featured);
export const HOMEPAGE_WALL_PHOTOS = SALON_PHOTOS.slice(0, 12);
export const GALLERY_PHOTOS = SALON_PHOTOS;
`;

  await fs.writeFile("lib/photo-inventory.ts", tsContent, "utf-8");
  console.log("SUCCESS! Processed 19 real salon photos.");
  console.log(
    "Generated lib/photo-inventory.ts and web derivatives in public/photos/",
  );
}

main().catch(console.error);
