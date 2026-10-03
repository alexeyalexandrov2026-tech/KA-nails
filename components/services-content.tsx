import React from "react";
import { BookingPanel } from "./booking-panel";
import { ServiceMenu } from "./facts/service-menu";
import { getDictionary, type Locale } from "../lib/locales";
import { studioFacts } from "../lib/studio-facts";

interface ServicesContentProps {
  locale?: Locale;
}

export function ServicesContent({ locale = "en" }: ServicesContentProps) {
  const dict = getDictionary(locale).servicesPage;

  return (
    <div className="page">
      <p className="eyebrow">{dict.eyebrow}</p>
      <h1>{dict.heading}</h1>
      {/* The lead promises prices only once the menu is published. */}
      <p className="lead">
        {studioFacts.services.length > 0 ? dict.leadWithMenu : dict.lead}
      </p>
      <ServiceMenu locale={locale} />
      <BookingPanel locale={locale} />
    </div>
  );
}
