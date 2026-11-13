import { normalizePhone } from "./booking-request";
import type { ChatMessage } from "./chat";

// Contact belongs to this request's visitor history, not to the model. Keep
// recognized originals here and send only placeholders to the model. This is
// narrow booking-contact handling, not a general-purpose PII detector.
export const CONTACT_NAME = "[PERSON_NAME]";
export const CONTACT_PHONE = "[PHONE]";

export interface BookingContact {
  name?: string;
  phone?: string;
}

const PHONE = /(?<![\p{L}\p{N}])\+?\(?\d[\d() .-]{5,24}\d\)?(?![\p{L}\p{N}])/gu;
const NAME =
  /^[\p{L}\p{M}][\p{L}\p{M}'’.-]*(?:\s+[\p{L}\p{M}][\p{L}\p{M}'’.-]*){0,5}$/u;
const NAME_PREFIX =
  /^(?:my\s+(?:full\s+)?name\s+is|name\s*:|меня\s+зовут|мо[её]\s+имя\s*:?)\s*/iu;
const NAME_QUESTION =
  /(?:what(?:['’]s|\s+is)\s+your\s+(?:full\s+|first\s+)?name|(?:provide|share|enter|tell\s+me|let\s+me\s+know|reply\s+with|give\s+me)\s+(?:your\s+)?(?:full\s+|first\s+)?name|как\s+вас\s+зовут|(?:укажите|напишите|сообщите|назовите)\s+(?:пожалуйста[,\s]+)?(?:ваше\s+)?(?:полное\s+)?имя)/iu;
const PHONE_INTRO =
  /^(?:(?:my\s+)?(?:phone|telephone|mobile|tel)(?:\s+number)?(?:\s+is)?|(?:мой\s+)?(?:телефон|номер(?:\s+телефона)?)|(?:you\s+can\s+)?(?:call|reach|contact|text)\s+me\s+(?:at|on))$/iu;
const PHONE_PREFIX =
  /^(?:(?:my\s+)?(?:phone|telephone|mobile|tel)(?:\s+number)?(?:\s+is)?|(?:мой\s+)?(?:телефон|номер(?:\s+телефона)?))(?:\s*:\s*|\s+)/iu;
const PHONE_QUESTION =
  /(?:what(?:['’]s|\s+is)\s+your\s+(?:phone|telephone|mobile)|(?:provide|share|enter|tell\s+me|let\s+me\s+know|reply\s+with|give\s+me)\s+(?:your\s+)?(?:phone|telephone|mobile)|(?:укажите|напишите|сообщите)\s+(?:ваш\s+)?(?:телефон|номер))/iu;
const NOT_NAME =
  /^(?:yes|no|ok|okay|thanks|thank\s+you|please|call|text|cancel|actually|book|request|don['’]?t|do\s+not|да|нет|спасибо|пожалуйста|позвоните|отмена|запишите|заявка|хочу|не)(?![\p{L}\p{M}])/iu;

function nameValue(
  raw: string,
  excludedNames: readonly string[],
): string | undefined {
  const value = raw.trim().replace(NAME_PREFIX, "").replace(/\s+/g, " ").trim();
  return value.length <= 100 &&
    NAME.test(value) &&
    !NOT_NAME.test(value) &&
    !excludedNames.some(
      (name) => name.toLocaleLowerCase() === value.toLocaleLowerCase(),
    )
    ? value
    : undefined;
}

export function prepareBookingContact(
  history: ChatMessage[],
  excludedNames: readonly string[] = [],
): {
  contact: BookingContact;
  messages: ChatMessage[];
  instruction?: string;
} {
  const contact: BookingContact = {};
  const names = new Set<string>();
  for (let i = 0; i < history.length; i++) {
    const message = history[i]!;
    if (message.role !== "user") continue;
    const found = [...message.content.matchAll(PHONE)].filter((match) =>
      normalizePhone(match[0]),
    );
    // Do not mix one person's name with another person's number.
    if (found.length > 1) {
      delete contact.name;
      delete contact.phone;
      continue;
    }
    let candidate: string | undefined;
    const nameRequested =
      history[i - 1]?.role === "assistant" &&
      NAME_QUESTION.test(history[i - 1]!.content);
    const phoneRequested =
      history[i - 1]?.role === "assistant" &&
      PHONE_QUESTION.test(history[i - 1]!.content);
    if (
      found.length === 0 &&
      (PHONE_PREFIX.test(message.content) ||
        (phoneRequested && /^[+()\d .-]+$/.test(message.content)))
    ) {
      // An explicit correction supersedes the old value even if invalid.
      delete contact.phone;
    }
    if (found.length === 1) {
      const rawWithoutPhone = message.content
        .replace(found[0]![0], "")
        .trim()
        .replace(/[,;:]\s*$/, "")
        .trim();
      const phoneOnly =
        rawWithoutPhone === "" || PHONE_INTRO.test(rawWithoutPhone);
      const withoutPhone = rawWithoutPhone
        .replace(
          /(?:[,;]\s*)?(?:phone|telephone|tel|телефон|номер)\s*:?\s*$/iu,
          "",
        )
        .trim();
      if (!phoneOnly) candidate = nameValue(withoutPhone, excludedNames);
      if (
        candidate &&
        !nameRequested &&
        !NAME_PREFIX.test(withoutPhone) &&
        !candidate.split(/\s+/).every((word) => /^\p{Lu}/u.test(word))
      ) {
        candidate = undefined;
      }
      if (phoneOnly || candidate) {
        contact.phone = normalizePhone(found[0]![0])!;
      } else {
        // Free-form sentences may refer to another person. Do not attach the
        // number to a previous contact or infer a name from sentence text.
        delete contact.name;
        delete contact.phone;
      }
    } else if (NAME_PREFIX.test(message.content) || nameRequested) {
      candidate = nameValue(message.content, excludedNames);
    }
    if (candidate) {
      contact.name = candidate;
      names.add(candidate);
    } else if (NAME_PREFIX.test(message.content)) {
      delete contact.name;
    }
  }
  // Replace old names as well as the latest correction, including echoes in
  // assistant messages. Phones are redacted even if no name was recognized.
  const patterns = [...names]
    .sort((a, b) => b.length - a.length)
    .map(
      (name) =>
        new RegExp(
          `(?<![\\p{L}\\p{M}])${name
            .split(/\s+/)
            .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("\\s+")}(?![\\p{L}\\p{M}])`,
          "giu",
        ),
    );
  const messages = history.map((message) => {
    let content = message.content;
    for (const pattern of patterns)
      content = content.replace(pattern, CONTACT_NAME);
    content = content.replace(PHONE, (value) =>
      normalizePhone(value) ? CONTACT_PHONE : value,
    );
    return { ...message, content };
  });
  const supplied = [
    contact.name ? CONTACT_NAME : undefined,
    contact.phone ? CONTACT_PHONE : undefined,
  ]
    .filter(Boolean)
    .join(" and ");
  return {
    contact,
    messages,
    ...(supplied
      ? {
          instruction:
            `Booking contact data is stored locally on this server. The visitor already supplied ${supplied}. ` +
            "These placeholders are valid values for the booking tool's name and phone fields, not missing or hidden data. " +
            "Use the exact placeholders in tool arguments and never ask the visitor to repeat a supplied field. " +
            "Ask for a contact field only if its placeholder is not listed as supplied here. " +
            "Still collect service and preferred time and ask for confirmation before submitting.",
        }
      : {}),
  };
}

export function restoreBookingContact(
  input: unknown,
  contact: BookingContact,
): unknown {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const restored = { ...(input as Record<string, unknown>) };
  // A model may copy a different phone from the studio menu or invent one.
  // Only recognized visitor messages can supply the contact on a booking.
  restored.name = contact.name;
  restored.phone = contact.phone;
  return restored;
}

/** Render contact only to this visitor; never include it in model history. */
export function renderBookingContact(
  text: string,
  contact: BookingContact,
): string {
  return text
    .replaceAll(CONTACT_NAME, contact.name ?? CONTACT_NAME)
    .replaceAll(CONTACT_PHONE, contact.phone ?? CONTACT_PHONE);
}
