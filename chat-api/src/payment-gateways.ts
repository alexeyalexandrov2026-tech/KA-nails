import Stripe from "stripe";
import { checkoutUrl, type DepositProvider } from "../../lib/deposit";
import {
  record,
  uuid,
  type Attempt,
  type Deposit,
  type PaymentMode,
  type PaymentObservation,
  type ProviderReference,
} from "./deposit-store";

export class InvalidWebhook extends Error {}

export interface ProviderEvent extends ProviderReference {
  id: string;
  dispute?: boolean;
}

type Inspection =
  PaymentObservation | { state: "open" } | { state: "approved" };

export interface Gateway {
  create(
    d: Deposit,
    a: Attempt,
    returnUrl: string,
  ): Promise<{ id: string; url: string }>;
  inspect(d: Deposit, a: Attempt, close: boolean): Promise<Inspection>;
  capture?(d: Deposit, a: Attempt): Promise<Inspection>;
  refund(d: Deposit, a: Attempt, retry: boolean): Promise<PaymentObservation>;
  event(headers: Headers, raw: string): Promise<ProviderEvent | null>;
}

function required(value: unknown, field: string) {
  if (typeof value !== "string" || !value)
    throw new Error(`Missing provider ${field}`);
  return value;
}

function id(value: unknown) {
  if (typeof value !== "string" || !/^[a-zA-Z0-9_-]{1,160}$/.test(value))
    throw new Error("Invalid provider identifier");
  return value;
}

function redirect(provider: DepositProvider, value: unknown) {
  const url = checkoutUrl(provider, value);
  if (!url) throw new Error("Unexpected payment redirect");
  return url;
}

