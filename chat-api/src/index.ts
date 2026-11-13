import { studioFacts } from "../../lib/studio-facts";
import { readConfig } from "./config";
import { BodyTooLarge, handleChatHttp, MAX_BODY_BYTES } from "./http";
import { emailNotifier, telegramNotifier, type Notifier } from "./notify";
import { buildSystemPrompt } from "./prompt";
import { SupabaseError, supabaseChat } from "./supabase";
import { verifyTurnstile } from "./turnstile";
import { workersAiMessages } from "./workers-ai";

const system = buildSystemPrompt(studioFacts);
const informationOnly = buildSystemPrompt(studioFacts, false);
const noCache = { "cache-control": "no-store" };
const log = (message: string, details?: Record<string, unknown>) =>
  console.warn(JSON.stringify({ message, ...details }));

export async function readBoundedJson(request: Request): Promise<unknown> {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: false });
  let body = "";
  let bytes = 0;
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_BODY_BYTES) throw new BodyTooLarge();
      body += decoder.decode(chunk.value, { stream: true });
    }
    return JSON.parse(body + decoder.decode());
  } catch (error) {
    void reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
}

export default {
  async fetch(request, env): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path !== "/api/chat" && path !== "/api/health")
      return new Response(null, { status: 404 });
    const config = readConfig(env);
    const database =
      config.database &&
      supabaseChat(
        config.database.url,
        config.database.secret,
        config.dailyRequestLimit,
      );
    const channels = {
      telegram: Boolean(config.telegram),
      email: Boolean(config.email && env.EMAIL),
    };
    const configured = Boolean(
      env.AI &&
      config.turnstileSecret &&
      config.allowedOrigins.length &&
      database,
    );

    if (path === "/api/health") {
      if (request.method !== "GET")
        return new Response(null, { status: 405, headers: { Allow: "GET" } });
      const databaseReady =
        (await database?.ready().catch((error: unknown) => {
          log("database readiness check failed", {
            reason:
              error instanceof SupabaseError
                ? `http-${error.status}`
                : "connection",
          });
          return false;
        })) ?? false;
      const ready = configured && databaseReady;
      return Response.json(
        {
          status: ready ? "ok" : "degraded",
          provider: "workers-ai",
          model: config.model,
          modelReady: Boolean(env.AI),
          databaseReady,
          bookingReady: ready && (channels.telegram || channels.email),
          channels,
          humanCheck: config.turnstileSecret ? "on" : "missing",
        },
        { status: ready ? 200 : 503, headers: noCache },
      );
    }

    const origin = request.headers.get("origin");
    if (!database || !configured) {
      return Response.json(
        { error: "chat unavailable" },
        {
          status: 503,
          headers: {
            ...noCache,
            vary: "Origin",
            ...(origin && config.allowedOrigins.includes(origin)
              ? { "access-control-allow-origin": origin }
              : {}),
          },
        },
      );
    }
    const notifiers: Notifier[] = [];
    if (config.telegram)
      notifiers.push(
        telegramNotifier(config.telegram.token, config.telegram.chatId),
      );
    if (config.email && env.EMAIL)
      notifiers.push(
        emailNotifier(env.EMAIL, config.email.from, config.email.to),
      );

    const length = request.headers.get("content-length");
    const output = await handleChatHttp(
      {
        method: request.method,
        origin,
        ip: request.headers.get("cf-connecting-ip") ?? "unknown",
        contentLength: length === null ? null : Number(length),
        readJson: () => readBoundedJson(request),
      },
      {
        allowedOrigins: config.allowedOrigins,
        rateLimiter: async (key) =>
          (await env.VISITOR_LIMIT.limit({ key })).success,
        allowMessage: () => database.allowMessage(config.dailyLimit),
        verifyHuman: (token) =>
          verifyTurnstile(
            config.turnstileSecret,
            token,
            fetch,
            true,
            origin ? new URL(origin).hostname : undefined,
          ),
        log,
        chat: {
          facts: studioFacts,
          system: notifiers.length > 0 ? system : informationOnly,
          model: config.model,
          createMessage: workersAiMessages((model, input) =>
            env.AI.run(model, input),
          ),
          store: database.store,
          notifiers,
          now: () => new Date(),
          newId: () => crypto.randomUUID(),
          log,
        },
      },
    );
    return output.body === undefined
      ? new Response(null, { status: output.status, headers: output.headers })
      : Response.json(output.body, {
          status: output.status,
          headers: output.headers,
        });
  },
} satisfies ExportedHandler<Env>;
