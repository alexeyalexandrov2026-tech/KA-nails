export type Locale = "en" | "ru";

export interface LocaleDictionary {
  locale: Locale;
  meta: {
    siteTitle: string;
    siteTitleTemplate: string;
    siteDescription: string;
    servicesTitle: string;
    servicesDescription: string;
    galleryTitle: string;
    galleryDescription: string;
    contactTitle: string;
    contactDescription: string;
    bookTitle: string;
    bookDescription: string;
  };
  nav: {
    brandName: string;
    brandSubtitle: string;
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
    card1: { tag: string; duration: string; name: string; desc: string };
    card2: { tag: string; duration: string; name: string; desc: string };
    card3: { tag: string; duration: string; name: string; desc: string };
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
    lead: string;
  };
  galleryPage: {
    eyebrow: string;
    title: string;
    lead: string;
    filterAriaLabel: string;
    inventoryBadge: string;
    inventoryText: (
      uniquePhotos: number,
      additionalNeeded: number,
      target: number,
    ) => string;
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
