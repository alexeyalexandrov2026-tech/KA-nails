export const DEPOSIT_TERMS_VERSION = "2026-11-13";
export const STUDIO_TIME_ZONE = "America/New_York";
export const DEPOSIT_PROVIDERS = ["paypal", "stripe"] as const;
export type DepositProvider = (typeof DEPOSIT_PROVIDERS)[number];

export const DEPOSIT_STATUSES = [
  "waiting",
  "payable",
  "processing",
  "booked",
  "expired",
  "cancelled",
  "retained",
  "refund_due",
  "refund_pending",
  "refunded",
  "review",
] as const;

export interface DepositView {
  status: (typeof DEPOSIT_STATUSES)[number];
  startsAt?: string;
  holdUntil?: string;
  amount?: number;
  total?: number;
  provider?: DepositProvider;
  checkoutOpen?: boolean;
  attemptRef?: string;
}

export function isDepositToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

export function depositProvider(value: unknown): value is DepositProvider {
  return value === "paypal" || value === "stripe";
}

export function isPaymentAttempt(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
      value,
    )
  );
}

export function readDepositView(value: unknown): DepositView | null {
  if (!value || typeof value !== "object") return null;
  const view = value as Partial<DepositView>;
  if (!view.status || !DEPOSIT_STATUSES.includes(view.status)) return null;
  if (view.status === "waiting") return { status: "waiting" };
  if (
    typeof view.startsAt !== "string" ||
    typeof view.holdUntil !== "string" ||
    !Number.isFinite(Date.parse(view.startsAt)) ||
    !Number.isFinite(Date.parse(view.holdUntil)) ||
    typeof view.amount !== "number" ||
    !Number.isSafeInteger(view.amount) ||
    view.amount < 50 ||
    typeof view.total !== "number" ||
    !Number.isSafeInteger(view.total) ||
    view.total < view.amount ||
    (view.provider !== undefined && !depositProvider(view.provider)) ||
    (view.attemptRef !== undefined && !isPaymentAttempt(view.attemptRef)) ||
    typeof view.checkoutOpen !== "boolean"
  )
    return null;
  return view as DepositView;
}

export function depositHref(locale: "en" | "ru", token?: string) {
  return `${locale === "ru" ? "/ru" : ""}/pay/${token ? `#${token}` : ""}`;
}

export function checkoutUrl(provider: DepositProvider, value: unknown) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    const valid =
      provider === "stripe"
        ? url.hostname === "checkout.stripe.com" &&
          /^\/(?:c|g)\/pay\/cs_(?:test|live)_[a-zA-Z0-9]+$/.test(url.pathname)
        : ["www.paypal.com", "www.sandbox.paypal.com"].includes(url.hostname) &&
          ["/checkoutnow", "/webapps/hermes"].includes(url.pathname);
    return valid &&
      url.protocol === "https:" &&
      !url.port &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}
