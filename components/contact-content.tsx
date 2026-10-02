import React from "react";
import { getDictionary, type Locale } from "../lib/locales";

interface ContactContentProps {
  locale?: Locale;
}

export function ContactContent({ locale = "en" }: ContactContentProps) {
  const dict = getDictionary(locale).contactPage;

  return (
    <div className="page">
      <p className="eyebrow">{dict.eyebrow}</p>
      <h1>{dict.heading}</h1>
      <section className="notice">
        <h2>{dict.noticeTitle}</h2>
        <p>{dict.noticeText}</p>
      </section>
    </div>
  );
}
