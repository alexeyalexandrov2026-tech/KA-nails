"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { getDictionary, type Locale } from "../../lib/locales";

// The AI receptionist: a chat button on every page that opens a panel.
// The conversation lives only in this page; each message is sent with the
// text history to the receptionist API (chat-api/), which
// answers from the studio's facts and can pass a request to the master.

interface ChatWidgetProps {
  locale: Locale;
  endpoint: string;
  /** Published WhatsApp link, offered when the assistant is unavailable. */
  whatsappHref: string | null;
  /** Cloudflare Turnstile site key; without it no human check runs. */
  turnstileSiteKey?: string;
}

interface Item {
  role: "user" | "assistant" | "notice";
  text: string;
  /** A visitor message that never reached the assistant. */
  failed?: boolean;
}

interface TurnstileApi {
  render(
    element: HTMLElement,
    options: {
      sitekey: string;
      size: "compact";
      appearance: "interaction-only";
      execution: "execute";
      language: Locale;
      retry: "never";
      "refresh-timeout": "never";
      callback(token: string): void;
      "error-callback"(code: string): void;
      "before-interactive-callback"(): void;
      "after-interactive-callback"(): void;
      "timeout-callback"(): void;
    },
  ): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

interface TurnstileState {
  widget: string;
  api: TurnstileApi;
  waiting: ((token: string | undefined) => void) | null;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const MAX_MESSAGES = 30;
const MAX_CHARS = 1000;
const SCRIPT_TIMEOUT_MS = 15_000;
const VERIFICATION_TIMEOUT_MS = 120_000;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    const fail = () => {
      clearTimeout(timeout);
      script.remove();
      reject(new Error("Turnstile failed to load"));
    };
    const timeout = setTimeout(fail, SCRIPT_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timeout);
      if (window.turnstile) resolve(window.turnstile);
      else fail();
    };
    script.onerror = fail;
    document.head.appendChild(script);
  });
}

