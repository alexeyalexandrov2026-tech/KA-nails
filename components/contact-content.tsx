import React from "react";
import { ContactChannels } from "./facts/contact-channels";
import { StudioDetails } from "./facts/studio-details";
import { getDictionary, type Locale } from "../lib/locales";
import { studioFacts } from "../lib/studio-facts";

interface ContactContentProps {
  locale?: Locale;
}

export function ContactContent({ locale = "en" }: ContactContentProps) {
  const dict = getDictionary(locale).contactPage;

  return (
    <div className="page">
      <p className="eyebrow">{dict.eyebrow}</p>
      <h1>{dict.heading}</h1>
      {/* The "coming soon" notice stays until the address is confirmed. */}
      {!studioFacts.address && (
        <section className="notice">
          <h2>{dict.noticeTitle}</h2>
          <p>{dict.noticeText}</p>
        </section>
      )}
      <StudioDetails locale={locale} />
      <ContactChannels locale={locale} />
    </div>
  );
}
