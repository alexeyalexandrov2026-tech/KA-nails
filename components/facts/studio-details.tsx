import React from "react";
import { getDictionary, type Locale } from "../../lib/locales";
import { pick, studioFacts, type StudioFacts } from "../../lib/studio-facts";

interface StudioDetailsProps {
  locale: Locale;
  facts?: StudioFacts;
}

/** Address (with a map link, no embed) and opening hours. */
export function StudioDetails({
  locale,
  facts = studioFacts,
}: StudioDetailsProps) {
  const { address, hours } = facts;
  if (!address && hours.length === 0) return null;
  const dict = getDictionary(locale).facts;

  return (
    <section
      className="facts-block studio-details"
      data-facts="details"
      aria-labelledby="facts-details-title"
    >
      <p className="eyebrow">{dict.detailsEyebrow}</p>
      <h2 id="facts-details-title" className="facts-title">
        {dict.detailsTitle}
      </h2>
      <div className="studio-details-grid">
        {address && (
          <div className="studio-details-part">
            <h3 className="studio-details-label">{dict.addressLabel}</h3>
            <address className="studio-address">
              {address.lines.map((line, i) => (
                <span key={i} className="studio-address-line">
                  {pick(line, locale)}
                </span>
              ))}
            </address>
            {address.mapUrl && (
              <a
                className="studio-map-link"
                href={address.mapUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {dict.mapLink} <span aria-hidden="true">↗</span>
              </a>
            )}
          </div>
        )}
        {hours.length > 0 && (
          <div className="studio-details-part">
            <h3 className="studio-details-label">{dict.hoursLabel}</h3>
            <dl className="studio-hours">
              {hours.map((row, i) => (
                <div key={i} className="studio-hours-row">
                  <dt>{pick(row.days, locale)}</dt>
                  <dd>
                    {row.closed ? (
                      dict.closedLabel
                    ) : (
                      <>
                        <time>{row.opens}</time>–<time>{row.closes}</time>
                      </>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </div>
    </section>
  );
}
