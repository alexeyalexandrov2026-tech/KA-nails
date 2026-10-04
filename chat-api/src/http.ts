import { FALLBACK, handleChat, parseChatBody, type ChatDeps } from "./chat";
import { utcDay, type DailyCounter, type RateLimiter } from "./limits";
import type { HumanCheck } from "./turnstile";

// The HTTP contract of POST /api/chat, independent of the Azure runtime so it
// can be tested directly. CORS allows only the website's own origins.

/** Bodies above this are refused unread; a full conversation is far smaller. */
export const MAX_BODY_BYTES = 256 * 1024;

export interface HttpInput {
  method: string;
  origin: string | null;
  ip: string | undefined;
  /** The Content-Length header, when the client sent one. */
  contentLength: number | null;
  readJson(): Promise<unknown>;
}

/**
 * The visitor's address for the rate limit: the right-most X-Forwarded-For
 * entry, which the platform's front end appends. Entries to its left come
 * from the client and can be anything. Azure adds the port to IPv4.
 */
export function forwardedClientIp(header: string | null): string | undefined {
  const last = header?.split(",").at(-1)?.trim();
  return last ? last.replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1") : undefined;
}

export interface HttpOutput {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface HttpDeps {
  allowedOrigins: string[];
  rateLimiter: RateLimiter;
  dailyCounter: DailyCounter;
  dailyLimit: number;
  verifyHuman(token: string | undefined): Promise<HumanCheck>;
  chat: ChatDeps;
  log(message: string, details?: Record<string, unknown>): void;
}

function corsHeaders(
  origin: string | null,
  allowed: string[],
): Record<string, string> {
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

export async function handleChatHttp(
  input: HttpInput,
  deps: HttpDeps,
): Promise<HttpOutput> {
  const cors = corsHeaders(input.origin, deps.allowedOrigins);
  const json = (status: number, body: unknown): HttpOutput => ({
    status,
    headers: {
      ...cors,
      "content-type": "application/json",
      "cache-control": "no-store",
    },
    body,
  });

  // Only the studio's website may use the receptionist.
  if (!input.origin || !deps.allowedOrigins.includes(input.origin)) {
    return json(403, { error: "origin not allowed" });
  }
  if (input.method === "OPTIONS") return { status: 204, headers: cors };
  if (input.method !== "POST") return json(405, { error: "use POST" });
  if (input.contentLength !== null && input.contentLength > MAX_BODY_BYTES) {
    return json(413, { error: "message too large" });
  }

  const now = deps.chat.now();
  if (!deps.rateLimiter.allow(input.ip ?? "unknown", now.getTime())) {
    return json(429, {
      error: "too many messages, try again in a few minutes",
    });
  }

  let raw: unknown;
  try {
    raw = await input.readJson();
  } catch {
    return json(400, { error: "invalid JSON" });
  }
  const parsed = parseChatBody(raw);
  if (!parsed.ok) return json(400, { error: parsed.error });
  const { body } = parsed;

  const check = await deps.verifyHuman(body.turnstileToken);
  if (!check.ok) {
    // The reason (Cloudflare's error codes, or no-token when the browser had
    // none) shows in the browser's network panel and in the logs.
    deps.log("human check failed", { reason: check.reason });
    return json(403, {
      error: "verification failed, reload the page",
      reason: check.reason,
    });
  }
  let count = 0;
  try {
    count = await deps.dailyCounter.increment(utcDay(now));
  } catch (error) {
    // The cap is a cost guard; a storage hiccup must not silence the chat.
    deps.log("daily counter unavailable", {
      error: String(error).slice(0, 300),
    });
  }
  if (count > deps.dailyLimit) {
    deps.log("daily limit reached", { count });
    return json(200, {
      reply: FALLBACK.unavailable[body.language],
      requestSent: body.requestSent,
      reason: "daily-limit",
    });
  }

  try {
    return json(200, await handleChat(body, deps.chat));
  } catch (error) {
    deps.log("chat failed", { error: String(error).slice(0, 300) });
    return json(200, {
      reply: FALLBACK.unavailable[body.language],
      requestSent: body.requestSent,
      reason: failureReason(error),
    });
  }
}

// The model API's HTTP status (402: no credits for a paid model, 404: no
// endpoint for the model, 429: rate limit) without the error's details.
function failureReason(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? `model-http-${status}` : "model-error";
}
