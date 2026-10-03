import { getLocalizedPath, type Locale } from "./locales";
import { absoluteUrl } from "./site";
import { orderedChannels, type ContactChannel } from "./studio-facts";

// Booking requests through the studio's own messengers: the site only builds
// a ready-to-send message and a link; nothing is stored or sent by the site.

export interface BookingLook {
  id: string;
  title: string;
}

export interface BookingDraft {
  looks?: BookingLook[];
  preferredTime?: string;
  name?: string;
  notes?: string;
}

const COPY: Record<
  Locale,
  {
    subject: string;
    greeting: string;
    looks: string;
    time: string;
    name: string;
    notes: string;
  }
> = {
  en: {
    subject: "Pedicure appointment request",
    greeting: "Hello, KA Nails! I would like to book a pedicure.",
    looks: "Look from your portfolio",
    time: "Preferred days and time",
    name: "Name",
    notes: "Notes",
  },
  ru: {
    subject: "Запрос записи на педикюр",
    greeting: "Здравствуйте, KA Nails! Хочу записаться на педикюр.",
    looks: "Образ из портфолио",
    time: "Удобные дни и время",
    name: "Имя",
    notes: "Комментарий",
  },
};

export function bookingSubject(locale: Locale): string {
  return COPY[locale].subject;
}

/** Plain-text message in the visitor's language. Empty fields are left out. */
export function bookingMessage(locale: Locale, draft: BookingDraft): string {
  const copy = COPY[locale];
  const gallery = getLocalizedPath("/gallery/", locale);
  const lines = [copy.greeting];
  if (draft.looks && draft.looks.length > 0) {
    lines.push("", `${copy.looks}:`);
    for (const look of draft.looks) {
      lines.push(`• ${look.title} — ${absoluteUrl(`${gallery}#${look.id}`)}`);
    }
  }
  const details: [string, string | undefined][] = [
    [copy.time, draft.preferredTime],
    [copy.name, draft.name],
    [copy.notes, draft.notes],
  ];
  const filled = details.filter(([, value]) => value && value.trim() !== "");
  if (filled.length > 0) lines.push("");
  for (const [label, value] of filled) lines.push(`${label}: ${value!.trim()}`);
  return lines.join("\n");
}

export type RequestKind = "whatsapp" | "telegram" | "email";

export interface RequestLink {
  kind: RequestKind;
  href: string;
  /** Telegram cannot prefill a chat: the message is copied before opening. */
  copyFirst: boolean;
}

/**
 * Links that open the visitor's messenger with the request, for the
 * channels the studio has published (preferred channel first).
 */
export function requestLinks(
  channels: ContactChannel[],
  subject: string,
  text: string,
): RequestLink[] {
  const links: RequestLink[] = [];
  for (const channel of orderedChannels(channels)) {
    if (channel.kind === "whatsapp") {
      links.push({
        kind: "whatsapp",
        href: `https://wa.me/${channel.value.slice(1)}?text=${encodeURIComponent(text)}`,
        copyFirst: false,
      });
    } else if (channel.kind === "telegram") {
      links.push({
        kind: "telegram",
        href: `https://t.me/${channel.value}`,
        copyFirst: true,
      });
    } else if (channel.kind === "email") {
      links.push({
        kind: "email",
        href: `mailto:${channel.value}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`,
        copyFirst: false,
      });
    }
  }
  return links;
}

/** WhatsApp link for a single look (lightbox, style picker), if published. */
export function whatsappLookLink(
  channels: ContactChannel[],
  locale: Locale,
  looks: BookingLook[],
): string | null {
  const link = requestLinks(
    channels.filter((channel) => channel.kind === "whatsapp"),
    bookingSubject(locale),
    bookingMessage(locale, { looks }),
  )[0];
  return link ? link.href : null;
}
