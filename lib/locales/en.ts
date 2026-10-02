import type { LocaleDictionary } from "./types";

export const enLocale: LocaleDictionary = {
  locale: "en",
  meta: {
    siteTitle: "KA Nails",
    siteTitleTemplate: "%s | KA Nails",
    siteDescription:
      "Pedicure at KA Nails. Explore services and reserve an appointment when online booking becomes available.",
    servicesTitle: "Services — KA Nails",
    servicesDescription:
      "Published studio services, prices and durations will appear in the booking portal when online booking opens.",
    galleryTitle: "Gallery — Curated Studio Works | KA Nails",
    galleryDescription:
      "Explore authentic salon pedicure artistry, deep bordeaux gloss, royal cobalt, pastel lilac, and attentive care by KA Nails.",
    contactTitle: "Studio Information — KA Nails",
    contactDescription:
      "Studio address, contact details and opening hours for KA Nails.",
    bookTitle: "Book an Appointment — KA Nails",
    bookDescription:
      "Explore services and check appointment availability for KA Nails.",
  },
  nav: {
    brandName: "KA Nails",
    brandHomeAria: "KA Nails home",
    skipToContent: "Skip to content",
    services: "Services",
    gallery: "Gallery",
    contact: "Contact",
    book: "Book an appointment",
    navAriaLabel: "Main navigation",
    langSwitchAriaLabel: "Select language",
  },
  footer: {
    brandTitle: "KA Nails",
    brandSub: "Authentic salon portfolio & attentive care",
    services: "Services",
    gallery: "Gallery",
    book: "Book Appointment",
    contact: "Studio information",
    logoAlt: "KA Nails",
  },
  hero: {
    eyebrow: "KA Nails",
    headingLine1: "A little care.",
    headingLine2: "A moment of pure artistry.",
    description:
      "Carefully crafted pedicure artistry. Explore our verified portfolio of authentic salon works while online booking preparation is underway.",
    bookCta: "Book an appointment",
    galleryCta: "Explore gallery (19)",
    badge1: "Curated Pedicure Artistry",
    badge2: "Authentic Salon Portfolio",
    badge3: "Attentive Care",
    badgeText: "Studio Portfolio · 19 Verified Works",
    tileAriaLabel: (title, category) =>
      `Open artwork ${title}, category: ${category}`,
    collageAriaLabel: "Visual salon collage with authentic photography",
  },
  section02: {
    eyebrow: "02 / The Studio Exhibition",
    title: "Selected Works",
    scrollLeftAria: "Scroll gallery left",
    scrollRightAria: "Scroll gallery right",
    viewFullGallery: "View full gallery (19)",
    stageAriaLabel:
      "Interactive 3D multi-layer exhibition wall. Drag or swipe horizontally to navigate, select a photograph to expand.",
    cardAriaLabel: (title, category) =>
      `Open ${title}, ${category} pedicure. Press Enter to view high resolution.`,
    pauseMotionAria: "Pause exhibition motion",
    resumeMotionAria: "Resume exhibition motion",
  },
  pillars: {
    eyebrow: "03 / The Studio Standard",
    titleLine1: "Attentive care.",
    titleLine2: "Curated presentation.",
    lead: "Every set in our portfolio reflects thoughtful craftsmanship, clean application, and respect for natural nail health.",
    ariaLabel: "Studio Standards and Philosophy",
    pillar1: {
      num: "01",
      title: "Curated Color & Finish",
      text: "Rich pigments, high-gloss lacquers, and refined finishes selected to complement your skin tone and personal aesthetic.",
    },
    pillar2: {
      num: "02",
      title: "Clean Application",
      text: "Precise edging and seamless coats designed for elegant wear and lasting aesthetic appeal.",
    },
    pillar3: {
      num: "03",
      title: "Professional Cleanliness",
      text: "Carefully sanitized implements and dedicated station care prepared for every client visit.",
    },
  },
  servicesShowcase: {
    eyebrow: "04 / Studio Portfolio",
    title: "Styles & Treatments",
    ariaLabel: "Signature Studio Services",
    viewServiceInfo: "View service information",
    exploreInGallery: "Explore in gallery",
    card1: {
      tag: "Classic",
      duration: "Curated",
      name: "Classic Pedicure Artistry",
      desc: "Timeless deep bordeaux, neutral porcelain tones, and clean contours captured in our studio portfolio.",
    },
    card2: {
      tag: "Featured",
      duration: "Curated",
      name: "French & Accent Detailing",
      desc: "Refined smile lines, delicate bow motifs, and accent rings showcased in authentic salon photography.",
    },
    card3: {
      tag: "Color",
      duration: "Curated",
      name: "Vibrant Color & Shimmer",
      desc: "Royal cobalt gloss, cornflower drape, pastel lilac bliss, and rose shimmer lacquer finishes.",
    },
  },
  finalBooking: {
    eyebrow: "Studio Appointments",
    titleLine1: "Crafted with care.",
    titleLine2: "Captured in detail.",
    desc: "Explore our curated gallery of 19 verified salon works. Online booking will open once scheduling details are finalized with the studio.",
    ariaLabel: "Studio Portfolio & Appointments",
    viewStatusBtn: "View booking status",
    exploreGalleryBtn: "Explore gallery (19)",
  },
  servicesPage: {
    eyebrow: "The studio / Services",
    heading: "Choose your care.",
    lead: "Published services, prices and durations are shown in the studio’s booking below.",
  },
  galleryPage: {
    eyebrow: "KA Nails / Studio Exhibition",
    title: "Curated Pedicure Portfolio",
    sectionHeading: "Selected Works Portfolio",
    lead: "Explore our archive of authentic studio works. From refined French lines and deep bordeaux gloss to restorative aesthetic care and attentive salon detailing.",
    filterAriaLabel: "Filter gallery by technique",
    inventoryBadge: "Authentic Studio Archive",
    inventoryText: (uniquePhotos, additionalNeeded, target) =>
      `${uniquePhotos} authentic salon works displayed • ${additionalNeeded} additional works pending client curation (Target: ${target})`,
    statusText: (count, category) =>
      `Showing ${count} ${category === "All" ? "curated styles" : `${category} designs`}`,
    cardAriaLabel: (title, category) =>
      `View ${title}, ${category} pedicure. Press Enter or click to open full-screen.`,
    expandLabel: "Expand ↗",
    viewDetailLabel: "View detail →",
    ctaEyebrow: "Studio Appointments",
    ctaTitle: "Bring your inspiration to life.",
    ctaLead:
      "Every set in our gallery is customized to your natural nail health, skin tone, and personal aesthetic.",
    ctaBookBtn: "Book your appointment",
    categoryLabels: {
      All: "All",
      Classic: "Classic",
      Color: "Color",
      French: "French",
      "Glitter / Detail": "Glitter / Detail",
      Restorative: "Restorative",
    },
  },
  contactPage: {
    eyebrow: "KA Nails / Studio information",
    heading: "Stay close.",
    noticeTitle: "Studio details are coming soon.",
    noticeText:
      "The studio’s address, contact information and opening hours will appear here once they are confirmed.",
  },
  bookPage: {
    eyebrow: "Your studio appointment",
    heading: "A time for you.",
  },
  bookingPanel: {
    noticeEyebrow: "Online appointments",
    noticeTitle: "Online booking is not available yet.",
    noticeText:
      "Services, prices and available appointments will appear here when the studio opens online booking.",
    helpTextLead: "Choose your service and appointment below. You can also ",
    openFullPage: "open booking in a full page",
    helpTextTrail: ".",
    frameTitle: "KA Nails appointment booking",
    panelAriaLabel: "Studio booking",
  },
  lightbox: {
    dialogAriaLabel: (title, current, total) =>
      `${title} — Artwork ${current} of ${total}`,
    share: "Share",
    linkCopied: "Link Copied",
    closeAria: "Close gallery viewer (Escape)",
    prevAria: "Previous artwork (Left Arrow)",
    nextAria: "Next artwork (Right Arrow)",
    bookBtn: "Book an appointment",
    bookBtnAria: (title) => `Book an appointment for ${title}`,
    copyLinkAria: "Copy link to this artwork",
  },
};
