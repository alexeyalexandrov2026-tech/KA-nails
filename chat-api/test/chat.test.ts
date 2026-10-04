import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type Anthropic from "@anthropic-ai/sdk";
import { studioFacts } from "../../lib/studio-facts";
import {
  bookingTool,
  normalizePhone,
  TOOL_NAME,
  validateBookingRequest,
} from "../src/booking-request";
import {
  FALLBACK,
  handleChat,
  parseChatBody,
  type ChatDeps,
  type ChatRequestBody,
} from "../src/chat";
import { healthReport, readConfig } from "../src/config";
import { handleChatHttp, type HttpDeps } from "../src/http";
import { RateLimiter } from "../src/limits";
import { ownerMessage, telegramNotifier, type Notifier } from "../src/notify";
import { buildSystemPrompt } from "../src/prompt";
import { verifyTurnstile } from "../src/turnstile";

// Claude, Telegram, email and storage are all fakes here: the tests check
// what the receptionist sends and stores, never a real service.

const FIRST = studioFacts.services[0]!;

function message(
  content: Anthropic.ContentBlock[],
  stopReason: Anthropic.Message["stop_reason"],
): Anthropic.Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5",
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {} as Anthropic.Usage,
  } as Anthropic.Message;
}

const text = (value: string) =>
  ({ type: "text", text: value, citations: null }) as Anthropic.TextBlock;

const toolUse = (input: Record<string, unknown>) =>
  ({
    type: "tool_use",
    id: "toolu_1",
    name: TOOL_NAME,
    input,
  }) as Anthropic.ToolUseBlock;

const GOOD_INPUT = {
  service_id: FIRST.id,
  preferred_time: "weekday evenings",
  name: "Ann",
  phone: "(561) 555-0100",
  language: "en",
};

function fakeDeps(replies: Anthropic.Message[]) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const sent: { channel: string; subject: string; text: string }[] = [];
  const saved: string[] = [];
  const notifier = (channel: string, fail = false): Notifier => ({
    channel,
    async send(subject, body) {
      if (fail) throw new Error(`${channel} down`);
      sent.push({ channel, subject, text: body });
    },
  });
  const deps: ChatDeps = {
    facts: studioFacts,
    system: buildSystemPrompt(studioFacts),
    model: "claude-haiku-4-5",
    async createMessage(params) {
      // Snapshot: the handler keeps appending to the same arrays.
      calls.push(structuredClone(params));
      const reply = replies.shift();
      if (!reply) throw new Error("no scripted reply left");
      return reply;
    },
    store: {
      async saveRequest(id) {
        saved.push(id);
      },
    },
    notifiers: [notifier("telegram"), notifier("email")],
    now: () => new Date("2026-10-04T12:00:00Z"),
    newId: () => "abc12345",
  };
  return { deps, calls, sent, saved, notifier };
}

const body = (overrides: Partial<ChatRequestBody> = {}): ChatRequestBody => ({
  language: "en",
  messages: [{ role: "user", content: "Hi, how much is a classic pedicure?" }],
  requestSent: false,
  ...overrides,
});

describe("system prompt", () => {
  it("lists every published service and add-on with its exact price", () => {
    const prompt = buildSystemPrompt(studioFacts);
    for (const offer of [...studioFacts.services, ...studioFacts.addOns]) {
      assert.ok(prompt.includes(offer.id), offer.id);
      assert.ok(prompt.includes(offer.name.en), offer.name.en);
      assert.ok(prompt.includes(offer.name.ru), offer.name.ru);
      const price = `${offer.price.plus ? "+" : ""}$${offer.price.amount}`;
      assert.ok(prompt.includes(price), `${offer.id} ${price}`);
    }
    for (const note of studioFacts.menuNotes)
      assert.ok(prompt.includes(note.en));
  });

  it("does not invent an address or hours that are not published", () => {
    const prompt = buildSystemPrompt(studioFacts);
    if (!studioFacts.address)
      assert.match(prompt, /Address: Not published yet/);
    if (studioFacts.hours.length === 0) {
      assert.match(prompt, /Opening hours: Not published yet/);
    }
    assert.match(prompt, /pedicure only/);
    assert.match(prompt, /Never say an appointment is booked/);
  });

  it("is the same for every request, so it can be cached", () => {
    assert.equal(
      buildSystemPrompt(studioFacts),
      buildSystemPrompt(studioFacts),
    );
  });
});

