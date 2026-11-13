import type { StudioFacts } from "../../lib/studio-facts";
import {
  bookingTool,
  TOOL_NAME,
  validateBookingRequest,
  type BookingRequest,
} from "./booking-request";
import type {
  ModelMessage,
  ModelReply,
  ModelRequest,
  TextBlock,
  ToolResult,
  ToolUse,
} from "./model";
import {
  prepareBookingContact,
  renderBookingContact,
  restoreBookingContact,
  type BookingContact,
} from "./booking-contact";
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
  depositAccess?: string;
  /** Why the reply is a fallback; shows in the browser's network panel. */
  reason?: string;
}

export interface RequestStore {
  beginRequest(
    id: string,
    request: BookingRequest,
    receivedAt: Date,
    accessHash?: string,
  ): Promise<
    "created" | "created-without-access" | "delivered" | "pending" | "limit"
  >;
  finishRequest(
    id: string,
    receivedAt: Date,
    delivery: NotifyResult[],
  ): Promise<void>;
}

export interface ChatDeps {
  facts: StudioFacts;
  system: string;
  model: string;
  createMessage(params: ModelRequest): Promise<ModelReply>;
  store: RequestStore;
  notifiers: Notifier[];
  now(): Date;
  newId(): string;
  newDepositAccess?(): Promise<{ token: string; hash: string }>;
  log(message: string, details?: Record<string, unknown>): void;
}

export const LIMITS = {
  messages: 30,
  userChars: 1000,
  assistantChars: 4000,
  toolRounds: 3,
};

