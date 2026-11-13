import { FALLBACK, handleChat, parseChatBody, type ChatDeps } from "./chat";
import type { HumanCheck } from "./turnstile";

/** Bodies above this are refused unread; a full conversation is far smaller. */
export const MAX_BODY_BYTES = 256 * 1024;
export class BodyTooLarge extends Error {}

export async function readBoundedText(
  request: Request,
  limit = MAX_BODY_BYTES,
  preserveBom = false,
) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder("utf-8", {
    fatal: true,
    ignoreBOM: preserveBom,
  });
  let body = "";
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > limit) throw new BodyTooLarge();
      body += decoder.decode(chunk.value, { stream: true });
    }
    return body + decoder.decode();
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export interface HttpInput {
  method: string;
  origin: string | null;
  ip: string | undefined;
  /** The Content-Length header, when the client sent one. */
  contentLength: number | null;
  readJson(): Promise<unknown>;
}

export interface HttpOutput {
  status: number;
  headers: Record<string, string>;
  body?: unknown;
}

export interface HttpDeps {
  allowedOrigins: string[];
  rateLimiter(key: string): Promise<boolean>;
  allowMessage(): Promise<boolean>;
  verifyHuman(token: string | undefined): Promise<HumanCheck>;
  chat: ChatDeps;
  log(message: string, details?: Record<string, unknown>): void;
}

export function corsHeaders(
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

  let withinVisitorLimit: boolean;
  try {
    withinVisitorLimit = await deps.rateLimiter(input.ip ?? "unknown");
  } catch {
    deps.log("visitor rate limit unavailable");
    return json(503, { error: "chat unavailable" });
  }
  if (!withinVisitorLimit) {
    return json(429, {
      error: "too many messages, try again in a few minutes",
    });
  }

  let raw: unknown;
  try {
    raw = await input.readJson();
  } catch (error) {
    if (error instanceof BodyTooLarge)
      return json(413, { error: "message too large" });
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
  let allowed: boolean;
  try {
    allowed = await deps.allowMessage();
  } catch {
    deps.log("daily counter unavailable");
    return json(200, {
      reply: FALLBACK.unavailable[body.language],
      requestSent: body.requestSent,
      reason: "daily-limit-unavailable",
    });
  }
  if (!allowed) {
    deps.log("daily limit reached");
    return json(200, {
      reply: FALLBACK.unavailable[body.language],
      requestSent: body.requestSent,
      reason: "daily-limit",
    });
  }

  try {
    return json(200, await handleChat(body, deps.chat));
  } catch (error) {
    deps.log("chat failed", { reason: failureReason(error) });
    return json(200, {
      reply: FALLBACK.unavailable[body.language],
      requestSent: body.requestSent,
      reason: failureReason(error),
    });
  }
}

function failureReason(error: unknown): string {
  const status = (error as { status?: unknown } | null)?.status;
  return typeof status === "number" ? `model-http-${status}` : "model-error";
}