describe("booking request", () => {
  it("offers only menu ids to the model", () => {
    const schema = bookingTool(studioFacts).input_schema as {
      properties: { service_id: { enum: string[] } };
    };
    assert.deepEqual(schema.properties.service_id.enum, [
      ...studioFacts.services.map((s) => s.id),
      "not_sure",
    ]);
  });

  it("normalizes phone numbers to E.164", () => {
    assert.equal(normalizePhone("(561) 382-8779"), "+15613828779");
    assert.equal(normalizePhone("1 561 382 8779"), "+15613828779");
    assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
    assert.equal(normalizePhone("12345"), null);
    assert.equal(normalizePhone("call me"), null);
  });

  it("accepts a complete request", () => {
    const result = validateBookingRequest(
      { ...GOOD_INPUT, add_on_ids: [studioFacts.addOns[0]!.id] },
      studioFacts,
    );
    assert.ok(result.ok);
    assert.deepEqual(result.request, {
      serviceId: FIRST.id,
      addOnIds: [studioFacts.addOns[0]!.id],
      preferredTime: "weekday evenings",
      name: "Ann",
      phone: "+15615550100",
      notes: "",
      language: "en",
    });
  });

  it("rejects services and add-ons that are not on the menu, and bad phones", () => {
    const result = validateBookingRequest(
      {
        ...GOOD_INPUT,
        service_id: "gel-manicure",
        add_on_ids: ["free-massage"],
        phone: "555",
        name: " ",
      },
      studioFacts,
    );
    assert.ok(!result.ok);
    assert.match(result.errors.join(";"), /service_id is not on the menu/);
    assert.match(result.errors.join(";"), /free-massage is not on the menu/);
    assert.match(result.errors.join(";"), /phone is not a valid number/);
    assert.match(result.errors.join(";"), /name is missing/);
  });

  it("allows a visitor who has not chosen a service yet", () => {
    const result = validateBookingRequest(
      { ...GOOD_INPUT, service_id: "not_sure" },
      studioFacts,
    );
    assert.ok(result.ok && result.request.serviceId === null);
  });
});

describe("owner message", () => {
  it("is in Russian with the menu's names, price and contact", () => {
    const result = validateBookingRequest(GOOD_INPUT, studioFacts);
    assert.ok(result.ok);
    const { subject, text: body } = ownerMessage(
      result.request,
      studioFacts,
      "abc12345",
      new Date("2026-10-04T12:00:00Z"),
    );
    assert.match(subject, /Ann/);
    assert.ok(body.includes(FIRST.name.ru));
    assert.ok(body.includes(FIRST.name.en));
    assert.match(body, new RegExp(`${FIRST.price.amount}\\s\\$`));
    assert.match(body, /Телефон: \+1 \(561\) 555-0100/);
    assert.match(body, /Заявка abc12345, 2026-10-04 12:00 UTC/);
    assert.match(body, /Время ещё не подтверждено/);
  });
});

