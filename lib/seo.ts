import type { Metadata } from "next";
import { getDictionary, getLocalizedPath, type Locale } from "./locales";
import { SITE_URL, absoluteUrl } from "./site";

export type PageKey = "home" | "services" | "gallery" | "contact" | "book";

const PAGE_PATHS: Record<PageKey, string> = {
  home: "/",
  services: "/services/",
  gallery: "/gallery/",
  contact: "/contact/",
  book: "/book/",
};

export const PAGE_KEYS = Object.keys(PAGE_PATHS) as PageKey[];

/**
 * Launch switch. The site stays out of search engines (noindex, no sitemap)
 * until it is built with NEXT_PUBLIC_SITE_INDEXING=index.
 */
export const SITE_INDEXING = process.env.NEXT_PUBLIC_SITE_INDEXING === "index";

/** Link preview image, built by tools/make-share-image.mjs. */
export const SHARE_IMAGE = {
  url: "/og/ka-nails-share.jpg",
  width: 1200,
  height: 630,
};

const OTHER_LOCALE: Record<Locale, Locale> = { en: "ru", ru: "en" };

export function pageUrl(page: PageKey, locale: Locale): string {
  return absoluteUrl(getLocalizedPath(PAGE_PATHS[page], locale));
}

/** Robots policy shared by both root layouts and every page. */
export const robotsMetadata: Metadata["robots"] = SITE_INDEXING
  ? { index: true, follow: true }
  : { index: false, follow: false };

/** Defaults for a root layout; each page refines them with pageMetadata. */
export function layoutMetadata(locale: Locale): Metadata {
  return {
    ...pageMetadata(locale, "home"),
    title: { default: "KA Nails", template: "%s | KA Nails" },
  };
}

/**
 * Title, description, canonical URL, EN/RU alternates, link previews and
 * robots for one page, all from the locale dictionaries.
 */
export function pageMetadata(locale: Locale, page: PageKey): Metadata {
  const meta = getDictionary(locale).meta;
  const { title, description } = meta.pages[page];
  const fullTitle = page === "home" ? title : `${title} | KA Nails`;
  const url = pageUrl(page, locale);
  const image = { ...SHARE_IMAGE, alt: meta.shareImageAlt };
  return {
    metadataBase: new URL(SITE_URL),
    title: page === "home" ? { absolute: title } : title,
    description,
    robots: robotsMetadata,
    alternates: {
      canonical: url,
      languages: {
        en: pageUrl(page, "en"),
        ru: pageUrl(page, "ru"),
        "x-default": pageUrl(page, "en"),
      },
    },
    openGraph: {
      type: "website",
      siteName: "KA Nails",
      title: fullTitle,
      description,
      url,
      locale: meta.ogLocale,
      alternateLocale: [getDictionary(OTHER_LOCALE[locale]).meta.ogLocale],
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [image],
    },
  };
}
