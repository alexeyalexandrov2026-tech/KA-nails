import React from "react";
import { PageIntro } from "./page-intro";
import { getDictionary, type Locale } from "../lib/locales";
import {
  channelDisplay,
  channelHref,
  orderedChannels,
  studioFacts,
} from "../lib/studio-facts";

interface PrivacyContentProps {
  locale?: Locale;
}

// Privacy requests go to the studio's direct channels, never to social profiles.
const REQUEST_CHANNELS = new Set(["phone", "whatsapp", "email"]);

export function PrivacyContent({ locale = "en" }: PrivacyContentProps) {
  const dict = getDictionary(locale);
  const page = dict.privacyPage;
  const channels = orderedChannels(studioFacts.channels).filter((channel) =>
    REQUEST_CHANNELS.has(channel.kind),
  );

  return (
    <div className="page privacy-page">
      <PageIntro
        locale={locale}
        eyebrow={page.eyebrow}
        heading={page.heading}
        photoId="work-16"
        lead={
          <>
            <p className="privacy-effective">{page.effective}</p>
            <p className="lead">{page.lead}</p>
          </>
        }
      />
      <article className="privacy-policy">
        {page.sections.map((section) => (
          <section
            key={section.id}
            id={section.id}
            aria-labelledby={`${section.id}-title`}
          >
            <h2 id={`${section.id}-title`}>{section.title}</h2>
            {section.paragraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </section>
        ))}
        <section id={page.contact.id} aria-labelledby="privacy-contact-title">
          <h2 id="privacy-contact-title">{page.contact.title}</h2>
          <p>{page.contact.text}</p>
          {channels.length > 0 && (
            <ul className="privacy-contact">
              {channels.map((channel) => (
                <li key={`${channel.kind}:${channel.value}`}>
                  <a href={channelHref(channel)}>
                    {dict.facts.channelLabels[channel.kind]}:{" "}
                    {channelDisplay(channel)}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  );
}