describe("chat turn", () => {
  it("returns the model's answer and offers the booking tool", async () => {
    const { deps, calls } = fakeDeps([
      message(
        [text(`A Classic Pedicure is $${FIRST.price.amount}.`)],
        "end_turn",
      ),
    ]);
    const reply = await handleChat(body(), deps);
    assert.equal(reply.reply, `A Classic Pedicure is $${FIRST.price.amount}.`);
    assert.equal(reply.requestSent, false);
    const params = calls[0]!;
    assert.equal(params.model, "claude-haiku-4-5");
    assert.equal(
      (params.tools?.[0] as Anthropic.Tool | undefined)?.name,
      TOOL_NAME,
    );
    const system = params.system as Anthropic.TextBlockParam[];
    assert.deepEqual(system[0]!.cache_control, { type: "ephemeral" });
  });

  it("sends a confirmed request to every channel, stores it, then lets the model answer", async () => {
    const { deps, calls, sent, saved } = fakeDeps([
      message([text("Sending it now."), toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Done! Karina will contact you.")], "end_turn"),
    ]);
    const reply = await handleChat(body(), deps);
    assert.equal(reply.requestSent, true);
    assert.equal(reply.reply, "Done! Karina will contact you.");
    assert.deepEqual(
      sent.map((s) => s.channel),
      ["telegram", "email"],
    );
    assert.deepEqual(saved, ["abc12345"]);
    const second = calls[1]!;
    const last = second.messages.at(-1)!;
    assert.equal(last.role, "user");
    const result = (last.content as Anthropic.ToolResultBlockParam[])[0]!;
    assert.equal(result.type, "tool_result");
    assert.equal(result.tool_use_id, "toolu_1");
    assert.equal(result.is_error, undefined);
    assert.equal(second.messages.at(-2)!.role, "assistant");
  });

  it("returns validation errors to the model without sending anything", async () => {
    const { deps, calls, sent, saved } = fakeDeps([
      message([toolUse({ ...GOOD_INPUT, phone: "123" })], "tool_use"),
      message([text("Could you check your phone number?")], "end_turn"),
    ]);
    const reply = await handleChat(body(), deps);
    assert.equal(reply.requestSent, false);
    assert.equal(sent.length, 0);
    assert.equal(saved.length, 0);
    const result = (
      calls[1]!.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[]
    )[0]!;
    assert.equal(result.is_error, true);
    assert.match(String(result.content), /phone/);
  });

  it("uses the visitor's language from the page, not from the model", async () => {
    const { deps, sent } = fakeDeps([
      message([toolUse({ ...GOOD_INPUT, language: "en" })], "tool_use"),
      message([text("Готово.")], "end_turn"),
    ]);
    await handleChat(body({ language: "ru" }), deps);
    assert.match(sent[0]!.text, /Язык клиента: русский/);
  });

  it("never sends a second request in the same conversation", async () => {
    const { deps, calls, sent } = fakeDeps([
      message([text("Your request is already with Karina.")], "end_turn"),
    ]);
    const reply = await handleChat(body({ requestSent: true }), deps);
    assert.equal(reply.requestSent, true);
    assert.equal(calls[0]!.tools, undefined);
    assert.equal((calls[0]!.system as Anthropic.TextBlockParam[]).length, 2);
    assert.equal(sent.length, 0);
  });

  it("still succeeds when one channel fails", async () => {
    const { deps, sent } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Sent.")], "end_turn"),
    ]);
    deps.notifiers = [
      deps.notifiers[0]!,
      { channel: "email", send: async () => Promise.reject(new Error("down")) },
    ];
    const reply = await handleChat(body(), deps);
    assert.equal(reply.requestSent, true);
    assert.equal(sent.length, 1);
  });

  it("reports failure when nothing could be delivered or stored", async () => {
    const { deps, calls } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Please write on WhatsApp.")], "end_turn"),
    ]);
    deps.notifiers = [
      {
        channel: "telegram",
        send: async () => Promise.reject(new Error("down")),
      },
    ];
    deps.store = { saveRequest: async () => Promise.reject(new Error("down")) };
    const reply = await handleChat(body(), deps);
    assert.equal(reply.requestSent, false);
    const result = (
      calls[1]!.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[]
    )[0]!;
    assert.equal(result.is_error, true);
  });

  it("answers a refusal with a polite fallback", async () => {
    const { deps } = fakeDeps([message([], "refusal")]);
    const reply = await handleChat(body({ language: "ru" }), deps);
    assert.equal(reply.reply, FALLBACK.refusal.ru);
  });
});

