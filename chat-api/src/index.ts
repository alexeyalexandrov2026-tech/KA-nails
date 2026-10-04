import { randomUUID } from "node:crypto";
import { app, type InvocationContext } from "@azure/functions";
import { DefaultAzureCredential } from "@azure/identity";
import { studioFacts } from "../../lib/studio-facts";
import {
  emailNotifier,
  foundryMessages,
  openRouterMessages,
  tableDailyCounter,
  tableRequestGuard,
  tableRequestStore,
} from "./azure";
import { healthReport, readConfig } from "./config";
import {
  forwardedClientIp,
  handleChatHttp,
  MAX_BODY_BYTES,
  type HttpDeps,
} from "./http";
import { RateLimiter } from "./limits";
import { telegramNotifier, type Notifier } from "./notify";
import { buildSystemPrompt } from "./prompt";
import { verifyTurnstile } from "./turnstile";

// Azure Functions entry point (Node.js v4 programming model).

const config = readConfig(process.env);
const credential = new DefaultAzureCredential();
const notifiers: Notifier[] = [];
if (config.telegram) {
  notifiers.push(
    telegramNotifier(config.telegram.token, config.telegram.chatId),
  );
}
if (config.email) {
  notifiers.push(
    emailNotifier(
      config.email.endpoint,
      credential,
      config.email.sender,
      config.email.to,
    ),
  );
}

const rateLimiter = new RateLimiter(config.ratePerTenMinutes, 10 * 60 * 1000);
const dailyCounter = tableDailyCounter(config.storageTableEndpoint, credential);
const store = tableRequestStore(config.storageTableEndpoint, credential);
const requestGuard = tableRequestGuard(
  config.storageTableEndpoint,
  credential,
  config.dailyRequestLimit,
);
const createMessage =
  config.model.provider === "foundry"
    ? foundryMessages(config.model.resource, credential)
    : openRouterMessages(config.model.apiKey);
const system = buildSystemPrompt(studioFacts);

function deps(context: InvocationContext): HttpDeps {
  return {
    allowedOrigins: config.allowedOrigins,
    rateLimiter,
    dailyCounter,
    dailyLimit: config.dailyLimit,
    verifyHuman: (token, ip) =>
      verifyTurnstile(
        config.turnstileSecret,
        token,
        ip,
        fetch,
        config.requireHumanCheck,
      ),
    log: (message, details) => context.warn(message, details ?? {}),
    chat: {
      facts: studioFacts,
      system,
      model: config.model.name,
      createMessage,
      store,
      notifiers,
      requestGuard,
      now: () => new Date(),
      newId: () => randomUUID().slice(0, 8),
      log: (message, details) => context.error(message, details ?? {}),
    },
  };
}

app.http("chat", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "chat",
  handler: async (request, context) => {
    const length = request.headers.get("content-length");
    const output = await handleChatHttp(
      {
        method: request.method,
        origin: request.headers.get("origin"),
        ip: forwardedClientIp(request.headers.get("x-forwarded-for")),
        contentLength: length === null ? null : Number(length),
        readJson: async () => {
          const text = await request.text();
          // Chunked bodies have no Content-Length; refuse big ones here.
          if (Buffer.byteLength(text) > MAX_BODY_BYTES) {
            throw new Error("body too large");
          }
          return JSON.parse(text);
        },
      },
      deps(context),
    );
    return {
      status: output.status,
      headers: output.headers,
      ...(output.body === undefined ? {} : { jsonBody: output.body }),
    };
  },
});

app.http("health", {
  methods: ["GET"],
  authLevel: "anonymous",
  route: "health",
  handler: async () => ({
    status: 200,
    headers: { "cache-control": "no-store" },
    jsonBody: healthReport(config),
  }),
});
