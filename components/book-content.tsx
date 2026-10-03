import React from "react";
import { BookingPanel } from "./booking-panel";
import { ContactChannels } from "./facts/contact-channels";
import { getDictionary, type Locale } from "../lib/locales";

interface BookContentProps {
  locale?: Locale;
}

export function BookContent({ locale = "en" }: BookContentProps) {
  const dict = getDictionary(locale).bookPage;

  return (
    <div className="page">
      <p className="eyebrow">{dict.eyebrow}</p>
      <h1>{dict.heading}</h1>
      <BookingPanel locale={locale} />
      <ContactChannels locale={locale} />
    </div>
  );
}
