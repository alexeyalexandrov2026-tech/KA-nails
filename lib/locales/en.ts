import type { LocaleDictionary } from "./types";

export const enLocale: LocaleDictionary = {
  locale: "en",
  meta: {
    pages: {
      home: {
        title: "KA Nails",
        description:
          "Pedicure at KA Nails. Explore services and reserve an appointment when online booking becomes available.",
      },
      services: {
        title: "Services",
        description:
          "Pedicure services at KA Nails. Prices and durations will be published here once they are confirmed.",
      },
      gallery: {
        title: "Gallery — Curated Studio Works",
        description:
          "Explore authentic salon pedicure artistry, deep bordeaux gloss, royal cobalt, pastel lilac, and attentive care by KA Nails.",
      },
      contact: {
        title: "Studio information",
        description:
          "Studio address, contact details and opening hours for KA Nails.",
      },
      book: {
        title: "Book an appointment",
        description:
          "Explore services and check appointment availability for KA Nails.",
      },
      privacy: {
        title: "Privacy policy",
        description:
          "How KA Nails handles information on its website, in the AI assistant and in the KA Nails Android app.",
      },
    },
    servicesDescriptionWithMenu: "Pedicure services and prices at KA Nails.",
    ogLocale: "en_US",
    shareImageAlt:
      "KA Nails logo on a cream background beside three pedicure works from the studio portfolio",
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
    privacy: "Privacy",
    logoAlt: "KA Nails",
    navAriaLabel: "Footer",
    worksAriaLabel: "Works from the studio portfolio",
    copyright: "© KA Nails",
  },
  hero: {
    eyebrow: "KA Nails",
    headingLine1: "A little care.",
    headingLine2: "A moment of pure artistry.",
    description:
      "Carefully crafted pedicure artistry. Explore our portfolio of real studio works while online booking preparation is underway.",
    bookCta: "Book an appointment",
    galleryCta: "Explore gallery (19)",
    badge1: "Curated Pedicure Artistry",
    badge2: "Authentic Salon Portfolio",
    badge3: "Attentive Care",
    badgeText: "Studio Portfolio · 19 Real Works",
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
    footnote: (count) => `${count} pedicure works in the studio portfolio`,
    footnoteLink: "See the full gallery",
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
      name: "Classic Pedicure Artistry",
      desc: "Timeless deep bordeaux, neutral porcelain tones, and clean contours captured in our studio portfolio.",
    },
    card2: {
      tag: "French",
      name: "French & Accent Detailing",
      desc: "Refined smile lines, delicate bow motifs, and accent rings showcased in authentic salon photography.",
    },
    card3: {
      tag: "Color",
      name: "Vibrant Color & Shimmer",
      desc: "Royal cobalt gloss, cornflower drape, pastel lilac bliss, and rose shimmer lacquer finishes.",
    },
  },
  stylePicker: {
    eyebrow: "05 / Find your style",
    title: "Find your style.",
    lead: "Two quick choices, and we will show the pedicure works from our portfolio that match.",
    ariaLabel: "Pedicure style finder",
    lookLegend: "1. Choose a look",
    toneLegend: "2. Choose a tone",
    anyOption: "Any",
    tones: {
      light: "Light & nude",
      deep: "Deep & dark",
      bright: "Bright color",
    },
    status: (count, total) => `Matching works: ${count} of ${total}`,
    closestNote: "No exact match yet, so here are the closest works.",
    reset: "Start over",
    viewGallery: "See the full gallery",
  },
  finalBooking: {
    eyebrow: "Studio Appointments",
    titleLine1: "Crafted with care.",
    titleLine2: "Captured in detail.",
    desc: "Explore our curated gallery of 19 real studio works. Online booking will open once scheduling details are finalized with the studio.",
    ariaLabel: "Studio Portfolio & Appointments",
    viewStatusBtn: "View booking status",
    exploreGalleryBtn: "Explore gallery (19)",
  },
  servicesPage: {
    eyebrow: "The studio / Services",
    heading: "Choose your care.",
    lead: "Pedicure care at KA Nails. The service menu with prices and durations will be published here once it is confirmed.",
    leadWithMenu: "Every service is pedicure care. Prices are listed below.",
    stripTitle: "From the studio portfolio",
    stripLink: "See the full gallery",
  },
  galleryPage: {
    eyebrow: "KA Nails / Studio Exhibition",
    title: "Curated Pedicure Portfolio",
    sectionHeading: "Selected Works Portfolio",
    lead: "Explore our archive of authentic studio works. From refined French lines and deep bordeaux gloss to restorative aesthetic care and attentive salon detailing.",
    filterAriaLabel: "Filter gallery by technique",
    inventoryBadge: "Authentic Studio Archive",
    inventoryText: (uniquePhotos) =>
      `${uniquePhotos} authentic salon works displayed`,
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
      "The studio’s address and opening hours will appear here once they are confirmed.",
  },
  privacyPage: {
    eyebrow: "KA Nails / Privacy",
    heading: "Privacy policy",
    effective: "Effective November 14, 2026",
    lead: "This policy explains what information the KA Nails website, its AI assistant and the KA Nails Android app handle, why, and for how long.",
    sections: [
      {
        id: "who",
        title: "Who is responsible",
        paragraphs: [
          "KA Nails, the pedicure studio of Karina Mamedova, is responsible for the information described in this policy.",
          "The KA Nails Android app (com.ka_nails_miami.app) is published on Google Play by its developer, Gorgona One AI. The app itself collects no personal information.",
        ],
      },
      {
        id: "app",
        title: "The KA Nails Android app",
        paragraphs: [
          "The app does not collect, send or share personal information. It does not request internet access and contains no analytics, advertising, crash reporting or sign-in tools.",
          "The app saves one setting on your device: the language you choose. This setting is left out of device backups and transfers, and it is removed when you clear the app’s data or uninstall the app.",
          "Booking and the chat open the KA Nails website in your browser, where the sections below about the website apply. The phone and WhatsApp buttons open your phone app or WhatsApp, and nothing is sent until you place the call or send the message.",
        ],
      },
      {
        id: "website",
        title: "Visiting the website",
        paragraphs: [
          "The website has no accounts, advertising or analytics, and it sets no cookies of its own.",
          "The website is hosted on Cloudflare Pages. To deliver pages and protect the site, Cloudflare processes technical information such as your IP address and browser details under its own privacy policy.",
        ],
      },
      {
        id: "request-form",
        title: "The appointment request form",
        paragraphs: [
          "The request form on the booking page stays in your browser. The website does not store or send it.",
          "When you press the send button, WhatsApp or another messaging app opens with a ready message. Nothing is sent until you press send there. Your message then reaches the studio through that service, under that service’s own privacy policy.",
        ],
      },
      {
        id: "assistant",
        title: "The AI assistant",
        paragraphs: [
          "Messages you write to the assistant go to the KA Nails chat service on Cloudflare Workers, and the replies are written by an AI model that runs on Cloudflare Workers AI. The conversation itself is not saved.",
          "Before a message is sent, Cloudflare Turnstile checks that it comes from a person; Cloudflare processes information about your browser and device for this check. The chat service also uses your IP address briefly to limit how many messages can be sent per minute, and does not save it.",
          "If you ask the assistant to request an appointment, the details you confirm are saved: your name, phone number, the chosen service and add-ons, your preferred time, your comment and the language of the conversation. They are kept in a private Supabase database used only by KA Nails and sent to the studio by email through Cloudflare and, where the studio has turned it on, as a Telegram message to the studio’s own chat.",
        ],
      },
      {
        id: "use",
        title: "How information is used and shared",
        paragraphs: [
          "KA Nails uses this information only to answer you and arrange your appointment. It is not sold and not used for advertising.",
          "It is handled only by the services named in this policy: Cloudflare (hosting, the chat service, AI replies, the human check and email delivery), Supabase (the database of appointment requests) and Telegram (studio notifications, where turned on). Google Play distributes the app under Google’s privacy policy.",
        ],
      },
      {
        id: "retention",
        title: "How long information is kept",
        paragraphs: [
          "Appointment requests sent through the assistant are kept for up to 12 months and then deleted, or earlier if you ask.",
          "Messages you send to the studio directly by phone, WhatsApp or another messenger stay in that service’s history.",
        ],
      },
      {
        id: "security",
        title: "Security",
        paragraphs: [
          "The website and the chat service use encrypted connections (HTTPS). The database of appointment requests is closed to the public; only the chat service can write to it.",
        ],
      },
      {
        id: "changes",
        title: "Changes to this policy",
        paragraphs: [
          "If this policy changes, this page and its effective date will be updated.",
        ],
      },
    ],
    contact: {
      id: "contact",
      title: "Your requests and contact",
      text: "To see, correct or delete the information KA Nails holds about you, or to ask about this policy, contact the studio:",
    },
  },
  bookPage: {
    eyebrow: "Your studio appointment",
    heading: "A time for you.",
  },
  bookingPanel: {
    noticeEyebrow: "Online appointments",
    noticeTitle: "Online booking is not available yet.",
    noticeText:
      "Available appointments will appear here when the studio opens online booking.",
    helpTextLead: "Choose your service and appointment below. You can also ",
    openFullPage: "open booking in a full page",
    helpTextTrail: ".",
    frameTitle: "KA Nails appointment booking",
    panelAriaLabel: "Studio booking",
    requestLink: "Request an appointment",
  },
  facts: {
    servicesEyebrow: "Pedicure menu",
    servicesTitle: "Services and prices",
    durationLabel: "Duration",
    priceLabel: "Price",
    priceFrom: (price) => `from ${price}`,
    addOnsTitle: "Add-ons",
    menuNotesTitle: "Please note",
    channelsEyebrow: "Get in touch",
    channelsTitle: "Contact the studio",
    preferredLabel: "Preferred",
    channelLabels: {
      phone: "Phone",
      whatsapp: "WhatsApp",
      telegram: "Telegram",
      instagram: "Instagram",
      email: "Email",
    },
    detailsEyebrow: "Visit",
    detailsTitle: "Address and hours",
    addressLabel: "Address",
    hoursLabel: "Opening hours",
    closedLabel: "Closed",
    mapLink: "Open in maps",
    masterEyebrow: "06 / Your master",
    masterTitle: "Meet your master",
    masterPhotoAlt: (name) => `${name}, KA Nails pedicure master`,
  },
  bookingRequest: {
    eyebrow: "While online booking is being prepared",
    title: "Request an appointment",
    lead: "Choose a look and a convenient time. Your messenger opens with a ready message, and nothing is sent until you press send there.",
    serviceLabel: "Service (optional)",
    serviceAny: "I will decide with the master",
    lookLabel: "Look from the portfolio (optional)",
    lookAny: "I will choose with the master",
    timeLabel: "Preferred days and time",
    timeHint: "For example: weekday evenings or Saturday morning",
    nameLabel: "Your name (optional)",
    notesLabel: "Anything else (optional)",
    sendVia: {
      whatsapp: "Send via WhatsApp",
      telegram: "Copy and open Telegram",
      email: "Send by email",
    },
    copied: "The message is copied. Paste it into the Telegram chat.",
    privacy: "This form is not stored or sent by the website.",
    lookOnWhatsApp: "Book this look on WhatsApp",
    lookOnWhatsAppAria: (title) => `Book ${title} on WhatsApp`,
    sendLooks: "Send these looks on WhatsApp",
  },
  chat: {
    launcher: "Ask or book",
    title: "KA Nails assistant",
    close: "Close chat",
    greeting:
      "Hello! Ask me about our pedicures, prices, or how to request an appointment.",
    inputLabel: "Your message",
    placeholder: "Ask about services or request a time…",
    send: "Send",
    typing: "The assistant is writing…",
    verifying: "Verifying your browser…",
    verificationPrompt:
      "Complete the Cloudflare verification below to send your message.",
    verificationError:
      "Cloudflare could not verify your browser. Press Send to retry, or reopen the chat if the check does not appear.",
    you: "You",
    assistant: "Assistant",
    privacy:
      "Replies are written by AI. Your contact details go only to the studio.",
    whatsapp: "Write on WhatsApp instead",
    error:
      "The message was not sent. Check your connection and try again, or write to the studio on WhatsApp.",
    limit:
      "This conversation is long enough for the assistant. Please continue on WhatsApp or by phone.",
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
