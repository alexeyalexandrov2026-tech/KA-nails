import {
  depositProvider,
  isPaymentAttempt,
  type DepositProvider,
  type DepositView,
} from "../../lib/deposit";
import { supabaseRpc } from "./supabase";

export type PaymentMode = "sandbox" | "live";
type AppointmentState =
  | "awaiting"
  | "booked"
  | "expired"
  | "cancelled"
  | "retained"
  | "refund_due"
  | "refund_pending"
  | "refunded"
  | "review";
type AttemptState =
  | "creating"
  | "open"
  | "closing"
  | "capturing"
  | "processing"
  | "closed"
  | "paid";

export interface Attempt {
  id: string;
  provider: DepositProvider;
  mode: PaymentMode;
  locale: "en" | "ru";
  state: AttemptState;
  provider_id: string | null;
  checkout_url: string | null;
  payment_id: string | null;
  refund_id: string | null;
  capture_started_at: string | null;
  refund_started_at: string | null;
  created_at: string;
}

export interface Deposit {
  id: string;
  request_day: string | null;
  request_id: string | null;
  label: string;
  starts_at: string;
  ends_at: string;
  hold_until: string;
  amount: number;
  total: number;
  state: AppointmentState;
  cancel_at: string | null;
  mode: PaymentMode;
  attempt: Attempt | null;
}

export interface StaffRequest {
  day: string;
  id: string;
  name: string;
  phone: string;
  preferred_time: string;
  service_id: string | null;
  add_on_ids: string[];
  language: "en" | "ru";
}

export interface Offer {
  id: string;
  day: string | null;
  requestId: string | null;
  label: string;
  startsAt: string;
  endsAt: string;
  holdUntil: string;
  total: number;
  shareHash: string;
  mode: PaymentMode;
}

export interface PaymentObservation {
  state:
    "closed" | "processing" | "paid" | "refunded" | "refund_pending" | "review";
  paymentId?: string;
  refundId?: string;
  paidAt?: string;
}

export interface ProviderReference {
  providerId?: string;
  paymentId?: string;
  attemptId?: string;
}

const appointmentStates = [
  "awaiting",
  "booked",
  "expired",
  "cancelled",
  "retained",
  "refund_due",
  "refund_pending",
  "refunded",
  "review",
] as const;
const attemptStates = [
  "creating",
  "open",
  "closing",
  "capturing",
  "processing",
  "closed",
  "paid",
] as const;

export function record(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    throw new Error("Expected an object");
  return value as Record<string, unknown>;
}

export { isPaymentAttempt as uuid };

