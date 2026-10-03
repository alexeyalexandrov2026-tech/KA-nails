import type { GalleryItem } from "./gallery-data";

export type Tone = "light" | "deep" | "bright";
export type Look = GalleryItem["category"];

export const TONES: Tone[] = ["light", "deep", "bright"];
export const LOOKS: Look[] = [
  "Classic",
  "French",
  "Color",
  "Glitter / Detail",
  "Restorative",
];

// Tone of each portfolio work, read from its recorded colour family
// (lib/photo-inventory.ts). Used only to group real photos for the picker.
export const TONE_BY_WORK: Record<string, Tone> = {
  "work-01": "deep", // Deep Wine / Bordeaux
  "work-02": "bright", // Cobalt Blue
  "work-03": "light", // Lilac / Lavender
  "work-04": "light", // Baby Blue
  "work-05": "light", // Sheer Blush / White
  "work-06": "light", // White / Natural Pink
  "work-07": "light", // Pink Shimmer
  "work-08": "bright", // True Red
  "work-09": "light", // Pure White
  "work-10": "deep", // Jet Black
  "work-11": "light", // Champagne Gold
  "work-12": "light", // Milky Nude
  "work-13": "bright", // Peach / Coral
  "work-14": "deep", // Indigo Blue
  "work-15": "light", // Pink Shimmer / White
  "work-16": "light", // Sky Blue
  "work-17": "light", // Blush / White
  "work-18": "deep", // Bordeaux Wine
  "work-19": "bright", // Scarlet Red / Natural Care
};

export interface PickerResult {
  items: GalleryItem[];
  /** Number of works that match both choices exactly. */
  exactCount: number;
}

/**
 * Works matching the chosen look and tone. When nothing matches both, the
 * closest works are returned instead: same look first, otherwise same tone.
 */
export function pickStyles(
  items: GalleryItem[],
  look: Look | null,
  tone: Tone | null,
): PickerResult {
  const byLook = (item: GalleryItem) => !look || item.category === look;
  const byTone = (item: GalleryItem) => !tone || TONE_BY_WORK[item.id] === tone;
  const exact = items.filter((item) => byLook(item) && byTone(item));
  if (exact.length > 0) return { items: exact, exactCount: exact.length };
  const sameLook = items.filter(byLook);
  return {
    items: sameLook.length > 0 ? sameLook : items.filter(byTone),
    exactCount: 0,
  };
}
