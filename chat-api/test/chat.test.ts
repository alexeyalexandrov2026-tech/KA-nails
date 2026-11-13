import assert from "node:assert/strict";
import { describe, it } from "node:test";
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
  type RequestStore,
} from "../src/chat";
import { readConfig } from "../src/config";
import {
  BodyTooLarge,
  handleChatHttp,
  MAX_BODY_BYTES,
  type HttpDeps,
} from "../src/http";
import type {
  ModelReply,
  ModelRequest,
  TextBlock,
  ToolResult,
  ToolUse,
} from "../src/model";
import {
  DeliveryRejected,
  ownerMessage,
  telegramNotifier,
  type Notifier,
} from "../src/notify";
import { buildSystemPrompt } from "../src/prompt";
import { verifyTurnstile } from "../src/turnstile";

// Inference, Telegram, email and storage are all fakes here: the tests check
// what the receptionist sends and stores, never a real service.

const FIRST = studioFacts.services[0]!;

function message(
  content: ModelReply["content"],
  stopReason: ModelReply["stop_reason"],
): ModelReply {
  return { content, stop_reason: stopReason };
}

const text = (value: string): TextBlock => ({ type: "text", text: value });

const toolUse = (input: Record<string, unknown>): ToolUse => ({
  type: "tool_use",
  id: "toolu_1",
  name: TOOL_NAME,
  input,
});

const GOOD_INPUT = {
  service_id: FIRST.id,
  preferred_time: "weekday evenings",
  name: "Ann",
  phone: "(561) 555-0100",
  language: "en",
};

/** Test double for booking reservation and delivery persistence. */
function memoryStore(limit = 20, saved: string[] = []): RequestStore {
  const states = new Map<
    string,
    { id: string; state: "pending" | "delivered" | "failed" }
  >();
  let count = 0;
  return {
    async beginRequest(id, request) {
      const prior = states.get(request.phone)?.state;
      if (prior === "pending" || prior === "delivered") return prior;
      if (count >= limit) return "limit";
      count++;
      states.set(request.phone, { id, state: "pending" });
      saved.push(id);
      return "created";
    },
    async finishRequest(id, _date, delivery) {
      for (const booking of states.values()) {
        if (booking.id === id)
          booking.state = delivery.some((item) => item.ok)
            ? "delivered"
            : delivery.some((item) => item.error === "delivery-unknown")
              ? "pending"
              : "failed";
      }
    },
  };
}

function fakeDeps(replies: ModelReply[]) {
  const calls: ModelRequest[] = [];
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
    model: "@cf/google/gemma-4-26b-a4b-it",
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
    store: memoryStore(20, saved),
    notifiers: [notifier("telegram"), notifier("email")],
    now: () => new Date("2026-10-04T12:00:00Z"),
    newId: () => "abc12345",
    log: (message) => logs.push(message),
  };
  return { deps, calls, sent, saved, logs, notifier };
}

const PHONE = "+15615550100";
const DAY = "2026-10-04";

const lastToolResult = (params: ModelRequest) =>
  (params.messages.at(-1)!.content as ToolResult[])[0]!;

const body = (overrides: Partial<ChatRequestBody> = {}): ChatRequestBody => ({
  language: "en",
  messages: [{ role: "user", content: "Hi, how much is a classic pedicure?" }],
  requestSent: false,
  ...overrides,
});

