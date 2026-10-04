import { randomUUID } from "node:crypto";
import {
  app,
  type HttpRequest,
  type InvocationContext,
} from "@azure/functions";
import { DefaultAzureCredential } from "@azure/identity";
import { studioFacts } from "../../lib/studio-facts";
import {
  emailNotifier,
  foundryMessages,
  tableDailyCounter,
  tableRequestStore,
} from "./azure";
import { healthReport, readConfig } from "./config";
import { handleChatHttp, type HttpDeps } from "./http";
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
const createMessage = foundryMessages(config.foundryResource, credential);
const system = buildSystemPrompt(studioFacts);

function deps(context: InvocationContext): HttpDeps {
  return {
    allowedOrigins: config.allowedOrigins,
    rateLimiter,
    dailyCounter,
    dailyLimit: config.dailyLimit,
    verifyHuman: (token, ip) =>
      verifyTurnstile(config.turnstileSecret, token, ip),
    log: (message, details) => context.warn(message, details ?? {}),
    chat: {
      facts: studioFacts,
      system,
      model: config.foundryDeployment,
      createMessage,
      store,
      notifiers,
      now: () => new Date(),
      newId: () => randomUUID().slice(0, 8),
    },
  };
}

function clientIp(request: HttpRequest): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0];
  // Azure appends the port ("1.2.3.4:5678"); IPv6 addresses keep their colons.
  return forwarded?.trim().replace(/^(\d+\.\d+\.\d+\.\d+):\d+$/, "$1");
}

app.http("chat", {
  methods: ["POST", "OPTIONS"],
  authLevel: "anonymous",
  route: "chat",
  handler: async (request, context) => {
    const output = await handleChatHttp(
      {
        method: request.method,
        origin: request.headers.get("origin"),
        ip: clientIp(request),
        readJson: () => request.json(),
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
