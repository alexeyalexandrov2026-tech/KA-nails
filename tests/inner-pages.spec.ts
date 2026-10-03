import { expect, test } from "@playwright/test";

const focusInsideDialog = (page: import("@playwright/test").Page) =>
  page.evaluate(() => !!document.activeElement?.closest('div[role="dialog"]'));

test.describe("Gallery, lightbox and inner pages (stage 5)", () => {
  test("the lightbox is rendered over the whole page and the page behind is inert", async ({
    page,
  }) => {
    await page.goto("/gallery/");
    await page.locator("article#work-02 .gallery-card-trigger").click();
    const dialog = page.locator('div[role="dialog"].lightbox-overlay');
    await expect(dialog).toBeVisible();

    expect(
      await dialog.evaluate((el) => el.parentElement === document.body),
    ).toBe(true);
    await expect(page.locator("body > main")).toHaveAttribute("inert", "");
    await expect(page.locator("body > header")).toHaveAttribute("inert", "");

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(page.locator("body > main")).not.toHaveAttribute("inert");
    await expect(page.locator("[inert]")).toHaveCount(0);
  });

  test("focus stays in the lightbox while browsing works", async ({ page }) => {
    await page.goto("/gallery/");
    const trigger = page.locator("article#work-03 .gallery-card-trigger");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const dialog = page.locator('div[role="dialog"].lightbox-overlay');
    await expect(dialog).toBeVisible();

    await page.keyboard.press("ArrowRight");
    await expect(dialog.locator(".current-num")).toHaveText("4");
    expect(await focusInsideDialog(page)).toBe(true);

    await dialog.locator(".lightbox-nav-btn.next").click();
    await expect(dialog.locator(".current-num")).toHaveText("5");
    expect(await focusInsideDialog(page)).toBe(true);

    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      expect(await focusInsideDialog(page)).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test("a work linked as /gallery/#work-NN is shown and highlighted", async ({
    page,
  }) => {
    for (const url of ["/gallery/#work-05", "/ru/gallery/#work-05"]) {
      await page.goto(url);
      const card = page.locator("article#work-05");
      await expect(card).toHaveClass(/is-target/);
      await expect(card).toBeInViewport();
      await expect(page.locator(".gallery-card.is-target")).toHaveCount(1);
    }
  });

  test("a style chapter on the home page leads to its highlighted work", async ({
    page,
  }) => {
    await page.goto("/");
    await page.locator(".services-showcase .service-book-link").first().click();
    await expect(page).toHaveURL(/\/gallery\/#work-18$/);
    const card = page.locator("article#work-18");
    await expect(card).toHaveClass(/is-target/);
    await expect(card).toBeInViewport();
  });

  test("the gallery shows only public copy and a dark closing band", async ({
    page,
  }) => {
    await page.goto("/gallery/");
    await expect(page.locator(".inventory-text")).toHaveText(
      "19 authentic salon works displayed",
    );
    await expect(page.locator("main")).not.toContainText(/Target|curation/);
    await expect(page.locator(".gallery-cta-band")).toHaveCSS(
      "background-color",
      "rgb(38, 27, 21)",
    );
  });

  test("inner pages open with a heading beside an arched portfolio photo", async ({
    page,
  }) => {
    for (const url of [
      "/services/",
      "/book/",
      "/contact/",
      "/ru/services/",
      "/ru/book/",
      "/ru/contact/",
    ]) {
      await page.goto(url);
      const intro = page.locator("main .page-intro");
      await expect(intro.locator("h1")).toHaveCount(1);
      await expect(page.locator("h1")).toHaveCount(1);
      const photo = intro.locator("img.arch-photo");
      await expect(photo).toBeVisible();
      expect((await photo.getAttribute("alt"))?.length).toBeGreaterThan(10);
      await expect(intro.locator("[data-decor]")).toHaveAttribute(
        "aria-hidden",
        "true",
      );
    }
    await page.goto("/book/");
    await expect(page.locator(".notice")).toHaveCount(1);
  });

  test("services page links its portfolio strip to the works", async ({
    page,
  }) => {
    await page.goto("/services/");
    const links = page.locator(".work-strip-list a");
    await expect(links).toHaveCount(3);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute("href", /^\/gallery\/#work-\d\d$/);
      await expect(link).toHaveAttribute("aria-label", /^Open artwork /);
    }
  });
});
