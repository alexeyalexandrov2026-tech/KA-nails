import rawFacts from "../content/studio-facts.json";
import type { Locale } from "./locales/types";

// Confirmed business facts of the studio. The JSON file is empty until the
// owner confirms the data; every block that reads it renders nothing while its
// part is empty. The shape matches the future GORGONA admin export.

export interface Bilingual {
  en: string;
  ru: string;
}

export type Currency = "USD" | "EUR" | "RUB";

export interface Price {
  amount: number;
  currency: Currency;
  /** Shown as "from $50" when the final price depends on the visit. */
  from?: boolean;
}

export interface ServiceFact {
  id: string;
  name: Bilingual;
  description?: Bilingual;
  durationMinutes: number;
  price: Price;
}

export type ChannelKind =
  "phone" | "whatsapp" | "telegram" | "instagram" | "email";

export interface ContactChannel {
  kind: ChannelKind;
  value: string;
  preferred?: boolean;
}

/** Structured address for search engines (schema.org PostalAddress). */
export interface PostalAddress {
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2, e.g. "US". */
  addressCountry: string;
}

export interface StudioAddress {
  lines: Bilingual[];
  mapUrl?: string;
  postal?: PostalAddress;
}

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export type DayOfWeek = (typeof DAYS_OF_WEEK)[number];

export interface OpeningHours {
  days: Bilingual;
  /** Machine-readable days for search engines; `days` is what people read. */
  daysOfWeek?: DayOfWeek[];
  opens?: string;
  closes?: string;
  closed?: boolean;
}

export interface MasterFact {
  name: Bilingual;
  bio: Bilingual;
  photo?: string;
}

export interface StudioFacts {
  services: ServiceFact[];
  channels: ContactChannel[];
  address: StudioAddress | null;
  hours: OpeningHours[];
  master: MasterFact | null;
}

