import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { approvedChatApiUrl } from "../lib/chat-api-url";
import { studioFacts } from "../lib/studio-facts";

const BASE_URL = "https://ka-nails.pages.dev";
const LIVE_INDEXING = process.env.NEXT_PUBLIC_SITE_INDEXING === "index";
const LIVE_CHAT = approvedChatApiUrl(process.env.NEXT_PUBLIC_CHAT_API_URL);

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
    // Search engines see the site only when it was deployed with SITE_INDEXING=index.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      LIVE_INDEXING ? /^index, follow$/ : /noindex/,
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
    // The deployed menu is the published one.
    await expect(
      page.locator('[data-facts="services"] .service-menu-name'),
    ).toHaveText(studioFacts.services.map((service) => service.name.en));
    await expect(
      page.locator('[data-facts="services"] .service-addon-name'),
    ).toHaveText(studioFacts.addOns.map((addOn) => addOn.name.en));
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

  test("robots.txt and the sitemap match the indexing switch", async ({
    request,
  }) => {
    const robots = await (await request.get(`${BASE_URL}/robots.txt`)).text();
    const sitemap = await (await request.get(`${BASE_URL}/sitemap.xml`)).text();
    if (LIVE_INDEXING) {
      expect(robots).toMatch(/^Sitemap: https:\/\/\S+\/sitemap\.xml$/m);
      expect(sitemap.match(/<url>/g)?.length).toBe(10);
    } else {
      expect(robots).not.toContain("Sitemap:");
      expect(sitemap).not.toContain("<url>");
    }
  });

  test("Live pages carry the security and cache headers from public/_headers", async ({
    request,
  }) => {
    const home = await request.get(`${BASE_URL}/`);
    expect(home.ok()).toBe(true);
    const headers = home.headers();
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["content-security-policy"]).toContain(
      "frame-ancestors 'none'",
    );

    const font = await request.get(
      `${BASE_URL}/fonts/inter-latin-wght-normal.woff2`,
    );
    expect(font.ok()).toBe(true);
    expect(font.headers()["cache-control"]).toContain("max-age=2592000");
  });

  test("The AI receptionist button follows the chat switch and its API is up", async ({
    page,
    request,
  }) => {
    await page.goto(`${BASE_URL}/`);
    await expect(page.locator(".chat-launcher")).toHaveCount(LIVE_CHAT ? 1 : 0);
    if (!LIVE_CHAT) return;

    const health = await request.get(LIVE_CHAT.replace(/chat$/, "health"));
    expect(health.ok()).toBe(true);
    const report = (await health.json()) as {
      status: string;
      channels: Record<string, boolean>;
    };
    expect(report.status).toBe("ok");
    // At least one way to reach the master must be switched on.
    expect(Object.values(report.channels)).toContain(true);
  });
});
