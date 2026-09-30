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

Real integration requires the existing canonical platform checkout, its built
`web/out`, PostgreSQL 18 and the platform Python environment. Supply
`GORGONA_API_DIR` (the platform `api/` directory), `GBA_TEST_ADMIN_DSN` securely
through the environment, and `GBA_REQUIRE_POSTGRES=1`. Run with that Python environment:

```sh
python -m pytest /path/to/ka-nails/tools/test_gorgona_integration.py -q -s
```

The adapter imports the platform fixtures, creates a disposable test database,
starts the real API, builds the independent site with a loopback booking origin,
runs desktop/mobile Chromium, verifies confirmed booking rows and tenant isolation,
then stops the API and removes only the disposable database. No primary booking
API is mocked. The network failure test aborts a request only to check recovery.
After that test, rebuild with the actual approved setting (or no setting for the
unpublished candidate); the ephemeral test origin must never be deployed.

No push, Cloudflare deployment, DNS or production database change has been made.
