# Studio facts

`studio-facts.json` holds the studio's confirmed business facts: the pedicure
menu (services, add-ons and notes, with prices), contact channels, address,
opening hours and the master's profile. Only data the owner has confirmed goes
in; nothing is shown on the site for a part that is still empty. Every block
appears by itself once its data is filled in.

What each part turns on:

- `services`: the menu on the services page (a duration is shown only when
  `durationMinutes` is given) and the service choice in the /book/ request
  form. `addOns` and `menuNotes` are listed under the menu; an add-on price
  with `"plus": true` reads "+$15" (added to a pedicure's price).
- `channels` with WhatsApp, Telegram or email: the appointment request form
  on /book/ (and a link to it on the services page), "Book this look on
  WhatsApp" in the photo viewer and "Send these looks" in the style finder.
  The site only prepares the message; visitors send it from their own app.
- `address.postal`: the schema.org `NailSalon` description for search
  engines (Google requires the address), with the phone from `channels`,
  hours that have `daysOfWeek`, and services with prices.
- `master.photo`: put the original in `source-assets/master/` and run
  `node tools/make-master-photo.mjs`; it writes
  `public/photos/master/<name>.webp`, the path to use here.
- `address`, `hours`, `master`: the matching blocks on the contact and home
  pages.

The build validates this file (`lib/studio-facts.ts`) and fails on missing
EN/RU text, phone numbers not in E.164 format, invalid handles, non-https
links, invalid prices or durations, "+" prices outside add-ons, duplicate ids,
or any service that is not pedicure.

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
  "addOns": [
    {
      "id": "french-gel",
      "name": { "en": "French gel", "ru": "Гель-френч" },
      "price": { "amount": 15, "currency": "USD", "plus": true }
    }
  ],
  "menuNotes": [{ "en": "…", "ru": "…" }],
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
