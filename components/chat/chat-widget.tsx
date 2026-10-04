"use client";

import React, { useCallback, useEffect, useId, useRef, useState } from "react";
import { getDictionary, type Locale } from "../../lib/locales";

// The AI receptionist: a chat button on every page that opens a panel.
// The conversation lives only in this page; each message is sent with the
// text history to the receptionist API (chat-api/, Azure Functions), which
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
      callback(token: string): void;
      "error-callback"(code: string): void;
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

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () =>
      window.turnstile
        ? resolve(window.turnstile)
        : reject(new Error("turnstile"));
    script.onerror = () => reject(new Error("turnstile"));
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
  const [pending, setPending] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const checkRef = useRef<Promise<TurnstileState | null> | null>(null);

  const history = items.filter(
    (item): item is Item & { role: "user" | "assistant" } =>
      (item.role === "user" && !item.failed) || item.role === "assistant",
  );
  const atLimit = history.length >= MAX_MESSAGES - 1;

  const close = useCallback(() => {
    setOpen(false);
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
  }, [items, pending]);

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
        if (cancelled || !turnstileRef.current) return null;
        const current: TurnstileState = { widget: "", api, waiting: null };
        current.widget = api.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          size: "compact",
          appearance: "interaction-only",
          execution: "execute",
          callback: (token) => {
            current.waiting?.(token);
            current.waiting = null;
          },
          "error-callback": (code) => {
            // Cloudflare's code names the cause: 110100 a wrong site key,
            // 110200 a domain missing from the widget's hostnames.
            console.warn("Turnstile error", code);
            current.waiting?.(undefined);
            current.waiting = null;
          },
        });
        state = current;
        return current;
      })
      // Without the check the API refuses; the visitor sees the fallback.
      .catch(() => null);
    return () => {
      cancelled = true;
      checkRef.current = null;
      if (!state) return;
      state.waiting?.(undefined);
      state.waiting = null;
      try {
        state.api.remove(state.widget);
      } catch {
        // Already gone with the panel.
      }
    };
  }, [open, turnstileSiteKey]);

  // A fresh token for every message: Cloudflare accepts each one only once.
  const humanToken = async (): Promise<string | undefined> => {
    const state = await checkRef.current;
    if (!state) return undefined;
    return new Promise((resolve) => {
      state.waiting = resolve;
      state.api.reset(state.widget);
      state.api.execute(state.widget);
      // Time enough to solve a challenge if Cloudflare shows one.
      setTimeout(() => {
        if (state.waiting === resolve) {
          state.waiting = null;
          resolve(undefined);
        }
      }, 60_000);
    });
  };

  async function send(event?: React.FormEvent) {
    event?.preventDefault();
    const text = draft.trim();
    if (!text || pending || atLimit) return;
    const outgoing = [...history, { role: "user" as const, text }];
    setItems((current) => [...current, { role: "user", text }]);
    setDraft("");
    setPending(true);
    try {
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
          turnstileToken: await humanToken(),
        }),
      });
      if (!response.ok) throw new Error(String(response.status));
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
        return [...next, { role: "notice", text: dict.error }];
      });
      setDraft(text);
    } finally {
      setPending(false);
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
                  {dict.typing}
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
              onChange={(event) => setDraft(event.target.value)}
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
              disabled={pending || atLimit || draft.trim() === ""}
            >
              {dict.send}
            </button>
          </form>
          <p className="chat-privacy">
            {dict.privacy}
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