export function stripeGateway(
  mode: PaymentMode,
  key: string,
  webhook: string,
): Gateway {
  const stripe = new Stripe(key, {
    apiVersion: "2026-10-28.endive",
    httpClient: Stripe.createFetchHttpClient(),
    maxNetworkRetries: 0,
    timeout: 7000,
  });
  const live = mode === "live";

  async function inspect(
    d: Deposit,
    a: Attempt,
    close: boolean,
  ): Promise<Inspection> {
    const sessionId = id(a.provider_id);
    const expansion = ["payment_intent.latest_charge"];
    let s = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: expansion,
    });
    if (
      s.id !== sessionId ||
      s.livemode !== live ||
      s.mode !== "payment" ||
      s.amount_total !== d.amount ||
      s.currency !== "usd" ||
      s.client_reference_id !== a.id ||
      s.metadata?.ka_attempt !== a.id
    )
      throw new Error("Stripe Checkout does not match this deposit");

    if (close && s.status === "open") {
      try {
        await stripe.checkout.sessions.expire(
          sessionId,
          {},
          { idempotencyKey: `close-${a.id}` },
        );
      } catch {
        // Completion can race expiration. Check the current session before releasing it.
      }
      s = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: expansion,
      });
    }
    if (s.status === "expired" && s.payment_status === "unpaid")
      return { state: "closed" };
    if (s.status === "open" && s.payment_status === "unpaid")
      return { state: "open" };
    const intent =
      typeof s.payment_intent === "object" ? s.payment_intent : null;
    if (
      !intent ||
      intent.livemode !== live ||
      intent.metadata.ka_attempt !== a.id ||
      intent.amount !== d.amount ||
      intent.currency !== "usd"
    )
      throw new Error("Stripe PaymentIntent does not match this deposit");
    const paymentId = id(intent.id);
    if (s.payment_status === "unpaid") {
      if (
        intent.status === "requires_payment_method" ||
        intent.status === "canceled"
      )
        return { state: "closed" };
      return { state: "processing", paymentId };
    }
    const charge =
      typeof intent.latest_charge === "object" ? intent.latest_charge : null;
    if (
      s.status !== "complete" ||
      s.payment_status !== "paid" ||
      intent.status !== "succeeded" ||
      intent.amount_received !== d.amount ||
      !charge?.paid ||
      !charge.captured ||
      charge.amount_captured !== d.amount ||
      charge.currency !== "usd" ||
      charge.payment_intent !== paymentId ||
      charge.livemode !== live
    )
      throw new Error("Stripe charge does not match this deposit");
    if (charge.refunded && charge.amount_refunded === d.amount)
      return { state: "refunded", paymentId };
    if (charge.disputed || charge.amount_refunded > 0)
      return { state: "review", paymentId };
    return {
      state: "paid",
      paymentId,
      paidAt: new Date(charge.created * 1000).toISOString(),
    };
  }

  return {
    async create(d, a, returnUrl) {
      const s = await stripe.checkout.sessions.create(
        {
          mode: "payment",
          integration_identifier: "ka-nails-deposit-hgvtqjrm",
          allowed_payment_method_types: ["card"],
          client_reference_id: a.id,
          metadata: { ka_attempt: a.id },
          payment_intent_data: { metadata: { ka_attempt: a.id } },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: "usd",
                unit_amount: d.amount,
                product_data: {
                  name:
                    a.locale === "ru"
                      ? "KA Nails — депозит за запись"
                      : "KA Nails appointment deposit",
                },
              },
            },
          ],
          locale: a.locale,
          // Derive it from the stored attempt so retries send identical parameters.
          expires_at: Math.floor(
            Math.max(
              Date.parse(a.created_at) + 40 * 60_000,
              Math.min(
                Date.parse(d.hold_until),
                Date.parse(a.created_at) + 23 * 60 * 60_000,
              ),
            ) / 1000,
          ),
          success_url: `${returnUrl}?return=${a.id}`,
          cancel_url: `${returnUrl}?return=${a.id}`,
        },
        { idempotencyKey: `create-${a.id}` },
      );
      if (s.livemode !== live || s.client_reference_id !== a.id)
        throw new Error("Unexpected Stripe Checkout response");
      return { id: id(s.id), url: redirect("stripe", s.url) };
    },
    inspect,
    async refund(d, a, retry) {
      const paymentId = id(a.payment_id);
      const settled = await inspect(d, a, false);
      if (settled.state !== "paid")
        return settled.state === "refunded"
          ? settled
          : { state: "review", paymentId };
      const known = a.refund_id
        ? await stripe.refunds.retrieve(id(a.refund_id))
        : (
            await stripe.refunds.list({ payment_intent: paymentId, limit: 20 })
          ).data.find((item) => item.metadata?.ka_attempt === a.id);
      const refund =
        known ??
        (retry
          ? await stripe.refunds.create(
              {
                payment_intent: paymentId,
                amount: d.amount,
                metadata: { ka_attempt: a.id },
              },
              { idempotencyKey: `refund-${a.id}` },
            )
          : null);
      if (!refund) return { state: "review", paymentId };
      if (
        refund.payment_intent !== paymentId ||
        refund.amount !== d.amount ||
        refund.currency !== "usd"
      )
        throw new Error("Stripe refund does not match this deposit");
      const state =
        refund.status === "succeeded"
          ? "refunded"
          : refund.status === "pending" || refund.status === "requires_action"
            ? "refund_pending"
            : "review";
      return { state, paymentId, refundId: id(refund.id) };
    },
    async event(headers, raw) {
      const signature = headers.get("stripe-signature");
      if (!signature) throw new InvalidWebhook();
      let event: Stripe.Event;
      try {
        event = await stripe.webhooks.constructEventAsync(
          raw,
          signature,
          webhook,
          300,
          Stripe.createSubtleCryptoProvider(),
        );
      } catch {
        throw new InvalidWebhook();
      }
      if (event.livemode !== live || event.account || event.context)
        throw new InvalidWebhook();
      switch (event.type) {
        case "checkout.session.completed":
        case "checkout.session.async_payment_succeeded":
        case "checkout.session.async_payment_failed":
        case "checkout.session.expired":
          return {
            id: event.id,
            providerId: event.data.object.id,
            attemptId: uuid(event.data.object.client_reference_id)
              ? event.data.object.client_reference_id
              : undefined,
          };
        case "refund.created":
        case "refund.updated":
        case "refund.failed":
        case "charge.refunded":
        case "charge.dispute.created":
        case "charge.dispute.updated":
        case "charge.dispute.closed":
          return {
            id: event.id,
            paymentId:
              typeof event.data.object.payment_intent === "string"
                ? event.data.object.payment_intent
                : undefined,
            dispute: event.type.startsWith("charge.dispute."),
          };
        default:
          return null;
      }
    },
  };
}