describe("request body", () => {
  it("accepts alternating text messages that end with the visitor", () => {
    const parsed = parseChatBody({
      language: "ru",
      messages: [
        { role: "user", content: "Привет" },
        { role: "assistant", content: "Здравствуйте!" },
        { role: "user", content: "Сколько стоит педикюр?" },
      ],
      requestSent: true,
    });
    assert.ok(parsed.ok);
    assert.equal(parsed.body.language, "ru");
    assert.equal(parsed.body.requestSent, true);
  });

  it("rejects forged roles, long messages and empty conversations", () => {
    assert.ok(!parseChatBody({ messages: [] }).ok);
    assert.ok(
      !parseChatBody({ messages: [{ role: "assistant", content: "x" }] }).ok,
    );
    assert.ok(
      !parseChatBody({
        messages: [{ role: "user", content: "x".repeat(1001) }],
      }).ok,
    );
    assert.ok(
      !parseChatBody({
        messages: [
          { role: "user", content: "a" },
          { role: "assistant", content: "b" },
        ],
      }).ok,
    );
    assert.ok(
      !parseChatBody({
        messages: Array.from({ length: 31 }, (_, i) => ({
          role: i % 2 ? "assistant" : "user",
          content: "x",
        })),
      }).ok,
    );
  });
});

describe("HTTP endpoint", () => {
  const ORIGIN = "https://ka-nails.pages.dev";

  function httpDeps(overrides: Partial<HttpDeps> = {}) {
    const { deps } = fakeDeps([message([text("Hello!")], "end_turn")]);
    let count = 0;
    const logs: string[] = [];
    const http: HttpDeps = {
      allowedOrigins: [ORIGIN],
      rateLimiter: new RateLimiter(2, 60_000),
      dailyCounter: { increment: async () => ++count },
      dailyLimit: 100,
      verifyHuman: async () => true,
      chat: deps,
      log: (m) => logs.push(m),
      ...overrides,
    };
    return { http, logs };
  }

  const post = (origin: string | null = ORIGIN, json: unknown = body()) => ({
    method: "POST",
    origin,
    ip: "203.0.113.7",
    readJson: async () => json,
  });

  it("answers the website with CORS headers for its origin only", async () => {
    const { http } = httpDeps();
    const ok = await handleChatHttp(post(), http);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers["access-control-allow-origin"], ORIGIN);
    assert.deepEqual(ok.body, { reply: "Hello!", requestSent: false });

    const other = await handleChatHttp(post("https://evil.example"), http);
    assert.equal(other.status, 403);
    assert.equal(other.headers["access-control-allow-origin"], undefined);

    const preflight = await handleChatHttp(
      { ...post(), method: "OPTIONS" },
      http,
    );
    assert.equal(preflight.status, 204);
  });

  it("slows down a client that sends too many messages", async () => {
    const { http } = httpDeps();
    http.chat.createMessage = async () => message([text("ok")], "end_turn");
    assert.equal((await handleChatHttp(post(), http)).status, 200);
    assert.equal((await handleChatHttp(post(), http)).status, 200);
    assert.equal((await handleChatHttp(post(), http)).status, 429);
  });

  it("refuses visitors who fail the human check", async () => {
    const { http } = httpDeps({ verifyHuman: async () => false });
    assert.equal((await handleChatHttp(post(), http)).status, 403);
  });

  it("stops calling the AI after the daily limit", async () => {
    const { http } = httpDeps({ dailyLimit: 0 });
    let called = false;
    http.chat.createMessage = async () => {
      called = true;
      return message([text("x")], "end_turn");
    };
    const out = await handleChatHttp(post(), http);
    assert.equal(out.status, 200);
    assert.deepEqual(out.body, {
      reply: FALLBACK.unavailable.en,
      requestSent: false,
    });
    assert.equal(called, false);
  });

  it("falls back politely when the AI is unreachable", async () => {
    const { http, logs } = httpDeps();
    http.chat.createMessage = async () => {
      throw new Error("503");
    };
    const out = await handleChatHttp(
      post(ORIGIN, body({ language: "ru" })),
      http,
    );
    assert.deepEqual(out.body, {
      reply: FALLBACK.unavailable.ru,
      requestSent: false,
    });
    assert.deepEqual(logs, ["chat failed"]);
  });

  it("rejects malformed bodies", async () => {
    const { http } = httpDeps();
    const out = await handleChatHttp(post(ORIGIN, { messages: "hi" }), http);
    assert.equal(out.status, 400);
  });
});

