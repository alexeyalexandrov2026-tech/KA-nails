"use client";

import React, { useId, useMemo, useState, useSyncExternalStore } from "react";
import { getGalleryItems } from "../../lib/gallery-data";
import { getDictionary, type Locale } from "../../lib/locales";
import {
  bookingMessage,
  bookingSubject,
  requestLinks,
} from "../../lib/booking-message";
import {
  pick,
  priceText,
  studioFacts,
  type ServiceFact,
  type StudioFacts,
} from "../../lib/studio-facts";

// The query string does not change while the page is open.
const noSubscription = () => () => {};

interface BookingRequestProps {
  locale: Locale;
  facts?: StudioFacts;
}

/**
 * Appointment request through the studio's own messengers. Renders nothing
 * until WhatsApp, Telegram or email is published in studio facts. The page
 * only composes the message; the visitor sends it from their own app.
 */
export function BookingRequest({
  locale,
  facts = studioFacts,
}: BookingRequestProps) {
  const { bookingRequest: dict, facts: factsDict } = getDictionary(locale);
  const works = useMemo(() => getGalleryItems(locale), [locale]);
  const [serviceId, setServiceId] = useState("");
  // null until the visitor picks a look; then their choice wins.
  const [lookChoice, setLookChoice] = useState<string | null>(null);
  const [preferredTime, setPreferredTime] = useState("");
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [copied, setCopied] = useState(false);
  const id = useId();

  // A look chosen elsewhere on the site arrives as /book/?look=work-NN.
  // The static HTML has no query string, so the server snapshot is empty.
  const lookFromUrl = useSyncExternalStore(
    noSubscription,
    () => new URLSearchParams(window.location.search).get("look") ?? "",
    () => "",
  );
  const lookId =
    lookChoice ??
    (works.some((work) => work.id === lookFromUrl) ? lookFromUrl : "");
  const look = works.find((work) => work.id === lookId);
  // The service as the menu shows it, with its price.
  const serviceText = (service: ServiceFact) =>
    `${pick(service.name, locale)} — ${priceText(service.price, locale, factsDict.priceFrom)}`;
  const service = facts.services.find((item) => item.id === serviceId);
  const text = bookingMessage(locale, {
    service: service && serviceText(service),
    looks: look ? [{ id: look.id, title: look.title }] : [],
    preferredTime,
    name,
    notes,
  });
  const links = requestLinks(facts.channels, bookingSubject(locale), text);
  if (links.length === 0) return null;

  return (
    <section
      className="facts-block booking-request"
      data-facts="request"
      aria-labelledby={`${id}-title`}
    >
      <p className="eyebrow">{dict.eyebrow}</p>
      <h2 id={`${id}-title`} className="facts-title">
        {dict.title}
      </h2>
      <p className="booking-request-lead">{dict.lead}</p>

      <form
        className="booking-request-form"
        onSubmit={(event) => event.preventDefault()}
      >
        {facts.services.length > 0 && (
          <label className="request-field">
            <span>{dict.serviceLabel}</span>
            <select
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
            >
              <option value="">{dict.serviceAny}</option>
              {facts.services.map((item) => (
                <option key={item.id} value={item.id}>
                  {serviceText(item)}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="request-field">
          <span>{dict.lookLabel}</span>
          <select
            value={lookId}
            onChange={(event) => setLookChoice(event.target.value)}
          >
            <option value="">{dict.lookAny}</option>
            {works.map((work) => (
              <option key={work.id} value={work.id}>
                {work.title}
              </option>
            ))}
          </select>
        </label>

        <label className="request-field">
          <span>{dict.timeLabel}</span>
          <input
            type="text"
            value={preferredTime}
            onChange={(event) => setPreferredTime(event.target.value)}
            aria-describedby={`${id}-time-hint`}
            autoComplete="off"
          />
          <small id={`${id}-time-hint`} className="request-hint">
            {dict.timeHint}
          </small>
        </label>

        <label className="request-field">
          <span>{dict.nameLabel}</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoComplete="given-name"
          />
        </label>

        <label className="request-field request-field-wide">
          <span>{dict.notesLabel}</span>
          <textarea
            value={notes}
            rows={3}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>

        <div className="request-actions">
          {links.map((link, index) => (
            <a
              key={link.kind}
              className={index === 0 ? "button" : "button-secondary"}
              href={link.href}
              {...(link.href.startsWith("https:")
                ? { target: "_blank", rel: "noopener noreferrer" }
                : {})}
              onClick={
                link.copyFirst
                  ? async () => {
                      try {
                        await navigator.clipboard.writeText(text);
                        setCopied(true);
                      } catch {
                        setCopied(false);
                      }
                    }
                  : undefined
              }
            >
              {dict.sendVia[link.kind]}
            </a>
          ))}
        </div>
        <p className="request-status" role="status">
          {copied ? dict.copied : ""}
        </p>
        <p className="request-privacy">{dict.privacy}</p>
      </form>
    </section>
  );
}
