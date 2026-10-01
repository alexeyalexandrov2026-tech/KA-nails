import { SALON_PHOTOS, PHOTO_INVENTORY_METRICS } from "./photo-inventory";

export type GalleryCategory =
  "All" | "Classic" | "Color" | "French" | "Glitter / Detail" | "Restorative";

export interface GalleryItem {
  id: string;
  slug: string;
  title: string;
  category: "Classic" | "Color" | "French" | "Glitter / Detail" | "Restorative";
  subCategory: string;
  src: string;
  srcMed: string;
  srcThumb: string;
  srcJpg: string;
  alt: string;
  aspect: "portrait" | "landscape" | "square";
  width: number;
  height: number;
  finish: string;
  colorFamily: string;
  notes: string;
  featured: boolean;
  heroEligible: boolean;
  heroRole: string;
  isTransformation: boolean;
  // Field aliases for backward compatibility and clean UI labeling
  nailShape: string;
  technique: string;
}

export const GALLERY_CATEGORIES: GalleryCategory[] = [
  "All",
  "Classic",
  "Color",
  "French",
  "Glitter / Detail",
  "Restorative",
];

function aspectFromRatio(ratio: string): "portrait" | "landscape" | "square" {
  if (ratio === "1:1") return "square";
  if (ratio === "3:4" || ratio === "4:5") return "portrait";
  return "landscape";
}

export const GALLERY_ITEMS: GalleryItem[] = SALON_PHOTOS.map((p) => ({
  id: p.id,
  slug: p.slug,
  title: p.title,
  category: p.category,
  subCategory: p.subCategory,
  src: p.src,
  srcMed: p.srcMed,
  srcThumb: p.srcThumb,
  srcJpg: p.srcJpg,
  alt: p.alt,
  aspect: aspectFromRatio(p.aspectRatio),
  width: p.width,
  height: p.height,
  finish: p.finish,
  colorFamily: p.colorFamily,
  notes: p.notes,
  featured: p.featured,
  heroEligible: p.heroEligible,
  heroRole: p.heroRole,
  isTransformation: p.isTransformation,
  nailShape: "Precision Square / Natural Contour",
  technique: p.finish,
}));

export const HERO_ITEMS = GALLERY_ITEMS.filter((item) => item.heroEligible);
export const WALL_ITEMS = GALLERY_ITEMS.slice(0, 12);
export const GALLERY_METRICS = PHOTO_INVENTORY_METRICS;

export function getHeroGalleryTiles(): GalleryItem[] {
  return HERO_ITEMS.slice(0, 4);
}
