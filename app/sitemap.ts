import type { MetadataRoute } from "next";
import { PAGE_KEYS, SITE_INDEXING, pageUrl } from "../lib/seo";

export const dynamic = "force-static";

/** Every page in both languages, listed only after launch. */
export default function sitemap(): MetadataRoute.Sitemap {
  if (!SITE_INDEXING) return [];
  return PAGE_KEYS.flatMap((page) =>
    (["en", "ru"] as const).map((locale) => ({
      url: pageUrl(page, locale),
      alternates: {
        languages: { en: pageUrl(page, "en"), ru: pageUrl(page, "ru") },
      },
    })),
  );
}
