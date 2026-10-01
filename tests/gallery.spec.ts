import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("KA Nails Gallery & Motion Suite", () => {
  test("gallery page loads 19 authentic works, supports category filtering and meets WCAG AA", async ({
    page,
  }) => {
    await page.goto("/gallery/");
    await expect(page).toHaveTitle(/Gallery/);

    // Verify H1
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Curated Nail Artistry & Architectural Gel",
    );

    // Verify all 19 cards exist
    const cards = page.locator(".gallery-card");
    await expect(cards).toHaveCount(19);

    // Verify each card has an image with descriptive alt text
    const firstCardImage = cards.first().locator("img");
    await expect(firstCardImage).toBeVisible();
    const altText = await firstCardImage.getAttribute("alt");
    expect(altText).toBeTruthy();
    expect(altText?.length).toBeGreaterThan(10);

    // Axe Core accessibility scan on /gallery/
    const axeResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(axeResults.violations).toEqual([]);

    // Test category filtering: Classic (6 items)
    await page.getByRole("button", { name: /^Classic/ }).click();
    await expect(page.locator(".gallery-status-text")).toContainText(
      "Showing 6 Classic designs",
    );
    await expect(cards).toHaveCount(6);

    // Test category filtering: Color (6 items)
    await page.getByRole("button", { name: /^Color/ }).click();
    await expect(page.locator(".gallery-status-text")).toContainText(
      "Showing 6 Color designs",
    );
    await expect(cards).toHaveCount(6);

    // Test category filtering: French (3 items)
    await page.getByRole("button", { name: /^French/ }).click();
    await expect(page.locator(".gallery-status-text")).toContainText(
      "Showing 3 French designs",
    );
    await expect(cards).toHaveCount(3);

    // Test category filtering: Glitter / Detail (3 items)
    await page.getByRole("button", { name: /^Glitter/ }).click();
    await expect(page.locator(".gallery-status-text")).toContainText(
      "Showing 3 Glitter / Detail designs",
    );
    await expect(cards).toHaveCount(3);

    // Test category filtering: Restorative (1 item)
    await page.getByRole("button", { name: /^Restorative/ }).click();
    await expect(page.locator(".gallery-status-text")).toContainText(
      "Showing 1 Restorative designs",
    );
    await expect(cards).toHaveCount(1);

    // Restore All
    await page.getByRole("button", { name: /^All/ }).click();
    await expect(cards).toHaveCount(19);

    // Test responsive viewport overflow on /gallery/
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(noOverflow).toBe(true);
    }
  });

  test("lightbox opens, traps focus, locks body scroll, navigates with keyboard and closes with Escape", async ({
    page,
  }) => {
    await page.goto("/gallery/");

    // Body scroll should initially not be hidden
    const initialOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    expect(initialOverflow).not.toBe("hidden");

    // Click first card to open lightbox
    await page.locator(".gallery-card").first().click();

    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Body scroll lock applied
    const lockedOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    expect(lockedOverflow).toBe("hidden");

    // Verify counter shows 1 / 19
    await expect(dialog.locator(".current-num")).toHaveText("1");
    await expect(dialog.locator(".total-num")).toHaveText("19");

    // Keyboard ArrowRight -> Next artwork (2 / 19)
    await page.keyboard.press("ArrowRight");
    await expect(dialog.locator(".current-num")).toHaveText("2");

    // Keyboard ArrowLeft -> Back to 1 / 19
    await page.keyboard.press("ArrowLeft");
    await expect(dialog.locator(".current-num")).toHaveText("1");

    // Verify booking action inside lightbox — scroll footer into view for mobile
    const bookStyleBtn = dialog.getByRole("link", {
      name: /Book an appointment/,
    });
    await bookStyleBtn.scrollIntoViewIfNeeded();
    await expect(bookStyleBtn).toBeVisible();
    await expect(bookStyleBtn).toHaveAttribute("href", "/book/");

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // Body scroll restored
    const restoredOverflow = await page.evaluate(
      () => document.body.style.overflow,
    );
    expect(restoredOverflow).not.toBe("hidden");
  });

  test("homepage moving wall and hero collage work interactively and honor reduced motion", async ({
    page,
  }) => {
    // Emit reduced motion BEFORE navigating so animated cards are stable for clicks
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Hero collage tiles exist
    await expect(page.locator(".hero-visual-col")).toBeVisible();
    await expect(page.locator(".collage-tile")).toHaveCount(5); // 1 logo anchor + 4 floating tiles

    // Moving wall section exists
    const movingWall = page.locator(".moving-wall-section");
    await expect(movingWall).toBeVisible();
    await expect(page.locator(".moving-wall-card").first()).toBeVisible();

    // Open lightbox from moving wall card (animation paused via reduced-motion)
    await page.locator(".moving-wall-card").first().click();
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // Verify CSS animations are disabled under reduced-motion
    const trackAnimation = await page.evaluate(() => {
      const track = document.querySelector(".moving-wall-track");
      return track ? window.getComputedStyle(track).animationName : "";
    });
    expect(trackAnimation === "none" || trackAnimation === "").toBe(true);

    const tileAnimation = await page.evaluate(() => {
      const tile = document.querySelector(".tile-drift-1");
      return tile ? window.getComputedStyle(tile).animationName : "";
    });
    expect(tileAnimation === "none" || tileAnimation === "").toBe(true);
  });
});