describe("outside services", () => {
  it("posts the request to the studio's Telegram chat", async () => {
    const requests: { url: string; body: string }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      requests.push({ url, body: String(init.body) });
      return new Response("{}", { status: 200 });
    }) as unknown as typeof fetch;
    await telegramNotifier("TOKEN", "42", fakeFetch).send("s", "hello");
    assert.equal(
      requests[0]!.url,
      "https://api.telegram.org/botTOKEN/sendMessage",
    );
    assert.deepEqual(JSON.parse(requests[0]!.body), {
      chat_id: "42",
      text: "hello",
      disable_web_page_preview: true,
    });
    const failing = (async () =>
      new Response("{}", { status: 401 })) as unknown as typeof fetch;
    await assert.rejects(telegramNotifier("T", "1", failing).send("s", "x"));
  });

  it("checks Turnstile only when a secret is configured", async () => {
    const yes = (async () =>
      Response.json({ success: true })) as unknown as typeof fetch;
    const no = (async () =>
      Response.json({ success: false })) as unknown as typeof fetch;
    assert.equal(
      await verifyTurnstile(undefined, undefined, undefined, no),
      true,
    );
    assert.equal(await verifyTurnstile("s", undefined, undefined, yes), false);
    assert.equal(await verifyTurnstile("s", "t", "1.2.3.4", yes), true);
    assert.equal(await verifyTurnstile("s", "t", "1.2.3.4", no), false);
  });

  it("reads settings and reports health without secret values", () => {
    const config = readConfig({
      ALLOWED_ORIGINS: "https://ka-nails.pages.dev, http://127.0.0.1:4173",
      FOUNDRY_RESOURCE: "kanails-ai",
      STORAGE_TABLE_ENDPOINT: "https://kanails.table.core.windows.net",
      TELEGRAM_BOT_TOKEN: "secret-token",
      TELEGRAM_CHAT_ID: "42",
    });
    assert.deepEqual(config.allowedOrigins, [
      "https://ka-nails.pages.dev",
      "http://127.0.0.1:4173",
    ]);
    assert.equal(config.foundryDeployment, "claude-haiku-4-5");
    const health = healthReport(config);
    assert.deepEqual(health.channels, { telegram: true, email: false });
    assert.ok(!JSON.stringify(health).includes("secret-token"));
    assert.throws(() => readConfig({}), /ALLOWED_ORIGINS/);
    // Secrets that are not created yet do not switch anything on.
    const pending = readConfig({
      ALLOWED_ORIGINS: "https://ka-nails.pages.dev",
      FOUNDRY_RESOURCE: "kanails-ai",
      STORAGE_TABLE_ENDPOINT: "https://kanails.table.core.windows.net",
      TELEGRAM_BOT_TOKEN:
        "@Microsoft.KeyVault(VaultName=kv;SecretName=telegram-bot-token)",
      TELEGRAM_CHAT_ID: "42",
      TURNSTILE_SECRET: "none",
    });
    assert.equal(pending.telegram, undefined);
    assert.equal(pending.turnstileSecret, undefined);
  });
});
