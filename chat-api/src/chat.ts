import type Anthropic from "@anthropic-ai/sdk";
import type { StudioFacts } from "../../lib/studio-facts";
import {
  bookingTool,
  TOOL_NAME,
  validateBookingRequest,
  type BookingRequest,
} from "./booking-request";
import { utcDay } from "./limits";
import {
  notifyAll,
  ownerMessage,
  type Notifier,
  type NotifyResult,
} from "./notify";

// One chat turn. The browser keeps the conversation (plain text only) and
// sends it with each new message; the server holds no session. Within a
// turn the model may call the booking tool, which the server runs.

export type Language = "en" | "ru";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequestBody {
  language: Language;
  messages: ChatMessage[];
  /** True once a request was sent in this conversation (no second one). */
  requestSent: boolean;
  turnstileToken?: string;
}

export interface ChatReply {
  reply: string;
  requestSent: boolean;
  /** Why the reply is a fallback; shows in the browser's network panel. */
  reason?: string;
}

export interface RequestStore {
  saveRequest(
    id: string,
    request: BookingRequest,
    receivedAt: Date,
    delivery: NotifyResult[],
  ): Promise<void>;
}

/**
 * Shared limits on requests, so a script cannot flood the master's Telegram
 * and email: one request per phone number per UTC day and a daily total.
 */
export interface RequestGuard {
  reserve(phone: string, day: string): Promise<"ok" | "duplicate" | "limit">;
  /** Frees the phone number of a request that was not delivered. */
  release(phone: string, day: string): Promise<void>;
}

export interface ChatDeps {
  facts: StudioFacts;
  system: string;
  model: string;
  createMessage(
    params: Anthropic.MessageCreateParamsNonStreaming,
  ): Promise<Anthropic.Message>;
  store: RequestStore;
  notifiers: Notifier[];
  requestGuard: RequestGuard;
  now(): Date;
  newId(): string;
  log(message: string, details?: Record<string, unknown>): void;
}

export const LIMITS = {
  messages: 30,
  userChars: 1000,
  assistantChars: 4000,
  toolRounds: 3,
};

export const FALLBACK: Record<
  "unavailable" | "refusal" | "deliveryFailed" | "sent",
  Record<Language, string>
> = {
  unavailable: {
    en: "Sorry, the assistant is unavailable right now. Please message the studio on WhatsApp or call.",
    ru: "Извините, ассистент сейчас недоступен. Напишите студии в WhatsApp или позвоните.",
  },
  refusal: {
    en: "I can only help with KA Nails pedicure services and appointment requests.",
    ru: "Я могу помочь только с услугами педикюра KA Nails и запросом на запись.",
  },
  deliveryFailed: {
    en: "The request could not be delivered.",
    ru: "Заявку не удалось отправить.",
  },
  sent: {
    en: "Your request has been sent to the master, who will contact you to confirm the time. Nothing is booked yet.",
    ru: "Заявка отправлена мастеру: мастер свяжется с вами, чтобы подтвердить время. Запись пока не подтверждена.",
  },
};

export type ParsedBody =
  { ok: true; body: ChatRequestBody } | { ok: false; error: string };

export function parseChatBody(raw: unknown): ParsedBody {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "expected a JSON object" };
  }
  const record = raw as Record<string, unknown>;
  const language = record.language === "ru" ? "ru" : "en";
  const list = record.messages;
  if (!Array.isArray(list) || list.length === 0) {
    return { ok: false, error: "messages must be a non-empty list" };
  }
  if (list.length > LIMITS.messages) {
    return { ok: false, error: "conversation is too long" };
  }
  const messages: ChatMessage[] = [];
  for (const [i, item] of list.entries()) {
    const message = item as Record<string, unknown> | null;
    const role = i % 2 === 0 ? "user" : "assistant";
    if (
      !message ||
      message.role !== role ||
      typeof message.content !== "string"
    ) {
      return { ok: false, error: `messages[${i}] must be a ${role} message` };
    }
    const content = message.content.trim();
    const max = role === "user" ? LIMITS.userChars : LIMITS.assistantChars;
    if (content === "" || content.length > max) {
      return { ok: false, error: `messages[${i}] has an invalid length` };
    }
    messages.push({ role, content });
  }
  if (messages.at(-1)!.role !== "user") {
    return { ok: false, error: "the last message must be the visitor's" };
  }
  return {
    ok: true,
    body: {
      language,
      messages,
      requestSent: record.requestSent === true,
      turnstileToken:
        typeof record.turnstileToken === "string"
          ? record.turnstileToken
          : undefined,
    },
  };
}

