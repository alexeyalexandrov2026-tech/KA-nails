import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = "https://ka-nails.pages.dev";

test.describe("Cloudflare Deployed Production QA - KA Nails", () => {
  test("Home page loads over HTTPS with 0 blocking console errors, 0 axe violations, and responsive layout", async ({
    page,
    request,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    const logoResp = await request.get(`${BASE_URL}/assets/ka-nails-logo.png`);
    expect(logoResp.ok()).toBe(true);
    const logoHash = createHash("sha256")
      .update(await logoResp.body())
      .digest("hex");
    expect(logoHash).toBe(
      "bb2fe1c05eb7183b8b8f55eee861b06d80256cf5349b2958e1432fa3b83fbf53",
    );

    await page.goto(`${BASE_URL}/`);
    await expect(page).toHaveTitle("KA Nails");
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little care.",
    );

    // Axe Core accessibility scan
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(accessibilityScanResults.violations).toEqual([]);

    // Responsive viewports
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      const noOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(noOverflow).toBe(true);
    }

    // Interactive navigation
    await page.getByRole("link", { name: "Contact", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Studio details are coming soon." }),
    ).toBeVisible();

    expect(pageErrors).toEqual([]);
  });

  test("Services page loads over HTTPS with honest unavailable state when GORGONA URL is unset", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto(`${BASE_URL}/services/`);
    await expect(
      page.getByRole("heading", {
        name: "Online booking is not available yet.",
      }),
    ).toBeVisible();
    await expect(page.locator("iframe")).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("Contact page loads over HTTPS with studio details placeholder", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto(`${BASE_URL}/contact/`);
    await expect(
      page.getByRole("heading", { name: "Studio details are coming soon." }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("Book page loads over HTTPS cleanly", async ({ page }) => {
    const pageErrors: Error[] = [];
    page.on("pageerror", (err) => pageErrors.push(err));

    await page.goto(`${BASE_URL}/book/`);
    await expect(
      page.getByRole("heading", {
        name: "Online booking is not available yet.",
      }),
    ).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
});
