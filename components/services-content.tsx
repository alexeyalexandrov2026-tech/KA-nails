import React from "react";
import Link from "next/link";
import { PortfolioImage } from "./portfolio-image";
import { BookingPanel } from "./booking-panel";
import { PageIntro } from "./page-intro";
import { ServiceMenu } from "./facts/service-menu";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";
import { getGalleryItems } from "../lib/gallery-data";
import { studioFacts } from "../lib/studio-facts";

// Portfolio works shown under the booking notice.
const STRIP_WORKS = ["work-01", "work-07", "work-02"];

interface ServicesContentProps {
  locale?: Locale;
}

export function ServicesContent({ locale = "en" }: ServicesContentProps) {
  const dictionary = getDictionary(locale);
  const dict = dictionary.servicesPage;
  const galleryHref = getLocalizedPath("/gallery/", locale);
  const strip = getGalleryItems(locale).filter((item) =>
    STRIP_WORKS.includes(item.id),
  );

  return (
    <div className="page">
      <PageIntro
        locale={locale}
        eyebrow={dict.eyebrow}
        heading={dict.heading}
        photoId="work-15"
        lead={
          // The lead promises prices only once the menu is published.
          <p className="lead">
            {studioFacts.services.length > 0 ? dict.leadWithMenu : dict.lead}
          </p>
        }
      />
      <ServiceMenu locale={locale} />
      <BookingPanel locale={locale} />

      <section className="work-strip" aria-labelledby="work-strip-title">
        <div className="work-strip-header">
          <h2 id="work-strip-title" className="facts-title">
            {dict.stripTitle}
          </h2>
          <Link href={galleryHref} className="button-secondary">
            {dict.stripLink} <span aria-hidden="true">→</span>
          </Link>
        </div>
        <ul className="work-strip-list">
          {strip.map((item) => (
            <li key={item.id}>
              <Link
                href={`${galleryHref}#${item.id}`}
                aria-label={dictionary.hero.tileAriaLabel(
                  item.title,
                  item.categoryLabel || item.category,
                )}
              >
                <PortfolioImage
                  photo={item}
                  alt=""
                  sizes="(max-width: 767px) 30vw, 28vw"
                  className="arch-photo reveal-photo"
                />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
