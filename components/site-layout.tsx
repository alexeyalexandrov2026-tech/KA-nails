import React from "react";
import Link from "next/link";
import { PortfolioImage } from "./portfolio-image";
import Image from "next/image";
import { preload } from "react-dom";
import { LanguageSwitcher } from "./language-switcher";
import { ChatWidget } from "./chat/chat-widget";
import { approvedChatApiUrl } from "../lib/chat-api-url";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";
import { getGalleryItems } from "../lib/gallery-data";
import { nailSalonJsonLd, serializeJsonLd } from "../lib/structured-data";
import {
  channelDisplay,
  channelHref,
  orderedChannels,
  pick,
  studioFacts,
} from "../lib/studio-facts";

// Portfolio works shown as a small mosaic in the footer.
const FOOTER_WORKS = ["work-01", "work-05", "work-13", "work-16"];

interface SiteLayoutProps {
  locale: Locale;
  children: React.ReactNode;
}

// Fonts used above the fold, preloaded so the first paint already uses them
// (no swap, no layout shift). Files come from tools/sync-fonts.mjs.
const PRELOAD_FONTS: Record<Locale, string[]> = {
  en: [
    "/fonts/inter-latin-wght-normal.woff2",
    "/fonts/cormorant-garamond-latin-wght-normal.woff2",
  ],
  ru: [
    "/fonts/inter-latin-wght-normal.woff2",
    "/fonts/inter-cyrillic-wght-normal.woff2",
    "/fonts/cormorant-garamond-latin-wght-normal.woff2",
    "/fonts/cormorant-garamond-cyrillic-wght-normal.woff2",
  ],
};

export function SiteLayout({ locale, children }: SiteLayoutProps) {
  for (const href of PRELOAD_FONTS[locale]) {
    preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
  }
  const dict = getDictionary(locale);
  // Published only once confirmed studio facts exist (phone or address).
  const jsonLd = nailSalonJsonLd(studioFacts, locale);
  // The AI receptionist appears only once its API address is configured.
  const chatEndpoint = approvedChatApiUrl(process.env.NEXT_PUBLIC_CHAT_API_URL);
  const whatsapp = studioFacts.channels.find((c) => c.kind === "whatsapp");

  const homeHref = locale === "ru" ? "/ru/" : "/";
  const servicesHref = getLocalizedPath("/services/", locale);
  const galleryHref = getLocalizedPath("/gallery/", locale);
  const contactHref = getLocalizedPath("/contact/", locale);
  const bookHref = getLocalizedPath("/book/", locale);
  const mosaic = getGalleryItems(locale).filter((item) =>
    FOOTER_WORKS.includes(item.id),
  );

  return (
    <html lang={locale}>
      <body data-brand="tenant">
        <a href="#main" className="skip">
          {dict.nav.skipToContent}
        </a>

        <header className="header">
          <Link
            href={homeHref}
            aria-label={dict.nav.brandHomeAria}
            className="wordmark"
          >
            {dict.nav.brandName}
          </Link>

          <nav aria-label={dict.nav.navAriaLabel} className="main-nav">
            <Link href={servicesHref}>{dict.nav.services}</Link>
            <Link href={galleryHref}>{dict.nav.gallery}</Link>
            <Link href={contactHref}>{dict.nav.contact}</Link>
            <Link href={bookHref} className="button nav-book-button">
              {dict.nav.book}
            </Link>

            <div className="header-lang-wrapper">
              <LanguageSwitcher
                currentLocale={locale}
                ariaLabel={dict.nav.langSwitchAriaLabel}
              />
            </div>
          </nav>
        </header>

        <main id="main">{children}</main>

        {jsonLd && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
          />
        )}

        <footer className="footer">
          <div className="footer-main">
            <div className="footer-brand">
              <Image
                src="/assets/ka-nails-logo-320.webp"
                alt={dict.footer.logoAlt}
                width={112}
                height={112}
                loading="lazy"
                unoptimized
              />
              <div className="footer-brand-text">
                <span className="footer-title">{dict.footer.brandTitle}</span>
                <p className="footer-sub">{dict.footer.brandSub}</p>
              </div>
            </div>

            <nav className="footer-links" aria-label={dict.footer.navAriaLabel}>
              <Link href={servicesHref}>{dict.footer.services}</Link>
              <Link href={galleryHref}>{dict.footer.gallery}</Link>
              <Link href={bookHref}>{dict.footer.book}</Link>
              <Link href={contactHref}>{dict.footer.contact}</Link>
            </nav>

            <ul
              className="footer-mosaic"
              aria-label={dict.footer.worksAriaLabel}
            >
              {mosaic.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`${galleryHref}#${item.id}`}
                    aria-label={dict.hero.tileAriaLabel(
                      item.title,
                      item.categoryLabel || item.category,
                    )}
                  >
                    <PortfolioImage photo={item} alt="" sizes="116px" />
                  </Link>
                </li>
              ))}
            </ul>

            {(studioFacts.address || studioFacts.channels.length > 0) && (
              <div className="footer-facts" data-facts="footer">
                {studioFacts.address && (
                  <address className="footer-address">
                    {studioFacts.address.lines.map((line, i) => (
                      <span key={i}>{pick(line, locale)}</span>
                    ))}
                  </address>
                )}
                {studioFacts.channels.length > 0 && (
                  <ul className="footer-channels">
                    {orderedChannels(studioFacts.channels).map((channel) => (
                      <li key={`${channel.kind}:${channel.value}`}>
                        <a
                          href={channelHref(channel)}
                          aria-label={`${dict.facts.channelLabels[channel.kind]}: ${channelDisplay(channel)}`}
                        >
                          {dict.facts.channelLabels[channel.kind]}
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <p className="footer-legal">{dict.footer.copyright}</p>
        </footer>

        {chatEndpoint && (
          <ChatWidget
            locale={locale}
            endpoint={chatEndpoint}
            whatsappHref={whatsapp ? channelHref(whatsapp) : null}
            turnstileSiteKey={
              process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || undefined
            }
          />
        )}
      </body>
    </html>
  );
}
