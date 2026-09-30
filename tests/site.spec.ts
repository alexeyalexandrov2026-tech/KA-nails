import { createHash } from "node:crypto";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { approvedBookingUrl } from "../lib/booking-url";

test("salon website preserves original logo, noindex and responsive navigation", async ({
  page,
  request,
}) => {
  const response = await request.get("/assets/ka-nails-logo.png");
  expect(response.ok()).toBe(true);
  expect(
    createHash("sha256")
      .update(await response.body())
      .digest("hex"),
  ).toBe("bb2fe1c05eb7183b8b8f55eee861b06d80256cf5349b2958e1432fa3b83fbf53");
  await page.goto("/");
  await expect(page).toHaveTitle("KA Nails — Nail Studio");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    /noindex/,
  );
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "A little care.",
  );
  expect(
    (await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze())
      .violations,
  ).toEqual([]);
  await page.screenshot({
    path: `test-results/ka-home-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("link", { name: "Contact", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Studio details are coming soon." }),
  ).toBeVisible();
});

test("booking setting rejects visitor tenant overrides and unsafe destinations", () => {
  for (const value of [
    "javascript:alert(1)",
    "http://unapproved.example/book/",
    "https://user:secret@example.test/book/",
    "https://example.test/book/?tenant_id=other",
    "https://example.test/book/#tenant",
    "https://example.test/admin/",
  ]) {
    expect(approvedBookingUrl(value)).toBeNull();
  }
});

test("unconfigured salon shows unavailable state without a fake booking", async ({
  page,
}) => {
  test.skip(
    Boolean(process.env.KA_BOOKING_TEST_URL),
    "Only for the unpublished, unconfigured export",
  );
  await page.goto("/services/");
  await expect(
    page.getByRole("heading", { name: "Online booking is not available yet." }),
  ).toBeVisible();
  await expect(page.locator("iframe")).toHaveCount(0);
});

test("salon → real platform service/availability → PostgreSQL confirmation", async ({
  page,
}) => {
  test.skip(
    !process.env.KA_BOOKING_TEST_URL,
    "Requires real disposable GORGONA fixture",
  );
  await page.goto("/");
  await page.getByRole("link", { name: /Explore services/ }).click();
  const frame = page.frameLocator(
    'iframe[title="KA Nails appointment booking"]',
  );
  await expect(page.locator("iframe")).toHaveAttribute(
    "src",
    process.env.KA_BOOKING_TEST_URL!,
  );
  await frame
    .getByLabel("Service and variant")
    .selectOption({ label: "FAKE FAKE_BASE · 60 min" });
  await frame.getByRole("button", { name: "Continue to times" }).click();
  await frame.getByLabel("Date").fill(process.env.GBA_BROWSER_DAY!);
  await frame.getByRole("button", { name: /^\d/ }).first().click();
  await frame.getByRole("button", { name: "Continue to details" }).click();
  await frame.getByLabel("Full name").fill("FAKE KA Website Guest");
  await frame.getByLabel("Email").fill("fake-ka@example.test");
  await frame.getByLabel("Phone").fill("+1 555 010 2345");
  await frame.getByLabel("I agree to the cancellation policy").check();
  await frame.getByRole("button", { name: "Review appointment" }).click();
  await frame.getByRole("button", { name: "Confirm booking" }).click();
  await expect(
    frame.getByRole("heading", { name: "You’re booked." }),
  ).toBeVisible();
  await expect(frame.getByTestId("booking-reference")).toContainText(
    /[0-9a-f-]{36}/,
  );
  await page.screenshot({
    path: `test-results/ka-confirmed-${page.viewportSize()?.width}.png`,
    fullPage: true,
  });
});

test("full-page fallback opens the hosted platform wizard at top level", async ({
  page,
}) => {
  test.skip(
    !process.env.KA_BOOKING_TEST_URL,
    "Requires real disposable GORGONA fixture",
  );
  await page.goto("/book/");
  const fallback = page.getByRole("link", {
    name: "open booking in a full page",
  });
  await expect(fallback).toHaveAttribute(
    "href",
    process.env.KA_BOOKING_TEST_URL!,
  );
  await expect(fallback).toHaveAttribute("target", "_blank");
  await expect(fallback).toHaveAttribute("rel", /noopener/);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    fallback.click(),
  ]);
  expect(popup.url()).toBe(process.env.KA_BOOKING_TEST_URL!);
  await expect(popup.getByLabel("Service and variant")).toBeVisible();
  await popup.close();
});

test("platform API network failure remains recoverable inside the site", async ({
  page,
}) => {
  test.skip(
    !process.env.KA_BOOKING_TEST_URL,
    "Requires real disposable GORGONA fixture",
  );
  await page.route("**/v1/customer/bootstrap", (route) => route.abort());
  await page.goto("/book/");
  const frame = page.frameLocator(
    'iframe[title="KA Nails appointment booking"]',
  );
  await expect(frame.getByRole("button", { name: "Try again" })).toBeVisible();
  await page.unroute("**/v1/customer/bootstrap");
  await frame.getByRole("button", { name: "Try again" }).click();
  await expect(frame.getByLabel("Service and variant")).toBeVisible();
});
