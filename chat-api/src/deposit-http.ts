import {
  DEPOSIT_TERMS_VERSION,
  depositProvider,
  isDepositToken,
  isPaymentAttempt,
  type DepositProvider,
} from "../../lib/deposit";
import { handleDepositAdmin } from "./deposit-admin";
import {
  depositStore,
  hashDepositToken,
  record,
  type PaymentMode,
} from "./deposit-store";
import { depositService } from "./deposits";
import {
  InvalidWebhook,
  paypalGateway,
  stripeGateway,
} from "./payment-gateways";
import {
  BodyTooLarge,
  corsHeaders,
  MAX_BODY_BYTES,
  readBoundedText,
} from "./http";
import type { ChatConfig } from "./config";

type Log = (message: string, details?: Record<string, unknown>) => void;

type PaymentEnv = Env &
  Partial<
    Record<
      | "PAYMENTS_MODE"
      | "PAYMENTS_CHECKOUT"
      | "PAYMENTS_SITE_ORIGIN"
      | "PAYMENTS_STAFF_AUDIENCE"
      | "PAYMENTS_STAFF_EMAILS"
      | "PAYPAL_CLIENT_ID"
      | "PAYPAL_CLIENT_SECRET"
      | "PAYPAL_MERCHANT_ID"
      | "PAYPAL_WEBHOOK_ID"
      | "STRIPE_KEY"
      | "STRIPE_WEBHOOK_SECRET",
      string
    >
  >;

export function depositRuntime(env: PaymentEnv, config: ChatConfig, log: Log) {
  const mode = env.PAYMENTS_MODE;
  const siteOrigin = env.PAYMENTS_SITE_ORIGIN;
  const stripeKey = env.STRIPE_KEY;
  if (
    !config.database ||
    (mode !== "sandbox" && mode !== "live") ||
    !siteOrigin ||
    !config.allowedOrigins.includes(siteOrigin) ||
    !/^https:\/\/[\w.-]+(?::\d+)?$/.test(siteOrigin) ||
    !env.PAYPAL_CLIENT_ID ||
    !env.PAYPAL_CLIENT_SECRET ||
    !env.PAYPAL_MERCHANT_ID ||
    !env.PAYPAL_WEBHOOK_ID ||
    !stripeKey ||
    !(mode === "live" ? /^rk_live_/ : /^(?:rk|rkcs)_test_/).test(stripeKey) ||
    !env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") ||
    !env.PAYMENTS_STAFF_AUDIENCE ||
    !env.PAYMENTS_STAFF_EMAILS
  )
    return null;
  const store = depositStore(config.database.url, config.database.secret);
  const enabled = env.PAYMENTS_CHECKOUT === "on";
  const service = depositService(
    store,
    {
      mode,
      enabled,
      siteOrigin,
      gateways: {
        paypal: paypalGateway(mode, {
          clientId: env.PAYPAL_CLIENT_ID,
          secret: env.PAYPAL_CLIENT_SECRET,
          merchant: env.PAYPAL_MERCHANT_ID,
          webhook: env.PAYPAL_WEBHOOK_ID,
        }),
        stripe: stripeGateway(mode, stripeKey, env.STRIPE_WEBHOOK_SECRET),
      },
    },
    log,
  );
  return { store, service, mode: mode as PaymentMode, enabled, siteOrigin };
}

export async function handleDepositHttp(
  request: Request,
  env: PaymentEnv,
  config: ChatConfig,
  ctx: ExecutionContext,
  runtime: ReturnType<typeof depositRuntime>,
  log: Log,
) {
  const path = new URL(request.url).pathname;
  const publicApi = [
    "/api/deposit/view",
    "/api/deposit/checkout",
    "/api/deposit/refresh",
  ].includes(path);
  const origin = request.headers.get("origin");
  const cors = publicApi ? corsHeaders(origin, config.allowedOrigins) : {};
  const headers = { "cache-control": "no-store", ...cors };
  const json = (data: unknown, status = 200) =>
    Response.json(data, { status, headers });
  if (publicApi && (!origin || !config.allowedOrigins.includes(origin)))
    return json({ error: "origin" }, 403);
  if (publicApi && request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (!runtime) return json({ error: "payment-unavailable" }, 503);

  try {
    if (path.startsWith("/staff/")) {
      return await handleDepositAdmin(request, ctx.access, runtime.store, {
        audience: env.PAYMENTS_STAFF_AUDIENCE ?? "",
        emails: (env.PAYMENTS_STAFF_EMAILS ?? "")
          .toLowerCase()
          .split(",")
          .map((email) => email.trim())
          .filter(Boolean),
        siteOrigin: runtime.siteOrigin,
        canOffer: runtime.enabled,
        mode: runtime.mode,
        reconcile: runtime.service.reconcileAppointment,
      });
    }
    if (request.method !== "POST") return json({ error: "use-post" }, 405);
    if (path === "/webhooks/paypal" || path === "/webhooks/stripe") {
      const provider: DepositProvider =
        path === "/webhooks/paypal" ? "paypal" : "stripe";
      await runtime.service.webhook(
        provider,
        request.headers,
        await readBoundedText(request, MAX_BODY_BYTES, true),
      );
      return new Response(null, { status: 204, headers });
    }
    if (!publicApi) return json({ error: "not-found" }, 404);
    const allowed = await env.VISITOR_LIMIT.limit({
      key: `deposit:${request.headers.get("cf-connecting-ip") ?? "unknown"}`,
    });
    if (!allowed.success) return json({ error: "rate-limited" }, 429);
    let body: Record<string, unknown>;
    try {
      body = record(JSON.parse(await readBoundedText(request, 4096)));
    } catch (error) {
      if (error instanceof BodyTooLarge) throw error;
      return json({ error: "invalid-body" }, 400);
    }
    if (!isDepositToken(body.token)) return json({ error: "not-found" }, 404);
    const hash = await hashDepositToken(body.token);
    if (path === "/api/deposit/checkout") {
      if (
        !depositProvider(body.provider) ||
        body.terms !== DEPOSIT_TERMS_VERSION ||
        (body.locale !== "ru" && body.locale !== "en")
      )
        return json({ error: "invalid-checkout" }, 400);
      const result = await runtime.service.checkout(
        hash,
        body.provider,
        body.locale,
      );
      return result?.url
        ? json(result)
        : json({ error: "payment-unavailable" }, 409);
    }
    if (path === "/api/deposit/refresh") {
      if (body.returnRef !== undefined && !isPaymentAttempt(body.returnRef))
        return json({ error: "invalid-attempt" }, 400);
      await runtime.service.refresh(hash, body.returnRef);
    }
    const view = await runtime.service.view(hash);
    return view ? json(view) : json({ error: "not-found" }, 404);
  } catch (error) {
    if (error instanceof InvalidWebhook)
      return json({ error: "invalid-signature" }, 400);
    if (error instanceof BodyTooLarge)
      return json({ error: "body-too-large" }, 413);
    log("deposit endpoint unavailable", { path });
    return json({ error: "payment-unavailable" }, 503);
  }
}
