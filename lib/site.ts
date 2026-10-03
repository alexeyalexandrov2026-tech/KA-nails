/**
 * Public address of the site, without a trailing slash. Set
 * NEXT_PUBLIC_SITE_URL at build time when the studio moves to its own domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://ka-nails.pages.dev"
).replace(/\/+$/, "");

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
