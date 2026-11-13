"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import {
  checkoutUrl,
  DEPOSIT_TERMS_VERSION,
  isDepositToken,
  isPaymentAttempt,
  readDepositView,
  STUDIO_TIME_ZONE,
  type DepositProvider,
  type DepositView,
} from "../../lib/deposit";
import { getDictionary, type Locale } from "../../lib/locales";

const sessionKey = "ka-nails-payment";
const fixedLocation = () => () => {};
const browserLocation = () => window.location.href;
const staticLocation = () => "";

async function paymentRequest(
  endpoint: string,
  action: "view" | "checkout" | "refresh",
  token: string,
  args: object = {},
  signal?: AbortSignal,
): Promise<unknown> {
  const response = await fetch(new URL(`/api/deposit/${action}`, endpoint), {
    method: "POST",
    headers: { "content-type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ token, ...args }),
    signal,
  });
  if (!response.ok) throw new Error("Deposit unavailable");
  return response.json();
}

export async function fetchDepositView(
  endpoint: string,
  token: string,
  signal?: AbortSignal,
) {
  return readDepositView(
    await paymentRequest(endpoint, "view", token, {}, signal),
  );
}

export function DepositPayment({
  locale,
  endpoint,
}: {
  locale: Locale;
  endpoint: string | null;
}) {
  const dict = getDictionary(locale).deposit;
  const location = useSyncExternalStore(
    fixedLocation,
    browserLocation,
    staticLocation,
  );
  const returnRef = location
    ? new URL(location).searchParams.get("return")
    : null;
  const fragment = location ? new URL(location).hash.slice(1) : "";
  let token: string | null = null;
  if (returnRef && isPaymentAttempt(returnRef)) {
    try {
      const stored = sessionStorage.getItem(`${sessionKey}:${returnRef}`);
      if (isDepositToken(stored)) token = stored;
    } catch {
      // A visitor can reopen the original link to see the result.
    }
  } else if (!returnRef && isDepositToken(fragment)) {
    token = fragment;
  }
  const [view, setView] = useState<DepositView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [checkoutError, setCheckoutError] = useState(false);
  const [accept, setAccept] = useState(false);

  const update = useCallback(
    async (
      value: string,
      refresh: boolean,
      signal?: AbortSignal,
      returnRef?: string,
    ) => {
      if (!endpoint) return;
      try {
        const data = readDepositView(
          await paymentRequest(
            endpoint,
            refresh ? "refresh" : "view",
            value,
            returnRef ? { returnRef } : {},
            signal,
          ),
        );
        if (!data) throw new Error("Invalid deposit");
        if (!signal?.aborted) {
          setView(data);
          setError(false);
        }
      } catch {
        if (!signal?.aborted) {
          setView(null);
          setError(true);
        }
      }
    },
    [endpoint],
  );

  useEffect(() => {
    if (!token) return;
    const stop = new AbortController();
    const initial = window.setTimeout(
      () =>
        void update(
          token,
          Boolean(returnRef),
          stop.signal,
          returnRef ?? undefined,
        ),
      0,
    );
    const timer = window.setInterval(
      () => void update(token, false, stop.signal),
      15000,
    );
    return () => {
      stop.abort();
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, [token, returnRef, update]);

  async function checkout(provider: DepositProvider) {
    if (!endpoint || !token || !accept || !view?.checkoutOpen || busy) return;
    setBusy(true);
    setError(false);
    setCheckoutError(false);
    try {
      const data = (await paymentRequest(endpoint, "checkout", token, {
        provider,
        locale,
        terms: DEPOSIT_TERMS_VERSION,
      })) as { url?: unknown; attemptRef?: unknown } | null;
      const url = checkoutUrl(provider, data?.url);
      if (!url || !isPaymentAttempt(data?.attemptRef))
        throw new Error("Invalid checkout URL");
      try {
        sessionStorage.setItem(`${sessionKey}:${data.attemptRef}`, token);
      } catch {
        // A visitor can reopen the original link to see the result.
      }
      window.location.assign(url);
    } catch {
      setCheckoutError(true);
      setBusy(false);
      void update(token, false);
    }
  }

  const money = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
  });
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: STUDIO_TIME_ZONE,
  });
  return (
    <section className="notice" aria-labelledby="deposit-heading">
      <h1 id="deposit-heading">{dict.heading}</h1>
      <div aria-live="polite">
        {(!endpoint || (location && !token)) && <p>{dict.linkRequired}</p>}
        {endpoint && token && !view && !error && <p>{dict.loading}</p>}
        {view && <p>{dict.status[view.status]}</p>}
        {error && <p role="alert">{dict.error}</p>}
        {checkoutError && !error && <p role="alert">{dict.checkoutError}</p>}
      </div>
      {view?.startsAt &&
        view.holdUntil &&
        view.amount !== undefined &&
        view.total !== undefined && (
          <>
            <p>
              {dict.visit}{" "}
              <time dateTime={view.startsAt}>
                {date.format(new Date(view.startsAt))}
              </time>{" "}
              ({dict.timeZone})
            </p>
            {view.status === "payable" && (
              <p>
                {dict.deadline}{" "}
                <time dateTime={view.holdUntil}>
                  {date.format(new Date(view.holdUntil))}
                </time>
              </p>
            )}
            <p>
              {dict.total} <strong>{money.format(view.total / 100)}</strong>
            </p>
            <p>
              {dict.amount} <strong>{money.format(view.amount / 100)}</strong>
            </p>
            <p>
              {dict.balance}{" "}
              <strong>{money.format((view.total - view.amount) / 100)}</strong>
            </p>
          </>
        )}
      {view?.checkoutOpen && (
        <>
          <p>{dict.policy}</p>
          <p>{dict.providerDetails}</p>
          <p>
            <label>
              <input
                type="checkbox"
                checked={accept}
                onChange={(event) => setAccept(event.target.checked)}
              />{" "}
              {dict.accept}
            </label>
          </p>
          <p className="notice-action">
            <button
              className="button"
              type="button"
              disabled={busy || !accept}
              onClick={() => void checkout("paypal")}
            >
              {dict.paypal}
            </button>
          </p>
          <p className="notice-action">
            <button
              className="button"
              type="button"
              disabled={busy || !accept}
              onClick={() => void checkout("stripe")}
            >
              {dict.stripe}
            </button>
          </p>
        </>
      )}
      {token && (view?.status === "processing" || error) && (
        <p className="notice-action">
          <button
            className="button"
            type="button"
            onClick={() => void update(token, true)}
          >
            {dict.refresh}
          </button>
        </p>
      )}
    </section>
  );
}
