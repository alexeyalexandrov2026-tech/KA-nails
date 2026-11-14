// Builds the offline catalog of the KA Nails Android app from the site's own
// sources, so prices, services, photos and contacts are kept in one place:
// content/studio-facts.json (through lib/studio-facts.ts), lib/gallery-data.ts,
// lib/locales/{en,ru}.ts and the WebP files in public/. Gradle runs it before
// every build; nothing it writes is committed.
//
// node android/tools/build-catalog.mjs --site <repo> --assets <dir> --res <dir>

import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    site: { type: "string" },
    assets: { type: "string" },
    res: { type: "string" },
  },
});
if (!values.site || !values.assets || !values.res) {
  throw new Error(
    "usage: build-catalog.mjs --site <repo> --assets <dir> --res <dir>",
  );
}

const site = path.resolve(values.site);
const assetsDir = path.resolve(values.assets);
const resDir = path.resolve(values.res);
const LOCALES = ["en", "ru"];
const SOURCES = [
  "lib/studio-facts.ts",
  "lib/gallery-data.ts",
  "lib/locales/index.ts",
  "lib/site.ts",
];

function compileSiteModules() {
  const siteRequire = createRequire(path.join(site, "package.json"));
  let ts;
  try {
    ts = siteRequire("typescript");
  } catch {
    throw new Error(
      "TypeScript is missing: run `npm ci --ignore-scripts` in the repository root first.",
    );
  }
  const outDir = mkdtempSync(path.join(tmpdir(), "ka-nails-catalog-"));
  const program = ts.createProgram(
    SOURCES.map((file) => path.join(site, file)),
    {
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ES2022,
      strict: true,
      noUncheckedIndexedAccess: true,
      resolveJsonModule: true,
      esModuleInterop: true,
      skipLibCheck: true,
      typeRoots: [path.join(site, "node_modules/@types")],
      types: ["node"],
      rootDir: site,
      outDir,
    },
  );
  const result = program.emit();
  const errors = ts
    .getPreEmitDiagnostics(program)
    .concat(result.diagnostics)
    .filter((d) => d.category === ts.DiagnosticCategory.Error);
  if (errors.length > 0 || result.emitSkipped) {
    rmSync(outDir, { recursive: true, force: true });
    throw new Error(
      ts.formatDiagnostics(errors, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => site,
        getNewLine: () => "\n",
      }),
    );
  }
  const load = createRequire(path.join(outDir, "index.js"));
  try {
    return {
      facts: load("./lib/studio-facts.js"),
      gallery: load("./lib/gallery-data.js"),
      locales: load("./lib/locales/index.js"),
      site: load("./lib/site.js"),
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

const { facts, gallery, locales, site: siteModule } = compileSiteModules();

const siteUrl = new URL(siteModule.SITE_URL);
if (siteUrl.protocol !== "https:" || siteUrl.search || siteUrl.hash) {
  throw new Error(`SITE_URL must be a plain https address: ${siteUrl.href}`);
}

rmSync(assetsDir, { recursive: true, force: true });
rmSync(resDir, { recursive: true, force: true });
const catalogDir = path.join(assetsDir, "catalog");
mkdirSync(path.join(catalogDir, "photos"), { recursive: true });

const copied = new Map();
/** Copies a site image (a public/ path such as /photos/x.webp) into the APK. */
function asset(publicPath, target) {
  if (copied.has(publicPath)) return copied.get(publicPath);
  if (!/^\/[\w./-]+\.webp$/.test(publicPath)) {
    throw new Error(`Only site WebP images go into the app: ${publicPath}`);
  }
  const source = path.join(site, "public", publicPath);
  if (!existsSync(source) || statSync(source).size === 0) {
    throw new Error(`Image is missing in public/: ${publicPath}`);
  }
  const relative = `catalog/${target}`;
  copyFileSync(source, path.join(assetsDir, relative));
  copied.set(publicPath, relative);
  return relative;
}

const studio = facts.studioFacts;
const offer = (item, locale, dict) => ({
  id: item.id,
  name: facts.pick(item.name, locale),
  description: item.description ? facts.pick(item.description, locale) : null,
  duration: item.durationMinutes
    ? facts.formatDuration(item.durationMinutes, locale)
    : null,
  price: facts.priceText(item.price, locale, dict.facts.priceFrom),
  amount: item.price.amount,
  currency: item.price.currency,
  from: item.price.from === true,
  plus: item.price.plus === true,
});

const masterPhoto = studio.master?.photo
  ? asset(studio.master.photo, `photos/${path.basename(studio.master.photo)}`)
  : null;
const logo = asset("/assets/ka-nails-logo-320.webp", "logo.webp");

function localeCatalog(locale) {
  const dict = locales.getDictionary(locale);
  const works = gallery.getGalleryItems(locale);
  if (works.length === 0) throw new Error(`No gallery works for ${locale}`);
  const usedCategories = new Set(works.map((work) => work.category));
  const masterName = studio.master
    ? facts.pick(studio.master.name, locale)
    : "";
  return {
    paths: {
      home: locales.getLocalizedPath("/", locale),
      book: locales.getLocalizedPath("/book/", locale),
    },
    labels: {
      services: dict.nav.services,
      gallery: dict.nav.gallery,
      contact: dict.nav.contact,
      book: dict.nav.book,
      chat: dict.chat.launcher,
      chatPrivacy: dict.chat.privacy,
      servicesEyebrow: dict.facts.servicesEyebrow,
      servicesTitle: dict.facts.servicesTitle,
      addOnsTitle: dict.facts.addOnsTitle,
      menuNotesTitle: dict.facts.menuNotesTitle,
      channelsTitle: dict.facts.channelsTitle,
      masterTitle: dict.facts.masterTitle,
      galleryTitle: dict.galleryPage.title,
    },
    services: studio.services.map((item) => offer(item, locale, dict)),
    addOns: studio.addOns.map((item) => offer(item, locale, dict)),
    menuNotes: studio.menuNotes.map((note) => facts.pick(note, locale)),
    channels: facts.orderedChannels(studio.channels).map((channel) => ({
      kind: channel.kind,
      label: dict.facts.channelLabels[channel.kind],
      display: facts.channelDisplay(channel),
      href: facts.channelHref(channel),
    })),
    master: studio.master
      ? {
          name: masterName,
          bio: facts.pick(studio.master.bio, locale),
          photo: masterPhoto,
          photoAlt: dict.facts.masterPhotoAlt(masterName),
        }
      : null,
    categories: gallery
      .getGalleryCategories(locale)
      .filter((c) => c.key === "All" || usedCategories.has(c.key)),
    works: works.map((work) => ({
      id: work.id,
      title: work.title,
      category: work.category,
      categoryLabel: work.categoryLabel,
      finish: work.finish,
      colorFamily: work.colorFamily,
      notes: work.notes,
      alt: work.alt,
      width: work.width,
      height: work.height,
      thumb: asset(work.srcThumb, `photos/${path.basename(work.srcThumb)}`),
      image: asset(work.srcMed, `photos/${path.basename(work.srcMed)}`),
    })),
  };
}

const catalog = {
  schema: 1,
  siteUrl: siteUrl.href.replace(/\/+$/, ""),
  factsSha256: createHash("sha256")
    .update(readFileSync(path.join(site, "content/studio-facts.json")))
    .digest("hex"),
  logo,
  locales: Object.fromEntries(LOCALES.map((l) => [l, localeCatalog(l)])),
};

// Both languages must describe the same menu, works and contacts.
const [en, ru] = LOCALES.map((l) => catalog.locales[l]);
const keys = {
  services: (item) => item.id,
  addOns: (item) => item.id,
  works: (item) => item.id,
  channels: (item) => item.href,
};
for (const [field, key] of Object.entries(keys)) {
  if (en[field].map(key).join() !== ru[field].map(key).join()) {
    throw new Error(`EN and RU ${field} differ`);
  }
}
if (en.services.length === 0) throw new Error("The service menu is empty");

writeFileSync(
  path.join(catalogDir, "catalog.json"),
  `${JSON.stringify(catalog, null, 2)}\n`,
);

// The launcher icon is an adaptive icon in res/ (tools/make-launcher-icons.mjs);
// this directory stays for generated resources and is empty for now.
mkdirSync(resDir, { recursive: true });

console.log(
  `KA Nails catalog: ${en.services.length} services, ${en.addOns.length} add-ons, ` +
    `${en.works.length} works per locale, ${copied.size} images, ` +
    `facts ${catalog.factsSha256.slice(0, 12)}`,
);
