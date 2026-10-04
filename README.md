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

A chat button on every page opens the studio's AI receptionist. It answers
questions about the pedicure menu, prices and the master in English or Russian,
and collects a booking request (service, preferred time, name, phone). The request
goes to the master by Telegram and email and is stored in Azure Table Storage. The
receptionist never confirms an appointment: the master confirms the time personally.
It knows only `content/studio-facts.json`, the same data the site shows.

- `chat-api/`: an Azure Functions app (Node 22, TypeScript) with `POST /api/chat`
  and `GET /api/health`. The model runs on OpenRouter through its
  Anthropic-compatible Messages endpoint; it is the free NVIDIA Nemotron 3 Ultra
  (`nvidia/nemotron-3-ultra-550b-a55b`) unless the app setting
  `OPENROUTER_MODEL` names another model with tool calling. Free OpenRouter
  models are rate-limited (20 requests a minute, 50 a day until $10 of credits
  is bought, then 1,000), and free providers may log or train on prompts, which
  include visitors' names and phone numbers: check the account's privacy
  settings. `MODEL_PROVIDER=foundry` switches to Claude Haiku 4.5 in Microsoft
  Foundry with the app's managed identity, once the subscription has Claude
  quota. Secrets (the OpenRouter key, Telegram, the Cloudflare Turnstile key)
  live in Key Vault. Limits: 20 messages per visitor
  per 10 minutes, 500 per day for the whole site, 30 messages and 1,000
  characters per message; 20 booking requests a day and one per phone number
  a day. CORS admits only the site's origins (`ALLOWED_ORIGINS`). The
  Cloudflare Turnstile human check is required: without its secret the API
  refuses every message, unless the app setting `HUMAN_CHECK` is `off` (not
  recommended). A request counts as sent only once Telegram or email has
  delivered it; otherwise the visitor is asked to write on WhatsApp or call.
- `components/chat/chat-widget.tsx`: the widget. It is built in only when
  `NEXT_PUBLIC_CHAT_API_URL` is an https origin (loopback http for tests); without
  it there is no button and the site works as before. When a message fails, the
  widget offers WhatsApp.
- `infra/azure/chat.bicep` and `infra/azure/setup-chat.sh`: the Azure resources
  (resource group `rg-kanails-chat`, region `eastus2`) and a one-time setup script
  for Azure Cloud Shell. Claude in Foundry (`MODEL_PROVIDER=foundry bash
setup-chat.sh`) needs a pay-as-you-go subscription with Claude quota, which
  can be 0 even then.

```sh
cd chat-api && npm ci && npm run typecheck && npm test && npm run build
```

Setup, once:

1. In Telegram, create the studio bot with @BotFather and send it `/start` from
   the master's account.
2. In Azure Cloud Shell (shell.azure.com): `git clone` this repository, then
   `bash KA-nails/infra/azure/setup-chat.sh`. It first asks for the studio
   email, the website address(es) the chat answers, the OpenRouter model and
   API key (openrouter.ai → Settings → Keys), the bot token (Enter skips
   Telegram; you confirm the chat that pressed Start) and the Turnstile secret, and checks each key with its service;
   then it creates everything, stores the keys and prints the values for
   GitHub. On a re-run every answer defaults to the last one and Enter keeps a
   saved key.
3. Create the Cloudflare Turnstile widget first (Cloudflare dashboard →
   Turnstile → Add widget, Managed mode, the site's hostnames). Invisible mode
   would need a privacy policy that references Cloudflare's Turnstile Privacy
   Addendum, which the site does not have yet. Its secret goes into Key Vault
   (`turnstile-secret`, asked for by the script; restart the Function App after
   changing it) and its site key into the variable `TURNSTILE_SITE_KEY`.
4. Add the values as repository variables (`AZURE_CLIENT_ID`,
   `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID`, `CHAT_FUNCTION_APP`,
   `CHAT_API_URL`, `TURNSTILE_SITE_KEY`), run Actions → chat-api → Run
   workflow, then re-run the latest `main` run of `ci` so the site shows the
   button.

The `chat-api` workflow tests every change to `chat-api/` and, on `main`,
deploys it with GitHub's OIDC login; until the variables exist it only reports
that deployment is skipped. CI runs the site's browser tests twice: without the
chat and with it pointed at a local fake (Turnstile is faked too, under
Cloudflare's always-pass test site key).

## Verification

For an unconfigured export:

```sh
npm run build
npm run test:e2e -- --grep "website|unsafe|unconfigured"
```

Real integration uses only public configuration and HTTP/browser behaviour. This
repository never imports platform code or connects to a database. The site's own
suite reads:

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

The deployed build reads two repository variables (Settings → Secrets and
variables → Actions → Variables): `SITE_INDEXING=index` opens the site to search
engines, `SITE_URL` sets the public origin once the studio has its own domain, and
`CHAT_API_URL` / `TURNSTILE_SITE_KEY` switch on the AI receptionist. After changing
any of them, re-run the latest `main` run of the `ci` workflow so it is redeployed;
`verify-live` expects the settings the site was deployed with. When `SITE_URL`
changes, add the new origin (and its www form) to the chat Function App's
`ALLOWED_ORIGINS` setting too (re-run `infra/azure/setup-chat.sh` or edit the
app setting), or the chat refuses visitors on the new domain; `verify-live`
checks that the chat API admits the site's origin.
