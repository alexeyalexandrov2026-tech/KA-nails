export type Locale = "en" | "ru";

export interface LocaleDictionary {
  locale: Locale;
  meta: {
    /** Title (home: the full title) and description of every page. */
    pages: Record<
      "home" | "services" | "gallery" | "contact" | "book",
      { title: string; description: string }
    >;
    /** Services page description once the menu from studio facts is published. */
    servicesDescriptionWithMenu: string;
    /** Open Graph locale, e.g. "en_US". */
    ogLocale: string;
    shareImageAlt: string;
  };
  nav: {
    brandName: string;
    brandHomeAria: string;
    skipToContent: string;
    services: string;
    gallery: string;
    contact: string;
    book: string;
    navAriaLabel: string;
    langSwitchAriaLabel: string;
  };
  footer: {
    brandTitle: string;
    brandSub: string;
    services: string;
    gallery: string;
    book: string;
    contact: string;
    logoAlt: string;
    navAriaLabel: string;
    worksAriaLabel: string;
    copyright: string;
  };
  hero: {
    eyebrow: string;
    headingLine1: string;
    headingLine2: string;
    description: string;
    bookCta: string;
    galleryCta: string;
    badge1: string;
    badge2: string;
    badge3: string;
    badgeText: string;
    tileAriaLabel: (title: string, category: string) => string;
    collageAriaLabel: string;
  };
  section02: {
    eyebrow: string;
    title: string;
    scrollLeftAria: string;
    scrollRightAria: string;
    viewFullGallery: string;
    stageAriaLabel: string;
    cardAriaLabel: (title: string, category: string) => string;
    pauseMotionAria: string;
    resumeMotionAria: string;
    footnote: (count: number) => string;
    footnoteLink: string;
  };
  pillars: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    lead: string;
    ariaLabel: string;
    pillar1: { num: string; title: string; text: string };
    pillar2: { num: string; title: string; text: string };
    pillar3: { num: string; title: string; text: string };
  };
  servicesShowcase: {
    eyebrow: string;
    title: string;
    ariaLabel: string;
    viewServiceInfo: string;
    exploreInGallery: string;
    card1: { tag: string; name: string; desc: string };
    card2: { tag: string; name: string; desc: string };
    card3: { tag: string; name: string; desc: string };
  };
  stylePicker: {
    eyebrow: string;
    title: string;
    lead: string;
    ariaLabel: string;
    lookLegend: string;
    toneLegend: string;
    anyOption: string;
    tones: Record<"light" | "deep" | "bright", string>;
    status: (count: number, total: number) => string;
    closestNote: string;
    reset: string;
    viewGallery: string;
  };
  finalBooking: {
    eyebrow: string;
    titleLine1: string;
    titleLine2: string;
    desc: string;
    ariaLabel: string;
    viewStatusBtn: string;
    exploreGalleryBtn: string;
  };
  servicesPage: {
    eyebrow: string;
    heading: string;
    /** Shown while no service menu is published. */
    lead: string;
    /** Shown once the service menu from studio facts is published. */
    leadWithMenu: string;
    stripTitle: string;
    stripLink: string;
  };
  galleryPage: {
    eyebrow: string;
    title: string;
    sectionHeading: string;
    lead: string;
    filterAriaLabel: string;
    inventoryBadge: string;
    inventoryText: (uniquePhotos: number) => string;
    statusText: (count: number, category: string) => string;
    cardAriaLabel: (title: string, category: string) => string;
    expandLabel: string;
    viewDetailLabel: string;
    ctaEyebrow: string;
    ctaTitle: string;
    ctaLead: string;
    ctaBookBtn: string;
    categoryLabels: Record<string, string>;
  };
  contactPage: {
    eyebrow: string;
    heading: string;
    noticeTitle: string;
    noticeText: string;
  };
  bookPage: {
    eyebrow: string;
    heading: string;
  };
  bookingPanel: {
    noticeEyebrow: string;
    noticeTitle: string;
    noticeText: string;
    helpTextLead: string;
    openFullPage: string;
    helpTextTrail: string;
    frameTitle: string;
    panelAriaLabel: string;
    /** Link to the messenger request form while online booking is off. */
    requestLink: string;
  };
  facts: {
    servicesEyebrow: string;
    servicesTitle: string;
    durationLabel: string;
    priceLabel: string;
    priceFrom: (price: string) => string;
    addOnsTitle: string;
    menuNotesTitle: string;
    channelsEyebrow: string;
    channelsTitle: string;
    preferredLabel: string;
    channelLabels: Record<
      "phone" | "whatsapp" | "telegram" | "instagram" | "email",
      string
    >;
    detailsEyebrow: string;
    detailsTitle: string;
    addressLabel: string;
    hoursLabel: string;
    closedLabel: string;
    mapLink: string;
    masterEyebrow: string;
    masterTitle: string;
    masterPhotoAlt: (name: string) => string;
  };
  bookingRequest: {
    eyebrow: string;
    title: string;
    lead: string;
    serviceLabel: string;
    serviceAny: string;
    lookLabel: string;
    lookAny: string;
    timeLabel: string;
    timeHint: string;
    nameLabel: string;
    notesLabel: string;
    sendVia: Record<"whatsapp" | "telegram" | "email", string>;
    copied: string;
    privacy: string;
    lookOnWhatsApp: string;
    lookOnWhatsAppAria: (title: string) => string;
    sendLooks: string;
  };
  chat: {
    launcher: string;
    title: string;
    close: string;
    greeting: string;
    inputLabel: string;
    placeholder: string;
    send: string;
    typing: string;
    you: string;
    assistant: string;
    privacy: string;
    whatsapp: string;
    error: string;
    limit: string;
  };
  lightbox: {
    dialogAriaLabel: (title: string, current: number, total: number) => string;
    share: string;
    linkCopied: string;
    closeAria: string;
    prevAria: string;
    nextAria: string;
    bookBtn: string;
    bookBtnAria: (title: string) => string;
    copyLinkAria: string;
  };
}
