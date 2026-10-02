import React from "react";
import { approvedBookingUrl } from "../lib/booking-url";
import { getDictionary, type Locale } from "../lib/locales";

interface BookingPanelProps {
  locale?: Locale;
}

export function BookingPanel({ locale = "en" }: BookingPanelProps) {
  const dict = getDictionary(locale).bookingPanel;
  const url = approvedBookingUrl(process.env.NEXT_PUBLIC_GORGONA_BOOKING_URL);

  if (!url) {
    return (
      <section className="notice" aria-labelledby="booking-state">
        <p className="eyebrow">{dict.noticeEyebrow}</p>
        <h2 id="booking-state">{dict.noticeTitle}</h2>
        <p>{dict.noticeText}</p>
      </section>
    );
  }

  return (
    <section aria-label={dict.panelAriaLabel} className="booking-panel">
      <p className="booking-help">
        {dict.helpTextLead}
        <a href={url} target="_blank" rel="noopener noreferrer">
          {dict.openFullPage}
        </a>
        {dict.helpTextTrail}
      </p>
      <iframe
        src={url}
        title={dict.frameTitle}
        sandbox="allow-scripts allow-forms allow-same-origin"
        referrerPolicy="no-referrer"
        className="booking-frame"
      />
    </section>
  );
}
