import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Image from "next/image";
import { expect, test } from "@playwright/test";
import * as locales from "../lib/locales";
import * as facts from "../lib/studio-facts";
import {
  channelHref,
  pick,
  priceText,
  studioFacts,
  validateStudioFacts,
  type ServiceFact,
  type StudioFacts,
} from "../lib/studio-facts";
import { loadComponent } from "./support/load-component";

type FactsBlock = React.ComponentType<{
  locale: "en" | "ru";
  facts: StudioFacts;
}>;

function loadBlock(file: string, name: string): FactsBlock {
  return loadComponent<FactsBlock>(`components/facts/${file}`, name, {
    react: React,
    "next/image": { __esModule: true, default: Image },
    "../../lib/locales": locales,
    "../../lib/studio-facts": facts,
  });
}

const ServiceMenu = loadBlock("service-menu.tsx", "ServiceMenu");
const ContactChannels = loadBlock("contact-channels.tsx", "ContactChannels");
const StudioDetails = loadBlock("studio-details.tsx", "StudioDetails");
const MasterProfile = loadBlock("master-profile.tsx", "MasterProfile");

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

const EMPTY: StudioFacts = {
  services: [],
  addOns: [],
  menuNotes: [],
  channels: [],
  address: null,
  hours: [],
  master: null,
};

// Prices as text ("$75", "from $50", "+$15", "75 $") in a page's language.
const PRICE = /\d\s?(€|₽|\$|EUR|RUB|USD)|(€|₽|\$)\s?\d|от \d|from \d/i;

// FAKE data for formatting checks only. It never reaches the site.
const FAKE: StudioFacts = {
  services: [
    {
      id: "fake-classic",
      name: { en: "FAKE classic pedicure", ru: "ФЕЙК классический педикюр" },
      description: { en: "FAKE description", ru: "ФЕЙК описание" },
      durationMinutes: 90,
      price: { amount: 50, currency: "USD" },
    },
    {
      id: "fake-spa",
      name: { en: "FAKE spa pedicure", ru: "ФЕЙК спа-педикюр" },
      durationMinutes: 45,
      price: { amount: 120.5, currency: "USD", from: true },
    },
    {
      id: "fake-express",
      name: { en: "FAKE express pedicure", ru: "ФЕЙК экспресс-педикюр" },
      price: { amount: 35, currency: "USD" },
    },
  ],
  addOns: [
    {
      id: "fake-french",
      name: { en: "FAKE French gel", ru: "ФЕЙК гель-френч" },
      price: { amount: 15, currency: "USD", plus: true },
    },
    {
      id: "fake-massage",
      name: { en: "FAKE foot massage", ru: "ФЕЙК массаж стоп" },
      durationMinutes: 15,
      price: { amount: 20, currency: "USD" },
    },
  ],
  menuNotes: [{ en: "FAKE note", ru: "ФЕЙК примечание" }],
  channels: [
    { kind: "email", value: "fake@example.com" },
    { kind: "phone", value: "+13055550100", preferred: true },
    { kind: "whatsapp", value: "+13055550100" },
    { kind: "telegram", value: "fake_studio" },
    { kind: "instagram", value: "fake.studio" },
  ],
  address: {
    lines: [{ en: "FAKE 1 Example St", ru: "ФЕЙК 1 Example St" }],
    mapUrl: "https://maps.example.com/?q=fake",
  },
  hours: [
    { days: { en: "Mon–Fri", ru: "Пн–Пт" }, opens: "10:00", closes: "19:00" },
    { days: { en: "Sun", ru: "Вс" }, closed: true },
  ],
  master: {
    name: { en: "FAKE Name", ru: "ФЕЙК Имя" },
    bio: { en: "FAKE bio", ru: "ФЕЙК био" },
    photo: "/photos/fake-med.webp",
  },
};

function withFake(patch: (facts: StudioFacts) => void): unknown {
  const copy = structuredClone(FAKE);
  patch(copy);
  return copy;
}