function timestamp(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function checkedAttempt(value: unknown) {
  if (value === null) return null;
  const a = record(value);
  if (
    !isPaymentAttempt(a.id) ||
    !depositProvider(a.provider) ||
    (a.mode !== "sandbox" && a.mode !== "live") ||
    (a.locale !== "en" && a.locale !== "ru") ||
    !attemptStates.includes(a.state as AttemptState) ||
    !nullableString(a.provider_id) ||
    !nullableString(a.checkout_url) ||
    !nullableString(a.payment_id) ||
    !nullableString(a.refund_id) ||
    !(a.capture_started_at === null || timestamp(a.capture_started_at)) ||
    !(a.refund_started_at === null || timestamp(a.refund_started_at)) ||
    !timestamp(a.created_at)
  )
    throw new Error("Invalid stored payment attempt");
  return a as unknown as Attempt;
}

function checkedDeposit(value: unknown): Deposit {
  const d = record(value);
  if (
    !isPaymentAttempt(d.id) ||
    !nullableString(d.request_day) ||
    !nullableString(d.request_id) ||
    typeof d.label !== "string" ||
    !timestamp(d.starts_at) ||
    !timestamp(d.ends_at) ||
    !timestamp(d.hold_until) ||
    !(d.cancel_at === null || timestamp(d.cancel_at)) ||
    (d.mode !== "sandbox" && d.mode !== "live") ||
    !appointmentStates.includes(d.state as AppointmentState) ||
    typeof d.total !== "number" ||
    !Number.isSafeInteger(d.total) ||
    typeof d.amount !== "number" ||
    d.amount !== Math.floor((d.total + 5) / 10) ||
    d.amount < 50
  )
    throw new Error("Invalid stored deposit");
  const attempt = checkedAttempt(d.attempt);
  if (attempt && attempt.mode !== d.mode)
    throw new Error("Stored attempt does not match deposit mode");
  return {
    id: d.id,
    request_day: d.request_day,
    request_id: d.request_id,
    label: d.label,
    starts_at: d.starts_at,
    ends_at: d.ends_at,
    hold_until: d.hold_until,
    amount: d.amount,
    total: d.total,
    state: d.state as AppointmentState,
    cancel_at: d.cancel_at,
    mode: d.mode,
    attempt,
  };
}

function checkedStaffRequest(value: unknown): StaffRequest {
  const r = record(value);
  if (
    typeof r.day !== "string" ||
    typeof r.id !== "string" ||
    typeof r.name !== "string" ||
    typeof r.phone !== "string" ||
    typeof r.preferred_time !== "string" ||
    !nullableString(r.service_id) ||
    !Array.isArray(r.add_on_ids) ||
    !r.add_on_ids.every((id) => typeof id === "string") ||
    (r.language !== "en" && r.language !== "ru")
  )
    throw new Error("Invalid stored booking request");
  return r as unknown as StaffRequest;
}

export function depositView(deposit: Deposit): DepositView {
  const a = deposit.attempt;
  const active = a && a.state !== "closed";
  const checkoutOpen =
    deposit.state === "awaiting" &&
    !deposit.cancel_at &&
    Date.parse(deposit.hold_until) > Date.now();
  let status: DepositView["status"];
  if (deposit.state !== "awaiting") status = deposit.state;
  else if (active && (!checkoutOpen || a.state !== "open"))
    status = "processing";
  else if (checkoutOpen) status = "payable";
  else status = deposit.cancel_at ? "cancelled" : "expired";
  return {
    status,
    startsAt: deposit.starts_at,
    holdUntil: deposit.hold_until,
    amount: deposit.amount,
    total: deposit.total,
    ...(active ? { provider: a.provider, attemptRef: a.id } : {}),
    checkoutOpen: checkoutOpen && status === "payable",
  };
}

export function depositStore(
  url: string,
  secret: string,
  fetchImpl: typeof fetch = fetch,
) {
  const call = supabaseRpc(url, secret, fetchImpl);
  const rpc = (name: string, args: object = {}) =>
    call(`deposit_${name}`, args);
  const optional = (value: unknown) =>
    value === null ? null : checkedDeposit(value);
  return {
    async lookup(hash: string) {
      const result = await rpc("lookup", { p_hash: hash });
      return result && record(result).waiting === true
        ? ("waiting" as const)
        : optional(result);
    },
    async ready() {
      return (await rpc("lookup", { p_hash: "" })) === null;
    },
    async byProvider(
      provider: DepositProvider,
      mode: PaymentMode,
      ref: ProviderReference,
    ) {
      return optional(
        await rpc("provider_ref", {
          p_provider: provider,
          p_mode: mode,
          p_provider_id: ref.providerId ?? null,
          p_payment_id: ref.paymentId ?? null,
          p_attempt_id: ref.attemptId ?? null,
        }),
      );
    },
    async offer(offer: Offer, actor: string) {
      await rpc("offer", {
        p_id: offer.id,
        p_request_day: offer.day,
        p_request_id: offer.requestId,
        p_label: offer.label,
        p_starts_at: offer.startsAt,
        p_ends_at: offer.endsAt,
        p_hold_until: offer.holdUntil,
        p_total: offer.total,
        p_share_hash: offer.shareHash,
        p_actor: actor,
        p_mode: offer.mode,
      });
    },
    async staffList() {
      const result = record(await rpc("staff_list"));
      if (!Array.isArray(result.deposits) || !Array.isArray(result.requests))
        throw new Error("Invalid staff list");
      return {
        deposits: result.deposits.map((value) => {
          const raw = record(value);
          const contact = raw.contact === null ? null : record(raw.contact);
          if (
            contact &&
            (typeof contact.name !== "string" ||
              typeof contact.phone !== "string")
          )
            throw new Error("Invalid staff contact");
          return {
            ...checkedDeposit(raw),
            contact: contact as { name: string; phone: string } | null,
          };
        }),
        requests: result.requests.map(checkedStaffRequest),
      };
    },
    async staffRecord(id: string) {
      return optional(await call("deposit_staff_record", { p_id: id }));
    },
    async staffUpdate(
      id: string,
      actor: string,
      action: "share" | "move" | "cancel" | "refund",
      input: {
        at?: string;
        end?: string;
        reason?: string;
        shareHash?: string;
      } = {},
    ) {
      return optional(
        await rpc("staff_update", {
          p_id: id,
          p_actor: actor,
          p_action: action,
          p_at: input.at ?? null,
          p_end: input.end ?? null,
          p_reason: input.reason ?? null,
          p_share_hash: input.shareHash ?? null,
        }),
      );
    },
    async reserve(
      id: string,
      provider: DepositProvider,
      mode: PaymentMode,
      locale: "en" | "ru",
      terms: string,
    ) {
      return optional(
        await rpc("reserve", {
          p_id: id,
          p_attempt: crypto.randomUUID(),
          p_provider: provider,
          p_mode: mode,
          p_locale: locale,
          p_terms: terms,
        }),
      );
    },
    async step(
      id: string,
      attempt: string,
      action: "attach" | "abandon" | "close" | "capture",
      reference?: string,
      checkout?: string,
    ) {
      return optional(
        await rpc("step", {
          p_id: id,
          p_attempt: attempt,
          p_action: action,
          p_reference: reference ?? null,
          p_url: checkout ?? null,
        }),
      );
    },
    async observe(
      id: string,
      attempt: string,
      observation: PaymentObservation,
      eventId?: string,
    ) {
      await rpc("observe", {
        p_id: id,
        p_attempt: attempt,
        p_result: observation.state,
        p_payment_id: observation.paymentId ?? null,
        p_refund_id: observation.refundId ?? null,
        p_paid_at: observation.paidAt ?? null,
        p_event_id: eventId ?? null,
      });
    },
    async due(mode: PaymentMode) {
      const rows = await rpc("due", { p_mode: mode, p_limit: 3 });
      if (!Array.isArray(rows)) throw new Error("Invalid reconciliation list");
      return rows.map(checkedDeposit);
    },
  };
}

export type DepositStore = ReturnType<typeof depositStore>;

export function newDepositToken() {
  return hex(crypto.getRandomValues(new Uint8Array(32)));
}

function hex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export async function hashDepositToken(token: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return hex(new Uint8Array(digest));
}
