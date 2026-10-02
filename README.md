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

All pages are `noindex, nofollow`. Address, contact, hours, staff, prices, durations,
policies, photographs and production domain remain unconfirmed and are not invented.
The generic services page displays the actual platform service picker only when
the booking origin is configured. Until then online booking is unavailable.

Before publication, approve those facts and the registered booking domain, validate
the real live tenant, add verified business metadata/canonicals, review photography
rights and mobile accessibility, and approve hosting/TLS/CSP/asset routing. Changing
this site's URL setting never makes a tenant live or bypasses GORGONA readiness.

The original PNG lives at `public/assets/ka-nails-logo.png` with SHA-256
`bb2fe1c05eb7183b8b8f55eee861b06d80256cf5349b2958e1432fa3b83fbf53`.
It is not redrawn, recolored or cropped. The acceptance suite verifies its served
bytes. The design specification and tokens are in `design/`.

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

Every push to `main` that passes CI is deployed to the Cloudflare Pages project
`ka-nails` (https://ka-nails.pages.dev) by the `deploy` job in
`.github/workflows/ci.yml`, and the `verify-live` job then runs
`tests/deployed-cloudflare.spec.ts` against the live site. The job needs two
repository secrets: `CLOUDFLARE_API_TOKEN` (Account → Cloudflare Pages → Edit) and
`CLOUDFLARE_ACCOUNT_ID`.
