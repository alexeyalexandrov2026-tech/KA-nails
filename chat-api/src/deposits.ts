import {
  checkoutUrl,
  DEPOSIT_TERMS_VERSION,
  depositHref,
  type DepositProvider,
} from "../../lib/deposit";
import {
  depositView,
  type Attempt,
  type Deposit,
  type DepositStore,
  type PaymentMode,
} from "./deposit-store";
import type { Gateway, ProviderEvent } from "./payment-gateways";

type Log = (message: string, details?: Record<string, unknown>) => void;
const safeReplayWindow = 5 * 60 * 60_000;
const stripeCreationReplayWindow = 8 * 60_000;

export interface DepositServiceConfig {
  mode: PaymentMode;
  enabled: boolean;
  siteOrigin: string;
  gateways: Record<DepositProvider, Gateway>;
}

export function depositService(
  store: DepositStore,
  config: DepositServiceConfig,
  log: Log,
) {
  const { mode, enabled, siteOrigin, gateways } = config;
  const before = (value: string) => Date.parse(value) > Date.now();
  const replayable = (value: string) =>
    Date.now() - Date.parse(value) < safeReplayWindow;
  const active = (d: Deposit) =>
    d.attempt?.mode === mode && d.attempt.state !== "closed" ? d.attempt : null;

  async function reconcile(
    d: Deposit,
    event?: ProviderEvent,
    switchProvider = false,
  ) {
    let a = active(d);
    if (!a) return null;
    const gateway = gateways[a.provider];

    if (a.state === "creating") {
      if (
        !enabled ||
        d.cancel_at ||
        !before(d.hold_until) ||
        !replayable(a.created_at) ||
        (a.provider === "stripe" &&
          Date.now() - Date.parse(a.created_at) > stripeCreationReplayWindow)
      ) {
        await store.step(d.id, a.id, "abandon");
        return null;
      }
      const session = await gateway.create(
        d,
        a,
        siteOrigin + depositHref(a.locale),
      );
      const attached = await store.step(
        d.id,
        a.id,
        "attach",
        session.id,
        session.url,
      );
      if (!attached || !attached.attempt) return null;
      a = attached.attempt;
      d = attached;
    }

    if (d.state === "refund_pending" && a.state === "paid") {
      const observation = await gateway.refund(
        d,
        a,
        Boolean(a.refund_started_at && replayable(a.refund_started_at)),
      );
      await store.observe(d.id, a.id, observation, event?.id);
      return null;
    }
    if (d.state !== "awaiting" && d.state !== "review" && !event) return null;

    const acceptCheckout = !d.cancel_at && before(d.hold_until);
    const wantsClose =
      !acceptCheckout || switchProvider || a.state === "closing";
    if (wantsClose && a.state === "open") {
      const closing = await store.step(d.id, a.id, "close");
      if (!closing?.attempt) return null;
      a = closing.attempt;
      d = closing;
    }

    let outcome = await gateway.inspect(d, a, a.state === "closing");
    if (
      outcome.state === "approved" &&
      gateway.capture &&
      acceptCheckout &&
      (a.state === "open" || a.state === "capturing")
    ) {
      const capturing = await store.step(d.id, a.id, "capture");
      if (!capturing?.attempt) return null;
      a = capturing.attempt;
      if (!a.capture_started_at || !replayable(a.capture_started_at)) {
        log("deposit capture needs provider review", {
          depositId: d.id,
          provider: a.provider,
        });
        return null;
      }
      outcome = await gateway.capture(capturing, a);
    }
    if (outcome.state === "open" || outcome.state === "approved")
      return a.state === "open" && acceptCheckout
        ? { url: checkoutUrl(a.provider, a.checkout_url), attemptRef: a.id }
        : null;
    if (event?.dispute && outcome.state === "paid")
      await store.observe(
        d.id,
        a.id,
        { state: "review", paymentId: outcome.paymentId },
        event.id,
      );
    else await store.observe(d.id, a.id, outcome, event?.id);
    return null;
  }

  async function load(hash: string) {
    return store.lookup(hash);
  }

  return {
    async view(hash: string) {
      const d = await load(hash);
      if (d === "waiting") return { status: "waiting" as const };
      if (!d) return null;
      const view = depositView(d);
      return enabled && d.mode === mode
        ? view
        : { ...view, checkoutOpen: false };
    },
    async checkout(
      hash: string,
      provider: DepositProvider,
      locale: "en" | "ru",
    ) {
      if (!enabled) return null;
      const first = await load(hash);
      if (
        !first ||
        first === "waiting" ||
        first.mode !== mode ||
        first.state !== "awaiting" ||
        first.cancel_at ||
        !before(first.hold_until)
      )
        return null;
      if (first.attempt && first.attempt.state !== "closed") {
        if (first.attempt.mode !== mode) return null;
        if (first.attempt.provider === provider) return reconcile(first);
        await reconcile(first, undefined, true);
      }
      const next = await store.reserve(
        first.id,
        provider,
        mode,
        locale,
        DEPOSIT_TERMS_VERSION,
      );
      return next?.attempt?.provider === provider ? reconcile(next) : null;
    },
    async refresh(hash: string, returnRef?: string) {
      const d = await load(hash);
      if (d && d !== "waiting" && (!returnRef || d.attempt?.id === returnRef))
        await reconcile(d);
    },
    async webhook(provider: DepositProvider, headers: Headers, raw: string) {
      const event = await gateways[provider].event(headers, raw);
      if (!event || (!event.attemptId && !event.paymentId && !event.providerId))
        return;
      const d = await store.byProvider(provider, mode, event);
      const a = d && active(d);
      if (!d || !a) return;
      if (
        a.provider !== provider ||
        (event.attemptId && event.attemptId !== a.id) ||
        (a.provider_id &&
          event.providerId &&
          event.providerId !== a.provider_id) ||
        (a.payment_id && event.paymentId && event.paymentId !== a.payment_id)
      )
        return;
      await reconcile(d, event);
    },
    async reconcileAppointment(d: Deposit) {
      await reconcile(d);
    },
    async scheduled() {
      const due = await store.due(mode);
      await Promise.all(
        due.map((d) =>
          reconcile(d).catch(() => {
            log("deposit reconciliation pending", {
              depositId: d.id,
              provider: d.attempt?.provider,
            });
          }),
        ),
      );
    },
  };
}

export type DepositService = ReturnType<typeof depositService>;
