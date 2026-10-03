import { expect, test } from "@playwright/test";
import { channelHref, orderedChannels, studioFacts } from "../lib/studio-facts";

test.describe("Home composition (stage 4)", () => {
  test("the hero logo is never covered by a tile at 1440, 390 and 320", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/");
      const logo = page.locator('.hero-collage-stage img[alt="KA Nails"]');
      await logo.scrollIntoViewIfNeeded();
      const covered = await logo.evaluate((img) => {
        const box = img.getBoundingClientRect();
        const misses: string[] = [];
        for (const [fx, fy] of [
          [0.5, 0.5],
          [0.25, 0.25],
          [0.75, 0.25],
          [0.25, 0.75],
          [0.75, 0.75],
          [0.5, 0.9],
        ] as const) {
          const hit = document.elementFromPoint(
            box.left + box.width * fx,
            box.top + box.height * fy,
          );
          if (!hit?.closest(".tile-logo")) {
            misses.push(`${fx},${fy} → ${hit?.className || hit?.tagName}`);
          }
        }
        return misses;
      });
      expect(covered, `logo covered at ${width}px`).toEqual([]);
    }
  });

  test("decorations are hidden from assistive tech and never take clicks", async ({
    page,
  }) => {
    for (const url of ["/", "/ru/"]) {
      await page.goto(url);
      const decor = page.locator("[data-decor]");
      expect(await decor.count()).toBeGreaterThanOrEqual(3);
      for (const el of await decor.all()) {
        await expect(el).toHaveAttribute("aria-hidden", "true");
        await expect(el).toHaveCSS("pointer-events", "none");
      }
    }
  });

  test("hero heading keeps its words, second line in italic", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText(
      /^A little care.\s*A moment of pure artistry.$/,
    );
    await expect(page.locator("h1 .hero-heading-accent")).toHaveCSS(
      "font-style",
      "italic",
    );
  });

  test("section 02 is the dark night gallery with readable controls", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".moving-wall-section")).toHaveCSS(
      "background-color",
      "rgb(38, 27, 21)",
    );
    await expect(page.locator(".moving-wall-section .section-title")).toHaveCSS(
      "color",
      "rgb(253, 248, 242)",
    );
    await expect(page.locator(".moving-wall-footer-note")).not.toContainText(
      /Target|цель/,
    );
  });

  test("header book button stays readable", async ({ page }) => {
    await page.goto("/");
    const book = page.locator(".main-nav .nav-book-button");
    await expect(book).toHaveCSS("color", "rgb(253, 248, 242)");
    await expect(book).toHaveCSS("background-color", "rgb(38, 27, 21)");
  });

  test("style chapters open their works in the gallery", async ({ page }) => {
    for (const [url, prefix] of [
      ["/", "/gallery/"],
      ["/ru/", "/ru/gallery/"],
    ] as const) {
      await page.goto(url);
      const links = page.locator(".services-showcase .service-book-link");
      await expect(links).toHaveCount(3);
      for (const [i, id] of ["work-18", "work-17", "work-14"].entries()) {
        await expect(links.nth(i)).toHaveAttribute("href", `${prefix}#${id}`);
      }
      await expect(
        page.locator(".services-showcase .service-duration"),
      ).toHaveCount(0);
    }
  });

  test("style picker narrows the real portfolio and opens the lightbox", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const picker = page.locator(".style-picker");
    const results = picker.locator(".picker-result:not(.picker-result-more)");
    const status = picker.locator(".picker-status");

    await expect(status).toHaveText("Matching works: 19 of 19");
    await expect(results).toHaveCount(6);

    await picker.getByRole("radio", { name: "French" }).check();
    await picker.getByRole("radio", { name: "Light & nude" }).check();
    await expect(status).toHaveText("Matching works: 3 of 19");
    await expect(results).toHaveCount(3);
    for (const result of await results.all()) {
      await expect(result).toHaveAttribute("data-category", "French");
      await expect(result).toHaveAttribute("data-tone", "light");
    }

    // No French work is deep in tone: the closest (French) works are shown.
    await picker.getByRole("radio", { name: "Deep & dark" }).check();
    await expect(status).toHaveText(/closest works/);
    for (const result of await results.all()) {
      await expect(result).toHaveAttribute("data-category", "French");
    }

    const first = results.first().locator("button");
    await first.click();
    const dialog = page.locator('div[role="dialog"].lightbox-overlay');
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(first).toBeFocused();

    await picker.getByRole("button", { name: "Start over" }).click();
    await expect(status).toHaveText("Matching works: 19 of 19");
  });

  test("footer shows the logo, links, a work mosaic and only published facts", async ({
    page,
  }) => {
    for (const [url, prefix] of [
      ["/", "/gallery/"],
      ["/ru/gallery/", "/ru/gallery/"],
    ] as const) {
      await page.goto(url);
      const footer = page.locator("footer");
      await expect(footer.locator('img[alt="KA Nails"]')).toHaveCount(1);
      await expect(footer.locator("nav.footer-links a")).toHaveCount(4);
      const mosaic = footer.locator(".footer-mosaic a");
      await expect(mosaic).toHaveCount(4);
      for (const link of await mosaic.all()) {
        await expect(link).toHaveAttribute(
          "href",
          new RegExp(`^${prefix}#work-\\d\\d$`),
        );
      }
      await expect(footer.locator(".footer-legal")).toHaveText("© KA Nails");
      const hasFacts =
        studioFacts.address !== null || studioFacts.channels.length > 0;
      await expect(footer.locator("[data-facts]")).toHaveCount(
        hasFacts ? 1 : 0,
      );
      // Exactly the published channels, in the owner's order.
      const contacts = await footer
        .locator(
          'a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"], a[href*="t.me/"], a[href*="instagram.com"]',
        )
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")));
      expect(contacts).toEqual(
        orderedChannels(studioFacts.channels).map(channelHref),
      );
    }
  });
});