function dollars(amount: number) {
  return `${Math.floor(amount / 100)}.${String(amount % 100).padStart(2, "0")}`;
}

function paypalAmount(value: unknown, amount: number) {
  const money = record(value);
  return money.currency_code === "USD" && money.value === dollars(amount);
}

function paypalKey(operation: "c" | "p" | "r", attempt: Attempt) {
  return `${operation}-${attempt.id.replaceAll("-", "")}`;
}

function captureId(resource: Record<string, unknown>) {
  const extra = resource.supplementary_data;
  if (extra && typeof extra === "object") {
    const ids = record(extra).related_ids;
    if (ids && typeof ids === "object") {
      const capture = record(ids).capture_id;
      if (typeof capture === "string") return id(capture);
    }
  }
  for (const link of Array.isArray(resource.links) ? resource.links : []) {
    const data = record(link);
    if (data.rel === "up" && typeof data.href === "string") {
      const match = /^\/v2\/payments\/captures\/([A-Z0-9]+)$/i.exec(
        new URL(data.href).pathname,
      );
      if (match?.[1]) return id(match[1]);
    }
  }
  return undefined;
}

class PayPalError extends Error {
  constructor(
    readonly status: number,
    readonly issues: string[],
  ) {
    super(`PayPal API returned ${status}`);
  }
}

