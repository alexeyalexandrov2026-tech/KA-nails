import { expect, test } from "@playwright/test";
import { approvedChatApiUrl } from "../lib/chat-api-url";
import { DEPOSIT_TERMS_VERSION } from "../lib/deposit";

const api = approvedChatApiUrl(process.env.NEXT_PUBLIC_CHAT_API_URL);
const firstToken = "a".repeat(64);
const secondToken = "b".repeat(64);
const attempt = "f677fa1b-80ef-47f5-8964-cdd0d72424f8";
const times = {
  startsAt: "2030-01-02T17:00:00Z",
  holdUntil: "2030-01-02T16:00:00Z",
};

test.describe("Appointment deposit", () => {
  test("a bare payment URL explains how to get a link and is not indexable", async ({
    page,
  }) => {
    await page.goto("/pay/");
    await expect(
      page.getByText(
        "Open the personal link from the studio or the assistant.",
      ),
    ).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      "noindex, nofollow",
    );
    await expect(
      page.getByRole("button", { name: "Pay with PayPal" }),
    ).toHaveCount(0);
  });

  for (const flow of [
    {
      locale: "en",
      path: "/pay/",
      provider: "stripe",
      button: "Pay by card via Stripe",
      approve: "I agree to the deposit terms.",
      booked: "Deposit received. Your appointment is confirmed.",
      hosted: "https://checkout.stripe.com/g/pay/cs_test_checkout123",
    },
    {
      locale: "ru",
      path: "/ru/pay/",
      provider: "paypal",
      button: "Оплатить через PayPal",
      approve: "Я принимаю условия депозита.",
      booked: "Депозит получен. Ваша запись подтверждена.",
      hosted: "https://www.sandbox.paypal.com/checkoutnow?token=SANDBOX",
    },
  ] as const) {
    test(`opens ${flow.provider} from ${flow.locale} and matches return to the same deposit`, async ({
      page,
    }) => {
      test.skip(!api, "build without API URL");
      let completed = false;
      let refreshes = 0;
      await page.route("**/api/deposit/view", async (route) => {
        const body = route.request().postDataJSON();
        expect([firstToken, secondToken]).toContain(body.token);
        return route.fulfill({
          json: {
            ...times,
            status:
              completed && body.token === firstToken ? "booked" : "payable",
            amount: body.token === firstToken ? 750 : 950,
            total: body.token === firstToken ? 7500 : 9500,
            checkoutOpen: !completed || body.token === secondToken,
          },
        });
      });
      await page.route("**/api/deposit/checkout", (route) => {
        expect(route.request().postDataJSON()).toEqual({
          token: firstToken,
          provider: flow.provider,
          locale: flow.locale,
          terms: DEPOSIT_TERMS_VERSION,
        });
        return route.fulfill({
          json: { url: flow.hosted, attemptRef: attempt },
        });
      });
      await page.route(flow.hosted, (route) =>
        route.fulfill({ body: "Hosted sandbox simulation" }),
      );
      await page.route("**/api/deposit/refresh", (route) => {
        expect(route.request().postDataJSON()).toEqual({
          token: firstToken,
          returnRef: attempt,
        });
        refreshes++;
        return route.fulfill({
          json: {
            ...times,
            status: "booked",
            amount: 750,
            total: 7500,
            checkoutOpen: false,
            provider: flow.provider,
            attemptRef: attempt,
          },
        });
      });
      await page.goto(`${flow.path}#${firstToken}`);
      const button = page.getByRole("button", { name: flow.button });
      await expect(button).toBeDisabled();
      await page.getByRole("checkbox", { name: flow.approve }).check();
      await button.click();
      await expect(page).toHaveURL(flow.hosted);
      await page.goto(`${flow.path}#${secondToken}`);
      await expect(
        page.getByRole("button", { name: flow.button }),
      ).toBeVisible();
      completed = true;
      await page.goto(`${flow.path}?return=${attempt}`);
      await expect(page.getByText(flow.booked)).toBeVisible();
      await expect(button).toHaveCount(0);
      expect(refreshes).toBe(1);
    });
  }
});
