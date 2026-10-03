# KA Nails public site — notes for Claude

This file is the project's memory. It is loaded at the start of every session and
survives because it is committed (cloud containers are wiped after each session).
The human-facing detail lives in [`README.md`](README.md); read it for booking,
verification and deployment specifics.

## What this is

A static Next.js 16 export (`output: "export"`, trailing slashes) of the KA Nails
public site in English and Russian. Online booking is GORGONA's hosted `/book/`
wizard in a sandboxed iframe; this repo has no backend. Platform code belongs to
`alexeyalexandrov2026-tech/-GORGONA-Booking-Platform`: never import or copy it.

## Commands

```sh
npm ci --ignore-scripts
npm run format:check && npm run typecheck && npm run lint && npm run build
npx playwright test --grep-invert "Cloudflare Deployed Production QA"
```

The last line is the local suite CI's `web` job runs (it needs a fresh `build`).

- CI uses Node 24 (`engines: >=24 <25`); cloud containers have Node 22 / npm 10.
  Use `npm ci`, never `npm install`: the older npm strips the lockfile's `libc`
  fields (fixed in 009fd64).
- In cloud containers Playwright finds the preinstalled Chromium; do not run
  `playwright install`.
- `format:check` covers root Markdown, including this file (`design/` is ignored).

## Where things live

- `app/(en)` and `app/ru`: two separate root layouts, one per language.
- `components/*-content.tsx`: page bodies shared by both locales.
- `lib/locales/{en,ru}.ts`: all copy, typed by `lib/locales/types.ts`; path helpers
  in `lib/locales/index.ts`.
- `lib/seo.ts`, `app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`: metadata,
  canonicals, EN/RU alternates, link previews.
- `content/studio-facts.json` (format in `content/README.md`), validated by
  `lib/studio-facts.ts` at build time; blocks in `components/facts/` render nothing
  while their data is missing.
- Photos: `source-assets/photos/originals/` → `tools/process-photos.mjs` →
  `public/photos/` and `lib/photo-inventory.ts` (19 works) → `lib/gallery-data.ts`;
  rendered by `components/portfolio-image.tsx`.
- Design tokens: `app/globals.css` `:root`; reference in
  `design/KA_NAILS_DESIGN_SYSTEM.md` ("Implemented system").

## Hard rules

- **Pedicure only.** The site never mentions manicure; the brand is plain "KA
  Nails" with no "Nail Studio" descriptor. Tests enforce both.
- **Never invent business facts** (prices, address, hours, phone, staff, policies,
  domain). They enter only through `content/studio-facts.json` once the owner
  confirms them. Pages stay `noindex` unless `NEXT_PUBLIC_SITE_INDEXING=index`.
- **Only authentic KA Nails photos**, never stock or synthetic images, and no
  clinical claims in photo copy.
- **The logo PNG is never edited**; tests check its SHA-256. Derivatives come from
  `tools/make-logo-derivatives.mjs`.
- **Every copy change goes into both `en.ts` and `ru.ts`.**
- **The language switcher uses native `<a>`, not `next/link`**: switching crosses
  root layouts and must be a full page load (bc90820).
- **The booking URL comes only from build-time `NEXT_PUBLIC_GORGONA_BOOKING_URL`**
  (https, path `/book/`), never from visitor input (`lib/booking-url.ts`).
- **Design is "brand luxe"**: cream, espresso and rose gold from the logo,
  Cormorant Garamond plus Inter. Rose `#b8937f` is decoration only on light
  grounds. The Studio.Design phase is history; don't bring it back.
- **Accessibility gates must keep passing**: axe, reduced motion, target sizes,
  WCAG 1.4.12 text spacing, lightbox focus trap.

## CI and deploy

`.github/workflows/ci.yml`: `web` (format, typecheck, lint, build, E2E), then on
`main` `deploy` to Cloudflare Pages project `ka-nails` (https://ka-nails.pages.dev)
and `verify-live`. Without the `CLOUDFLARE_API_TOKEN` secret, deploy is skipped and
the tested `out/` is uploaded as artifact `ka-nails-out-<sha>` for a manual upload;
`verify-live.yml` can then be run by hand. Treat a push to `main` as a production
release.

## Keeping this memory

When a session learns something durable (an owner-confirmed fact, a decision, a
gotcha), add a dated one-line entry below in the same commit as the change. Keep
entries short and delete any that stop being true.

## Decision log

- 2026-09-30: Site decoupled from the platform; HTTP/browser-only booking
  integration.
- 2026-10-01: Portfolio limited to 19 authentic works (minimum target 30, ideal 36).
- 2026-10-02: EN/RU as two static root layouts; language switch uses native links.
- 2026-10-02: KA Nails presented as a pedicure-only studio.
- 2026-10-02: CI deploys `main` to Cloudflare Pages and verifies the live site.
- 2026-10-03: "Brand luxe" redesign from the logo replaces Studio.Design (PR #1).
- 2026-10-03: Studio facts module added and kept empty until the owner confirms data.
- 2026-10-03: SEO, link previews and an indexing switch added; the site stays
  `noindex` until publication is approved.
- 2026-10-03: `public/_headers` sets security headers (no script/default CSP, so
  Next's inline scripts keep working) and caching; photos and fonts keep stable
  names, so they are never `immutable`.
- 2026-10-03: Owner confirmed rights and client consent for all 19 photos,
  including work 19 (before/after).
- 2026-10-03: Indexing is switched by the repository variable `SITE_INDEXING=index`
  (and the domain by `SITE_URL`) at deploy time; the live checks follow it.
- Open: no manual screen-reader test yet; WCAG 2.2 AA conformance not established.
