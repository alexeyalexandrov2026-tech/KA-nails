import React from "react";
import { BookingPanel } from "./booking-panel";
import { getDictionary, type Locale } from "../lib/locales";

interface ServicesContentProps {
  locale?: Locale;
}

export function ServicesContent({ locale = "en" }: ServicesContentProps) {
  const dict = getDictionary(locale).servicesPage;

  return (
    <div className="page">
      <p className="eyebrow">{dict.eyebrow}</p>
      <h1>{dict.heading}</h1>
      <p className="lead">{dict.lead}</p>
      <BookingPanel locale={locale} />
    </div>
  );
}
