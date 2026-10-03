import React from "react";
import Link from "next/link";
import { HeroCollage } from "./hero-collage";
import { HomeMovingWall } from "./home-moving-wall";
import { MasterProfile } from "./facts/master-profile";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";

interface HomePageContentProps {
  locale?: Locale;
}

export function HomePageContent({ locale = "en" }: HomePageContentProps) {
  const dict = getDictionary(locale);

  const servicesHref = getLocalizedPath("/services/", locale);
  const galleryHref = getLocalizedPath("/gallery/", locale);
  const bookHref = getLocalizedPath("/book/", locale);

  return (
    <>
      {/* Asymmetric Studio Hero */}
      <HeroCollage locale={locale} />

      {/* Moving Wall Showcase of Curated Nail Art (Section 02) */}
      <HomeMovingWall locale={locale} />

      {/* Editorial Studio Standards Section (Section 03) */}
      <section
        className="editorial-pillars"
        aria-label={dict.pillars.ariaLabel}
      >
        <div className="pillars-intro">
          <p className="eyebrow">{dict.pillars.eyebrow}</p>
          <h2 className="section-title">
            {dict.pillars.titleLine1}
            <br />
            {dict.pillars.titleLine2}
          </h2>
          <p className="lead">{dict.pillars.lead}</p>
        </div>

        <div className="pillars-grid">
          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              {dict.pillars.pillar1.num}
            </span>
            <h3 className="pillar-title">{dict.pillars.pillar1.title}</h3>
            <p className="pillar-text">{dict.pillars.pillar1.text}</p>
          </article>

          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              {dict.pillars.pillar2.num}
            </span>
            <h3 className="pillar-title">{dict.pillars.pillar2.title}</h3>
            <p className="pillar-text">{dict.pillars.pillar2.text}</p>
          </article>

          <article className="pillar-card">
            <span className="pillar-num" aria-hidden="true">
              {dict.pillars.pillar3.num}
            </span>
            <h3 className="pillar-title">{dict.pillars.pillar3.title}</h3>
            <p className="pillar-text">{dict.pillars.pillar3.text}</p>
          </article>
        </div>
      </section>

      {/* Signature Services Showcase (Section 04) */}
      <section
        className="services-showcase"
        aria-label={dict.servicesShowcase.ariaLabel}
      >
        <div className="services-showcase-header">
          <div>
            <p className="eyebrow">{dict.servicesShowcase.eyebrow}</p>
            <h2 className="section-title">{dict.servicesShowcase.title}</h2>
          </div>
          <Link href={servicesHref} className="button-secondary">
            {dict.servicesShowcase.viewServiceInfo}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </div>

        <div className="services-preview-grid">
          <div className="service-preview-card">
            <div className="service-card-meta">
              <span className="service-tag">
                {dict.servicesShowcase.card1.tag}
              </span>
              <span className="service-duration">
                {dict.servicesShowcase.card1.duration}
              </span>
            </div>
            <h3 className="service-name">{dict.servicesShowcase.card1.name}</h3>
            <p className="service-desc">{dict.servicesShowcase.card1.desc}</p>
            <Link href={galleryHref} className="service-book-link">
              {dict.servicesShowcase.exploreInGallery}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="service-preview-card featured">
            <div className="service-card-meta">
              <span className="service-tag highlight">
                {dict.servicesShowcase.card2.tag}
              </span>
              <span className="service-duration">
                {dict.servicesShowcase.card2.duration}
              </span>
            </div>
            <h3 className="service-name">{dict.servicesShowcase.card2.name}</h3>
            <p className="service-desc">{dict.servicesShowcase.card2.desc}</p>
            <Link href={galleryHref} className="service-book-link">
              {dict.servicesShowcase.exploreInGallery}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>

          <div className="service-preview-card">
            <div className="service-card-meta">
              <span className="service-tag">
                {dict.servicesShowcase.card3.tag}
              </span>
              <span className="service-duration">
                {dict.servicesShowcase.card3.duration}
              </span>
            </div>
            <h3 className="service-name">{dict.servicesShowcase.card3.name}</h3>
            <p className="service-desc">{dict.servicesShowcase.card3.desc}</p>
            <Link href={galleryHref} className="service-book-link">
              {dict.servicesShowcase.exploreInGallery}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* Master profile from studio facts; hidden until published */}
      <MasterProfile locale={locale} />

      {/* Final Booking Callout */}
      <section
        className="final-booking-band"
        aria-label={dict.finalBooking.ariaLabel}
      >
        <div className="final-booking-inner">
          <p className="eyebrow">{dict.finalBooking.eyebrow}</p>
          <h2 className="final-title">
            {dict.finalBooking.titleLine1}
            <br />
            {dict.finalBooking.titleLine2}
          </h2>
          <p className="final-desc">{dict.finalBooking.desc}</p>
          <div className="final-actions">
            <Link href={bookHref} className="button final-btn">
              {dict.finalBooking.viewStatusBtn}{" "}
              <span aria-hidden="true">↗</span>
            </Link>
            <Link
              href={galleryHref}
              className="button-secondary final-btn-secondary"
            >
              {dict.finalBooking.exploreGalleryBtn}{" "}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