const confirmedBody = (
  overrides: Partial<ChatRequestBody> = {},
): ChatRequestBody =>
  body({
    messages: [
      {
        role: "user",
        content: "Classic pedicure, weekday evenings.",
      },
      {
        role: "assistant",
        content: "Please provide your name and phone number.",
      },
      { role: "user", content: "My name is Ann, (561) 555-0100" },
      {
        role: "assistant",
        content: "Should I send this request to the master?",
      },
      { role: "user", content: "Yes, send the request." },
    ],
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
    const service = bookingTool(studioFacts).input_schema.properties.service_id;
    assert.ok(service && "enum" in service);
    assert.deepEqual(service.enum, [
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
    assert.match(result.errors.join(";"), /add-on is not on the menu/);
    assert.match(result.errors.join(";"), /phone is not a valid number/);
    assert.match(result.errors.join(";"), /name is missing/);
  });

  it("refuses a name or phone the model provider replaced with a placeholder", () => {
    // Some free providers mask personal data before the model sees it.
    const result = validateBookingRequest(
      { ...GOOD_INPUT, name: "[PERSON_NAME]", phone: "[PHONE]" },
      studioFacts,
    );
    assert.ok(!result.ok);
    assert.match(result.errors.join(";"), /name was hidden/);
    assert.match(result.errors.join(";"), /phone was hidden/);
    assert.ok(
      !validateBookingRequest({ ...GOOD_INPUT, name: "[ADDRESS]" }, studioFacts)
        .ok,
    );
    // Ordinary brackets in a name are fine.
    assert.ok(
      validateBookingRequest(
        { ...GOOD_INPUT, name: "Ann [Annie]" },
        studioFacts,
      ).ok,
    );
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
    assert.equal(params.model, deps.model);
    assert.equal(params.tools[0]?.name, TOOL_NAME);
    assert.deepEqual(params.tool_choice, { type: "none" });
    assert.equal(params.system, deps.system);
  });

  it("stores a confirmed request before sending it to each channel", async () => {
    const { deps, calls, sent, saved } = fakeDeps([
      message([text("Sending it now."), toolUse(GOOD_INPUT)], "tool_use"),
    ]);
    deps.notifiers = deps.notifiers.map((notifier) => ({
      ...notifier,
      send: (subject, text) => {
        assert.deepEqual(saved, ["abc12345"]);
        return notifier.send(subject, text);
      },
    }));
    const reply = await handleChat(confirmedBody(), deps);
    assert.equal(reply.requestSent, true);
    assert.equal(reply.reply, FALLBACK.sent.en);
    assert.deepEqual(
      sent.map((s) => s.channel),
      ["telegram", "email"],
    );
    assert.deepEqual(saved, ["abc12345"]);
    assert.equal(calls.length, 1);
  });

  it("uses the original contact and never asks the model to confirm delivery", async () => {
    const { deps, sent, calls } = fakeDeps([
      message(
        [
          toolUse({
            ...GOOD_INPUT,
            name: "Invented Name",
            phone: "+15615550101",
          }),
        ],
        "tool_use",
      ),
      message([text("Your appointment is booked.")], "end_turn"),
    ]);
    const reply = await handleChat(confirmedBody({ language: "ru" }), deps);
    assert.deepEqual(reply, { reply: FALLBACK.sent.ru, requestSent: true });
    assert.equal(sent.length, 2);
    assert.equal(calls.length, 1);
    assert.match(sent[0]!.text, /Ann/);
    assert.ok(!sent[0]!.text.includes("Invented"));
    assert.ok(sent[0]!.text.replace(/\D/g, "").includes("15615550100"));
  });

  it("returns validation errors to the model without sending anything", async () => {
    const { deps, calls, sent, saved } = fakeDeps([
      message([toolUse({ ...GOOD_INPUT, service_id: "unknown" })], "tool_use"),
      message([text("Could you check your phone number?")], "end_turn"),
    ]);
    const reply = await handleChat(confirmedBody(), deps);
    assert.equal(reply.requestSent, false);
    assert.equal(sent.length, 0);
    assert.equal(saved.length, 0);
    const result = (calls[1]!.messages.at(-1)!.content as ToolResult[])[0]!;
    assert.equal(result.is_error, true);
    assert.match(String(result.content), /service_id/);
  });

  it("keeps the supplied contact when a provider hides the name after a correction", async () => {
    const { deps, calls, sent } = fakeDeps([
      message(
        [toolUse({ ...GOOD_INPUT, name: "[PERSON_NAME]", phone: "[PHONE]" })],
        "tool_use",
      ),
      message(
        [text("Your request reached the master; the time is not confirmed.")],
        "end_turn",
      ),
    ]);
    const reply = await handleChat(
      body({
        messages: [
          {
            role: "user",
            content: "I'd like a classic pedicure on weekday evenings.",
          },
          {
            role: "assistant",
            content: "Please provide your name and phone number.",
          },
          { role: "user", content: "Alice +15615550100" },
          {
            role: "assistant",
            content: "Your name was hidden. Please reply with your full name.",
          },
          { role: "user", content: "Alice Example" },
          {
            role: "assistant",
            content: "Please confirm the request with those details.",
          },
          { role: "user", content: "Yes, send the request." },
        ],
      }),
      deps,
    );
    assert.equal(reply.requestSent, true);
    assert.equal(sent.length, 2);
    assert.match(sent[0]!.text, /Alice Example/);
    assert.ok(sent[0]!.text.replace(/\D/g, "").includes("15615550100"));
    const modelPayload = JSON.stringify(calls);
    assert.ok(!modelPayload.includes("Alice"));
    assert.ok(!modelPayload.includes("15615550100"));
  });

  it("shows supplied contact in confirmation without exposing it to the model", async () => {
    const { deps, calls, sent } = fakeDeps([
      message([text("Please confirm [PERSON_NAME], [PHONE].")], "end_turn"),
    ]);
    const reply = await handleChat(
      body({
        messages: [{ role: "user", content: "Alice Example +15615550100" }],
      }),
      deps,
    );
    assert.equal(reply.reply, "Please confirm Alice Example, +15615550100.");
    assert.equal(reply.requestSent, false);
    assert.equal(sent.length, 0);
    assert.ok(!JSON.stringify(calls).includes("Alice Example"));
    assert.ok(!JSON.stringify(calls).includes("15615550100"));
  });

  it("never sends a request if the visitor has not supplied contact details", async () => {
    const { deps, calls, sent, saved } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Please message the studio on WhatsApp.")], "end_turn"),
    ]);
    const reply = await handleChat(
      confirmedBody({
        messages: [
          { role: "user", content: "Classic pedicure on Friday." },
          {
            role: "assistant",
            content: "Should I send this request to the master?",
          },
          { role: "user", content: "Yes, send it." },
        ],
      }),
      deps,
    );
    assert.equal(reply.requestSent, false);
    assert.equal(sent.length, 0);
    assert.equal(saved.length, 0);
    const result = (calls[1]!.messages.at(-1)!.content as ToolResult[])[0]!;
    assert.equal(result.is_error, true);
    assert.match(String(result.content), /phone is missing/);
  });

  it("uses the visitor's language from the page, not from the model", async () => {
    const { deps, sent } = fakeDeps([
      message([toolUse({ ...GOOD_INPUT, language: "en" })], "tool_use"),
      message([text("Готово.")], "end_turn"),
    ]);
    await handleChat(confirmedBody({ language: "ru" }), deps);
    assert.match(sent[0]!.text, /Язык клиента: русский/);
  });

  it("never sends a second request in the same conversation", async () => {
    const { deps, calls, sent } = fakeDeps([
      message([text("Your request is already with Karina.")], "end_turn"),
    ]);
    const reply = await handleChat(body({ requestSent: true }), deps);
    assert.equal(reply.requestSent, true);
    assert.deepEqual(calls[0]!.tool_choice, { type: "none" });
    assert.match(calls[0]!.system, /already been sent/);
    assert.equal(sent.length, 0);
  });

  it("ignores an unsolicited tool call before the visitor confirms", async () => {
    const { deps, calls, sent, saved } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Should I send this request to the master?")], "end_turn"),
    ]);
    const reply = await handleChat(body(), deps);
    assert.equal(reply.requestSent, false);
    assert.deepEqual(calls[0]!.tool_choice, { type: "none" });
    assert.match(lastToolResult(calls[1]!).content, /Request not sent/);
    assert.equal(saved.length, 0);
    assert.equal(sent.length, 0);
  });

  it("disables submission when there is no configured delivery channel", async () => {
    const { deps, calls, saved } = fakeDeps([
      message([text("Please message the studio on WhatsApp.")], "end_turn"),
    ]);
    deps.notifiers = [];
    deps.system = buildSystemPrompt(studioFacts, false);
    const reply = await handleChat(confirmedBody(), deps);
    assert.equal(reply.requestSent, false);
    assert.deepEqual(calls[0]!.tool_choice, { type: "none" });
    assert.equal(calls[0]!.tools.length, 0);
    assert.match(calls[0]!.system, /answers studio questions only/);
    assert.doesNotMatch(calls[0]!.system, /submit_booking_request/);
    assert.deepEqual(saved, []);
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
    const reply = await handleChat(confirmedBody(), deps);
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
    deps.store.beginRequest = async () => Promise.reject(new Error("down"));
    const reply = await handleChat(confirmedBody(), deps);
    assert.equal(reply.requestSent, false);
    assert.equal(reply.reply, FALLBACK.deliveryUnknown.en);
    assert.equal(calls.length, 1);
  });

  it("does not call a stored request sent when no channel delivered it", async () => {
    for (const notifiers of [
      [
        {
          channel: "telegram",
          send: () => Promise.reject(new DeliveryRejected("down")),
        },
      ],
    ]) {
      const { deps, calls, saved, logs } = fakeDeps([
        message([toolUse(GOOD_INPUT)], "tool_use"),
        message([text("Please write on WhatsApp.")], "end_turn"),
      ]);
      deps.notifiers = notifiers;
      const reply = await handleChat(confirmedBody(), deps);
      assert.equal(reply.requestSent, false);
      // Kept on record, but the visitor is told to write or call instead.
      assert.deepEqual(saved, ["abc12345"]);
      assert.equal(calls.length, 1);
      assert.equal(reply.reply, FALLBACK.deliveryFailed.en);
      assert.deepEqual(logs, ["request not delivered"]);
      // The number is free again for a later try.
      assert.equal(
        await deps.store.beginRequest(
          "retry",
          {
            serviceId: FIRST.id,
            addOnIds: [],
            preferredTime: "weekday evenings",
            name: "Ann",
            phone: PHONE,
            notes: "",
            language: "en",
          },
          new Date(DAY),
        ),
        "created",
      );
    }
  });

  it("sends one request per phone number a day, across conversations", async () => {
    const store = memoryStore();
    const first = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Sent.")], "end_turn"),
    ]);
    first.deps.store = store;
    assert.equal(
      (await handleChat(confirmedBody(), first.deps)).requestSent,
      true,
    );

    // A new conversation (the page says nothing was sent) with the same phone.
    const second = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Karina already has your request.")], "end_turn"),
    ]);
    second.deps.store = store;
    const reply = await handleChat(confirmedBody(), second.deps);
    assert.equal(reply.requestSent, true);
    assert.equal(second.sent.length, 0);
    assert.equal(reply.reply, FALLBACK.sent.en);
    assert.equal(second.calls.length, 1);
  });

  it("stops sending requests after the daily limit", async () => {
    const { deps, calls, sent, saved } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Please write on WhatsApp.")], "end_turn"),
    ]);
    deps.store = memoryStore(0);
    const reply = await handleChat(confirmedBody(), deps);
    assert.equal(reply.requestSent, false);
    assert.equal(sent.length, 0);
    assert.equal(saved.length, 0);
    assert.equal(reply.reply, FALLBACK.deliveryFailed.en);
    assert.equal(calls.length, 1);
  });

  it("keeps an ambiguous provider failure pending across retries", async () => {
    const { deps, saved, calls } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([toolUse(GOOD_INPUT)], "tool_use"),
    ]);
    let attempts = 0;
    deps.notifiers = [
      {
        channel: "email",
        async send() {
          attempts++;
          throw new Error("timeout");
        },
      },
    ];
    const first = await handleChat(confirmedBody(), deps);
    const second = await handleChat(confirmedBody(), deps);
    assert.deepEqual(first, {
      reply: FALLBACK.deliveryUnknown.en,
      requestSent: false,
    });
    assert.deepEqual(second, first);
    assert.equal(attempts, 1);
    assert.equal(saved.length, 1);
    assert.equal(calls.length, 2);
  });

  it("does not notify anyone when the booking cannot be persisted", async () => {
    const { deps, sent, logs } = fakeDeps([
      message([toolUse(GOOD_INPUT)], "tool_use"),
      message([text("Sent.")], "end_turn"),
    ]);
    deps.store.beginRequest = () => Promise.reject(new Error("storage down"));
    const reply = await handleChat(confirmedBody(), deps);
    assert.equal(reply.requestSent, false);
    assert.equal(sent.length, 0);
    assert.deepEqual(logs, ["request not stored"]);
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
      rateLimiter: async () => ++count <= 2,
      allowMessage: async () => true,
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
    const { http } = httpDeps({ allowMessage: async () => false });
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

  it("returns 413 for a chunked body above the limit", async () => {
    const { http } = httpDeps();
    assert.equal(
      (
        await handleChatHttp(
          {
            ...post(),
            readJson: async () => {
              throw new BodyTooLarge();
            },
          },
          http,
        )
      ).status,
      413,
    );
  });

  it("stops inference when the daily cost guard is unavailable", async () => {
    const { http } = httpDeps({
      allowMessage: async () => {
        throw new Error("offline");
      },
    });
    let calls = 0;
    http.chat.createMessage = async () => {
      calls++;
      return message([], "end_turn");
    };
    const response = await handleChatHttp(post(), http);
    assert.equal(calls, 0);
    assert.deepEqual(response.body, {
      reply: FALLBACK.unavailable.en,
      requestSent: false,
      reason: "daily-limit-unavailable",
    });
  });
});

