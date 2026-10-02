import React from "react";
import Link from "next/link";
import Image from "next/image";
import { LanguageSwitcher } from "./language-switcher";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";

interface SiteLayoutProps {
  locale: Locale;
  children: React.ReactNode;
}

export function SiteLayout({ locale, children }: SiteLayoutProps) {
  const dict = getDictionary(locale);

  const homeHref = locale === "ru" ? "/ru/" : "/";
  const servicesHref = getLocalizedPath("/services/", locale);
  const galleryHref = getLocalizedPath("/gallery/", locale);
  const contactHref = getLocalizedPath("/contact/", locale);
  const bookHref = getLocalizedPath("/book/", locale);

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

        <footer className="footer">
          <div className="footer-brand">
            <Image
              src="/assets/ka-nails-logo.png"
              alt={dict.footer.logoAlt}
              width={112}
              height={112}
              unoptimized
            />
            <div className="footer-brand-text">
              <span className="footer-title">{dict.footer.brandTitle}</span>
              <p className="footer-sub">{dict.footer.brandSub}</p>
            </div>
          </div>

          <div className="footer-links">
            <Link href={servicesHref}>{dict.footer.services}</Link>
            <Link href={galleryHref}>{dict.footer.gallery}</Link>
            <Link href={bookHref}>{dict.footer.book}</Link>
            <Link href={contactHref}>{dict.footer.contact}</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
