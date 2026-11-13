import assert from "node:assert/strict";
import { test } from "node:test";
import Stripe from "stripe";
import type { Attempt, Deposit } from "../src/deposit-store";
import {
  InvalidWebhook,
  paypalGateway,
  stripeGateway,
} from "../src/payment-gateways";

const attemptId = "6832920e-4716-4d55-bc10-c79a958784fd";
const capturedAt = new Date().toISOString();
const attempt: Attempt = {
  id: attemptId,
  mode: "sandbox",
  provider: "paypal",
  locale: "ru",
  state: "open",
  provider_id: "ORDER1",
  checkout_url: "https://www.sandbox.paypal.com/checkoutnow?token=ORDER1",
  payment_id: null,
  refund_id: null,
  capture_started_at: null,
  refund_started_at: null,
  created_at: capturedAt,
};
const deposit: Deposit = {
  id: "666d2f8c-71aa-4d91-b0bf-7a722981ee44",
  request_day: null,
  request_id: null,
  label: "Classic Pedicure",
  starts_at: "2030-01-02T17:00:00Z",
  ends_at: "2030-01-02T18:00:00Z",
  hold_until: "2030-01-02T16:00:00Z",
  total: 7500,
  amount: 750,
  state: "awaiting",
  mode: "sandbox",
  cancel_at: null,
  attempt,
};
const paypalConfig = {
  clientId: "sandbox-test",
  secret: "test-secret",
  merchant: "SELLER1",
  webhook: "WHID",
};
const amount = { value: "7.50", currency_code: "USD" };
const order = (state: "APPROVED" | "COMPLETED", merchant = "SELLER1") => ({
  id: "ORDER1",
  status: state,
  intent: "CAPTURE",
  purchase_units: [
    {
      reference_id: attemptId,
      custom_id: attemptId,
      amount,
      payee: { merchant_id: merchant },
      ...(state === "COMPLETED"
        ? {
            payments: {
              captures: [
                {
                  id: "CAPTURE1",
                  amount,
                  status: "COMPLETED",
                  create_time: capturedAt,
                },
              ],
            },
          }
        : {}),
    },
  ],
});

test("PayPal create uses fixed USD, redirect flow and short deterministic request key", async () => {
  let createRequests = 0;
  const gateway = paypalGateway(
    "sandbox",
    paypalConfig,
    async (input, init) => {
      const url = new URL(String(input));
      assert.equal(url.hostname, "api-m.sandbox.paypal.com");
      if (url.pathname === "/v1/oauth2/token")
        return Response.json({ access_token: "sandbox-token" });
      assert.equal(url.pathname, "/v2/checkout/orders");
      assert.equal(init?.method, "POST");
      assert.equal(
        new Headers(init.headers).get("paypal-request-id"),
        `c-${attemptId.replaceAll("-", "")}`,
      );
      const body = JSON.parse(String(init.body));
      assert.deepEqual(body.purchase_units[0].amount, amount);
      assert.equal(body.purchase_units[0].payee.merchant_id, "SELLER1");
      assert.equal(
        body.payment_source.paypal.experience_context.return_url,
        `https://example.test/ru/pay/?return=${attemptId}`,
      );
      createRequests++;
      return Response.json({
        id: "ORDER1",
        links: [{ rel: "payer-action", href: attempt.checkout_url }],
      });
    },
  );
  const checkout = await gateway.create(
    deposit,
    attempt,
    "https://example.test/ru/pay/",
  );
  assert.equal(checkout.url, attempt.checkout_url);
  assert.equal(createRequests, 1);
});

test("PayPal reconciles a lost capture response and rejects the wrong merchant", async () => {
  let captured = false;
  const gateway = paypalGateway(
    "sandbox",
    paypalConfig,
    async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path === "/v1/oauth2/token")
        return Response.json({ access_token: "sandbox-token" });
      if (path.endsWith("/capture")) {
        assert.equal(
          new Headers(init?.headers).get("paypal-request-id"),
          `p-${attemptId.replaceAll("-", "")}`,
        );
        captured = true;
        throw new Error("connection closed after payment");
      }
      return Response.json(order(captured ? "COMPLETED" : "APPROVED"));
    },
  );
  assert.deepEqual(await gateway.capture!(deposit, attempt), {
    state: "paid",
    paymentId: "CAPTURE1",
    paidAt: capturedAt,
  });
  const wrong = paypalGateway("sandbox", paypalConfig, async (input) =>
    String(input).endsWith("/token")
      ? Response.json({ access_token: "test" })
      : Response.json(order("APPROVED", "SELLER2")),
  );
  await assert.rejects(
    () => wrong.inspect(deposit, attempt, false),
    /purchase unit does not match/,
  );
});

