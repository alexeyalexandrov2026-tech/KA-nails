import React from "react";
import Image from "next/image";
import { getGalleryItems } from "../lib/gallery-data";
import type { Locale } from "../lib/locales";

interface PageIntroProps {
  locale: Locale;
  eyebrow: string;
  heading: string;
  lead?: React.ReactNode;
  /** Portfolio work shown in an arch next to the heading. */
  photoId: string;
}

/** Shared opening of the inner pages: eyebrow, h1, text and an arched photo. */
export function PageIntro({
  locale,
  eyebrow,
  heading,
  lead,
  photoId,
}: PageIntroProps) {
  const photo = getGalleryItems(locale).find((item) => item.id === photoId);

  return (
    <header className="page-intro">
      <div className="page-intro-text">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{heading}</h1>
        {lead}
      </div>
      {photo && (
        <figure className="page-intro-figure">
          <svg
            className="page-intro-arc"
            data-decor=""
            aria-hidden="true"
            focusable="false"
            viewBox="0 0 400 500"
          >
            <path d="M 8 500 L 8 200 A 192 192 0 0 1 392 200 L 392 500" />
          </svg>
          <Image
            src={photo.srcMed}
            alt={photo.alt}
            width={photo.width}
            height={photo.height}
            loading="eager"
            fetchPriority="high"
            unoptimized
            className="arch-photo"
          />
        </figure>
      )}
    </header>
  );
}
