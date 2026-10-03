"use client";

import React, { useId, useMemo, useState } from "react";
import Link from "next/link";
import { PortfolioImage } from "./portfolio-image";
import { GalleryViewer } from "./gallery-viewer";
import { getGalleryItems } from "../lib/gallery-data";
import { whatsappLookLink } from "../lib/booking-message";
import { studioFacts } from "../lib/studio-facts";
import { getDictionary, getLocalizedPath, type Locale } from "../lib/locales";
import {
  LOOKS,
  TONES,
  TONE_BY_WORK,
  pickStyles,
  type Look,
  type Tone,
} from "../lib/style-picker";

interface StylePickerProps {
  locale?: Locale;
}

const MAX_RESULTS = 6;

/** Two quick choices that narrow the real portfolio down to matching works. */
export function StylePicker({ locale = "en" }: StylePickerProps) {
  const dict = getDictionary(locale);
  const copy = dict.stylePicker;
  const categoryLabels = dict.galleryPage.categoryLabels;
  const items = useMemo(() => getGalleryItems(locale), [locale]);
  const [look, setLook] = useState<Look | null>(null);
  const [tone, setTone] = useState<Tone | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const groupId = useId();

  const result = useMemo(
    () => pickStyles(items, look, tone),
    [items, look, tone],
  );
  const shown = result.items.slice(0, MAX_RESULTS);
  // Shown only once the studio publishes a WhatsApp number in studio facts.
  const sendHref = whatsappLookLink(
    studioFacts.channels,
    locale,
    shown.map((item) => ({ id: item.id, title: item.title })),
  );

  const option = (
    name: string,
    value: string,
    label: string,
    checked: boolean,
    onChange: () => void,
  ) => (
    <label className="picker-option" key={value}>
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
      />
      <span>{label}</span>
    </label>
  );

  return (
    <section className="style-picker" aria-labelledby={`${groupId}-title`}>
      <div className="style-picker-inner">
        <div className="style-picker-intro">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h2 id={`${groupId}-title`} className="section-title">
            {copy.title}
          </h2>
          <p className="lead">{copy.lead}</p>

          <form
            className="picker-form"
            aria-label={copy.ariaLabel}
            onSubmit={(event) => event.preventDefault()}
          >
            <fieldset className="picker-group">
              <legend>{copy.lookLegend}</legend>
              <div className="picker-options">
                {option(`${groupId}-look`, "any", copy.anyOption, !look, () =>
                  setLook(null),
                )}
                {LOOKS.map((value) =>
                  option(
                    `${groupId}-look`,
                    value,
                    categoryLabels[value] ?? value,
                    look === value,
                    () => setLook(value),
                  ),
                )}
              </div>
            </fieldset>

            <fieldset className="picker-group">
              <legend>{copy.toneLegend}</legend>
              <div className="picker-options">
                {option(`${groupId}-tone`, "any", copy.anyOption, !tone, () =>
                  setTone(null),
                )}
                {TONES.map((value) =>
                  option(
                    `${groupId}-tone`,
                    value,
                    copy.tones[value],
                    tone === value,
                    () => setTone(value),
                  ),
                )}
              </div>
            </fieldset>

            <div className="picker-footer">
              <p className="picker-status" role="status">
                {result.exactCount > 0
                  ? copy.status(result.exactCount, items.length)
                  : copy.closestNote}
              </p>
              {sendHref && (
                <a
                  href={sendHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="picker-send"
                >
                  {dict.bookingRequest.sendLooks}{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              )}
              {(look || tone) && (
                <button
                  type="button"
                  className="picker-reset"
                  onClick={() => {
                    setLook(null);
                    setTone(null);
                  }}
                >
                  {copy.reset}
                </button>
              )}
            </div>
          </form>
        </div>

        <ul className="picker-results">
          {shown.map((item, index) => (
            <li
              key={item.id}
              className="picker-result"
              data-category={item.category}
              data-tone={TONE_BY_WORK[item.id]}
            >
              <button
                type="button"
                className="picker-result-btn"
                aria-label={dict.hero.tileAriaLabel(
                  item.title,
                  item.categoryLabel || item.category,
                )}
                onClick={() => setViewerIndex(index)}
              >
                <PortfolioImage
                  photo={item}
                  alt=""
                  sizes="(max-width: 767px) 45vw, 20vw"
                  className="picker-result-img"
                />
              </button>
              <p className="picker-result-title">
                {locale === "ru" ? (
                  <span lang="en">{item.title}</span>
                ) : (
                  item.title
                )}
              </p>
            </li>
          ))}
          <li className="picker-result picker-result-more">
            <Link
              href={getLocalizedPath("/gallery/", locale)}
              className="button-secondary"
            >
              {copy.viewGallery} <span aria-hidden="true">→</span>
            </Link>
          </li>
        </ul>
      </div>

      <GalleryViewer
        items={shown}
        currentIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onNavigate={(next) => setViewerIndex(next)}
        locale={locale}
      />
    </section>
  );
}
