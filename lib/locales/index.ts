import { enLocale } from "./en";
import { ruLocale } from "./ru";
import type { Locale, LocaleDictionary } from "./types";

export * from "./types";
export { enLocale } from "./en";
export { ruLocale } from "./ru";

export function getDictionary(locale: Locale): LocaleDictionary {
  return locale === "ru" ? ruLocale : enLocale;
}

export function getLocalePrefix(locale: Locale): string {
  return locale === "ru" ? "/ru" : "";
}

export function getLocalizedPath(path: string, locale: Locale): string {
  // Normalize base path
  const normalized =
    path.replace(/^\/ru(\/|$)/, "/").replace(/\/+$/, "") || "/";
  if (locale === "ru") {
    return normalized === "/" ? "/ru/" : `/ru${normalized}/`;
  }
  return normalized === "/" ? "/" : `${normalized}/`;
}

export function getEquivalentPath(
  currentPathname: string,
  targetLocale: Locale,
): string {
  // Clean trailing slashes
  const clean = currentPathname.replace(/\/+$/, "") || "/";
  if (targetLocale === "ru") {
    if (clean === "/ru" || clean.startsWith("/ru/")) {
      return clean + "/";
    }
    return clean === "/" ? "/ru/" : `/ru${clean}/`;
  } else {
    // targetLocale === "en"
    if (clean === "/ru") return "/";
    if (clean.startsWith("/ru/")) {
      const stripped = clean.replace(/^\/ru/, "");
      return stripped === "" ? "/" : stripped + "/";
    }
    return clean === "/" ? "/" : clean + "/";
  }
}