function replyText(message: Anthropic.Message): string {
  return message.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/** Runs the booking tool for one tool_use block and returns its result. */
async function runBookingTool(
  block: Anthropic.ToolUseBlock,
  deps: ChatDeps,
  state: { requestSent: boolean },
  language: Language,
): Promise<Anthropic.ToolResultBlockParam> {
  const result = (content: string, isError = false) => ({
    type: "tool_result" as const,
    tool_use_id: block.id,
    content,
    ...(isError ? { is_error: true } : {}),
  });
  if (block.name !== TOOL_NAME) return result("Unknown tool.", true);
  if (state.requestSent) {
    return result(
      "A request was already sent in this conversation. Do not send another; offer WhatsApp or a call for changes.",
      true,
    );
  }
  const validation = validateBookingRequest(
    { ...(block.input as object), language },
    deps.facts,
  );
  if (!validation.ok) {
    return result(
      `Not sent. Fix with the visitor: ${validation.errors.join("; ")}.`,
      true,
    );
  }
  const { request } = validation;
  const receivedAt = deps.now();
  const day = utcDay(receivedAt);
  let reservation: "ok" | "duplicate" | "limit" = "ok";
  try {
    reservation = await deps.requestGuard.reserve(request.phone, day);
  } catch (error) {
    // The limits stop abuse; a storage hiccup must not lose a real request.
    deps.log("request limits unavailable", {
      error: String(error).slice(0, 300),
    });
  }
  if (reservation === "duplicate") {
    state.requestSent = true;
    return result(
      "A request with this phone number already reached the master today. Do not send another; tell the visitor the master will contact them, and offer WhatsApp or a call for changes.",
    );
  }
  if (reservation === "limit") {
    return result(
      "Not sent: the studio takes no more online requests today. Ask the visitor to message the studio on WhatsApp or call instead.",
      true,
    );
  }

  const id = deps.newId();
  const { subject, text } = ownerMessage(request, deps.facts, id, receivedAt);
  const delivery = await notifyAll(deps.notifiers, subject, text);
  try {
    await deps.store.saveRequest(id, request, receivedAt, delivery);
  } catch (error) {
    deps.log("request not stored", { id, error: String(error).slice(0, 300) });
  }
  // The table is a record, not an inbox: only a message the master received
  // counts as sent.
  if (!delivery.some((d) => d.ok)) {
    deps.log("request not delivered", { id, delivery });
    try {
      await deps.requestGuard.release(request.phone, day);
    } catch {
      // The visitor can still reach the studio on WhatsApp or by phone.
    }
    return result(
      `${FALLBACK.deliveryFailed.en} Ask the visitor to message the studio on WhatsApp or call instead.`,
      true,
    );
  }
  state.requestSent = true;
  return result(
    "Sent to the master. Tell the visitor the master will contact them to confirm the time; nothing is booked yet.",
  );
}

export async function handleChat(
  body: ChatRequestBody,
  deps: ChatDeps,
): Promise<ChatReply> {
  const state = { requestSent: body.requestSent };
  const messages: Anthropic.MessageParam[] = body.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  // The stable rules and facts are cached; the per-conversation note is not.
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: deps.system, cache_control: { type: "ephemeral" } },
  ];
  if (state.requestSent) {
    system.push({
      type: "text",
      text: "A request has already been sent to the master in this conversation. Do not collect or send another one.",
    });
  }

  // The tool stays defined on every call (the API refuses tool blocks in the
  // history without it); once a request is sent the model may not use it.
  const tools = [bookingTool(deps.facts)];
  // A request sent in this turn is confirmed even if a later step fails.
  const sentNow = () => state.requestSent && !body.requestSent;
  const fallback = () =>
    (sentNow() ? FALLBACK.sent : FALLBACK.unavailable)[body.language];

  for (let round = 0; round < LIMITS.toolRounds; round++) {
    let response: Anthropic.Message;
    try {
      response = await deps.createMessage({
        model: deps.model,
        max_tokens: 1024,
        system,
        tools,
        ...(state.requestSent
          ? { tool_choice: { type: "none" as const } }
          : {}),
        messages,
      });
    } catch (error) {
      if (!sentNow()) throw error;
      deps.log("reply after a sent request failed", {
        error: String(error).slice(0, 300),
      });
      return { reply: fallback(), requestSent: true };
    }

    if (response.stop_reason === "refusal") {
      return {
        reply: (sentNow() ? FALLBACK.sent : FALLBACK.refusal)[body.language],
        requestSent: state.requestSent,
      };
    }
    if (response.stop_reason !== "tool_use") {
      const reply = replyText(response);
      if (reply) return { reply, requestSent: state.requestSent };
      // A reasoning model can spend every token before it writes.
      deps.log("empty model reply", { stopReason: response.stop_reason });
      return {
        reply: fallback(),
        requestSent: state.requestSent,
        reason: `model-empty-${response.stop_reason ?? "none"}`,
      };
    }
    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      results.push(await runBookingTool(block, deps, state, body.language));
    }
    // Only text and tool calls go back: other models may add reasoning
    // blocks that a later call cannot take.
    messages.push({
      role: "assistant",
      content: response.content.filter(
        (block) => block.type === "text" || block.type === "tool_use",
      ),
    });
    messages.push({ role: "user", content: results });
  }
  return { reply: fallback(), requestSent: state.requestSent };
}
