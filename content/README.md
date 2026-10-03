# Studio facts

`studio-facts.json` holds the studio's confirmed business facts: pedicure
services with prices and durations, contact channels, address, opening hours
and the master's profile. It is empty on purpose: nothing is shown on the site
until the owner confirms the data. Every block appears by itself once its data
is filled in.

What each part turns on:

- `channels` with WhatsApp, Telegram or email: the appointment request form
  on /book/, "Book this look on WhatsApp" in the photo viewer and "Send these
  looks" in the style finder. The site only prepares the message; visitors
  send it from their own app.
- `address.postal`: the schema.org `NailSalon` description for search
  engines (Google requires the address), with the phone from `channels`,
  hours that have `daysOfWeek`, and services with prices.
- `master.photo`: put the original in `source-assets/master/` and run
  `node tools/make-master-photo.mjs`; it writes
  `public/photos/master/<name>.webp`, the path to use here.
- `address`, `hours`, `services`, `master`: the matching blocks on the
  contact, services and home pages.

The build validates this file (`lib/studio-facts.ts`) and fails on missing
EN/RU text, phone numbers not in E.164 format, invalid handles, non-https
links, invalid prices or durations, duplicate ids, or any service that is not
pedicure.

Example of a filled file (illustrative values only — never publish them):

```json
{
  "services": [
    {
      "id": "classic-pedicure",
      "name": { "en": "Classic pedicure", "ru": "Классический педикюр" },
      "description": { "en": "…", "ru": "…" },
      "durationMinutes": 60,
      "price": { "amount": 50, "currency": "USD", "from": false }
    }
  ],
  "channels": [
    { "kind": "phone", "value": "+13055550100", "preferred": true },
    { "kind": "whatsapp", "value": "+13055550100" },
    { "kind": "telegram", "value": "ka_nails_example" },
    { "kind": "instagram", "value": "ka.nails.example" },
    { "kind": "email", "value": "hello@example.com" }
  ],
  "address": {
    "lines": [
      { "en": "100 Example St, Suite 1", "ru": "100 Example St, офис 1" }
    ],
    "mapUrl": "https://maps.google.com/?q=…",
    "postal": {
      "streetAddress": "100 Example St, Suite 1",
      "addressLocality": "Example City",
      "addressRegion": "FL",
      "postalCode": "00000",
      "addressCountry": "US"
    }
  },
  "hours": [
    {
      "days": { "en": "Mon–Fri", "ru": "Пн–Пт" },
      "daysOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      "opens": "10:00",
      "closes": "19:00"
    },
    { "days": { "en": "Sun", "ru": "Вс" }, "closed": true }
  ],
  "master": {
    "name": { "en": "…", "ru": "…" },
    "bio": { "en": "…", "ru": "…" },
    "photo": "/photos/master/….webp"
  }
}
```
