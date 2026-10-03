import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import "./fonts.css";
import "./globals.css";

// Next.js marks this page noindex by itself.
export const metadata: Metadata = {
  title: "Page not found | KA Nails",
};

// Unknown URLs have no language, so the page speaks both.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body data-brand="tenant">
        <main id="main" className="not-found-page">
          <Link href="/" className="not-found-logo" aria-label="KA Nails home">
            <Image
              src="/assets/ka-nails-logo-320.webp"
              alt="KA Nails"
              width={160}
              height={160}
              unoptimized
            />
          </Link>
          <p className="eyebrow">404</p>
          <h1>This page could not be found.</h1>
          <p className="lead">
            The link may be outdated. The portfolio and booking information are
            one step away.
          </p>
          <div className="not-found-actions">
            <Link href="/" className="button">
              Home
            </Link>
            <Link href="/gallery/" className="button-secondary">
              Gallery
            </Link>
          </div>

          <section lang="ru" className="not-found-alt">
            <h2>Страница не найдена.</h2>
            <p>Возможно, ссылка устарела. Портфолио и запись — в один шаг.</p>
            <div className="not-found-actions">
              <Link href="/ru/" className="button-secondary">
                Главная
              </Link>
              <Link href="/ru/gallery/" className="button-secondary">
                Галерея
              </Link>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