const CHANNEL_KINDS: ChannelKind[] = [
  "phone",
  "whatsapp",
  "telegram",
  "instagram",
  "email",
];
const CURRENCIES: Currency[] = ["USD", "EUR", "RUB"];
const E164 = /^\+[1-9]\d{6,14}$/;
const TELEGRAM_HANDLE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;
const INSTAGRAM_HANDLE = /^(?!.*\.\.)(?!\.)(?!.*\.$)[A-Za-z0-9._]{1,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LOCAL_IMAGE = /^\/(?:photos|assets)\/[\w./-]+\.(?:webp|jpe?g|png|avif)$/;
// The studio offers pedicure only.
const OFF_OFFER = /manicur|маникюр/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Checks the raw facts and returns them typed, or throws with every problem
 * listed. It runs when the site is built, so invalid data fails the build
 * instead of being published.
 */
export function validateStudioFacts(raw: unknown): StudioFacts {
  const problems: string[] = [];

  const text = (value: unknown, where: string, optional = false) => {
    if (value === undefined && optional) return;
    if (!isRecord(value)) {
      problems.push(`${where}: expected { en, ru }`);
      return;
    }
    for (const lang of ["en", "ru"] as const) {
      const entry = value[lang];
      if (typeof entry !== "string" || entry.trim() === "") {
        problems.push(`${where}.${lang}: text is empty`);
      } else if (OFF_OFFER.test(entry)) {
        problems.push(`${where}.${lang}: the studio offers pedicure only`);
      }
    }
  };

  if (!isRecord(raw)) {
    throw new Error("studio-facts.json: expected an object");
  }

  const { services, channels, address, hours, master } = raw;

  if (!Array.isArray(services)) {
    problems.push("services: expected an array");
  } else {
    const ids = new Set<string>();
    services.forEach((service, i) => {
      const where = `services[${i}]`;
      if (!isRecord(service)) {
        problems.push(`${where}: expected an object`);
        return;
      }
      if (typeof service.id !== "string" || !ID.test(service.id)) {
        problems.push(`${where}.id: use lowercase-words-with-dashes`);
      } else if (ids.has(service.id)) {
        problems.push(`${where}.id: duplicate id "${service.id}"`);
      } else {
        ids.add(service.id);
      }
      text(service.name, `${where}.name`);
      text(service.description, `${where}.description`, true);
      const minutes = service.durationMinutes;
      if (
        typeof minutes !== "number" ||
        !Number.isInteger(minutes) ||
        minutes < 10 ||
        minutes > 480
      ) {
        problems.push(`${where}.durationMinutes: whole minutes, 10–480`);
      }
      const price = service.price;
      if (!isRecord(price)) {
        problems.push(`${where}.price: expected { amount, currency }`);
      } else {
        if (
          typeof price.amount !== "number" ||
          !Number.isFinite(price.amount) ||
          price.amount <= 0 ||
          Math.round(price.amount * 100) !== price.amount * 100
        ) {
          problems.push(`${where}.price.amount: positive, at most 2 decimals`);
        }
        if (!CURRENCIES.includes(price.currency as Currency)) {
          problems.push(`${where}.price.currency: one of ${CURRENCIES}`);
        }
        if (price.from !== undefined && typeof price.from !== "boolean") {
          problems.push(`${where}.price.from: true or false`);
        }
      }
    });
  }

  if (!Array.isArray(channels)) {
    problems.push("channels: expected an array");
  } else {
    const seen = new Set<string>();
    channels.forEach((channel, i) => {
      const where = `channels[${i}]`;
      if (!isRecord(channel)) {
        problems.push(`${where}: expected an object`);
        return;
      }
      const { kind, value } = channel;
      if (!CHANNEL_KINDS.includes(kind as ChannelKind)) {
        problems.push(`${where}.kind: one of ${CHANNEL_KINDS}`);
        return;
      }
      const valid =
        typeof value === "string" &&
        (kind === "phone" || kind === "whatsapp"
          ? E164.test(value)
          : kind === "telegram"
            ? TELEGRAM_HANDLE.test(value)
            : kind === "instagram"
              ? INSTAGRAM_HANDLE.test(value)
              : EMAIL.test(value));
      if (!valid) {
        problems.push(
          `${where}.value: ${
            kind === "phone" || kind === "whatsapp"
              ? "phone number in E.164 format, e.g. +13055550100"
              : kind === "email"
                ? "email address"
                : "account name without @ or link"
          }`,
        );
      }
      const key = `${kind}:${String(value)}`;
      if (seen.has(key)) problems.push(`${where}: duplicate channel`);
      seen.add(key);
      if (
        channel.preferred !== undefined &&
        typeof channel.preferred !== "boolean"
      ) {
        problems.push(`${where}.preferred: true or false`);
      }
    });
  }

  if (address !== null) {
    if (!isRecord(address) || !Array.isArray(address.lines)) {
      problems.push("address: expected { lines: [...] } or null");
    } else {
      if (address.lines.length === 0) {
        problems.push("address.lines: at least one line");
      }
      address.lines.forEach((line, i) => text(line, `address.lines[${i}]`));
      if (address.mapUrl !== undefined && !isHttpsUrl(address.mapUrl)) {
        problems.push("address.mapUrl: https link");
      }
      if (address.postal !== undefined) {
        const postal = address.postal;
        if (!isRecord(postal)) {
          problems.push("address.postal: expected an object");
        } else {
          for (const field of [
            "streetAddress",
            "addressLocality",
            "addressRegion",
            "postalCode",
          ] as const) {
            const value = postal[field];
            if (typeof value !== "string" || value.trim() === "") {
              problems.push(`address.postal.${field}: text is empty`);
            }
          }
          if (
            typeof postal.addressCountry !== "string" ||
            !/^[A-Z]{2}$/.test(postal.addressCountry)
          ) {
            problems.push(
              'address.postal.addressCountry: two letters, e.g. "US"',
            );
          }
        }
      }
    }
  }

  if (!Array.isArray(hours)) {
    problems.push("hours: expected an array");
  } else {
    hours.forEach((row, i) => {
      const where = `hours[${i}]`;
      if (!isRecord(row)) {
        problems.push(`${where}: expected an object`);
        return;
      }
      text(row.days, `${where}.days`);
      if (row.daysOfWeek !== undefined) {
        const days = row.daysOfWeek;
        if (
          !Array.isArray(days) ||
          days.length === 0 ||
          days.some((day) => !DAYS_OF_WEEK.includes(day as DayOfWeek)) ||
          new Set(days).size !== days.length
        ) {
          problems.push(
            `${where}.daysOfWeek: distinct English day names, e.g. ["Monday"]`,
          );
        }
      }
      if (row.closed === true) {
        if (row.opens !== undefined || row.closes !== undefined) {
          problems.push(`${where}: a closed day has no opening time`);
        }
      } else if (
        typeof row.opens !== "string" ||
        typeof row.closes !== "string" ||
        !TIME.test(row.opens) ||
        !TIME.test(row.closes) ||
        row.opens >= row.closes
      ) {
        problems.push(`${where}: opens/closes as HH:MM, opens before closes`);
      }
    });
  }

  if (master !== null) {
    if (!isRecord(master)) {
      problems.push("master: expected an object or null");
    } else {
      text(master.name, "master.name");
      text(master.bio, "master.bio");
      if (
        master.photo !== undefined &&
        (typeof master.photo !== "string" || !LOCAL_IMAGE.test(master.photo))
      ) {
        problems.push("master.photo: a site image path such as /photos/…");
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `studio-facts.json is invalid:\n- ${problems.join("\n- ")}`,
    );
  }
  return raw as unknown as StudioFacts;
}

export const studioFacts: StudioFacts = validateStudioFacts(rawFacts);

export function pick(text: Bilingual, locale: Locale): string {
  return text[locale];
}

const INTL_LOCALE: Record<Locale, string> = { en: "en-US", ru: "ru-RU" };

export function formatPrice(price: Price, locale: Locale): string {
  const whole = Number.isInteger(price.amount);
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: price.currency,
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  }).format(price.amount);
}

export function formatDuration(minutes: number, locale: Locale): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const [h, m] = locale === "ru" ? ["ч", "мин"] : ["h", "min"];
  if (hours === 0) return `${rest} ${m}`;
  return rest === 0 ? `${hours} ${h}` : `${hours} ${h} ${rest} ${m}`;
}

export function channelHref(channel: ContactChannel): string {
  switch (channel.kind) {
    case "phone":
      return `tel:${channel.value}`;
    case "whatsapp":
      return `https://wa.me/${channel.value.slice(1)}`;
    case "telegram":
      return `https://t.me/${channel.value}`;
    case "instagram":
      return `https://www.instagram.com/${channel.value}/`;
    case "email":
      return `mailto:${channel.value}`;
  }
}

export function channelDisplay(channel: ContactChannel): string {
  if (channel.kind === "telegram" || channel.kind === "instagram") {
    return `@${channel.value}`;
  }
  if (channel.kind === "phone" || channel.kind === "whatsapp") {
    // North American numbers in their familiar form; others stay E.164.
    const nanp = /^\+1(\d{3})(\d{3})(\d{4})$/.exec(channel.value);
    if (nanp) return `+1 (${nanp[1]}) ${nanp[2]}-${nanp[3]}`;
  }
  return channel.value;
}

/** Preferred channels first, otherwise in the order the owner listed them. */
export function orderedChannels(channels: ContactChannel[]): ContactChannel[] {
  return [...channels].sort(
    (a, b) => Number(b.preferred === true) - Number(a.preferred === true),
  );
}
