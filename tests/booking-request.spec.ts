import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "@playwright/test";
import * as locales from "../lib/locales";
import * as facts from "../lib/studio-facts";
import * as galleryData from "../lib/gallery-data";
import * as bookingLib from "../lib/booking-message";
import {
  bookingMessage,
  requestLinks,
  whatsappLookLink,
} from "../lib/booking-message";
import { nailSalonJsonLd, serializeJsonLd } from "../lib/structured-data";
import {
  channelHref,
  pick,
  priceText,
  studioFacts,
  validateStudioFacts,
  type StudioFacts,
} from "../lib/studio-facts";
import { loadComponent } from "./support/load-component";

const BookingRequest = loadComponent<
  React.ComponentType<{ locale: "en" | "ru"; facts: StudioFacts }>
>("components/facts/booking-request.tsx", "BookingRequest", {
  react: React,
  "../../lib/locales": locales,
  "../../lib/studio-facts": facts,
  "../../lib/gallery-data": galleryData,
  "../../lib/booking-message": bookingLib,
});

const EMPTY: StudioFacts = {
  services: [],
  addOns: [],
  menuNotes: [],
  channels: [],
  address: null,
  hours: [],
  master: null,
};

// The studio's published WhatsApp link, if any.
const PUBLISHED_WHATSAPP = studioFacts.channels
  .filter((channel) => channel.kind === "whatsapp")
  .map(channelHref)[0];

// FAKE data for checks only. It never reaches the site.
const FAKE: StudioFacts = {
  services: [
    {
      id: "fake-spa",
      name: { en: "FAKE spa pedicure", ru: "ФЕЙК спа-педикюр" },
      durationMinutes: 60,
      price: { amount: 80, currency: "USD" },
    },
  ],
  addOns: [],
  menuNotes: [],
  channels: [
    { kind: "email", value: "fake@example.com" },
    { kind: "whatsapp", value: "+13055550100", preferred: true },
    { kind: "telegram", value: "fake_studio" },
    { kind: "instagram", value: "fake.studio" },
    { kind: "phone", value: "+13055550100" },
  ],
  address: {
    lines: [{ en: "FAKE 1 Example St", ru: "ФЕЙК 1 Example St" }],
    mapUrl: "https://maps.example.com/?q=fake",
    postal: {
      streetAddress: "FAKE 1 Example St",
      addressLocality: "Example City",
      addressRegion: "FL",
      postalCode: "00000",
      addressCountry: "US",
    },
  },
  hours: [
    {
      days: { en: "Mon–Fri", ru: "Пн–Пт" },
      daysOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      opens: "10:00",
      closes: "19:00",
    },
    { days: { en: "Sun", ru: "Вс" }, closed: true },
  ],
  master: null,
};

const ROUTES = [
  "/",
  "/services/",
  "/gallery/",
  "/contact/",
  "/book/",
  "/ru/",
  "/ru/services/",
  "/ru/gallery/",
  "/ru/contact/",
  "/ru/book/",
];

