"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getEquivalentPath, type Locale } from "../lib/locales";

interface LanguageSwitcherProps {
  currentLocale: Locale;
  ariaLabel?: string;
}

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
        <Link
          href={enHref}
          className="lang-switcher-item"
          aria-label="Switch to English"
          lang="en"
          hrefLang="en"
        >
          EN
        </Link>
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
        <Link
          href={ruHref}
          className="lang-switcher-item"
          aria-label="Переключить на русский язык"
          lang="ru"
          hrefLang="ru"
        >
          RU
        </Link>
      )}
    </nav>
  );
}
