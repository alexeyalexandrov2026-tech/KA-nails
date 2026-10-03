import { getLocalizedPath, type Locale } from "./locales";
import { absoluteUrl } from "./site";
import { channelHref, pick, type StudioFacts } from "./studio-facts";

type JsonLd = Record<string, unknown>;

/**
 * schema.org NailSalon description of the studio, built only from confirmed
 * studio facts. Returns null until there is at least a phone number or a
 * structured address, so nothing unconfirmed is ever published.
 */
export function nailSalonJsonLd(
  facts: StudioFacts,
  locale: Locale,
): JsonLd | null {
  const byKind = (kind: string) =>
    facts.channels.find((channel) => channel.kind === kind);
  const phone = byKind("phone") ?? byKind("whatsapp");
  const email = byKind("email");
  const instagram = byKind("instagram");
  const postal = facts.address?.postal;
  if (!phone && !postal) return null;

  const data: JsonLd = {
    "@context": "https://schema.org",
    "@type": "NailSalon",
    "@id": absoluteUrl("/#studio"),
    name: "KA Nails",
    url: absoluteUrl(getLocalizedPath("/", locale)),
    logo: absoluteUrl("/assets/ka-nails-logo.png"),
    image: absoluteUrl("/og/ka-nails-share.jpg"),
  };
  if (phone) data.telephone = phone.value;
  if (email) data.email = email.value;
  if (instagram) data.sameAs = [channelHref(instagram)];
  if (postal) data.address = { "@type": "PostalAddress", ...postal };
  if (facts.address?.mapUrl) data.hasMap = facts.address.mapUrl;

  const hours = facts.hours.filter((row) => row.daysOfWeek && !row.closed);
  if (hours.length > 0) {
    data.openingHoursSpecification = hours.map((row) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: row.daysOfWeek!.map((day) => `https://schema.org/${day}`),
      opens: row.opens,
      closes: row.closes,
    }));
  }
  if (facts.services.length > 0) {
    data.makesOffer = facts.services.map((service) => ({
      "@type": "Offer",
      itemOffered: { "@type": "Service", name: pick(service.name, locale) },
      price: service.price.amount,
      priceCurrency: service.price.currency,
    }));
  }
  return data;
}

/** JSON for a <script type="application/ld+json">, safe to inline in HTML. */
export function serializeJsonLd(data: JsonLd): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
