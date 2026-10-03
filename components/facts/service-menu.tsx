import React from "react";
import { getDictionary, type Locale } from "../../lib/locales";
import {
  formatDuration,
  pick,
  priceText,
  studioFacts,
  type StudioFacts,
} from "../../lib/studio-facts";

interface ServiceMenuProps {
  locale: Locale;
  facts?: StudioFacts;
}

/**
 * Pedicure menu with prices (and durations where the owner gave them), then
 * the add-ons and the menu's notes. Renders nothing until published.
 */
export function ServiceMenu({ locale, facts = studioFacts }: ServiceMenuProps) {
  if (facts.services.length === 0) return null;
  const dict = getDictionary(locale).facts;
  // Without durations a row shows only its price, as on a printed menu: the
  // "Price" label is left to screen readers.
  const priceOnly = facts.services.every(
    (service) => service.durationMinutes === undefined,
  );

  return (
    <section
      className="facts-block service-menu"
      data-facts="services"
      aria-labelledby="facts-services-title"
    >
      <p className="eyebrow">{dict.servicesEyebrow}</p>
      <h2 id="facts-services-title" className="facts-title">
        {dict.servicesTitle}
      </h2>
      <ul
        className={`service-menu-list${priceOnly ? " service-menu-price-only" : ""}`}
      >
        {facts.services.map((service) => (
          <li key={service.id} className="service-menu-item">
            <div className="service-menu-text">
              <h3 className="service-menu-name">
                {pick(service.name, locale)}
              </h3>
              {service.description && (
                <p className="service-menu-desc">
                  {pick(service.description, locale)}
                </p>
              )}
            </div>
            <dl className="service-menu-meta">
              {service.durationMinutes !== undefined && (
                <div>
                  <dt>{dict.durationLabel}</dt>
                  <dd>{formatDuration(service.durationMinutes, locale)}</dd>
                </div>
              )}
              <div>
                <dt className={priceOnly ? "sr-only" : undefined}>
                  {dict.priceLabel}
                </dt>
                <dd className="service-menu-price">
                  {priceText(service.price, locale, dict.priceFrom)}
                </dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>

      {facts.addOns.length > 0 && (
        <>
          <h3 className="service-addons-title">{dict.addOnsTitle}</h3>
          <ul className="service-addon-list">
            {facts.addOns.map((addOn) => (
              <li key={addOn.id} className="service-addon">
                <span className="service-addon-text">
                  <span className="service-addon-name">
                    {pick(addOn.name, locale)}
                  </span>
                  {addOn.durationMinutes !== undefined && (
                    <span className="service-addon-duration">
                      {formatDuration(addOn.durationMinutes, locale)}
                    </span>
                  )}
                  {addOn.description && (
                    <span className="service-addon-desc">
                      {pick(addOn.description, locale)}
                    </span>
                  )}
                </span>
                <span className="service-addon-price">
                  {priceText(addOn.price, locale, dict.priceFrom)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {facts.menuNotes.length > 0 && (
        <div className="service-menu-notes">
          <h3 className="service-menu-notes-title">{dict.menuNotesTitle}</h3>
          {facts.menuNotes.map((note, i) => (
            <p key={i}>{pick(note, locale)}</p>
          ))}
        </div>
      )}
    </section>
  );
}