test.describe("Messenger booking requests and structured data", () => {
  test("structured data waits for a confirmed address; messenger links reach only the studio", async ({
    page,
  }) => {
    const jsonLd = nailSalonJsonLd(studioFacts, "en");
    // Google requires an address for a local business, so without one nothing
    // is described to search engines.
    if (!studioFacts.address?.postal) expect(jsonLd).toBeNull();
    for (const url of ROUTES) {
      await page.goto(url);
      await expect(
        page.locator('script[type="application/ld+json"]'),
        url,
      ).toHaveCount(jsonLd ? 1 : 0);
      const whatsapp = await page
        .locator('a[href*="wa.me"]')
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")!));
      for (const href of whatsapp) {
        expect(PUBLISHED_WHATSAPP, `${url} has a WhatsApp link`).toBeTruthy();
        expect(href.split("?")[0], url).toBe(PUBLISHED_WHATSAPP);
      }
    }
    if (PUBLISHED_WHATSAPP) {
      // The appointment request on /book/ prepares a WhatsApp message.
      await page.goto("/book/");
      await expect(
        page.locator('[data-facts="request"] a[href*="wa.me"]'),
      ).toHaveAttribute(
        "href",
        `${PUBLISHED_WHATSAPP}?text=Hello%2C%20KA%20Nails!%20I%20would%20like%20to%20book%20a%20pedicure.`,
      );
    }
  });

  test("the validator accepts structured address and machine-readable days", () => {
    expect(validateStudioFacts(FAKE)).toEqual(FAKE);
    const badCountry = structuredClone(FAKE);
    badCountry.address!.postal!.addressCountry = "USA";
    expect(() => validateStudioFacts(badCountry)).toThrow(/addressCountry/);
    const badDays = structuredClone(FAKE) as unknown as {
      hours: { daysOfWeek: string[] }[];
    };
    badDays.hours[0]!.daysOfWeek = ["Mon"];
    expect(() => validateStudioFacts(badDays)).toThrow(/daysOfWeek/);
  });

  test("the booking message is composed in the visitor's language", () => {
    const en = bookingMessage("en", {
      looks: [{ id: "work-03", title: "Pastel Lilac Bliss" }],
      preferredTime: " weekday evenings ",
      name: "Ann",
      notes: "",
    });
    expect(en).toBe(
      [
        "Hello, KA Nails! I would like to book a pedicure.",
        "",
        "Look from your portfolio:",
        "• Pastel Lilac Bliss — https://ka-nails.pages.dev/gallery/#work-03",
        "",
        "Preferred days and time: weekday evenings",
        "Name: Ann",
      ].join("\n"),
    );
    const ru = bookingMessage("ru", {
      looks: [{ id: "work-03", title: "Pastel Lilac Bliss" }],
    });
    expect(ru).toContain("Здравствуйте, KA Nails! Хочу записаться на педикюр.");
    expect(ru).toContain("https://ka-nails.pages.dev/ru/gallery/#work-03");
    expect(bookingMessage("ru", {})).toBe(
      "Здравствуйте, KA Nails! Хочу записаться на педикюр.",
    );
    // A service chosen from the menu comes right after the greeting.
    const withService = bookingMessage("en", {
      service: "Classic Pedicure — $75",
      looks: [{ id: "work-03", title: "Pastel Lilac Bliss" }],
    });
    expect(withService.split("\n").slice(0, 4)).toEqual([
      "Hello, KA Nails! I would like to book a pedicure.",
      "",
      "Service: Classic Pedicure — $75",
      "",
    ]);
    expect(bookingMessage("ru", { service: "Классический педикюр" })).toBe(
      "Здравствуйте, KA Nails! Хочу записаться на педикюр.\n\nУслуга: Классический педикюр",
    );
    for (const text of [en, ru]) expect(text).not.toMatch(/manicur|маникюр/i);
  });

  test("a service chosen on /book/ goes into the prepared message", async ({
    page,
  }) => {
    const service = studioFacts.services.at(-1);
    if (!PUBLISHED_WHATSAPP || !service) return;
    for (const locale of ["en", "ru"] as const) {
      await page.goto(locale === "ru" ? "/ru/book/" : "/book/");
      const form = page.locator('[data-facts="request"]');
      const label = locales.getDictionary(locale).bookingRequest.serviceLabel;
      await form.getByLabel(label).selectOption(service.id);
      const href = await form.locator('a[href*="wa.me"]').getAttribute("href");
      const text = new URL(href!).searchParams.get("text")!;
      const price = priceText(
        service.price,
        locale,
        locales.getDictionary(locale).facts.priceFrom,
      );
      expect(text.split("\n")[2]).toBe(
        `${locale === "ru" ? "Услуга" : "Service"}: ${pick(service.name, locale)} — ${price}`,
      );
    }
  });

  test("the services page offers the request form while online booking is off", async ({
    page,
  }) => {
    const canRequest = requestLinks(studioFacts.channels, "", "").length > 0;
    for (const [url, href] of [
      ["/services/", "/book/"],
      ["/ru/services/", "/ru/book/"],
    ] as const) {
      await page.goto(url);
      const link = page.locator(".notice .notice-action a");
      if (canRequest) {
        await expect(link).toHaveAttribute("href", href);
        await link.click();
        await expect(page).toHaveURL(new RegExp(`${href}$`));
        await expect(page.locator('[data-facts="request"]')).toBeVisible();
      } else {
        await expect(link).toHaveCount(0);
      }
    }
    // The request form follows the notice on /book/ itself.
    await page.goto("/book/");
    await expect(page.locator(".notice .notice-action")).toHaveCount(0);
  });

  test("request links open the studio's own messengers, preferred first", () => {
    const links = requestLinks(FAKE.channels, "Subject & more", "Hi there");
    expect(links.map((link) => link.kind)).toEqual([
      "whatsapp",
      "email",
      "telegram",
    ]);
    expect(links[0]!.href).toBe("https://wa.me/13055550100?text=Hi%20there");
    expect(links[1]!.href).toBe(
      "mailto:fake@example.com?subject=Subject%20%26%20more&body=Hi%20there",
    );
    expect(links[2]).toEqual({
      kind: "telegram",
      href: "https://t.me/fake_studio",
      copyFirst: true,
    });
    expect(requestLinks(EMPTY.channels, "s", "t")).toEqual([]);
    expect(
      whatsappLookLink(EMPTY.channels, "en", [{ id: "work-01", title: "x" }]),
    ).toBeNull();
    expect(
      whatsappLookLink(FAKE.channels, "en", [
        { id: "work-01", title: "Bordeaux Luxury Editorial" },
      ]),
    ).toMatch(/^https:\/\/wa\.me\/13055550100\?text=.*Bordeaux/);
  });

  test("the request form renders only when a messenger is published", () => {
    for (const locale of ["en", "ru"] as const) {
      expect(
        renderToStaticMarkup(
          React.createElement(BookingRequest, { locale, facts: EMPTY }),
        ),
      ).toBe("");
    }
    const html = renderToStaticMarkup(
      React.createElement(BookingRequest, { locale: "en", facts: FAKE }),
    );
    expect(html).toContain('data-facts="request"');
    expect(html).toContain("Request an appointment");
    // Every field has a visible label.
    expect(html.match(/<label/g)?.length).toBe(5);
    expect(html).toContain('href="https://wa.me/13055550100?text=Hello');
    expect(html).toContain('href="mailto:fake@example.com?subject=');
    expect(html).toContain("Copy and open Telegram");
    // The published services with their prices, then the 19 looks.
    expect(html).toContain(">FAKE spa pedicure — $80</option>");
    expect(html.match(/<option/g)?.length).toBe(2 + 20);
    expect(html).not.toMatch(/manicur|маникюр/i);
    // Without a published menu there is no service choice.
    const noMenu = renderToStaticMarkup(
      React.createElement(BookingRequest, {
        locale: "en",
        facts: { ...FAKE, services: [] },
      }),
    );
    expect(noMenu.match(/<label/g)?.length).toBe(4);
    expect(noMenu.match(/<option/g)?.length).toBe(20);
  });

  test("structured data describes the studio from confirmed facts only", () => {
    const data = nailSalonJsonLd(FAKE, "en")!;
    expect(data).toMatchObject({
      "@context": "https://schema.org",
      "@type": "NailSalon",
      name: "KA Nails",
      url: "https://ka-nails.pages.dev/",
      telephone: "+13055550100",
      email: "fake@example.com",
      sameAs: ["https://www.instagram.com/fake.studio/"],
      address: {
        "@type": "PostalAddress",
        addressRegion: "FL",
        addressCountry: "US",
      },
      openingHoursSpecification: [
        {
          "@type": "OpeningHoursSpecification",
          dayOfWeek: [
            "https://schema.org/Monday",
            "https://schema.org/Tuesday",
            "https://schema.org/Wednesday",
            "https://schema.org/Thursday",
            "https://schema.org/Friday",
          ],
          opens: "10:00",
          closes: "19:00",
        },
      ],
      makesOffer: [
        {
          "@type": "Offer",
          itemOffered: { "@type": "Service", name: "FAKE spa pedicure" },
          price: 80,
          priceCurrency: "USD",
        },
      ],
    });
    expect(nailSalonJsonLd(FAKE, "ru")!.url).toBe(
      "https://ka-nails.pages.dev/ru/",
    );
    // Without a structured address nothing is published, even with a phone:
    // Google requires the address for a local business.
    expect(
      nailSalonJsonLd({ ...FAKE, channels: [], address: null }, "en"),
    ).toBeNull();
    expect(nailSalonJsonLd({ ...FAKE, address: null }, "en")).toBeNull();
    expect(nailSalonJsonLd({ ...FAKE, channels: [] }, "en")).not.toHaveProperty(
      "telephone",
    );
    expect(serializeJsonLd({ name: "</script><b>" })).toBe(
      '{"name":"\\u003c/script>\\u003cb>"}',
    );
  });
});
