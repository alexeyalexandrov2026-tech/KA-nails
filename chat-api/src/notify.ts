import {
  channelDisplay,
  priceText,
  type StudioFacts,
} from "../../lib/studio-facts";
import type { BookingRequest } from "./booking-request";

// Requests go to the owner through every configured channel at once. A channel
// that fails does not stop the others; the request is also stored.

export interface Notifier {
  channel: string;
  send(subject: string, text: string): Promise<string | void>;
}

export interface NotifyResult {
  channel: string;
  ok: boolean;
  providerId?: string;
  error?: "provider-rejected" | "delivery-unknown";
}

export class DeliveryRejected extends Error {}

const FROM_RU = (price: string) => `от ${price}`;

/** The message Karina receives, in Russian, with the menu's own names. */
export function ownerMessage(
  request: BookingRequest,
  facts: StudioFacts,
  id: string,
  receivedAt: Date,
): { subject: string; text: string } {
  const service = facts.services.find((s) => s.id === request.serviceId);
  const addOns = request.addOnIds
    .map((addOnId) => facts.addOns.find((a) => a.id === addOnId))
    .filter((addOn) => addOn !== undefined);
  const lines = [
    "Новая заявка с сайта KA Nails",
    "",
    `Услуга: ${
      service
        ? `${service.name.ru} — ${priceText(service.price, "ru", FROM_RU)} (${service.name.en})`
        : "клиент выберет с мастером"
    }`,
  ];
  if (addOns.length > 0) {
    lines.push(
      `Дополнительно: ${addOns
        .map((a) => `${a.name.ru} ${priceText(a.price, "ru", FROM_RU)}`)
        .join(", ")}`,
    );
  }
  lines.push(
    `Когда удобно: ${request.preferredTime}`,
    `Имя: ${request.name}`,
    `Телефон: ${channelDisplay({ kind: "phone", value: request.phone })}`,
  );
  if (request.notes) lines.push(`Комментарий: ${request.notes}`);
  lines.push(
    `Язык клиента: ${request.language === "ru" ? "русский" : "английский"}`,
    "",
    `Заявка ${id}, ${receivedAt.toISOString().slice(0, 16).replace("T", " ")} UTC.`,
    "Время ещё не подтверждено: свяжитесь с клиентом.",
  );
  return {
    subject: `Заявка с сайта: ${request.name}, ${service ? service.name.ru : "услуга не выбрана"}`,
    text: lines.join("\n"),
  };
}

export async function notifyAll(
  notifiers: Notifier[],
  subject: string,
  text: string,
): Promise<NotifyResult[]> {
  const settled = await Promise.allSettled(
    notifiers.map((notifier) => notifier.send(subject, text)),
  );
  return settled.map((result, i) => {
    const channel = notifiers[i]!.channel;
    if (result.status === "fulfilled") {
      return {
        channel,
        ok: true,
        ...(result.value ? { providerId: result.value } : {}),
      };
    }
    return {
      channel,
      ok: false,
      error:
        result.reason instanceof DeliveryRejected
          ? "provider-rejected"
          : "delivery-unknown",
    };
  });
}

/** Telegram Bot API: the studio's own bot writes to the owner's chat. */
export function telegramNotifier(
  token: string,
  chatId: string,
  fetchImpl: typeof fetch = fetch,
): Notifier {
  return {
    channel: "telegram",
    async send(_subject, text) {
      const response = await fetchImpl(
        `https://api.telegram.org/bot${token}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            chat_id: chatId,
            text,
            disable_web_page_preview: true,
          }),
          redirect: "manual",
          signal: AbortSignal.timeout(8_000),
        },
      );
      if (
        response.status >= 400 &&
        response.status < 500 &&
        response.status !== 408
      )
        throw new DeliveryRejected("Telegram rejected the message");
      if (!response.ok)
        throw new Error("Telegram delivery could not be confirmed");
      const result = (await response.json()) as {
        ok?: boolean;
        result?: { message_id?: number };
      };
      if (result.ok === false)
        throw new DeliveryRejected("Telegram rejected the message");
      if (
        result.ok !== true ||
        !Number.isSafeInteger(result.result?.message_id)
      )
        throw new Error("Telegram delivery could not be confirmed");
      return String(result.result?.message_id);
    },
  };
}

/** Cloudflare Email Sending, configured for the studio's fixed destination. */
export function emailNotifier(
  sender: {
    send(message: {
      from: string;
      to: string;
      subject: string;
      text: string;
    }): Promise<{ messageId: string }>;
  },
  from: string,
  to: string,
): Notifier {
  return {
    channel: "email",
    async send(subject, text) {
      try {
        const result = await sender.send({ from, to, subject, text });
        if (!result.messageId)
          throw new Error("Email delivery could not be confirmed");
        return result.messageId;
      } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        if (typeof code === "string" && EMAIL_REJECTIONS.has(code))
          throw new DeliveryRejected("Email provider rejected the message");
        throw error;
      }
    },
  };
}

const EMAIL_REJECTIONS = new Set([
  "E_VALIDATION_ERROR",
  "E_SENDER_NOT_VERIFIED",
  "E_RECIPIENT_NOT_ALLOWED",
  "E_RECIPIENT_SUPPRESSED",
  "E_SENDER_DOMAIN_NOT_AVAILABLE",
  "E_DELIVERY_FAILED",
  "E_RATE_LIMIT_EXCEEDED",
  "E_DAILY_LIMIT_EXCEEDED",
]);