test("an explicit PayPal funding decline releases an unfunded attempt", async () => {
  const gateway = paypalGateway("sandbox", paypalConfig, async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith("/token")) return Response.json({ access_token: "test" });
    if (path.endsWith("/capture"))
      return Response.json(
        { details: [{ issue: "INSTRUMENT_DECLINED" }] },
        { status: 422 },
      );
    return Response.json(order("APPROVED"));
  });
  assert.deepEqual(await gateway.capture!(deposit, attempt), {
    state: "closed",
  });
});

test("PayPal webhook uses the configured webhook ID and rejects failed verification", async () => {
  const payload = JSON.stringify({
    id: "EVENT1",
    event_type: "CHECKOUT.ORDER.APPROVED",
    resource: { id: "ORDER1" },
  });
  const headers = new Headers(
    Object.fromEntries(
      [
        "auth-algo",
        "cert-url",
        "transmission-id",
        "transmission-sig",
        "transmission-time",
      ].map((field) => [`paypal-${field}`, "test"]),
    ),
  );
  let result = "SUCCESS";
  const gateway = paypalGateway(
    "sandbox",
    paypalConfig,
    async (input, init) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith("/token"))
        return Response.json({ access_token: "test" });
      assert.equal(path, "/v1/notifications/verify-webhook-signature");
      const body = JSON.parse(String(init?.body));
      assert.equal(body.webhook_id, "WHID");
      assert.equal(body.transmission_id, "test");
      assert.equal(body.webhook_event.resource.id, "ORDER1");
      return Response.json({ verification_status: result });
    },
  );
  assert.deepEqual(await gateway.event(headers, payload), {
    id: "EVENT1",
    providerId: "ORDER1",
  });
  result = "FAILURE";
  await assert.rejects(() => gateway.event(headers, payload), InvalidWebhook);
});

test("Stripe verifies the raw event signature and rejects changed bodies or live events in sandbox", async () => {
  const key = "rk_test_local";
  const secret = "whsec_local_test";
  const stripe = new Stripe(key);
  const gateway = stripeGateway("sandbox", key, secret);
  const signed = (live: boolean) => {
    const payload = JSON.stringify({
      id: "evt_test",
      livemode: live,
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_123", client_reference_id: attemptId } },
    });
    const signature = stripe.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    return { payload, headers: new Headers({ "stripe-signature": signature }) };
  };
  const { payload, headers } = signed(false);
  assert.deepEqual(await gateway.event(headers, payload), {
    id: "evt_test",
    providerId: "cs_test_123",
    attemptId,
  });
  await assert.rejects(
    () => gateway.event(headers, payload + " "),
    InvalidWebhook,
  );
  const live = signed(true);
  await assert.rejects(
    () => gateway.event(live.headers, live.payload),
    InvalidWebhook,
  );
});

test("Stripe waits for a full pending refund and reconciles the settled outcome", async () => {
  let status = "pending";
  const stripeAttempt: Attempt = {
    ...attempt,
    provider: "stripe",
    state: "paid",
    provider_id: "cs_test_pending",
    payment_id: "pi_pending",
  };
  const gateway = stripeGateway(
    "sandbox",
    "rk_test_local",
    "whsec_local_test",
    async (input, init) => {
      assert.equal(init?.method, "GET");
      const url = new URL(String(input));
      if (url.pathname === "/v1/refunds") {
        assert.equal(url.searchParams.get("payment_intent"), "pi_pending");
        return Response.json({
          data: [
            {
              id: "re_pending",
              payment_intent: "pi_pending",
              amount: 750,
              currency: "usd",
              status,
            },
          ],
        });
      }
      assert.equal(url.pathname, "/v1/checkout/sessions/cs_test_pending");
      return Response.json({
        id: "cs_test_pending",
        livemode: false,
        mode: "payment",
        amount_total: 750,
        currency: "usd",
        status: "complete",
        payment_status: "paid",
        client_reference_id: attemptId,
        metadata: { ka_attempt: attemptId },
        payment_intent: {
          id: "pi_pending",
          livemode: false,
          amount: 750,
          currency: "usd",
          metadata: { ka_attempt: attemptId },
          status: "succeeded",
          amount_received: 750,
          latest_charge: {
            paid: true,
            captured: true,
            amount_captured: 750,
            currency: "usd",
            payment_intent: "pi_pending",
            livemode: false,
            refunded: true,
            amount_refunded: 750,
          },
        },
      });
    },
  );
  assert.deepEqual(await gateway.refund(deposit, stripeAttempt, true), {
    state: "refund_pending",
    paymentId: "pi_pending",
    refundId: "re_pending",
  });
  status = "succeeded";
  assert.deepEqual(await gateway.inspect(deposit, stripeAttempt, false), {
    state: "refunded",
    paymentId: "pi_pending",
  });
});
