import React from "react";
import { ContactChannels } from "./facts/contact-channels";
import { PageIntro } from "./page-intro";
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
      <PageIntro
        locale={locale}
        eyebrow={dict.eyebrow}
        heading={dict.heading}
        photoId="work-05"
      />
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
