import { expect, test } from "@playwright/test";

// The privacy policy Google Play links to: /privacy/ and /ru/privacy/.
const POLICIES = [
  {
    route: "/privacy/",
    lang: "en",
    heading: "Privacy policy",
    footerLink: "Privacy",
    effective: "Effective November 14, 2026",
    owner: "Karina Mamedova",
    retention: "up to 12 months",
    switchTo: "/ru/privacy/",
  },
  {
    route: "/ru/privacy/",
    lang: "ru",
    heading: "Политика конфиденциальности",
    footerLink: "Конфиденциальность",
    effective: "Действует с 14 ноября 2026 года",
    owner: "Карины Мамедовой",
    retention: "не дольше 12 месяцев",
    switchTo: "/privacy/",
  },
] as const;

test.describe("Privacy policy", () => {
  for (const policy of POLICIES) {
    test(`${policy.route} states who is responsible, the app and the chat`, async ({
      page,
    }) => {
      const response = await page.goto(policy.route);
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", policy.lang);
      await expect(page.locator("h1")).toHaveText(policy.heading);
      await expect(page).toHaveTitle(`${policy.heading} | KA Nails`);

      const main = page.locator("main");
      for (const text of [
        policy.effective,
        policy.owner,
        policy.retention,
        "com.ka_nails_miami.app",
        "Gorgona One AI",
        "Cloudflare Pages",
        "Cloudflare Workers AI",
        "Cloudflare Turnstile",
        "Supabase",
        "WhatsApp",
      ]) {
        await expect(main).toContainText(text);
      }

      // One h1, then a flat list of h2 sections, each reachable by its id.
      await expect(main.locator(".privacy-policy > section")).toHaveCount(10);
      await expect(main.locator(".privacy-policy h2")).toHaveCount(10);
      await expect(main.locator(".privacy-policy h3")).toHaveCount(0);
      for (const id of ["who", "app", "assistant", "retention", "contact"]) {
        await expect(main.locator(`section#${id} h2`)).toBeVisible();
      }

      // Privacy requests go to the studio's confirmed phone and WhatsApp.
      const contact = main.locator("section#contact");
      await expect(contact.locator('a[href="tel:+15613828779"]')).toBeVisible();
      await expect(
        contact.locator('a[href="https://wa.me/15613828779"]'),
      ).toBeVisible();

      // The language switcher leads to the same policy in the other language.
      await expect(
        page.locator(`.lang-switcher a[href="${policy.switchTo}"]`),
      ).toHaveCount(1);
    });
  }

  test("every page links to the privacy policy in its own language", async ({
    page,
  }) => {
    for (const route of [
      "/",
      "/services/",
      "/gallery/",
      "/contact/",
      "/book/",
    ]) {
      for (const policy of POLICIES) {
        const localized = policy.lang === "ru" ? `/ru${route}` : route;
        await page.goto(localized);
        const link = page
          .getByRole("contentinfo")
          .getByRole("link", { name: policy.footerLink, exact: true });
        await expect(link, localized).toHaveAttribute("href", policy.route);
      }
    }
  });

  test("the footer link opens the policy", async ({ page }) => {
    await page.goto("/ru/");
    await page
      .getByRole("contentinfo")
      .getByRole("link", { name: "Конфиденциальность", exact: true })
      .click();
    await expect(page).toHaveURL(/\/ru\/privacy\/$/);
    await expect(page.locator("h1")).toHaveText("Политика конфиденциальности");
  });
});
