# KA Nails public website

Independent salon-owned public site. Platform code belongs exclusively to
`alexeyalexandrov2026-tech/-GORGONA-Booking-Platform`.

## Development

Node 24 and npm are used, matching the established platform frontend stack.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm run format:check
npm run build
```

The build exports `out/`. Run `npm run dev` for local development.
`node tools/serve-preview.mjs` serves the export only on local loopback for tests.
It contains no booking API. Do not use that helper as a production server.

Build-time switches (all optional):

- `NEXT_PUBLIC_SITE_URL`: the public origin used for canonical links, hreflang,
  link previews and the sitemap. Default `https://ka-nails.pages.dev`.
- `NEXT_PUBLIC_SITE_INDEXING=index`: opens the site to search engines
  (`index, follow`, a sitemap link in `robots.txt`, all ten pages in
  `sitemap.xml`). Without it every page stays `noindex, nofollow`.
- `NEXT_PUBLIC_GORGONA_BOOKING_URL`: see "Booking boundary".
- `NEXT_PUBLIC_CHAT_API_URL` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: see "AI
  receptionist".

Asset tools (run by hand; their output is committed):

- `node tools/process-photos.mjs [--only=work-06,work-19]`: renders the portfolio
  photos (400 / 750 / up to 1200 px WebP) from `source-assets/photos/originals/`,
  applies the recorded crops and regenerates `lib/photo-inventory.ts`.
- `node tools/make-logo-derivatives.mjs`: logo WebP sizes, favicon, Apple and app
  icons. The original PNG is only read.
- `node tools/make-share-image.mjs`: the 1200×630 link-preview image
  `public/og/ka-nails-share.jpg`, kept under 300 KB so messengers show it.
- `node tools/sync-fonts.mjs`: copies the self-hosted fonts into `public/fonts/`.

## Studio facts

Confirmed business data (pedicure services and prices, contact channels, address,
hours, the master) lives in `content/studio-facts.json`; the format is described in
[`content/README.md`](content/README.md). The build validates it and fails on bad
data. Every block that uses it (service menu, contact channels, address and hours,
master profile, the messenger booking request and NailSalon structured data) renders
nothing until its data exists. Only owner-confirmed data goes in: so far the
master, phone/WhatsApp and the price menu; address and hours are still missing.

## Booking boundary

Set `NEXT_PUBLIC_GORGONA_BOOKING_URL` at build time to an owner-approved HTTPS
`/book/` URL on a Host registered for KA Nails in GORGONA. No visitor URL/query or
tenant identifier can change this setting. Loopback HTTP is allowed for local tests.
The site embeds the hosted platform wizard, with a full-page booking link as an
alternative. The embedded app calls its own same-origin API; no backend, API schema,
booking wizard or business rules are duplicated here.

No API cookies or customer data are read by the salon shell. The frame has a title,
restricted sandbox and no-referrer policy. No messaging protocol or client-side
confirmation is implemented. Only the platform can confirm an appointment.
If configuration is missing/invalid, the site shows an unavailable state. API
errors, races, expiry, not-live state and retries are handled by the real wizard.

## Publication state

All pages are `noindex, nofollow` until `NEXT_PUBLIC_SITE_INDEXING=index` is set.
The owner has confirmed the master, phone/WhatsApp and the price menu (3 October
2026). Address, hours, service durations, other policies and the production domain
remain unconfirmed and are not invented. The owner has confirmed the rights and
client consent for all 19 portfolio photographs (3 October 2026). The generic services page
displays the actual platform service picker only when the booking origin is
configured. Until then online booking is unavailable.

Canonical links, EN/RU alternates and link previews are in place. Before
publication, approve the studio facts and the registered booking domain, validate
the real live tenant, review mobile accessibility, and approve
hosting/TLS/CSP/asset routing. A manual screen-reader test has not been performed and
WCAG 2.2 AA conformance has not been established. Changing this site's URL setting
never makes a tenant live or bypasses GORGONA readiness.

The original PNG lives at `public/assets/ka-nails-logo.png` with SHA-256
`bb2fe1c05eb7183b8b8f55eee861b06d80256cf5349b2958e1432fa3b83fbf53`.
It is not redrawn, recolored or cropped. The acceptance suite verifies its served
bytes. The design specification and tokens are in `design/`.

## AI receptionist

The existing English and Russian chat widget uses the Cloudflare Worker in
`chat-api/`. Its public API is `POST /api/chat` and `GET /api/health`. Workers AI
answers from `content/studio-facts.json` and proposes a request after the visitor
confirms the recap. The master confirms appointment times personally.

Supabase stores a request before delivery. The database enforces the shared daily
quota and one pending or delivered request per phone number per UTC day. The API
reports a request as sent after an email or Telegram provider accepts it.
Recognized names and phone numbers stay in the Worker and are replaced with
placeholders in model prompts. Free-form messages can contain other information.

```sh
cd chat-api
npm ci
npm run typecheck
npm test
npm run build
```

### Deployment

1. Apply the SQL under `supabase/migrations/` to the dedicated KA Nails project.
   The schema is private. The four RPCs are executable by the server role only.
2. Set `SUPABASE_SECRET_KEY` and `TURNSTILE_SECRET` as Worker secrets. The matching
   Turnstile widget is in Managed mode and allows the site's hostname.
