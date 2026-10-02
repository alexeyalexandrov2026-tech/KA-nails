import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KA Nails — Nail Studio", template: "%s | KA Nails" },
  description:
    "KA Nails Nail Studio. Explore services and reserve an appointment when online booking becomes available.",
  robots: { index: false, follow: false },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body data-brand="tenant">
        <a href="#main" className="skip">
          Skip to content
        </a>
        <header className="header">
          <Link href="/" aria-label="KA Nails home" className="wordmark">
            KA Nails<span>Nail Studio</span>
          </Link>
          <nav aria-label="Main navigation">
            <Link href="/services/">Services</Link>
            <Link href="/gallery/">Gallery</Link>
            <Link href="/contact/">Contact</Link>
            <Link href="/book/" className="button">
              Book an appointment
            </Link>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer className="footer">
          <div className="footer-brand">
            <Image
              src="/assets/ka-nails-logo.png"
              alt="KA Nails Nail Studio"
              width={112}
              height={112}
              unoptimized
            />
            <div className="footer-brand-text">
              <span className="footer-title">KA Nails · Nail Studio</span>
              <p className="footer-sub">
                Authentic salon portfolio &amp; attentive care
              </p>
            </div>
          </div>
          <div className="footer-links">
            <Link href="/services/">Services</Link>
            <Link href="/gallery/">Gallery</Link>
            <Link href="/book/">Book Appointment</Link>
            <Link href="/contact/">Studio information</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
