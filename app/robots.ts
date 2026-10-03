import type { MetadataRoute } from "next";
import { SITE_INDEXING } from "../lib/seo";
import { absoluteUrl } from "../lib/site";

export const dynamic = "force-static";

// Crawlers may always fetch pages (so they can read the noindex tag); the
// sitemap is announced only once the site is opened with the launch switch.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    ...(SITE_INDEXING ? { sitemap: absoluteUrl("/sitemap.xml") } : {}),
  };
}
