import React from "react";
import Link from "next/link";
import { PortfolioImage } from "./portfolio-image";
import { HeroCollage } from "./hero-collage";
import { HomeMovingWall } from "./home-moving-wall";
import { MasterProfile } from "./facts/master-profile";
import { StylePicker } from "./style-picker";
import { getGalleryItems } from "../lib/gallery-data";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";

interface HomePageContentProps {
  locale?: Locale;
}

export function HomePageContent({ locale = "en" }: HomePageContentProps) {
  const dict = getDictionary(locale);

  const servicesHref = getLocalizedPath("/services/", locale);
  const galleryHref = getLocalizedPath("/gallery/", locale);
  const bookHref = getLocalizedPath("/book/", locale);

  const works = getGalleryItems(locale);
  const work = (id: string) => works.find((item) => item.id === id);
  // Real portfolio photos chosen for each block (see lib/photo-inventory.ts).
  const standardsPhoto = work("work-12");
  const pillars = [
    dict.pillars.pillar1,
    dict.pillars.pillar2,
    dict.pillars.pillar3,
  ];
  const chapters = [
    { numeral: "I", card: dict.servicesShowcase.card1, photo: work("work-18") },
    {
      numeral: "II",
      card: dict.servicesShowcase.card2,
      photo: work("work-17"),
    },
    {
      numeral: "III",
      card: dict.servicesShowcase.card3,
      photo: work("work-14"),
    },
  ];

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
        {standardsPhoto && (
          <figure className="pillars-figure">
            <PortfolioImage
              photo={standardsPhoto}
              alt={standardsPhoto.alt}
              sizes="(max-width: 900px) 380px, 40vw"
              className="arch-photo reveal-photo"
            />
          </figure>
        )}

        <div className="pillars-body">
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
            {pillars.map((pillar) => (
              <article className="pillar-card" key={pillar.num}>
                <span className="pillar-num" aria-hidden="true">
                  {pillar.num}
                </span>
                <div>
                  <h3 className="pillar-title">{pillar.title}</h3>
                  <p className="pillar-text">{pillar.text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Signature Services Showcase (Section 04) */}
      <section
        className="services-showcase"
        aria-label={dict.servicesShowcase.ariaLabel}
      >
        <div className="services-showcase-inner">
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
            {chapters.map(({ card, photo, numeral }) => (
              <div className="service-preview-card" key={numeral}>
                {photo && (
                  <PortfolioImage
                    photo={photo}
                    alt={photo.alt}
                    sizes="(max-width: 767px) 90vw, 30vw"
                    className="arch-photo service-chapter-photo reveal-photo"
                  />
                )}
                <div className="service-card-meta">
                  <span className="service-tag">
                    <span aria-hidden="true">{numeral} · </span>
                    {card.tag}
                  </span>
                </div>
                <h3 className="service-name">{card.name}</h3>
                <p className="service-desc">{card.desc}</p>
                <Link
                  href={photo ? `${galleryHref}#${photo.id}` : galleryHref}
                  className="service-book-link"
                >
                  {dict.servicesShowcase.exploreInGallery}{" "}
                  <span aria-hidden="true">→</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Style finder over the real portfolio (Section 05) */}
      <StylePicker locale={locale} />

      {/* Master profile from studio facts; hidden until published */}
      <MasterProfile locale={locale} />

      {/* Final Booking Callout */}
      <section
        className="final-booking-band"
        aria-label={dict.finalBooking.ariaLabel}
      >
        <svg
          className="final-arc"
          data-decor=""
          aria-hidden="true"
          focusable="false"
          viewBox="0 0 1200 400"
          preserveAspectRatio="none"
        >
          <path d="M -20 400 A 620 620 0 0 1 1220 400" />
        </svg>
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
