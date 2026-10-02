import React from "react";
import { GalleryArchive } from "./gallery-archive";
import { getDictionary, type Locale } from "../lib/locales";

interface GalleryContentProps {
  locale?: Locale;
}

export function GalleryContent({ locale = "en" }: GalleryContentProps) {
  const dict = getDictionary(locale).galleryPage;

  return (
    <div className="gallery-page-container">
      <header className="gallery-page-header">
        <p className="eyebrow">{dict.eyebrow}</p>
        <h1 className="gallery-page-title">{dict.title}</h1>
        <p className="gallery-page-lead">{dict.lead}</p>
      </header>

      <GalleryArchive locale={locale} />
    </div>
  );
}
