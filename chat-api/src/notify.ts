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
  send(subject: string, text: string): Promise<void>;
}

export interface NotifyResult {
  channel: string;
  ok: boolean;
  error?: string;
}

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
  return settled.map((result, i) => ({
    channel: notifiers[i]!.channel,
    ok: result.status === "fulfilled",
    ...(result.status === "rejected"
      ? { error: String(result.reason).slice(0, 200) }
      : {}),
  }));
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
        },
      );
      if (!response.ok) {
        throw new Error(`telegram responded ${response.status}`);
      }
    },
  };
}