describe("outside services", () => {
  it("posts the request to the studio's Telegram chat", async () => {
    const requests: { url: string; body: string }[] = [];
    const fakeFetch = (async (url: string, init: RequestInit) => {
      requests.push({ url, body: String(init.body) });
      return Response.json({ ok: true, result: { message_id: 12 } });
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
    // Siteverify can validate the token without a visitor IP.
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

  it("validates Workers AI settings and requires a hosted Supabase origin", () => {
    const base = {
      ALLOWED_ORIGINS: "https://ka-nails.pages.dev, http://127.0.0.1:4173",
      WORKERS_AI_MODEL: "@cf/google/gemma-4-26b-a4b-it",
      SUPABASE_URL: "https://example.supabase.co",
    };
    const config = readConfig({
      ...base,
      SUPABASE_SECRET_KEY: "sb_secret_test",
      TURNSTILE_SECRET: "test",
      DAILY_REQUEST_LIMIT: "5",
    });
    assert.deepEqual(config.allowedOrigins, [
      "https://ka-nails.pages.dev",
      "http://127.0.0.1:4173",
    ]);
    assert.equal(config.model, base.WORKERS_AI_MODEL);
    assert.equal(config.dailyRequestLimit, 5);
    assert.equal(config.dailyLimit, 500);
    assert.equal(config.database?.url, base.SUPABASE_URL);
    assert.equal(
      readConfig({
        ...base,
        SUPABASE_URL: "https://example.supabase.co.evil.test",
        SUPABASE_SECRET_KEY: "test",
      }).database,
      undefined,
    );
    assert.equal(readConfig(base).turnstileSecret, undefined);
    assert.throws(
      () => readConfig({ ...base, WORKERS_AI_MODEL: "other" }),
      /WORKERS_AI_MODEL/,
    );
  });
});
