import React from "react";
import { BookingPanel } from "./booking-panel";
import { BookingRequest } from "./facts/booking-request";
import { PageIntro } from "./page-intro";
import { ContactChannels } from "./facts/contact-channels";
import { approvedBookingUrl } from "../lib/booking-url";
import { getDictionary, type Locale } from "../lib/locales";

interface BookContentProps {
  locale?: Locale;
}

export function BookContent({ locale = "en" }: BookContentProps) {
  const dict = getDictionary(locale).bookPage;

  return (
    <div className="page">
      <PageIntro
        locale={locale}
        eyebrow={dict.eyebrow}
        heading={dict.heading}
        photoId="work-09"
      />
      <BookingPanel locale={locale} />
      {/* Messenger requests stand in until the booking platform is live. */}
      {!approvedBookingUrl(process.env.NEXT_PUBLIC_GORGONA_BOOKING_URL) && (
        <BookingRequest locale={locale} />
      )}
      <ContactChannels locale={locale} />
    </div>
  );
}