export function ChatWidget({
  locale,
  endpoint,
  whatsappHref,
  turnstileSiteKey,
}: ChatWidgetProps) {
  const dict = getDictionary(locale).chat;
  const id = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<"verification" | "reply" | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<Promise<TurnstileState | null> | null>(null);
  // A token fetched while the visitor types, so sending need not wait for it.
  const readyRef = useRef<{
    token: Promise<string | undefined>;
    at: number;
  } | null>(null);

  const history = items.filter(
    (item): item is Item & { role: "user" | "assistant" } =>
      (item.role === "user" && !item.failed) || item.role === "assistant",
  );
  const atLimit = history.length >= MAX_MESSAGES - 1;

  const close = useCallback(() => {
    setOpen(false);
    setInteractive(false);
    launcherRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [items, pending, interactive]);

  // The human check is set up when the panel opens and removed when it
  // closes (its element goes with the panel), so a reopened chat gets a fresh
  // widget. It stays out of sight unless Cloudflare asks the visitor to act;
  // the compact size fits the panel on a 320px phone.
  useEffect(() => {
    if (!open || !turnstileSiteKey) return;
    let state: TurnstileState | null = null;
    let cancelled = false;
    checkRef.current = loadTurnstile()
      .then((api) => {
        const container = turnstileRef.current;
        if (cancelled || !container) return null;
        const current: TurnstileState = { widget: "", api, waiting: null };
        const finish = (token?: string) => {
          if (cancelled) return;
          if (token && current.waiting) container.dataset.verified = "true";
          setInteractive(false);
          current.waiting?.(token);
        };
        current.widget = api.render(container, {
          sitekey: turnstileSiteKey,
          size: "compact",
          appearance: "interaction-only",
          execution: "execute",
          language: locale,
          retry: "never",
          "refresh-timeout": "never",
          callback: finish,
          "error-callback": (code) => {
            // Cloudflare's code names the cause: 110100 a wrong site key,
            // 110200 a domain missing from the widget's hostnames.
            console.warn("Turnstile error", code);
            finish();
          },
          "before-interactive-callback": () => {
            if (!cancelled && current.waiting) setInteractive(true);
          },
          "after-interactive-callback": () => {
            if (!cancelled) setInteractive(false);
          },
          "timeout-callback": () => finish(),
        });
        state = current;
        return current;
      })
      // If the widget fails to load, the next send shows the verification error.
      .catch(() => null);
    return () => {
      cancelled = true;
      checkRef.current = null;
      readyRef.current = null;
      if (!state) return;
      state.waiting?.(undefined);
      try {
        state.api.remove(state.widget);
      } catch {
        // Already gone with the panel.
      }
    };
  }, [open, turnstileSiteKey, locale]);

  // A fresh token for every message: Cloudflare accepts each one only once.
  const humanToken = async (): Promise<string | undefined> => {
    const state = await checkRef.current;
    if (!state) return undefined;
    return new Promise((resolve) => {
      const finish = (token?: string) => {
        clearTimeout(timeout);
        state.waiting = null;
        resolve(token);
      };
      const timeout = setTimeout(() => {
        setInteractive(false);
        finish();
      }, VERIFICATION_TIMEOUT_MS);
      try {
        turnstileRef.current?.removeAttribute("data-verified");
        state.api.reset(state.widget);
        state.waiting = finish;
        state.api.execute(state.widget);
      } catch {
        finish();
      }
    });
  };

  // Started on the first keystroke of a message. Tokens last 300 seconds;
  // one older than four minutes is not used.
  const prefetchToken = () => {
    if (!turnstileSiteKey || pending || readyRef.current) return;
    readyRef.current = { token: humanToken(), at: Date.now() };
  };

  const takeToken = async (): Promise<string | undefined> => {
    const ready = readyRef.current;
    readyRef.current = null;
    return ready && Date.now() - ready.at < 240_000
      ? ready.token
      : humanToken();
  };

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || pending || atLimit) return;
    const outgoing = [...history, { role: "user" as const, text }];
    setItems((current) => [...current, { role: "user", text }]);
    setDraft("");
    setPending(turnstileSiteKey ? "verification" : "reply");
    let failure = dict.error;
    try {
      const turnstileToken = turnstileSiteKey ? await takeToken() : undefined;
      if (turnstileSiteKey && !turnstileToken) {
        failure = dict.verificationError;
        throw new Error("Turnstile did not return a token");
      }
      setPending("reply");
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          language: locale,
          messages: outgoing.map((item) => ({
            role: item.role,
            content: item.text,
          })),
          requestSent,
          turnstileToken,
        }),
      });
      if (!response.ok) {
        if (response.status === 403) {
          const problem = (await response.json().catch(() => null)) as {
            error?: unknown;
          } | null;
          if (problem?.error === "verification failed, reload the page") {
            failure = dict.verificationError;
          }
        }
        throw new Error(String(response.status));
      }
      const data = (await response.json()) as {
        reply?: unknown;
        requestSent?: unknown;
      };
      if (typeof data.reply !== "string" || data.reply.trim() === "") {
        throw new Error("empty reply");
      }
      setItems((current) => [
        ...current,
        { role: "assistant", text: data.reply as string },
      ]);
      if (data.requestSent === true) setRequestSent(true);
    } catch {
      // The visitor's message stays visible but leaves the history, so the
      // conversation sent next time still alternates visitor/assistant.
      setItems((current) => {
        const next = [...current];
        const last = next.at(-1);
        if (last?.role === "user")
          next[next.length - 1] = { ...last, failed: true };
        return [...next, { role: "notice", text: failure }];
      });
      setDraft((current) => current || text);
    } finally {
      setPending(null);
    }
  }

  const panelId = `${id}-panel`;
  const titleId = `${id}-title`;

  return (
    <div className="chat-widget">
      {open && (
        <section
          id={panelId}
          className="chat-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
        >
          <header className="chat-panel-header">
            <h2 id={titleId} className="chat-panel-title">
              {dict.title}
            </h2>
            <button
              type="button"
              className="chat-close"
              onClick={close}
              aria-label={dict.close}
            >
              <span aria-hidden="true">×</span>
            </button>
          </header>

          <div
            ref={logRef}
            className="chat-log"
            role="log"
            aria-live="polite"
            aria-relevant="additions"
          >
            <ol className="chat-messages">
              <li className="chat-message chat-message-assistant">
                <span className="sr-only">{dict.assistant}: </span>
                {dict.greeting}
              </li>
              {items.map((item, i) => (
                <li
                  key={i}
                  className={`chat-message chat-message-${item.role}${item.failed ? " chat-message-failed" : ""}`}
                >
                  {item.role !== "notice" && (
                    <span className="sr-only">
                      {item.role === "user" ? dict.you : dict.assistant}:{" "}
                    </span>
                  )}
                  {item.text}
                  {item.role === "notice" && whatsappHref && (
                    <>
                      {" "}
                      <a
                        href={whatsappHref}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {dict.whatsapp}
                      </a>
                    </>
                  )}
                </li>
              ))}
              {pending && (
                <li className="chat-message chat-message-assistant chat-typing">
                  {pending === "verification" ? dict.verifying : dict.typing}
                </li>
              )}
              {atLimit && (
                <li className="chat-message chat-message-notice">
                  {dict.limit}
                </li>
              )}
            </ol>
          </div>

          <form className="chat-form" onSubmit={send}>
            <label htmlFor={`${id}-input`} className="sr-only">
              {dict.inputLabel}
            </label>
            <textarea
              id={`${id}-input`}
              ref={inputRef}
              className="chat-input"
              rows={2}
              maxLength={MAX_CHARS}
              value={draft}
              placeholder={dict.placeholder}
              disabled={atLimit}
              onChange={(event) => {
                setDraft(event.target.value);
                if (event.target.value.trim()) prefetchToken();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button
              type="submit"
              className="button chat-send"
              disabled={pending !== null || atLimit || draft.trim() === ""}
            >
              {dict.send}
            </button>
          </form>
          <p className="chat-privacy" aria-live="polite">
            {interactive ? dict.verificationPrompt : dict.privacy}
            {whatsappHref && (
              <>
                {" "}
                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {dict.whatsapp}
                </a>
              </>
            )}
          </p>
          <div ref={turnstileRef} className="chat-turnstile" />
        </section>
      )}

      <button
        ref={launcherRef}
        type="button"
        className="chat-launcher"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close() : setOpen(true))}
      >
        <span aria-hidden="true" className="chat-launcher-dot" />
        {dict.launcher}
      </button>
    </div>
  );
}
