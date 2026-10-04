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
  type RequestGuard,
} from "../src/chat";
import { healthReport, readConfig } from "../src/config";
import {
  forwardedClientIp,
  handleChatHttp,
  MAX_BODY_BYTES,
  type HttpDeps,
} from "../src/http";
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

/** The shared request limits, in memory, with the same rules as Azure's. */
function memoryGuard(limit = 20): RequestGuard {
  const phones = new Set<string>();
  let count = 0;
  return {
    async reserve(phone, day) {
      const key = `${day} ${phone}`;
      if (phones.has(key)) return "duplicate";
      phones.add(key);
      if (++count > limit) {
        phones.delete(key);
        return "limit";
      }
      return "ok";
    },
    async release(phone, day) {
      phones.delete(`${day} ${phone}`);
    },
  };
}

function fakeDeps(replies: Anthropic.Message[]) {
  const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const sent: { channel: string; subject: string; text: string }[] = [];
  const saved: string[] = [];
  const logs: string[] = [];
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
      // Like the real Messages API: tool blocks in the history need tools.
      const toolBlocks = params.messages.some(
        (m) =>
          Array.isArray(m.content) &&
          m.content.some(
            (b) => b.type === "tool_use" || b.type === "tool_result",
          ),
      );
      if (toolBlocks && !params.tools?.length) {
        throw new Error(
          "400 Requests which include `tool_use` or `tool_result` blocks must define tools.",
        );
      }
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
    requestGuard: memoryGuard(),
    now: () => new Date("2026-10-04T12:00:00Z"),
    newId: () => "abc12345",
    log: (message) => logs.push(message),
  };
  return { deps, calls, sent, saved, logs, notifier };
}

const PHONE = "+15615550100";
const DAY = "2026-10-04";