test.describe("Studio facts", () => {
  test("published facts are exactly what the owner confirmed", () => {
    // Confirmed by the owner on 3 October 2026: the master, phone/WhatsApp and
    // the client price menu (PDF "Pedicure Collection 2026"). The menu gives
    // no durations, so none are published (only the 15-minute massage).
    // Address and hours are not confirmed yet; Telegram waits for a username.
    const menu = (list: ServiceFact[]) =>
      list.map(({ name, price, durationMinutes }) => [
        name.en,
        price.plus ? `+${price.amount}` : price.amount,
        durationMinutes ?? null,
      ]);
    expect(menu(studioFacts.services)).toEqual([
      ["Classic Pedicure", 75, null],
      ["Russian Dry Pedicure + Gel Polish", 95, null],
      ["Russian Dry Pedicure + Regular Polish", 85, null],
      ["Full Dry Pedicure + Gel Polish", 115, null],
      ["Full Dry Pedicure + Regular Polish", 100, null],
      ["Hammam Luxury Pedicure", 145, null],
      ["Hammam Luxury + Gel Polish", 160, null],
      ["Hammam Luxury + Gel French", 175, null],
    ]);
    expect(menu(studioFacts.addOns)).toEqual([
      ["French Gel", "+15", null],
      ["Hammam Spa Upgrade", "+40", null],
      ["Removal of Other Salon’s Gel", "+15", null],
      ["Heel Care Only", 40, null],
      ["Extra Foot Massage", 20, 15],
    ]);
    for (const offer of [...studioFacts.services, ...studioFacts.addOns]) {
      expect(offer.price).toMatchObject({ currency: "USD" });
      expect(offer.price.from, offer.id).toBeUndefined();
    }
    expect(studioFacts.menuNotes.map((note) => note.en)).toEqual([
      "Heel care is included only where stated.",
      "Service suitability is confirmed after a visual check of the skin and nails. If there is an open wound, visible infection or another condition that makes the service unsafe, the affected service area should not be treated.",
    ]);
    expect(studioFacts.address).toBeNull();
    expect(studioFacts.hours).toEqual([]);
    expect(studioFacts.channels).toEqual([
      { kind: "phone", value: "+15613828779" },
      { kind: "whatsapp", value: "+15613828779" },
    ]);
    expect(studioFacts.master).toMatchObject({
      name: { en: "Karina Mamedova", ru: "Карина Мамедова" },
      photo: "/photos/master/karina-mamedova.webp",
    });
  });

  test("pages show only the published facts, and prices only with the menu", async ({
    page,
    request,
  }) => {
    // Which blocks each page shows follows from which facts exist.
    const messenger = studioFacts.channels.some((c) =>
      ["whatsapp", "telegram", "email"].includes(c.kind),
    );
    const expected: Record<string, string[]> = {
      "/": studioFacts.master ? ["master"] : [],
      "/services/": studioFacts.services.length > 0 ? ["services"] : [],
      "/gallery/": [],
      "/contact/": [
        ...(studioFacts.address || studioFacts.hours.length > 0
          ? ["details"]
          : []),
        ...(studioFacts.channels.length > 0 ? ["channels"] : []),
      ],
      "/book/": [
        ...(messenger ? ["request"] : []),
        ...(studioFacts.channels.length > 0 ? ["channels"] : []),
      ],
    };
    const published = studioFacts.channels.map(channelHref);
    const whatsapp = studioFacts.channels
      .filter((c) => c.kind === "whatsapp")
      .map(channelHref);

    for (const url of ROUTES) {
      await page.goto(url);
      const blocks = await page
        .locator("main [data-facts]")
        .evaluateAll((els) => els.map((el) => el.getAttribute("data-facts")));
      expect(blocks, url).toEqual(expected[url.replace(/^\/ru\//, "/")]);

      // Every contact link on the page is one the owner published (WhatsApp
      // links may carry a prepared message).
      const hrefs = await page
        .locator(
          'a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"], a[href*="t.me/"], a[href*="instagram.com"]',
        )
        .evaluateAll((els) => els.map((el) => el.getAttribute("href")!));
      for (const href of hrefs) {
        const known =
          published.includes(href) ||
          whatsapp.some((base) => href.startsWith(`${base}?text=`));
        expect(known, `${url} links to ${href}`).toBe(true);
      }

      // Prices appear only in the menu and in the /book/ service choice; the
      // next test checks they are exactly the published ones.
      const path = url.replace(/^\/ru\//, "/");
      if (
        studioFacts.services.length === 0 ||
        !["/services/", "/book/"].includes(path)
      ) {
        const text = await page.locator("main").innerText();
        expect(text, `${url} shows no prices`).not.toMatch(PRICE);
      }
    }

    // The master's portrait is served from the site itself.
    if (studioFacts.master?.photo) {
      const photo = await request.get(studioFacts.master.photo);
      expect(photo.status()).toBe(200);
      expect(photo.headers()["content-type"]).toContain("image/webp");
    }
  });

  test("the menu and the /book/ service choice show exactly the published prices", async ({
    page,
  }) => {
    for (const locale of ["en", "ru"] as const) {
      const prefix = locale === "ru" ? "/ru" : "";
      const dict = locales.getDictionary(locale).facts;
      const row = (offer: ServiceFact) =>
        `${pick(offer.name, locale)} ${priceText(offer.price, locale, dict.priceFrom)}`;

      await page.goto(`${prefix}/services/`);
      const menu = page.locator('[data-facts="services"]');
      const shown = (items: string, name: string, price: string) =>
        menu
          .locator(items)
          .evaluateAll(
            (els, { name, price }) =>
              els.map(
                (el) =>
                  `${el.querySelector(name)!.textContent} ${el.querySelector(price)!.textContent}`,
              ),
            { name, price },
          );
      expect(
        await shown(
          ".service-menu-item",
          ".service-menu-name",
          ".service-menu-price",
        ),
      ).toEqual(studioFacts.services.map(row));
      expect(
        await shown(
          ".service-addon",
          ".service-addon-name",
          ".service-addon-price",
        ),
      ).toEqual(studioFacts.addOns.map(row));
      await expect(menu.locator(".service-menu-notes p")).toHaveText(
        studioFacts.menuNotes.map((note) => pick(note, locale)),
      );

      // The request form offers the same services at the same prices.
      if (studioFacts.services.length > 0) {
        await page.goto(`${prefix}/book/`);
        const options = await page
          .locator('[data-facts="request"] select')
          .first()
          .locator("option")
          .allTextContents();
        expect(
          options.slice(1).map((text) => text.replace(" — ", " ")),
        ).toEqual(studioFacts.services.map(row));
      }
    }
  });

  test("the services lead and description promise only what the menu shows", async ({
    page,
  }) => {
    const hasMenu = studioFacts.services.length > 0;
    const hasDurations = studioFacts.services.some(
      (service) => service.durationMinutes !== undefined,
    );
    for (const url of ["/services/", "/ru/services/"]) {
      await page.goto(url);
      const lead = page.locator("main .lead");
      const description = page.locator('meta[name="description"]');
      if (hasMenu) {
        await expect(lead).toContainText(/listed below|указаны ниже/);
        await expect(description).toHaveAttribute("content", /prices|цены/);
        await expect(description).not.toHaveAttribute(
          "content",
          /will be published|будут опубликованы/,
        );
      } else {
        await expect(lead).not.toContainText(
          /shown in the studio|указаны ниже|listed below/i,
        );
      }
      if (!hasDurations) {
        await expect(lead).not.toContainText(/duration|продолжительн/i);
      }
    }
  });

  test("the validator accepts complete data", () => {
    expect(validateStudioFacts(FAKE)).toEqual(FAKE);
  });

  test("the validator rejects invalid data", () => {
    const cases: [string, unknown, RegExp][] = [
      [
        "empty Russian text",
        withFake((f) => (f.services[0]!.name.ru = " ")),
        /services\[0\]\.name\.ru: text is empty/,
      ],
      [
        "an offer other than pedicure",
        withFake((f) => (f.services[1]!.name.en = "FAKE manicure")),
        /pedicure only/,
      ],
      [
        "a Russian offer other than pedicure",
        withFake((f) => (f.master!.bio.ru = "Маникюр и педикюр")),
        /master\.bio\.ru: the studio offers pedicure only/,
      ],
      [
        "a duplicate service id",
        withFake((f) => (f.services[1]!.id = "fake-classic")),
        /duplicate id/,
      ],
      [
        "a negative price",
        withFake((f) => (f.services[0]!.price.amount = -5)),
        /price\.amount/,
      ],
      [
        "an unknown currency",
        withFake(
          (f) =>
            ((f.services[0]!.price as { currency: string }).currency = "BTC"),
        ),
        /price\.currency/,
      ],
      [
        "a duration that is not whole minutes",
        withFake((f) => (f.services[0]!.durationMinutes = 7.5)),
        /durationMinutes/,
      ],
      [
        "an add-on with an invalid duration",
        withFake((f) => (f.addOns[1]!.durationMinutes = 5)),
        /addOns\[1\]\.durationMinutes/,
      ],
      [
        "a service priced as an add-on",
        withFake((f) => (f.services[0]!.price.plus = true)),
        /services\[0\]\.price\.plus: only add-ons/,
      ],
      [
        "an add-on price that is both 'from' and 'plus'",
        withFake((f) => (f.addOns[0]!.price.from = true)),
        /addOns\[0\]\.price: "from" or "plus"/,
      ],
      [
        "an add-on id that repeats a service id",
        withFake((f) => (f.addOns[0]!.id = "fake-classic")),
        /addOns\[0\]\.id: duplicate id/,
      ],
      [
        "an add-on other than pedicure",
        withFake((f) => (f.addOns[0]!.name.en = "FAKE manicure add-on")),
        /addOns\[0\]\.name\.en: the studio offers pedicure only/,
      ],
      [
        "a missing add-on list",
        withFake((f) => delete (f as Partial<StudioFacts>).addOns),
        /addOns: expected an array/,
      ],
      [
        "an empty menu note",
        withFake((f) => (f.menuNotes[0]!.ru = "")),
        /menuNotes\[0\]\.ru: text is empty/,
      ],
      [
        "a phone number not in E.164",
        withFake((f) => (f.channels[1]!.value = "(305) 555-0100")),
        /channels\[1\]\.value: phone number in E\.164/,
      ],
      [
        "an Instagram link instead of a handle",
        withFake(
          (f) => (f.channels[4]!.value = "https://instagram.com/fake.studio"),
        ),
        /channels\[4\]\.value: account name/,
      ],
      [
        "a non-https map link",
        withFake((f) => (f.address!.mapUrl = "http://maps.example.com/")),
        /address\.mapUrl: https link/,
      ],
      [
        "opening after closing",
        withFake((f) => (f.hours[0]!.opens = "20:00")),
        /hours\[0\]: opens\/closes/,
      ],
      [
        "a portrait from another site",
        withFake((f) => (f.master!.photo = "https://example.com/me.jpg")),
        /master\.photo/,
      ],
    ];
    for (const [name, data, message] of cases) {
      expect(() => validateStudioFacts(data), name).toThrow(message);
    }
  });

  test("blocks render nothing for empty facts", () => {
    for (const locale of ["en", "ru"] as const) {
      for (const Block of [
        ServiceMenu,
        ContactChannels,
        StudioDetails,
        MasterProfile,
      ]) {
        expect(
          renderToStaticMarkup(
            React.createElement(Block, { locale, facts: EMPTY }),
          ),
        ).toBe("");
      }
      // Add-ons and notes belong to a menu: without services, nothing shows.
      const extrasOnly = {
        ...EMPTY,
        addOns: FAKE.addOns,
        menuNotes: FAKE.menuNotes,
      };
      expect(
        renderToStaticMarkup(
          React.createElement(ServiceMenu, { locale, facts: extrasOnly }),
        ),
      ).toBe("");
    }
  });

  test("blocks format FAKE facts in both languages", () => {
    const render = (Block: FactsBlock, locale: "en" | "ru") =>
      renderToStaticMarkup(React.createElement(Block, { locale, facts: FAKE }));

    const menuEn = render(ServiceMenu, "en");
    expect(menuEn).toContain('data-facts="services"');
    expect(menuEn).toContain("FAKE classic pedicure");
    expect(menuEn).toContain("$50<");
    expect(menuEn).toContain("from $120.50");
    expect(menuEn).toContain("1 h 30 min");
    expect(menuEn).toContain("45 min");
    // A service without a confirmed duration shows only its price.
    expect(menuEn.match(/<dt>Duration<\/dt>/g)).toHaveLength(2);
    expect(menuEn.match(/<dt>Price<\/dt>/g)).toHaveLength(3);
    expect(menuEn).toContain("$35<");
    // A menu without any durations reads like a printed one: name and price,
    // with the "Price" label kept for screen readers.
    const noDurations = withFake((f) =>
      f.services.forEach((service) => delete service.durationMinutes),
    ) as StudioFacts;
    const priceOnly = renderToStaticMarkup(
      React.createElement(ServiceMenu, { locale: "en", facts: noDurations }),
    );
    expect(priceOnly).toContain("service-menu-price-only");
    expect(priceOnly).not.toContain("Duration");
    expect(priceOnly.match(/<dt class="sr-only">Price<\/dt>/g)).toHaveLength(3);
    // Add-ons: "+" only where the price is added to a pedicure.
    expect(menuEn).toContain(">Add-ons</h3>");
    expect(menuEn).toContain(">+$15<");
    expect(menuEn).toContain(">$20<");
    expect(menuEn).toContain(">15 min<");
    expect(menuEn).toContain(">Please note</h3>");
    expect(menuEn).toContain("<p>FAKE note</p>");
    const menuRu = render(ServiceMenu, "ru");
    expect(menuRu).toContain("ФЕЙК классический педикюр");
    expect(menuRu).toMatch(/от 120,50\s\$/);
    expect(menuRu).toContain("1 ч 30 мин");
    expect(menuRu).toMatch(/>\+15\s\$</);
    expect(menuRu).toContain(">Дополнительные услуги</h3>");
    expect(menuRu).toContain("<p>ФЕЙК примечание</p>");

    const channels = render(ContactChannels, "en");
    expect(channels).toContain('href="tel:+13055550100"');
    expect(channels).toContain('href="https://wa.me/13055550100"');
    expect(channels).toContain('href="https://t.me/fake_studio"');
    expect(channels).toContain('href="https://www.instagram.com/fake.studio/"');
    expect(channels).toContain('href="mailto:fake@example.com"');
    expect(channels).toContain("@fake.studio");
    expect(channels).toContain("+1 (305) 555-0100");
    // The preferred channel comes first.
    expect(channels.indexOf("tel:")).toBeLessThan(channels.indexOf("mailto:"));
    // External links open safely in a new tab; tel:/mailto: do not.
    expect(channels).toMatch(
      /href="https:\/\/wa\.me\/13055550100" target="_blank" rel="noopener noreferrer"/,
    );
    expect(channels).not.toMatch(/href="tel:[^"]*" target=/);

    const details = render(StudioDetails, "ru");
    expect(details).toContain("<address");
    expect(details).toContain("ФЕЙК 1 Example St");
    expect(details).toContain("Выходной");
    expect(details).toContain('href="https://maps.example.com/?q=fake"');
    expect(details).not.toContain("<iframe");

    const master = render(MasterProfile, "en");
    expect(master).toContain("FAKE Name");
    expect(master).toContain('alt="FAKE Name, KA Nails pedicure master"');

    for (const html of [menuEn, menuRu, channels, details, master]) {
      expect(html).not.toMatch(/manicur|маникюр/i);
    }
  });
});
