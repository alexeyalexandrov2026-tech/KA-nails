import React from "react";
import Image from "next/image";
import { getDictionary, type Locale } from "../../lib/locales";
import { pick, studioFacts, type StudioFacts } from "../../lib/studio-facts";

interface MasterProfileProps {
  locale: Locale;
  facts?: StudioFacts;
}

/** The master's name, short bio and optional portrait (home section 05). */
export function MasterProfile({
  locale,
  facts = studioFacts,
}: MasterProfileProps) {
  const { master } = facts;
  if (!master) return null;
  const dict = getDictionary(locale).facts;
  const name = pick(master.name, locale);

  return (
    <section
      className="facts-block master-profile"
      data-facts="master"
      aria-labelledby="facts-master-title"
    >
      {master.photo && (
        <Image
          className="master-photo"
          src={master.photo}
          alt={dict.masterPhotoAlt(name)}
          width={480}
          height={600}
          loading="lazy"
          unoptimized
        />
      )}
      <div className="master-text">
        <p className="eyebrow">{dict.masterEyebrow}</p>
        <h2 id="facts-master-title" className="section-title">
          {dict.masterTitle}
        </h2>
        <p className="master-name">{name}</p>
        <p className="master-bio">{pick(master.bio, locale)}</p>
      </div>
    </section>
  );
}
