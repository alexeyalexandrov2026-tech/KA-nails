import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("WCAG 2.2 Accessibility Remediation Gates", () => {
  test("gallery cards use valid semantic button inside h3, without article role=button", async ({
    page,
  }) => {
    await page.goto("/gallery/");

    // Check that <article> tags in gallery do NOT have role="button" or tabIndex
    const articles = page.locator(".gallery-card");
    const count = await articles.count();
    expect(count).toBe(19);

    for (let i = 0; i < count; i++) {
      const role = await articles.nth(i).getAttribute("role");
      const tabIndex = await articles.nth(i).getAttribute("tabindex");
      expect(role).toBeNull();
      expect(tabIndex).toBeNull();

      // Check inner native button
      const btn = articles.nth(i).locator(".gallery-card-trigger");
      await expect(btn).toHaveCount(1);
      const btnType = await btn.getAttribute("type");
      expect(btnType).toBe("button");

      // Verify the button is nested within an h3
      const parentTag = await btn.evaluate((el) =>
        el.parentElement?.tagName.toLowerCase(),
      );
      expect(parentTag).toBe("h3");
    }
  });

  test("heading hierarchy: h1 -> h2 (sr-only) -> h3 on /gallery/ and /ru/gallery/", async ({
    page,
  }) => {
    for (const url of ["/gallery/", "/ru/gallery/"]) {
      await page.goto(url);

      const h1 = page.locator("h1");
      await expect(h1).toHaveCount(1);

      const h2 = page.locator("h2.sr-only");
      await expect(h2).toHaveCount(1);
      const h2Text = await h2.textContent();
      expect(h2Text?.trim().length).toBeGreaterThan(0);

      // Verify cards have h3 titles
      const h3s = page.locator(".gallery-card h3.card-title");
      await expect(h3s).toHaveCount(19);

      // Verify heading order in DOM: h1 precedes h2, h2 precedes the first h3
      const orderValid = await page.evaluate(() => {
        const h1El = document.querySelector("h1");
        const h2El = document.querySelector("h2.sr-only");
        const firstH3El = document.querySelector(".gallery-card h3.card-title");
        if (!h1El || !h2El || !firstH3El) return false;
        const pos12 = h1El.compareDocumentPosition(h2El);
        const pos23 = h2El.compareDocumentPosition(firstH3El);
        return (
          Boolean(pos12 & Node.DOCUMENT_POSITION_FOLLOWING) &&
          Boolean(pos23 & Node.DOCUMENT_POSITION_FOLLOWING)
        );
      });
      expect(orderValid).toBe(true);
    }
  });

  test("gallery native button keyboard activation (Enter & Space) and lightbox focus restoration", async ({
    page,
  }) => {
    await page.goto("/gallery/");

    const thirdTrigger = page
      .locator(".gallery-card")
      .nth(2)
      .locator(".gallery-card-trigger");
    await thirdTrigger.focus();
    await expect(thirdTrigger).toBeFocused();

    // Open via Enter key
    await page.keyboard.press("Enter");
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Close via Escape key
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // Verify focus is restored to the exact third card trigger
    await expect(thirdTrigger).toBeFocused();

    // Test fifth card with Space key
    const fifthTrigger = page
      .locator(".gallery-card")
      .nth(4)
      .locator(".gallery-card-trigger");
    await fifthTrigger.focus();
    await expect(fifthTrigger).toBeFocused();

    await page.keyboard.press("Space");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(fifthTrigger).toBeFocused();
  });

  test("Section 02 pause/resume control exists, updates state and labels", async ({
    page,
  }) => {
    // Test on English homepage
    await page.goto("/");
    const pauseBtn = page.locator(".showcase-pause-btn");
    await expect(pauseBtn).toBeVisible();
    await expect(pauseBtn).toHaveAttribute("aria-pressed", "false");
    await expect(pauseBtn).toHaveAttribute(
      "aria-label",
      "Pause exhibition motion",
    );

    // Toggle pause
    await pauseBtn.click();
    await expect(pauseBtn).toHaveAttribute("aria-pressed", "true");
    await expect(pauseBtn).toHaveAttribute(
      "aria-label",
      "Resume exhibition motion",
    );

    // Toggle back to play
    await pauseBtn.click();
    await expect(pauseBtn).toHaveAttribute("aria-pressed", "false");
    await expect(pauseBtn).toHaveAttribute(
      "aria-label",
      "Pause exhibition motion",
    );

    // Test on Russian homepage
    await page.goto("/ru/");
    const ruPauseBtn = page.locator(".showcase-pause-btn");
    await expect(ruPauseBtn).toBeVisible();
    await expect(ruPauseBtn).toHaveAttribute("aria-pressed", "false");
    await expect(ruPauseBtn).toHaveAttribute(
      "aria-label",
      "Приостановить движение выставки",
    );

    await ruPauseBtn.click();
    await expect(ruPauseBtn).toHaveAttribute("aria-pressed", "true");
    await expect(ruPauseBtn).toHaveAttribute(
      "aria-label",
      "Возобновить движение выставки",
    );
  });

  test("Section 02 accessible duplicate clone suppression and 19 canonical works", async ({
    page,
  }) => {
    await page.goto("/");

    // Query all interactive card buttons in Section 02
    const movingWallSection = page.locator(".moving-wall-section");
    await expect(movingWallSection).toBeVisible();

    const accessibleCards = movingWallSection.locator(
      '.moving-wall-card[role="button"]',
    );
    // Exactly 19 canonical works across Foreground (5), Primary (8), Background (6)
    const accessibleCount = await accessibleCards.count();
    expect(accessibleCount).toBe(19);

    // Verify all 19 unique work IDs are represented
    const workIds = await accessibleCards.evaluateAll((cards) =>
      cards.map((c) => c.getAttribute("data-work-id")),
    );
    const uniqueIds = new Set(workIds);
    expect(uniqueIds.size).toBe(19);

    for (let i = 1; i <= 19; i++) {
      const id = `work-${String(i).padStart(2, "0")}`;
      expect(uniqueIds.has(id)).toBe(true);
    }

    // Verify clone cards are suppressed: aria-hidden="true", tabindex="-1", no role="button"
    const cloneCards = movingWallSection.locator(
      '.moving-wall-card[aria-hidden="true"]',
    );
    const cloneCount = await cloneCards.count();
    expect(cloneCount).toBeGreaterThan(0);

    for (let j = 0; j < cloneCount; j++) {
      const clone = cloneCards.nth(j);
      const role = await clone.getAttribute("role");
      const tabIndex = await clone.getAttribute("tabindex");
      expect(role).toBeNull();
      expect(tabIndex).toBe("-1");
    }
  });

  test("Axe-core automated accessibility scan passes on all 10 localized static routes", async ({
    page,
  }) => {
    const routes = [
      "/",
      "/services/",
      "/gallery/",
      "/contact/",
      "/book/",
      "/ru/",
      "/ru/services/",
      "/ru/gallery/",
      "/ru/contact/",
      "/ru/book/",
    ];

    for (const route of routes) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations, `Violations found on route: ${route}`).toEqual(
        [],
      );
    }
  });
});