export const FALLBACK: Record<
  "unavailable" | "refusal" | "deliveryFailed" | "deliveryUnknown" | "sent",
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
    en: "The request could not be delivered. Please message the studio on WhatsApp or call.",
    ru: "Заявку не удалось отправить. Напишите студии в WhatsApp или позвоните.",
  },
  deliveryUnknown: {
    en: "I couldn’t verify that the request reached the studio. Please message the studio on WhatsApp or call to check.",
    ru: "Не удалось проверить доставку заявки. Напишите студии в WhatsApp или позвоните, чтобы уточнить.",
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
    messages.push({
      role,
      content: content.replace(/(\/pay\/#)[0-9a-f]{64}\b/gi, "$1[PRIVATE]"),
    });
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

function replyText(message: ModelReply): string {
  return message.content
    .filter((block): block is TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

/** Require the visitor's affirmative reply to a recap before executing a tool. */
function hasBookingConfirmation(messages: ChatMessage[]): boolean {
  const recap = messages.at(-2);
  const answer = messages
    .at(-1)
    ?.content.trim()
    .replace(/[.!?]+$/, "");
  if (!answer || recap?.role !== "assistant") return false;
  if (
    !/(?:\bconfirm\b|should i send|is that correct|подтверд|вс[её] верно|отправить .*заявк)/iu.test(
      recap.content,
    )
  ) {
    return false;
  }
  return /^(?:yes(?:[, ]+please)?(?:[, ]+(?:do|send(?: (?:it|the request))?|that['’]s (?:right|correct)|i confirm))?|i confirm|confirmed|please send (?:it|the request)|да(?:[, ]+(?:пожалуйста|можно))?(?:[, ]+(?:подтверждаю|вс[её] верно|отправьте|отправляйте)(?: (?:е[её]|заявку))?)?|подтверждаю(?: заявку)?|вс[её] верно(?:[, ]+отправьте(?: заявку)?)?|отправьте(?: заявку)?|отправляйте)$/iu.test(
    answer,
  );
}

/** Runs the booking tool for one tool_use block and returns its result. */
async function runBookingTool(
  block: ToolUse,
  deps: ChatDeps,
  state: {
    requestSent: boolean;
    deliveryReply?: string;
    depositAccess?: string;
  },
  language: Language,
  contact: BookingContact,
  toolEnabled: boolean,
): Promise<ToolResult> {
  const result = (content: string, isError = false): ToolResult => ({
    type: "tool_result",
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
  if (!toolEnabled) {
    return result(
      "Request not sent. Recap the details and ask the visitor whether to send it to the master.",
      true,
    );
  }
  const validation = validateBookingRequest(
    { ...(restoreBookingContact(block.input, contact) as object), language },
    deps.facts,
  );
  if (!validation.ok) {
    if (validation.errors.some((error) => error.includes("was hidden"))) {
      deps.log("masked contact", { model: deps.model });
    }
    return result(
      `Not sent. Fix with the visitor: ${validation.errors.join("; ")}.`,
      true,
    );
  }
  const { request } = validation;
  const receivedAt = deps.now();
  const id = deps.newId();
  const access = await deps.newDepositAccess?.();
  let reservation: Awaited<ReturnType<RequestStore["beginRequest"]>>;
  try {
    reservation = await deps.store.beginRequest(
      id,
      request,
      receivedAt,
      access?.hash,
    );
  } catch {
    deps.log("request not stored", { id });
    state.deliveryReply = FALLBACK.deliveryUnknown[language];
    return result(
      "Not sent. Ask the visitor to message the studio on WhatsApp or call instead.",
      true,
    );
  }
  if (reservation === "delivered") {
    state.requestSent = true;
    return result(
      "A request with this phone number already reached the master today. Do not send another; tell the visitor the master will contact them, and offer WhatsApp or a call for changes.",
    );
  }
  if (reservation === "pending") {
    state.deliveryReply = FALLBACK.deliveryUnknown[language];
    return result(
      "Delivery of the earlier request is unverified. Do not send another or say it was delivered. Offer WhatsApp or a call.",
      true,
    );
  }
  if (reservation === "limit") {
    state.deliveryReply = FALLBACK.deliveryFailed[language];
    return result(
      "Not sent: the studio takes no more online requests today. Ask the visitor to message the studio on WhatsApp or call instead.",
      true,
    );
  }

  const { subject, text } = ownerMessage(request, deps.facts, id, receivedAt);
  const delivery = await notifyAll(deps.notifiers, subject, text);
  try {
    await deps.store.finishRequest(id, receivedAt, delivery);
  } catch {
    deps.log("request delivery status not stored", { id, delivery });
  }
  if (!delivery.some((d) => d.ok)) {
    deps.log("request not delivered", { id, delivery });
    state.deliveryReply = delivery.some((d) => d.error === "delivery-unknown")
      ? FALLBACK.deliveryUnknown[language]
      : FALLBACK.deliveryFailed[language];
    return result(
      `${FALLBACK.deliveryFailed.en} Ask the visitor to message the studio on WhatsApp or call instead.`,
      true,
    );
  }
  state.requestSent = true;
  state.depositAccess = reservation === "created" ? access?.token : undefined;
  return result(
    "Sent to the master. Tell the visitor the master will contact them to confirm the time; nothing is booked yet.",
  );
}

export async function handleChat(
  body: ChatRequestBody,
  deps: ChatDeps,
): Promise<ChatReply> {
  const state: {
    requestSent: boolean;
    deliveryReply?: string;
    depositAccess?: string;
  } = {
    requestSent: body.requestSent,
  };
  const canSubmit =
    deps.notifiers.length > 0 && hasBookingConfirmation(body.messages);
  const prepared = prepareBookingContact(
    body.messages,
    [...deps.facts.services, ...deps.facts.addOns].flatMap((offer) => [
      offer.name.en,
      offer.name.ru,
    ]),
  );
  const messages: ModelMessage[] = [...prepared.messages];
  const system = [deps.system];
  if (deps.newDepositAccess) {
    system.push(
      "When asked, explain that once the master agrees on the time and total, a 10% USD deposit secures the appointment after verified payment. A move agreed with the studio carries the deposit. Cancellation at least 60 minutes before the visit, or cancellation by the studio, entitles the client to a full refund. Later cancellation or a no-show forfeits the deposit. The website displays a payment link when it is ready. Never invent a link or payment status. Direct visitors to enter payment details only at PayPal or Stripe.",
    );
  }
  if (prepared.instruction) {
    system.push(prepared.instruction);
  }
  if (state.requestSent) {
    system.push(
      "A request has already been sent to the master in this conversation. Do not collect or send another one.",
    );
  }

  // The tool stays defined on every call (the API refuses tool blocks in the
  // history without it); once a request is sent the model may not use it.
  const tools = deps.notifiers.length > 0 ? [bookingTool(deps.facts)] : [];
  const fallback = () => FALLBACK.unavailable[body.language];

  for (let round = 0; round < LIMITS.toolRounds; round++) {
    const response = await deps.createMessage({
      model: deps.model,
      max_tokens: 1024,
      system: system.join("\n\n"),
      tools,
      ...(state.requestSent || !canSubmit
        ? { tool_choice: { type: "none" as const } }
        : {}),
      messages,
    });

    if (response.stop_reason === "refusal") {
      return {
        reply: FALLBACK.refusal[body.language],
        requestSent: state.requestSent,
      };
    }
    if (response.stop_reason !== "tool_use") {
      const reply = replyText(response);
      if (reply)
        return {
          reply: renderBookingContact(reply, prepared.contact),
          requestSent: state.requestSent,
        };
      // A reasoning model can spend every token before it writes.
      deps.log("empty model reply", { stopReason: response.stop_reason });
      return {
        reply: fallback(),
        requestSent: state.requestSent,
        reason: `model-empty-${response.stop_reason ?? "none"}`,
      };
    }
    if (tools.length === 0) {
      return { reply: FALLBACK.unavailable[body.language], requestSent: false };
    }
    const toolUses = response.content.filter(
      (block): block is ToolUse => block.type === "tool_use",
    );
    const results: ToolResult[] = [];
    for (const block of toolUses) {
      results.push(
        await runBookingTool(
          block,
          deps,
          state,
          body.language,
          prepared.contact,
          canSubmit,
        ),
      );
      if (state.requestSent && !body.requestSent) {
        return {
          reply: FALLBACK.sent[body.language],
          requestSent: true,
          ...(state.depositAccess
            ? { depositAccess: state.depositAccess }
            : {}),
        };
      }
      if (state.deliveryReply)
        return { reply: state.deliveryReply, requestSent: false };
    }
    messages.push({
      role: "assistant",
      content: response.content,
    });
    messages.push({ role: "user", content: results });
  }
  return { reply: fallback(), requestSent: state.requestSent };
}
