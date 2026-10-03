import React from "react";
import { getDictionary, type Locale } from "../../lib/locales";
import {
  formatDuration,
  formatPrice,
  pick,
  studioFacts,
  type StudioFacts,
} from "../../lib/studio-facts";

interface ServiceMenuProps {
  locale: Locale;
  facts?: StudioFacts;
}

/** Pedicure menu with durations and prices. Renders nothing until published. */
export function ServiceMenu({ locale, facts = studioFacts }: ServiceMenuProps) {
  if (facts.services.length === 0) return null;
  const dict = getDictionary(locale).facts;

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
      <ul className="service-menu-list">
        {facts.services.map((service) => {
          const price = formatPrice(service.price, locale);
          return (
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
                <div>
                  <dt>{dict.durationLabel}</dt>
                  <dd>{formatDuration(service.durationMinutes, locale)}</dd>
                </div>
                <div>
                  <dt>{dict.priceLabel}</dt>
                  <dd className="service-menu-price">
                    {service.price.from ? dict.priceFrom(price) : price}
                  </dd>
                </div>
              </dl>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
