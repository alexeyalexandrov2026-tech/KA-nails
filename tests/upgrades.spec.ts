import { expect, test } from "@playwright/test";
import { SALON_PHOTOS } from "../lib/photo-inventory";

const SITE = "https://ka-nails.pages.dev";
const PAGES = ["/", "/services/", "/gallery/", "/contact/", "/book/"];
const ROUTES = [...PAGES, ...PAGES.map((path) => `/ru${path}`)];

const enPath = (route: string) => route.replace(/^\/ru\//, "/");
const ruPath = (route: string) =>
  route.startsWith("/ru/") ? route : `/ru${route}`;

test.describe("Stage 6 upgrades: sharing, SEO switch, photos, images", () => {
  test("every page has link previews, canonical and EN/RU alternates", async ({
    page,
  }) => {
    for (const route of ROUTES) {
      await page.goto(route);
      const head = page.locator("head");
      const meta = (selector: string) =>
        head.locator(selector).first().getAttribute("content");

      await expect(head.locator('link[rel="canonical"]')).toHaveAttribute(
        "href",
        `${SITE}${route}`,
      );
      expect(await meta('meta[property="og:url"]')).toBe(`${SITE}${route}`);
      expect(await meta('meta[property="og:image"]')).toBe(
        `${SITE}/og/ka-nails-share.jpg`,
      );
      expect(await meta('meta[property="og:locale"]')).toBe(
        route.startsWith("/ru/") ? "ru_RU" : "en_US",
      );
      expect(await meta('meta[name="twitter:card"]')).toBe(
        "summary_large_image",
      );
      expect(await meta('meta[property="og:title"]')).toBe(await page.title());
      for (const [lang, path] of [
        ["en", enPath(route)],
        ["ru", ruPath(route)],
        ["x-default", enPath(route)],
      ]) {
        await expect(
          head.locator(`link[rel="alternate"][hreflang="${lang}"]`),
          `${route} ${lang}`,
        ).toHaveAttribute("href", `${SITE}${path}`);
      }
      // Closed to search engines until the launch switch is turned on.
      expect(await meta('meta[name="robots"]')).toMatch(/noindex/);
    }
  });

  test("the share image is a light JPEG that WhatsApp will show", async ({
    request,
  }) => {
    const response = await request.get("/og/ka-nails-share.jpg");
    expect(response.status()).toBe(200);
    const body = await response.body();
    expect(body.length).toBeLessThan(300 * 1024);
    // JPEG signature
    expect(body.subarray(0, 3).toString("hex")).toBe("ffd8ff");
  });

  test("robots, sitemap and manifest follow the launch switch", async ({
    request,
  }) => {
    const robots = await (await request.get("/robots.txt")).text();
    expect(robots).toContain("Allow: /");
    expect(robots).not.toContain("Sitemap:");
    const sitemap = await (await request.get("/sitemap.xml")).text();
    expect(sitemap).toContain("<urlset");
    expect(sitemap).not.toContain("<url>");

    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toBe("KA Nails");
    for (const icon of manifest.icons as { src: string }[]) {
      expect((await request.get(icon.src)).status()).toBe(200);
    }
  });

  test("the 404 page is branded, bilingual and closed to search engines", async ({
    page,
  }) => {
    await page.goto("/404.html");
    await expect(page).toHaveTitle("Page not found | KA Nails");
    await expect(page.locator('img[alt="KA Nails"]')).toBeVisible();
    await expect(page.locator("h1")).toHaveText(
      "This page could not be found.",
    );
    await expect(page.locator('[lang="ru"] h2')).toHaveText(
      "Страница не найдена.",
    );
    await expect(page.locator('a[href="/gallery/"]')).toBeVisible();
    await expect(page.locator('a[href="/ru/"]')).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
  });

  test("Cloudflare gets security and cache headers for every page", async ({
    request,
  }) => {
    const response = await request.get("/_headers");
    expect(response.status()).toBe(200);
    const rules = await response.text();
    const block = (path: string) =>
      rules.split(/\n(?=\/)/).find((part) => part.startsWith(`${path}\n`)) ??
      "";
    const all = block("/*");
    expect(all).toContain("X-Content-Type-Options: nosniff");
    expect(all).toContain("Referrer-Policy: strict-origin-when-cross-origin");
    expect(all).toContain("X-Frame-Options: DENY");
    expect(all).toMatch(/Content-Security-Policy: .*frame-ancestors 'none'/);
    // The site must never block its own scripts: no script or default policy.
    expect(all).not.toMatch(/script-src|default-src/);
    expect(block("/_next/static/*")).toContain(
      "Cache-Control: public, max-age=31536000, immutable",
    );
    // Photos and fonts keep stable names, so they must not be cached forever.
    expect(block("/photos/*")).not.toContain("immutable");
    expect(block("/fonts/*")).not.toContain("immutable");
  });

  test("screenshot overlays are cropped from the portfolio photos", () => {
    // These works came from video screenshots (sound icon, progress bar,
    // Instagram header); the crops leave them narrower than 1200 px.
    const cropped = ["work-06", "work-07", "work-08", "work-10", "work-11"];
    for (const photo of SALON_PHOTOS) {
      if (cropped.includes(photo.id) || photo.id === "work-19") {
        expect(photo.width, photo.id).toBe(1180);
      }
    }
    const transformation = SALON_PHOTOS.find((p) => p.id === "work-19")!;
    expect(transformation.notes).not.toMatch(/clinical|nail bed/i);
    expect(transformation.alt).not.toMatch(/revitaliz|nail bed/i);
  });

  test("portfolio photos are served at the size they are shown", async ({
    page,
  }) => {
    await page.goto("/");
    const tiles = page.locator(".hero-collage-stage .collage-artwork-img");
    await expect(tiles).toHaveCount(4);
    for (const tile of await tiles.all()) {
      await expect(tile).toHaveAttribute(
        "srcset",
        /-thumb\.webp 400w, .*-med\.webp 750w, .*\.webp \d+w$/,
      );
      await expect(tile).toHaveAttribute("sizes", /.+/);
    }

    await page.goto("/gallery/");
    const eager = page.locator('img.gallery-card-image[loading="eager"]');
    await expect(eager).toHaveCount(3);
    await expect(page.locator("img.gallery-card-image[srcset]")).toHaveCount(
      19,
    );
  });

  test("portfolio copy makes no unverifiable claims", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("main")).not.toContainText(/verified/i);
    await page.goto("/gallery/");
    await expect(page.locator("main")).not.toContainText(/clinical|nail bed/i);
  });
});
