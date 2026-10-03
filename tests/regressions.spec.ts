import { expect, test } from "@playwright/test";

test.describe("Stage 1 defect and performance regressions", () => {
  test("gallery h2.sr-only is visually hidden but still a heading", async ({
    page,
  }) => {
    for (const url of ["/gallery/", "/ru/gallery/"]) {
      await page.goto(url);
      const h2 = page.locator("h2.sr-only");
      await expect(h2).toHaveCount(1);
      const box = await h2.boundingBox();
      expect(box, `${url} sr-only h2 has a box`).not.toBeNull();
      expect(box!.width).toBeLessThanOrEqual(1);
      expect(box!.height).toBeLessThanOrEqual(1);
      await expect(
        page.getByRole("heading", { level: 2, name: await h2.innerText() }),
      ).toHaveCount(1);
    }
  });

  test("hero collage stays idle (no DOM writes) without pointer input", async ({
    page,
  }) => {
    await page.goto("/");
    const mutations = await page.evaluate(async () => {
      const stage = document.querySelector(".hero-collage-stage");
      if (!stage) return -1;
      let count = 0;
      const observer = new MutationObserver((records) => {
        count += records.length;
      });
      observer.observe(stage, {
        attributes: true,
        childList: true,
        subtree: true,
      });
      await new Promise((resolve) => setTimeout(resolve, 1000));
      observer.disconnect();
      return count;
    });
    expect(mutations).toBe(0);
  });

  test("home loads resized images and never the 890 KB logo PNG", async ({
    page,
  }) => {
    const requested: string[] = [];
    page.on("request", (request) => requested.push(request.url()));
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const heroSources = await page
      .locator(".hero-collage-stage .collage-artwork-img")
      .evaluateAll((imgs) => imgs.map((img) => img.getAttribute("src")));
    expect(heroSources).toHaveLength(4);
    for (const src of heroSources) expect(src).toMatch(/-med\.webp$/);

    await expect(
      page.locator('.hero-collage-stage img[alt="KA Nails"]'),
    ).toHaveAttribute("src", /ka-nails-logo-640\.webp$/);
    expect(requested.some((url) => url.endsWith("/ka-nails-logo.png"))).toBe(
      false,
    );
    // Only the small first-screen hero assets may be preloaded: the 640px
    // logo copy and the four -med hero tiles. Never the PNG, never wall cards.
    const preloads = await page
      .locator('link[rel="preload"][as="image"]')
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(preloads.length).toBeLessThanOrEqual(5);
    for (const href of preloads) {
      expect(href).toMatch(/ka-nails-logo-640\.webp$|-med\.webp$/);
      expect(heroSources.concat("/assets/ka-nails-logo-640.webp")).toContain(
        href,
      );
    }
  });

  test("photo originals are not published", async ({ request }) => {
    const response = await request.get(
      "/photos/originals/pastel-lilac-bliss.png",
    );
    expect(response.status()).toBe(404);
  });

  test("site icon is served", async ({ page, request }) => {
    const response = await request.get("/favicon.ico");
    expect(response.status()).toBe(200);
    await page.goto("/");
    await expect(page.locator('link[rel="icon"]').first()).toHaveAttribute(
      "href",
      /favicon\.ico/,
    );
  });

  test("lightbox share copies a link to the artwork in the same language", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "share", {
        value: undefined,
        configurable: true,
      });
      const copied: string[] = [];
      (window as unknown as { __copied: string[] }).__copied = copied;
      Object.defineProperty(navigator, "clipboard", {
        value: {
          writeText: async (text: string) => {
            copied.push(text);
          },
        },
        configurable: true,
      });
    });

    for (const [url, expected] of [
      ["/gallery/", /\/gallery\/#work-01$/],
      ["/ru/gallery/", /\/ru\/gallery\/#work-01$/],
    ] as const) {
      await page.goto(url);
      await page
        .locator("article#work-01 .gallery-card-trigger")
        .first()
        .click();
      const dialog = page.locator('div[role="dialog"].lightbox-overlay');
      await expect(dialog).toBeVisible();
      await dialog.locator(".lightbox-action-btn").click();
      await expect
        .poll(() =>
          page.evaluate(() =>
            (window as unknown as { __copied: string[] }).__copied.at(-1),
          ),
        )
        .toMatch(expected);
      await page.keyboard.press("Escape");
    }
  });

  test("final booking band sends visitors to the booking page", async ({
    page,
  }) => {
    for (const [url, href] of [
      ["/", "/book/"],
      ["/ru/", "/ru/book/"],
    ] as const) {
      await page.goto(url);
      await expect(
        page.locator(".final-booking-band .final-btn"),
      ).toHaveAttribute("href", href);
    }
  });
});