3. Enable Cloudflare Email Sending on the sender domain configured in
   `chat-api/wrangler.jsonc`. Set the studio's approved recipient as the
   `EMAIL_TO` Worker secret. To enable Telegram, configure the studio's bot
   and set `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` as Worker secrets.
4. Deploy the Worker with `npm exec -- wrangler deploy` from `chat-api/`. Check
   `/api/health`, the site's CORS preflight and the bilingual chat before
   switching the website. Verify a synthetic booking through the configured
   notification channel before relying on online requests.
5. Set `CHAT_API_URL` to the Worker origin and `TURNSTILE_SITE_KEY` to the public
   widget key in GitHub Actions variables. Deploy the existing Cloudflare Pages
   project and run its live tests. The `chat-api` workflow can deploy updates from
   `main` using the `CLOUDFLARE_WORKERS_API_TOKEN` secret.

The Worker allows 10 requests per minute per visitor at each Cloudflare location,
500 verified chat turns per UTC day and 20 booking attempts per UTC day by default.
The database stops inference when its shared quota cannot be checked. Health
reports whether bindings and channels are configured and the database is reachable.
`bookingReady` reports whether at least one channel is configured. With no
channel configured, chat answers studio questions and directs requests to
WhatsApp or a call. A live delivery check verifies the configured channel.

If both notification providers fail, the visitor is directed to WhatsApp or a
call. An unresolved `pending` row means delivery could be indeterminate. Check
the provider before retrying or updating it to avoid notifying the master twice.

### Model evaluation

`npm run evaluate` in `chat-api/` compares supported Workers AI models using
synthetic English and Russian dialogues, the studio's menu and the booking tool.
Set `KA_CF_ACCOUNT` and `KA_CF_EVAL_TOKEN` in the process environment. The tool
result is simulated for evaluation. The evaluator never contacts the studio or
stores a booking. Model and configuration changes can be rolled back to a
previous Worker version.

On November 13, 2026, the live Workers AI API returned the following results on
nine scenarios. Latencies are medians per successful API response, excluding
browser, Turnstile and database time.

| Model           | Scenarios passed | Median |
| --------------- | ---------------- | ------ |
| Gemma 4 26B A4B | 9/9              | 0.99 s |
| Qwen 3.8 27B    | 8/9              | 1.24 s |
| GPT-OSS 120B    | 6/9              | 1.46 s |

The Worker pins `@cf/google/gemma-4-26b-a4b-it`. The benchmark includes correct
prices, unpublished address handling and the booking tool in both languages.
See the [Cloudflare model page](https://developers.cloudflare.com/workers-ai/models/gemma-4-26b-a4b-it/).

## Verification

For an unconfigured export:

```sh
npm run build
npm run test:e2e -- --grep "website|unsafe|unconfigured"
```

The public site integrates with the platform wizard over HTTP. The chat Worker
uses Supabase for request storage. The site's own suite reads:

- `NEXT_PUBLIC_GORGONA_BOOKING_URL` (build time) and `KA_BOOKING_TEST_URL`: the
  hosted `/book/` wizard of a disposable booking host with a FAKE tenant;
- `KA_BOOKING_TEST_DAY`: an ISO date with open FAKE availability;
- `KA_SITE_PORT`: the loopback port this site is previewed on. The booking host must
  have approved `http://127.0.0.1:<KA_SITE_PORT>` in its embedding allowlist, or the
  browser refuses to frame the wizard.

```sh
npm run build
npm run test:e2e -- --grep-invert unconfigured
```

The platform repository owns the fixture: its tenant-site harness
(`api/tests/integration/test_tenant_site_embedding.py`, enabled with
`GBA_REQUIRE_TENANT_SITE=1` and `GBA_TENANT_SITE_DIR=<this checkout>`) seeds FAKE
tenants, approves the loopback origin, starts the real API, runs the two commands above
with those variables, then verifies the confirmed rows and tenant isolation itself. No
primary booking API is mocked. The network failure test aborts a request only to check
recovery. The harness rebuilds this site without a booking URL afterwards; the
ephemeral test origin must never be deployed.

## Deployment

Every CI run uploads the tested export as the artifact `ka-nails-out-<commit>`.

With the repository secret `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages →
Edit), every push to `main` that passes CI is deployed to the Cloudflare Pages
project `ka-nails` (https://ka-nails.pages.dev) by the `deploy` job in
`.github/workflows/ci.yml`, and the `verify-live` job then runs
`tests/deployed-cloudflare.spec.ts` against the live site.

Without the secret the `deploy` job is skipped with a notice. Publish by hand:
download the artifact of the `main` run, upload its contents in Cloudflare
(`ka-nails` → Create deployment → Production), then run the `verify-live` workflow
(Actions → verify-live → Run workflow) on `main`.

The deployed build reads repository variables (Settings → Secrets and
variables → Actions → Variables): `SITE_INDEXING=index` opens the site to search
engines, `SITE_URL` sets the public origin once the studio has its own domain, and
`CHAT_API_URL` / `TURNSTILE_SITE_KEY` switch on the AI receptionist. After changing
any of them, re-run the latest `main` run of the `ci` workflow so it is redeployed;
`verify-live` expects the settings the site was deployed with. When `SITE_URL`
changes, add the new hostname to Turnstile and its origin to the Worker's ALLOWED_ORIGINS. The live test checks that the API accepts the site's origin.