const lastToolResult = (params: Anthropic.MessageCreateParamsNonStreaming) =>
  (params.messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0]!;

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
    assert.equal(params.tool_choice, undefined);
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
    // The API refuses tool blocks without tools; the tool may not be used.
    assert.equal((second.tools?.[0] as Anthropic.Tool).name, TOOL_NAME);
    assert.deepEqual(second.tool_choice, { type: "none" });
  });

  it("sends back only text and tool calls, not another model's reasoning", async () => {
    const thinking = {
      type: "thinking",
      thinking: "The visitor wants a pedicure.",
      signature: "",
    } as Anthropic.ThinkingBlock;
    const { deps, calls } = fakeDeps([
      message([thinking, text("Sending."), toolUse(GOOD_INPUT)], "tool_use"),
      message([thinking, text("Sent!")], "end_turn"),
    ]);
    const reply = await handleChat(body(), deps);
    assert.equal(reply.reply, "Sent!");
    const echoed = calls[1]!.messages.at(-2)!
      .content as Anthropic.ContentBlockParam[];
    assert.deepEqual(
      echoed.map((b) => b.type),
      ["text", "tool_use"],
    );
  });

  it("confirms a sent request even when the reply after it fails", async () => {
    const { deps, sent, logs } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      // No scripted second reply: the follow-up call fails.
    ]);
    const reply = await handleChat(body({ language: "ru" }), deps);
    assert.deepEqual(reply, { reply: FALLBACK.sent.ru, requestSent: true });
    assert.equal(sent.length, 2);
    assert.deepEqual(logs, ["reply after a sent request failed"]);
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
    assert.deepEqual(calls[0]!.tool_choice, { type: "none" });
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

  it("does not call a stored request sent when no channel delivered it", async () => {
    for (const notifiers of [
      [] as Notifier[],
      [{ channel: "telegram", send: () => Promise.reject(new Error("down")) }],
    ]) {
      const guard = memoryGuard();
      const { deps, calls, saved, logs } = fakeDeps([
        message([toolUse(GOOD_INPUT)], "tool_use"),
        message([text("Please write on WhatsApp.")], "end_turn"),
      ]);
      deps.notifiers = notifiers;
      deps.requestGuard = guard;
      const reply = await handleChat(body(), deps);
      assert.equal(reply.requestSent, false);
      // Kept on record, but the visitor is told to write or call instead.
      assert.deepEqual(saved, ["abc12345"]);
      assert.equal(lastToolResult(calls[1]!).is_error, true);
      assert.deepEqual(logs, ["request not delivered"]);
      // The number is free again for a later try.
      assert.equal(await guard.reserve(PHONE, DAY), "ok");
    }
  });

  it("sends one request per phone number a day, across conversations", async () => {
    const guard = memoryGuard();
    const first = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Sent.")], "end_turn"),
    ]);
    first.deps.requestGuard = guard;
    assert.equal((await handleChat(body(), first.deps)).requestSent, true);

    // A new conversation (the page says nothing was sent) with the same phone.
    const second = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Karina already has your request.")], "end_turn"),
    ]);
    second.deps.requestGuard = guard;
    const reply = await handleChat(body(), second.deps);
    assert.equal(reply.requestSent, true);
    assert.equal(second.sent.length, 0);
    const result = lastToolResult(second.calls[1]!);
    assert.equal(result.is_error, undefined);
    assert.match(String(result.content), /already reached the master today/);
  });

  it("stops sending requests after the daily limit", async () => {
    const { deps, calls, sent, saved } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Please write on WhatsApp.")], "end_turn"),
    ]);
    deps.requestGuard = memoryGuard(0);
    const reply = await handleChat(body(), deps);
    assert.equal(reply.requestSent, false);
    assert.equal(sent.length, 0);
    assert.equal(saved.length, 0);
    const result = lastToolResult(calls[1]!);
    assert.equal(result.is_error, true);
    assert.match(String(result.content), /no more online requests today/);
  });

  it("still sends a request when the limits storage is down", async () => {
    const { deps, sent, logs } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Sent.")], "end_turn"),
    ]);
    deps.requestGuard = {
      reserve: () => Promise.reject(new Error("storage down")),
      release: async () => {},
    };
    const reply = await handleChat(body(), deps);
    assert.equal(reply.requestSent, true);
    assert.equal(sent.length, 2);
    assert.deepEqual(logs, ["request limits unavailable"]);
  });

  it("answers a refusal with a polite fallback", async () => {
    const { deps } = fakeDeps([message([], "refusal")]);
    const reply = await handleChat(body({ language: "ru" }), deps);
    assert.equal(reply.reply, FALLBACK.refusal.ru);
  });

  it("says why when the model wrote no text", async () => {
    // A reasoning model can spend every token before it writes.
    const { deps, logs } = fakeDeps([message([], "max_tokens")]);
    const reply = await handleChat(body(), deps);
    assert.deepEqual(reply, {
      reply: FALLBACK.unavailable.en,
      requestSent: false,
      reason: "model-empty-max_tokens",
    });
    assert.deepEqual(logs, ["empty model reply"]);
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
      verifyHuman: async () => ({ ok: true }),
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
    contentLength: null,
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

  it("refuses visitors who fail the human check and says why", async () => {
    const { http, logs } = httpDeps({
      verifyHuman: async () => ({ ok: false, reason: "no-token" }),
    });
    const out = await handleChatHttp(post(), http);
    assert.equal(out.status, 403);
    assert.equal(out.headers["access-control-allow-origin"], ORIGIN);
    assert.deepEqual(out.body, {
      error: "verification failed, reload the page",
      reason: "no-token",
    });
    assert.deepEqual(logs, ["human check failed"]);
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
      reason: "daily-limit",
    });
    assert.equal(called, false);
  });

  it("falls back politely when the AI is unreachable", async () => {
    const { http, logs } = httpDeps();
    http.chat.createMessage = async () => {
      throw new Error("Connection error.");
    };
    const out = await handleChatHttp(
      post(ORIGIN, body({ language: "ru" })),
      http,
    );
    assert.deepEqual(out.body, {
      reply: FALLBACK.unavailable.ru,
      requestSent: false,
      reason: "model-error",
    });
    assert.deepEqual(logs, ["chat failed"]);
  });

  it("names the model's HTTP status when it refuses", async () => {
    // Like the SDK's APIError: OpenRouter answers 402 for a paid model
    // without credits.
    const { http } = httpDeps();
    http.chat.createMessage = async () => {
      throw Object.assign(new Error("402 Insufficient credits"), {
        status: 402,
      });
    };
    const out = await handleChatHttp(post(), http);
    assert.equal(out.status, 200);
    assert.deepEqual(out.body, {
      reply: FALLBACK.unavailable.en,
      requestSent: false,
      reason: "model-http-402",
    });
  });

  it("rejects malformed bodies", async () => {
    const { http } = httpDeps();
    const out = await handleChatHttp(post(ORIGIN, { messages: "hi" }), http);
    assert.equal(out.status, 400);
  });

  it("refuses oversized bodies without reading them", async () => {
    const { http } = httpDeps();
    let read = false;
    const out = await handleChatHttp(
      {
        ...post(),
        contentLength: MAX_BODY_BYTES + 1,
        readJson: async () => {
          read = true;
          return body();
        },
      },
      http,
    );
    assert.equal(out.status, 413);
    assert.equal(read, false);
  });

  it("limits by the address the platform appended, not the client's", () => {
    assert.equal(forwardedClientIp("203.0.113.7:51234"), "203.0.113.7");
    assert.equal(
      forwardedClientIp("1.2.3.4, 203.0.113.7:51234"),
      "203.0.113.7",
    );
    assert.equal(forwardedClientIp("2001:db8::1"), "2001:db8::1");
    assert.equal(forwardedClientIp(null), undefined);
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

  it("requires Turnstile unless the human check is switched off", async () => {
    const sent: string[] = [];
    const reply = (json: unknown, status = 200) =>
      (async (_url: unknown, init?: RequestInit) => {
        sent.push(String(init?.body));
        return Response.json(json, { status });
      }) as unknown as typeof fetch;
    const yes = reply({ success: true });
    // No secret: refused, unless HUMAN_CHECK=off.
    assert.deepEqual(await verifyTurnstile(undefined, "t", yes), {
      ok: false,
      reason: "no-secret",
    });
    assert.deepEqual(await verifyTurnstile(undefined, undefined, yes, false), {
      ok: true,
    });
    assert.deepEqual(await verifyTurnstile("s", undefined, yes), {
      ok: false,
      reason: "no-token",
    });
    assert.deepEqual(await verifyTurnstile("s", "t", yes), { ok: true });
    // The visitor's IP is not sent: Azure and Cloudflare can see different ones.
    assert.equal(sent.at(-1), "secret=s&response=t");
    // Cloudflare's reasons reach the caller.
    assert.deepEqual(
      await verifyTurnstile(
        "s",
        "t",
        reply({ success: false, "error-codes": ["invalid-input-response"] }),
      ),
      { ok: false, reason: "invalid-input-response" },
    );
    assert.deepEqual(await verifyTurnstile("s", "t", reply({}, 500)), {
      ok: false,
      reason: "siteverify-http-500",
    });
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    assert.deepEqual(await verifyTurnstile("s", "t", down), {
      ok: false,
      reason: "siteverify-unreachable",
    });
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
    // OpenRouter by default; without a key the model is not ready.
    assert.equal(config.model.provider, "openrouter");
    // The free endpoint: the id without ":free" is paid.
    assert.equal(config.model.name, "nvidia/nemotron-3-ultra-550b-a55b:free");
    assert.equal(healthReport(config).modelReady, false);
    assert.equal(config.requireHumanCheck, true);
    assert.equal(config.dailyRequestLimit, 20);
    const health = healthReport(config);
    assert.deepEqual(health.channels, { telegram: true, email: false });
    // Required but without a secret: the chat refuses every message.
    assert.equal(health.humanCheck, "missing");
    assert.ok(!JSON.stringify(health).includes("secret-token"));
    const base = {
      ALLOWED_ORIGINS: "https://ka-nails.pages.dev",
      FOUNDRY_RESOURCE: "kanails-ai",
      STORAGE_TABLE_ENDPOINT: "https://kanails.table.core.windows.net",
    };
    assert.equal(
      healthReport(readConfig({ ...base, TURNSTILE_SECRET: "s" })).humanCheck,
      "on",
    );
    const off = readConfig({ ...base, HUMAN_CHECK: "off" });
    assert.equal(off.requireHumanCheck, false);
    assert.equal(healthReport(off).humanCheck, "off");
    assert.equal(
      readConfig({ ...base, DAILY_REQUEST_LIMIT: "5" }).dailyRequestLimit,
      5,
    );
    assert.throws(() => readConfig({}), /ALLOWED_ORIGINS/);
    const routed = readConfig({
      ...base,
      OPENROUTER_API_KEY: "sk-or-secret",
      OPENROUTER_MODEL: "vendor/other-model",
    });
    assert.deepEqual(healthReport(routed).model, "vendor/other-model");
    assert.equal(healthReport(routed).modelReady, true);
    assert.ok(!JSON.stringify(healthReport(routed)).includes("sk-or-secret"));
    const foundry = readConfig({ ...base, MODEL_PROVIDER: "foundry" });
    assert.deepEqual(foundry.model, {
      provider: "foundry",
      name: "claude-haiku-4-5",
      resource: "kanails-ai",
    });
    assert.equal(healthReport(foundry).provider, "foundry");
    assert.throws(
      () =>
        readConfig({
          ALLOWED_ORIGINS: "https://ka-nails.pages.dev",
          STORAGE_TABLE_ENDPOINT: "https://kanails.table.core.windows.net",
          MODEL_PROVIDER: "foundry",
        }),
      /FOUNDRY_RESOURCE/,
    );
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
