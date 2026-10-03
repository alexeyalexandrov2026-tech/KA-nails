import React from "react";
import { getDictionary, type Locale } from "../../lib/locales";
import {
  channelDisplay,
  channelHref,
  orderedChannels,
  studioFacts,
  type StudioFacts,
} from "../../lib/studio-facts";

interface ContactChannelsProps {
  locale: Locale;
  facts?: StudioFacts;
  /** Unique heading id when the block appears more than once on a page. */
  headingId?: string;
}

/** Phone, messengers, Instagram and email. Renders nothing until published. */
export function ContactChannels({
  locale,
  facts = studioFacts,
  headingId = "facts-channels-title",
}: ContactChannelsProps) {
  if (facts.channels.length === 0) return null;
  const dict = getDictionary(locale).facts;

  return (
    <section
      className="facts-block contact-channels"
      data-facts="channels"
      aria-labelledby={headingId}
    >
      <p className="eyebrow">{dict.channelsEyebrow}</p>
      <h2 id={headingId} className="facts-title">
        {dict.channelsTitle}
      </h2>
      <ul className="contact-channel-list">
        {orderedChannels(facts.channels).map((channel) => {
          const href = channelHref(channel);
          const external = href.startsWith("https:");
          return (
            <li key={`${channel.kind}:${channel.value}`}>
              <a
                className="contact-channel-link"
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                <span className="contact-channel-kind">
                  {dict.channelLabels[channel.kind]}
                  {channel.preferred && (
                    <span className="contact-channel-preferred">
                      {" · "}
                      {dict.preferredLabel}
                    </span>
                  )}
                </span>
                <span className="contact-channel-value">
                  {channelDisplay(channel)}
                </span>
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
