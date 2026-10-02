import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SALON_PHOTOS } from "../lib/photo-inventory";
import { RU_PHOTO_LOCALES } from "../lib/gallery-data";

const EN_ROUTES = ["/", "/services/", "/gallery/", "/contact/", "/book/"];
const RU_ROUTES = [
  "/ru/",
  "/ru/services/",
  "/ru/gallery/",
  "/ru/contact/",
  "/ru/book/",
];

test.describe("KA Nails Bilingual English + Russian Test Suite", () => {
  // Gate 1: All 10 static routes return HTTP 200 with correct html lang
  for (const route of EN_ROUTES) {
    test(`English route ${route} returns 200 and renders html lang="en"`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      const htmlLang = await page.locator("html").getAttribute("lang");
      expect(htmlLang).toBe("en");

      // Verify robots meta is preserved
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
    });
  }

  for (const route of RU_ROUTES) {
    test(`Russian route ${route} returns 200 and renders html lang="ru"`, async ({
      page,
    }) => {
      const response = await page.goto(route);
      expect(response?.status()).toBe(200);

      const htmlLang = await page.locator("html").getAttribute("lang");
      expect(htmlLang).toBe("ru");

      // Verify robots meta is preserved
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        "content",
        /noindex/,
      );
    });
  }

  // Gate 2: Route-preserving Language Switcher
  test("Language switcher preserves equivalent routes in both directions", async ({
    page,
  }) => {
    // English Home -> Russian Home
    await page.goto("/");
    const ruSwitchHome = page.locator(".lang-switcher a[lang='ru']");
    await expect(ruSwitchHome).toHaveAttribute("href", "/ru/");
    await ruSwitchHome.click();
    await expect(page).toHaveURL(/\/ru\/?$/);
    expect(await page.locator("html").getAttribute("lang")).toBe("ru");

    // Russian Services -> English Services
    await page.goto("/ru/services/");
    const enSwitchServices = page.locator(".lang-switcher a[lang='en']");
    await expect(enSwitchServices).toHaveAttribute("href", "/services/");
    await enSwitchServices.click();
    await expect(page).toHaveURL(/\/services\/?$/);
    expect(await page.locator("html").getAttribute("lang")).toBe("en");

    // English Gallery -> Russian Gallery
    await page.goto("/gallery/");
    const ruSwitchGallery = page.locator(".lang-switcher a[lang='ru']");
    await expect(ruSwitchGallery).toHaveAttribute("href", "/ru/gallery/");
    await ruSwitchGallery.click();
    await expect(page).toHaveURL(/\/ru\/gallery\/?$/);
    expect(await page.locator("html").getAttribute("lang")).toBe("ru");

    // Russian Book -> English Book
    await page.goto("/ru/book/");
    const enSwitchBook = page.locator(".lang-switcher a[lang='en']");
    await expect(enSwitchBook).toHaveAttribute("href", "/book/");
    await enSwitchBook.click();
    await expect(page).toHaveURL(/\/book\/?$/);
    expect(await page.locator("html").getAttribute("lang")).toBe("en");

    // Russian Contact -> English Contact
    await page.goto("/ru/contact/");
    const enSwitchContact = page.locator(".lang-switcher a[lang='en']");
    await expect(enSwitchContact).toHaveAttribute("href", "/contact/");
    await enSwitchContact.click();
    await expect(page).toHaveURL(/\/contact\/?$/);
    expect(await page.locator("html").getAttribute("lang")).toBe("en");
  });

  // Gate 3: Russian UI translation completeness & no English UI leaks
  test("Russian homepage contains authentic Russian editorial copy without English leaks", async ({
    page,
  }) => {
    await page.goto("/ru/");

    // Header & Nav
    await expect(page.locator(".wordmark span")).toHaveText("Студия маникюра");
    const nav = page.locator("nav.main-nav");
    await expect(nav.getByRole("link", { name: "Услуги" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Галерея" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Контакты" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Запись" })).toBeVisible();

    // Hero
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Деликатный уход.",
    );
    await expect(page.locator(".hero-description")).toContainText(
      "Эстетика педикюра и маникюра, созданная со вниманием к деталям.",
    );
    await expect(page.locator(".hero-studio-badges")).toContainText(
      "Авторский педикюр",
    );
    await expect(page.locator(".hero-studio-badges")).toContainText(
      "Подлинное портфолио студии",
    );
    await expect(page.locator(".hero-studio-badges")).toContainText(
      "Внимательный уход",
    );

    // Section 02 Moving Wall
    await expect(
      page.locator(".moving-wall-section .section-title"),
    ).toHaveText("Избранные работы");
    await expect(page.locator(".moving-wall-section .eyebrow")).toHaveText(
      "02 / Выставка студии",
    );
    await expect(
      page.locator(".moving-wall-section .button-secondary"),
    ).toContainText("Вся галерея (19)");

    // Section 03 Pillars
    await expect(page.locator(".editorial-pillars .eyebrow")).toHaveText(
      "03 / Стандарты студии",
    );
    await expect(
      page.locator(".editorial-pillars .section-title"),
    ).toContainText("Внимательный уход.");

    // Section 04 Services Showcase
    await expect(page.locator(".services-showcase .eyebrow")).toHaveText(
      "04 / Портфолио студии",
    );
    await expect(page.locator(".services-showcase .section-title")).toHaveText(
      "Стили и техники",
    );

    // Footer
    await expect(page.locator(".footer-brand-text .footer-title")).toHaveText(
      "KA Nails · Студия маникюра",
    );
    await expect(page.locator(".footer-brand-text .footer-sub")).toHaveText(
      "Подлинное портфолио студии и внимательный уход",
    );
  });

  // Gate 4: Booking Truth in both EN and RU
  test("Russian booking page preserves honest unavailable status truth", async ({
    page,
  }) => {
    await page.goto("/ru/book/");
    await expect(
      page.getByRole("heading", { name: "Онлайн-запись пока недоступна." }),
    ).toBeVisible();
    await expect(page.locator(".notice p").nth(1)).toContainText(
      "Услуги, цены и доступные окна для записи появятся здесь, когда студия откроет онлайн-бронирование.",
    );

    await page.goto("/ru/services/");
    await expect(
      page.getByRole("heading", { name: "Онлайн-запись пока недоступна." }),
    ).toBeVisible();
  });

  // Gate 5: Russian Gallery & Lightbox
  test("Russian gallery displays 19 authentic works with localized categories and interactive lightbox", async ({
    page,
  }) => {
    await page.goto("/ru/gallery/");

    // Check localized filter pills
    const pills = page.locator(".gallery-filter-bar .filter-pill");
    await expect(pills).toContainText([
      "Все",
      "Классика",
      "Цвет",
      "Френч",
      "Шиммер и детали",
      "Эстетический уход",
    ]);

    // Check inventory banner
    await expect(page.locator(".inventory-badge")).toHaveText(
      "Подлинный архив студии",
    );
    await expect(page.locator(".inventory-text")).toContainText(
      "19 подлинных работ студии",
    );

    // Open lightbox
    const cards = page.locator(".gallery-grid article");
    expect(await cards.count()).toBe(19);

    await cards.first().locator(".gallery-media-wrapper").click();
    const lightbox = page.locator('div[role="dialog"].lightbox-overlay');
    await expect(lightbox).toBeVisible();

    // Check localized lightbox controls
    await expect(lightbox.locator(".lightbox-book-btn")).toContainText(
      "Записаться на процедуру",
    );
    await expect(lightbox.locator(".lightbox-action-btn")).toContainText(
      "Поделиться",
    );

    // Close via Escape
    await page.keyboard.press("Escape");
    await expect(lightbox).not.toBeVisible();
  });

  // Gate 6: Section 02 in Russian & English retains 3-layer motion
  test("Section 02 functions smoothly in both English and Russian", async ({
    page,
  }) => {
    for (const url of ["/", "/ru/"]) {
      await page.goto(url);
      const stage = page.locator(".moving-wall-stage");
      await stage.scrollIntoViewIfNeeded();

      // Check all 3 layers exist
      await expect(stage.locator(".moving-track-primary")).toBeVisible();
      await expect(stage.locator(".moving-track-fg")).toBeVisible();
      await expect(stage.locator(".moving-track-bg")).toBeVisible();

      // Click card to open lightbox
      const firstPrimaryCard = stage
        .locator(".moving-track-primary .moving-wall-card")
        .first();
      await firstPrimaryCard.click({ force: true });

      const dialog = page.locator('div[role="dialog"].lightbox-overlay');
      await expect(dialog).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(dialog).not.toBeVisible();
    }
  });

  // Gate 7: Accessibility WCAG 2.1 AA on both English and Russian
  test("Accessibility audit passes with 0 violations on EN and RU homepages", async ({
    page,
  }) => {
    for (const url of ["/", "/ru/", "/gallery/", "/ru/gallery/"]) {
      await page.goto(url);
      const axeResults = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze();
      expect(axeResults.violations).toEqual([]);
    }
  });

  // Gate 8: Mobile responsiveness & no horizontal overflow
  test("Mobile responsive layout has zero horizontal overflow across all viewports", async ({
    page,
  }) => {
    for (const width of [320, 390, 768, 1280, 1440]) {
      await page.setViewportSize({ width, height: 844 });
      for (const url of ["/", "/ru/"]) {
        await page.goto(url);
        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(hasOverflow).toBe(false);
      }
    }
  });

  // Gate 9: Reduced motion support in both locales
  test("Reduced motion disables 3D tracks in both EN and RU", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const url of ["/", "/ru/"]) {
      await page.goto(url);
      const fgTrack = page.locator(".moving-layer-fg");
      const bgTrack = page.locator(".moving-layer-bg");

      // In reduced motion, foreground and background atmospheric layers are hidden
      await expect(fgTrack).toHaveCSS("display", "none");
      await expect(bgTrack).toHaveCSS("display", "none");
    }
  });

  // Gate 10: Hero collage link aria-labels and English artwork titles lang="en" on Russian routes
  test("Hero collage and gallery use localized Russian aria-labels and lang='en' on English titles", async ({
    page,
  }) => {
    await page.goto("/ru/");

    // Check hero collage links on /ru/
    const heroCollage = page.locator(".hero-collage-stage");
    await expect(heroCollage).toBeVisible();

    // Must NOT have old English-only aria-labels
    const oldEnAriaLabels = [
      "Bordeaux Luxury Editorial — Classic",
      "Royal Cobalt Gloss — Color",
      "Cornflower Sky Macro — Color",
      "Pastel Lilac Bliss — Color",
    ];
    for (const oldLabel of oldEnAriaLabels) {
      await expect(
        heroCollage.locator(`a[aria-label="${oldLabel}"]`),
      ).toHaveCount(0);
    }

    // Must have new Russian aria-labels
    await expect(
      heroCollage.locator(
        'a[aria-label="Открыть работу Bordeaux Luxury Editorial, категория: Классика"]',
      ),
    ).toBeVisible();
    await expect(
      heroCollage.locator(
        'a[aria-label="Открыть работу Royal Cobalt Gloss, категория: Цвет"]',
      ),
    ).toBeVisible();
    await expect(
      heroCollage.locator(
        'a[aria-label="Открыть работу Cornflower Sky Macro, категория: Цвет"]',
      ),
    ).toBeVisible();
    await expect(
      heroCollage.locator(
        'a[aria-label="Открыть работу Pastel Lilac Bliss, категория: Цвет"]',
      ),
    ).toBeVisible();

    // Check logo image alt is localized
    await expect(
      heroCollage.locator('img[alt="KA Nails Студия маникюра"]'),
    ).toBeVisible();

    // Check visible English titles wrapped with lang="en" in micro-labels
    const microLabelsEn = heroCollage.locator(
      ".tile-micro-label span[lang='en']",
    );
    expect(await microLabelsEn.count()).toBeGreaterThanOrEqual(3);

    // Check Section 02 Moving Wall cards on /ru/
    const movingWallCards = page.locator(
      ".moving-track-primary .moving-wall-card",
    );
    const movingCardTitleEn = movingWallCards
      .first()
      .locator(".moving-card-title span[lang='en']");
    await expect(movingCardTitleEn).toBeVisible();

    // Check Gallery cards on /ru/gallery/
    await page.goto("/ru/gallery/");
    const galleryCardTitleEn = page
      .locator(".gallery-card .card-title span[lang='en']")
      .first();
    await expect(galleryCardTitleEn).toBeVisible();
  });

  // Gate 11: 19/19 Canonical Photo ID & Metadata Integrity
  test("All 19 canonical photos map to valid Russian locale entries with matching slugs", () => {
    expect(SALON_PHOTOS.length).toBe(19);

    for (const photo of SALON_PHOTOS) {
      const ruEntry = RU_PHOTO_LOCALES[photo.id]!;
      expect(
        ruEntry,
        `Photo ${photo.id} (${photo.title}) must have a Russian locale entry`,
      ).toBeDefined();
      expect(ruEntry.id).toBe(photo.id);
      expect(
        ruEntry.slug,
        `Photo ${photo.id} slug must match Russian entry slug`,
      ).toBe(photo.slug);
      expect(ruEntry.alt.length).toBeGreaterThan(15);
      expect(ruEntry.finish.length).toBeGreaterThan(3);
      expect(ruEntry.colorFamily.length).toBeGreaterThan(3);
      expect(ruEntry.notes.length).toBeGreaterThan(15);
    }
  });

  // Gate 12: Live Russian Gallery 19/19 DOM Card Mapping Integrity
  test("Russian gallery DOM renders all 19 cards with canonical photo IDs, images, and localized metadata", async ({
    page,
  }) => {
    await page.goto("/ru/gallery/");

    const cards = page.locator(".gallery-grid article");
    await expect(cards).toHaveCount(19);

    for (const photo of SALON_PHOTOS) {
      const card = page.locator(`.gallery-grid article#${photo.id}`);
      await expect(
        card,
        `Article element with id #${photo.id} must exist in Russian gallery`,
      ).toBeVisible();

      // Verify image source matches canonical slug
      const img = card.locator("img.gallery-card-image");
      await expect(img).toBeVisible();
      const src = await img.getAttribute("src");
      expect(src).toContain(photo.slug);

      // Verify image alt matches localized Russian alt
      const expectedRu = RU_PHOTO_LOCALES[photo.id]!;
      await expect(img).toHaveAttribute("alt", expectedRu.alt);

      // Verify title is rendered
      await expect(card.locator(".card-title")).toContainText(photo.title);

      // Verify finish and colorFamily match localized Russian text
      await expect(card.locator(".card-finish")).toHaveText(expectedRu.finish);
      await expect(card.locator(".card-shape")).toHaveText(
        expectedRu.colorFamily,
      );
      await expect(card.locator(".card-technique")).toHaveText(
        expectedRu.notes,
      );
    }
  });

  // Gate 13: Semantic Invariants Regression Test (No cross-talk between photos)
  test("Russian gallery preserves semantic invariants: Lilac, Cornflower, French, Rose Quartz", async ({
    page,
  }) => {
    await page.goto("/ru/gallery/");

    // 1. Pastel Lilac Bliss (work-03)
    const lilacCard = page.locator("article#work-03");
    const lilacText = await lilacCard.innerText();
    const lilacAlt = (await lilacCard.locator("img").getAttribute("alt")) || "";
    expect(lilacText).toMatch(/сирен|лаванд/i);
    expect(lilacAlt).toMatch(/пастельно-сиреневый/i);
    expect(lilacText).not.toContain("френч");
    expect(lilacText).not.toContain("микро-френч");

    // 2. Cornflower Sky Macro (work-04)
    const cornflowerCard = page.locator("article#work-04");
    const cornflowerText = await cornflowerCard.innerText();
    const cornflowerAlt =
      (await cornflowerCard.locator("img").getAttribute("alt")) || "";
    expect(cornflowerText).toMatch(/голуб|васильк/i);
    expect(cornflowerAlt).toMatch(/нежно-голубого/i);
    expect(cornflowerText).not.toMatch(/лаванд|сирен/i);

    // 3. Minimal French Contrast (work-05)
    const frenchCard = page.locator("article#work-05");
    const frenchText = await frenchCard.innerText();
    const frenchAlt =
      (await frenchCard.locator("img").getAttribute("alt")) || "";
    expect(frenchText).toMatch(/френч/i);
    expect(frenchAlt).toMatch(/френч/i);
    expect(frenchText).not.toMatch(/индиго|морская волна/i);

    // 4. Rose Quartz Shimmer (work-07)
    const quartzCard = page.locator("article#work-07");
    const quartzText = await quartzCard.innerText();
    const quartzAlt =
      (await quartzCard.locator("img").getAttribute("alt")) || "";
    expect(quartzText).toMatch(/розов|кварц|шиммер/i);
    expect(quartzAlt).toMatch(/розовый кварц/i);
    expect(quartzText).not.toMatch(/алый|красный/i);
  });

  // Gate 14: Lightbox and Section 02 Moving Wall Metadata Integrity
  test("Russian lightbox and Section 02 display correct canonical metadata for clicked works", async ({
    page,
  }) => {
    await page.goto("/ru/gallery/");

    // Click work-03 (Pastel Lilac Bliss)
    const lilacCard = page.locator("article#work-03");
    await lilacCard.click();

    const lightbox = page.locator('div[role="dialog"].lightbox-overlay');
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator(".lightbox-title")).toContainText(
      "Pastel Lilac Bliss",
    );
    const lightboxImgAlt =
      (await lightbox.locator(".lightbox-image").getAttribute("alt")) || "";
    expect(lightboxImgAlt).toBe(RU_PHOTO_LOCALES["work-03"]!.alt);
    expect(lightboxImgAlt).not.toContain("френч");

    // Close lightbox
    await page.keyboard.press("Escape");
    await expect(lightbox).not.toBeVisible();

    // Click work-07 (Rose Quartz Shimmer)
    const quartzCard = page.locator("article#work-07");
    await quartzCard.click();
    await expect(lightbox).toBeVisible();
    await expect(lightbox.locator(".lightbox-title")).toContainText(
      "Rose Quartz Shimmer",
    );
    const quartzLightboxAlt =
      (await lightbox.locator(".lightbox-image").getAttribute("alt")) || "";
    expect(quartzLightboxAlt).toBe(RU_PHOTO_LOCALES["work-07"]!.alt);
    expect(quartzLightboxAlt).not.toMatch(/алый|красный/i);

    await page.keyboard.press("Escape");
    await expect(lightbox).not.toBeVisible();
  });
});