export function paypalGateway(
  mode: PaymentMode,
  config: {
    clientId: string;
    secret: string;
    merchant: string;
    webhook: string;
  },
  fetchImpl: typeof fetch = fetch,
): Gateway {
  const base =
    mode === "live"
      ? "https://api-m.paypal.com"
      : "https://api-m.sandbox.paypal.com";
  let token: Promise<string> | undefined;
  async function authorize() {
    const response = await fetchImpl(`${base}/v1/oauth2/token`, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(`${config.clientId}:${config.secret}`)}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
      redirect: "manual",
      signal: AbortSignal.timeout(6500),
    });
    if (!response.ok) throw new Error("PayPal authorization failed");
    return required(record(await response.json()).access_token, "access token");
  }

  async function api(path: string, body?: object, key?: string) {
    const response = await fetchImpl(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        authorization: `Bearer ${await (token ??= authorize())}`,
        ...(body
          ? {
              "content-type": "application/json",
              prefer: "return=representation",
            }
          : {}),
        ...(key ? { "paypal-request-id": key } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      redirect: "manual",
      signal: AbortSignal.timeout(7000),
    });
    if (!response.ok) {
      const error: unknown = await response.json().catch(() => null);
      const details =
        error && typeof error === "object" ? record(error).details : undefined;
      const issues = Array.isArray(details)
        ? details
            .filter((item) => item && typeof item === "object")
            .map((item) => String(record(item).issue))
        : [];
      throw new PayPalError(response.status, issues);
    }
    return record(await response.json());
  }

  function inspectOrder(
    order: Record<string, unknown>,
    d: Deposit,
    a: Attempt,
  ): Inspection {
    if (
      order.id !== a.provider_id ||
      order.intent !== "CAPTURE" ||
      !Array.isArray(order.purchase_units) ||
      order.purchase_units.length !== 1
    )
      throw new Error("PayPal order does not match this deposit");
    const unit = record(order.purchase_units[0]);
    if (
      unit.reference_id !== a.id ||
      unit.custom_id !== a.id ||
      (unit.payee != null &&
        record(unit.payee).merchant_id !== config.merchant) ||
      !paypalAmount(unit.amount, d.amount)
    )
      throw new Error("PayPal purchase unit does not match this deposit");
    const captures = unit.payments ? record(unit.payments).captures : undefined;
    if (!Array.isArray(captures) || captures.length === 0) {
      if (order.status === "VOIDED") return { state: "closed" };
      if (order.status === "APPROVED") return { state: "approved" };
      if (
        ["CREATED", "SAVED", "PAYER_ACTION_REQUIRED"].includes(
          String(order.status),
        )
      )
        return { state: "open" };
      throw new Error("PayPal capture is missing");
    }
    if (captures.length !== 1)
      throw new Error("Unexpected PayPal capture count");
    const capture = record(captures[0]);
    const paymentId = id(capture.id);
    if (!paypalAmount(capture.amount, d.amount))
      throw new Error("PayPal capture amount does not match");
    switch (capture.status) {
      case "COMPLETED": {
        const paidAt = required(
          a.state === "processing" ? capture.update_time : capture.create_time,
          "capture time",
        );
        if (!Number.isFinite(Date.parse(paidAt)))
          throw new Error("Invalid PayPal capture time");
        return { state: "paid", paymentId, paidAt };
      }
      case "PENDING":
        return { state: "processing", paymentId };
      case "REFUNDED":
        return { state: "refunded", paymentId };
      case "PARTIALLY_REFUNDED":
      case "REVERSED":
        return { state: "review", paymentId };
      case "DECLINED":
      case "DENIED":
      case "FAILED":
        return { state: "closed" };
      default:
        throw new Error("Unrecognized PayPal capture state");
    }
  }

  const orderPath = (a: Attempt) => `/v2/checkout/orders/${id(a.provider_id)}`;
  const capturePath = (a: Attempt) =>
    `/v2/payments/captures/${id(a.payment_id)}`;
  async function inspect(
    d: Deposit,
    a: Attempt,
    close: boolean,
  ): Promise<Inspection> {
    const observation = inspectOrder(await api(orderPath(a)), d, a);
    // An uncaptured PayPal order can charge only through this Worker's capture route.
    if (
      close &&
      (observation.state === "open" || observation.state === "approved")
    )
      return { state: "closed" };
    if (a.payment_id && observation.state === "paid") {
      const capture = await api(capturePath(a));
      if (
        capture.id !== a.payment_id ||
        !paypalAmount(capture.amount, d.amount)
      )
        throw new Error("PayPal capture does not match this deposit");
      if (capture.status === "REFUNDED")
        return { state: "refunded", paymentId: a.payment_id };
      if (capture.status !== "COMPLETED")
        return { state: "review", paymentId: a.payment_id };
    }
    return observation;
  }

  return {
    async create(d, a, returnUrl) {
      const order = await api(
        "/v2/checkout/orders",
        {
          intent: "CAPTURE",
          purchase_units: [
            {
              reference_id: a.id,
              custom_id: a.id,
              payee: { merchant_id: config.merchant },
              description:
                a.locale === "ru"
                  ? "KA Nails — депозит за запись"
                  : "KA Nails appointment deposit",
              amount: { currency_code: "USD", value: dollars(d.amount) },
            },
          ],
          payment_source: {
            paypal: {
              experience_context: {
                user_action: "PAY_NOW",
                shipping_preference: "NO_SHIPPING",
                locale: a.locale === "ru" ? "ru-RU" : "en-US",
                payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
                return_url: `${returnUrl}?return=${a.id}`,
                cancel_url: `${returnUrl}?return=${a.id}`,
              },
            },
          },
        },
        paypalKey("c", a),
      );
      const link = (Array.isArray(order.links) ? order.links : [])
        .map(record)
        .find(
          (entry) => entry.rel === "payer-action" || entry.rel === "approve",
        );
      const url = redirect("paypal", link?.href);
      if (
        new URL(url).hostname !==
        (mode === "live" ? "www.paypal.com" : "www.sandbox.paypal.com")
      )
        throw new Error("PayPal Checkout environment does not match");
      return { id: id(order.id), url };
    },
    inspect,
    async capture(d, a) {
      let declined = false;
      try {
        await api(`${orderPath(a)}/capture`, {}, paypalKey("p", a));
      } catch (error) {
        // Fetch canonical state even if the POST timed out or was a replay.
        declined =
          error instanceof PayPalError &&
          error.status === 422 &&
          error.issues.includes("INSTRUMENT_DECLINED");
      }
      const result = await inspect(d, a, false);
      return declined &&
        (result.state === "open" || result.state === "approved")
        ? { state: "closed" }
        : result;
    },
    async refund(d, a, retry) {
      const paymentId = id(a.payment_id);
      const settled = await inspect(d, a, false);
      if (settled.state !== "paid")
        return settled.state === "refunded"
          ? settled
          : { state: "review", paymentId };
      const refund = a.refund_id
        ? await api(`/v2/payments/refunds/${id(a.refund_id)}`)
        : retry
          ? await api(
              `${capturePath(a)}/refund`,
              {
                amount: { currency_code: "USD", value: dollars(d.amount) },
                custom_id: a.id,
              },
              paypalKey("r", a),
            )
          : null;
      if (!refund) return { state: "review", paymentId };
      if (
        !paypalAmount(refund.amount, d.amount) ||
        captureId(refund) !== paymentId
      )
        throw new Error("PayPal refund does not match this deposit");
      const state =
        refund.status === "COMPLETED"
          ? "refunded"
          : refund.status === "PENDING"
            ? "refund_pending"
            : "review";
      return { state, paymentId, refundId: id(refund.id) };
    },
    async event(headers, raw) {
      const fields = [
        "auth-algo",
        "cert-url",
        "transmission-id",
        "transmission-sig",
        "transmission-time",
      ];
      const envelope = Object.fromEntries(
        fields.map((field) => [
          field.replaceAll("-", "_"),
          headers.get(`paypal-${field}`),
        ]),
      );
      if (
        Object.values(envelope).some((value) => !value || value.length > 4096)
      )
        throw new InvalidWebhook();
      let message: Record<string, unknown>;
      try {
        message = record(JSON.parse(raw));
      } catch {
        throw new InvalidWebhook();
      }
      const verification = await api(
        "/v1/notifications/verify-webhook-signature",
        {
          ...envelope,
          webhook_id: config.webhook,
          webhook_event: message,
        },
      );
      if (verification.verification_status !== "SUCCESS")
        throw new InvalidWebhook();
      const eventId = id(message.id);
      const eventType = String(message.event_type);
      const resource = record(message.resource);
      if (
        eventType === "CHECKOUT.ORDER.APPROVED" ||
        eventType === "CHECKOUT.PAYMENT-APPROVAL.REVERSED"
      )
        return { id: eventId, providerId: id(resource.id) };
      if (eventType === "PAYMENT.CAPTURE.REFUNDED")
        return { id: eventId, paymentId: captureId(resource) };
      if (eventType.startsWith("PAYMENT.CAPTURE.")) {
        const extra = resource.supplementary_data;
        const related =
          extra && typeof extra === "object"
            ? record(extra).related_ids
            : undefined;
        const order =
          related && typeof related === "object"
            ? record(related).order_id
            : undefined;
        return {
          id: eventId,
          paymentId: id(resource.id),
          ...(typeof order === "string" ? { providerId: id(order) } : {}),
          dispute: eventType === "PAYMENT.CAPTURE.REVERSED",
        };
      }
      if (
        eventType.startsWith("CUSTOMER.DISPUTE.") &&
        Array.isArray(resource.disputed_transactions)
      ) {
        const disputed = resource.disputed_transactions[0];
        if (disputed)
          return {
            id: eventId,
            paymentId: id(record(disputed).seller_transaction_id),
            dispute: true,
          };
      }
      return null;
    },
  };
}
