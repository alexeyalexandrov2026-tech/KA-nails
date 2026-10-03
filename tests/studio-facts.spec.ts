import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Image from "next/image";
import { expect, test } from "@playwright/test";
import * as locales from "../lib/locales";
import * as facts from "../lib/studio-facts";
import {
  studioFacts,
  validateStudioFacts,
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
  ],
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
  test("published facts are empty until the owner confirms them", () => {
    expect(studioFacts).toEqual({
      services: [],
      channels: [],
      address: null,
      hours: [],
      master: null,
    });
  });

  test("no facts, contacts or prices appear on any page while empty", async ({
    page,
  }) => {
    for (const url of ROUTES) {
      await page.goto(url);
      const main = page.locator("main");
      await expect(main.locator("[data-facts]"), url).toHaveCount(0);
      await expect(
        main.locator(
          'a[href^="tel:"], a[href^="mailto:"], a[href*="wa.me"], a[href*="t.me/"], a[href*="instagram.com"]',
        ),
        url,
      ).toHaveCount(0);
      const text = await main.innerText();
      expect(text, `${url} shows no prices`).not.toMatch(
        /\d\s?(€|₽|\$|EUR|RUB|USD)|(€|₽|\$)\s?\d|от \d|from \d/i,
      );
    }
  });

  test("the services lead does not promise prices while there are none", async ({
    page,
  }) => {
    for (const url of ["/services/", "/ru/services/"]) {
      await page.goto(url);
      await expect(page.locator("main .lead")).not.toContainText(
        /shown in the studio|указаны ниже|listed below/i,
      );
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
            React.createElement(Block, { locale, facts: studioFacts }),
          ),
        ).toBe("");
      }
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
    const menuRu = render(ServiceMenu, "ru");
    expect(menuRu).toContain("ФЕЙК классический педикюр");
    expect(menuRu).toMatch(/от 120,50\s\$/);
    expect(menuRu).toContain("1 ч 30 мин");

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
