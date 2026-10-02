"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { getEquivalentPath, type Locale } from "../lib/locales";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  ariaLabel?: string;
}

// EN and RU are separate root layouts, so switching locale always requires a
// full document load. Plain anchors navigate natively instead of letting the
// client router fetch the RSC payload first and only then fall back to a hard
// navigation, which left the old <html lang> in place in the meantime.
export function LanguageSwitcher({
  currentLocale,
  ariaLabel = "Select language",
}: LanguageSwitcherProps) {
  const pathname = usePathname() || (currentLocale === "ru" ? "/ru/" : "/");

  const enHref = getEquivalentPath(pathname, "en");
  const ruHref = getEquivalentPath(pathname, "ru");

  return (
    <nav className="lang-switcher" aria-label={ariaLabel}>
      {currentLocale === "en" ? (
        <span
          className="lang-switcher-item is-active"
          aria-current="true"
          lang="en"
        >
          EN
        </span>
      ) : (
        <a
          href={enHref}
          className="lang-switcher-item"
          aria-label="Switch to English"
          lang="en"
          hrefLang="en"
        >
          EN
        </a>
      )}

      <span className="lang-divider" aria-hidden="true">
        /
      </span>

      {currentLocale === "ru" ? (
        <span
          className="lang-switcher-item is-active"
          aria-current="true"
          lang="ru"
        >
          RU
        </span>
      ) : (
        <a
          href={ruHref}
          className="lang-switcher-item"
          aria-label="Переключить на русский язык"
          lang="ru"
          hrefLang="ru"
        >
          RU
        </a>
      )}
    </nav>
  );
}
