import fs from "node:fs/promises";
import path from "node:path";

const galleryItems = [
  {
    id: "work-001",
    title: "Liquid Champagne Chrome French",
    category: "French",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Micro French · Glazed Chrome · Hard Gel",
    finish: "High-Gloss Mirror",
    palette: ["#1c1815", "#2a221c", "#d4af37", "#fdf8f2"],
    nailShape: "Almond",
    accentType: "chrome-french",
    alt: "Almond shaped nails featuring sheer warm nude base with liquid champagne chrome micro French tips",
    featured: true,
    layer: 1,
  },
  {
    id: "work-002",
    title: "Oat Milk & Micro Gold Foil",
    category: "Minimal",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Structured BIAB · 24K Leaf · E-File Manicure",
    finish: "Satin Sheen",
    palette: ["#231d19", "#352b24", "#e8c39e", "#faf5ef"],
    nailShape: "Oval",
    accentType: "gold-foil",
    alt: "Clean oval nails in milky oat-nude gel accented with delicate flecks of 24k gold leaf",
    featured: true,
    layer: 2,
  },
  {
    id: "work-003",
    title: "Tortoiseshell & Amber Glass",
    category: "Nail Art",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Layered Jelly Gel · Hand-Painted Inks",
    finish: "High-Gloss Glass",
    palette: ["#18120e", "#3a2211", "#a05218", "#f4a261"],
    nailShape: "Squoval",
    accentType: "tortoiseshell",
    alt: "Rich tortoiseshell art on square-oval nails with translucent amber jelly and deep espresso layers",
    featured: true,
    layer: 3,
  },
  {
    id: "work-004",
    title: "Glazed Donut Pearl Shimmer",
    category: "Chrome",
    aspect: "landscape",
    width: 1000,
    height: 750,
    technique: "Pearl Chrome Powder · Sheer Nude Base",
    finish: "Iridescent Glaze",
    palette: ["#201c18", "#2e2924", "#ffffff", "#f0e6df"],
    nailShape: "Almond",
    accentType: "glazed-pearl",
    alt: "Almond nails with an ethereal white pearl chrome glaze over sheer blush nude",
    featured: true,
    layer: 1,
  },
  {
    id: "work-005",
    title: "Japanese Structured BIAB Neutral",
    category: "Gel & Care",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Apex Alignment · Cuticle E-File · Japanese Gel",
    finish: "Natural Gloss",
    palette: ["#221d19", "#382e27", "#d8b49e", "#fdf8f4"],
    nailShape: "Round",
    accentType: "biab-clean",
    alt: "Impeccably clean Russian e-file manicure with natural nude Japanese structured gel apex",
    featured: true,
    layer: 2,
  },
  {
    id: "work-006",
    title: "Obsidian Velvet Cat-Eye",
    category: "Editorial",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Magnetic Cat-Eye · Deep Jet Pigment",
    finish: "Dimensional Velvet",
    palette: ["#0f0d0c", "#1d1917", "#6b625b", "#dcd6cd"],
    nailShape: "Coffin",
    accentType: "velvet-cateye",
    alt: "Sculpted coffin nails with multidimensional velvet magnetic cat-eye shimmer over obsidian black",
    featured: true,
    layer: 4,
  },
  {
    id: "work-007",
    title: "Negative Space Architectural Line",
    category: "Minimal",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Precision Linework · Clean Cuticle Border",
    finish: "Matte & Gloss Contrast",
    palette: ["#1f1915", "#322720", "#c49a7a", "#fffbf7"],
    nailShape: "Almond",
    accentType: "geometric-line",
    alt: "Sheer beige almond nails featuring ultra-crisp black and rose-gold negative space geometric lines",
    featured: true,
    layer: 1,
  },
  {
    id: "work-008",
    title: "Bordeaux Wine Deep Gloss",
    category: "Gel & Care",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Double-Coat Pigment · Russian Manicure",
    finish: "Ultra-Lacquer Wet Look",
    palette: ["#1a0d10", "#381017", "#6a1422", "#f7f1ee"],
    nailShape: "Square",
    accentType: "bordeaux-solid",
    alt: "Square manicured nails in rich deep bordeaux wine lacquer with mirror glass topcoat",
    featured: true,
    layer: 2,
  },
  {
    id: "work-009",
    title: "Silver Molten Liquid Metal",
    category: "Chrome",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "3D Chrome Gel · Sculpted Freehand Drips",
    finish: "Liquid Chrome 3D",
    palette: ["#141416", "#24252a", "#c5c8d0", "#ffffff"],
    nailShape: "Stiletto",
    accentType: "molten-silver",
    alt: "High-editorial stiletto nails with sculpted 3D molten silver liquid chrome running down nude base",
    featured: true,
    layer: 3,
  },
  {
    id: "work-010",
    title: "Italian Carrara White Marble",
    category: "Nail Art",
    aspect: "landscape",
    width: 1000,
    height: 750,
    technique: "Blooming Gel · Quartz Inks · Gold Leaf Accent",
    finish: "Porcelain Gloss",
    palette: ["#1b1715", "#2e2722", "#9a918a", "#fcfbf9"],
    nailShape: "Almond",
    accentType: "marble-vein",
    alt: "Soft Carrara white marble nail art with delicate grey smoke veining and gold metallic flecks",
    featured: true,
    layer: 1,
  },
  {
    id: "work-011",
    title: "Rose Quartz Healing Crystal",
    category: "Nail Art",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Layered Jelly Rose · White Crystal Veins",
    finish: "Translucent Gemstone",
    palette: ["#1e1816", "#352422", "#d49b99", "#fdf4f4"],
    nailShape: "Almond",
    accentType: "rose-quartz",
    alt: "Ethereal translucent rose quartz nail design with crystalline fractures and subtle iridescent glow",
    featured: true,
    layer: 2,
  },
  {
    id: "work-012",
    title: "Micro-Dot Minimalist Accent",
    category: "Minimal",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Dotting Tool Precision · Sheer Pink BIAB",
    finish: "High-Gloss Glass",
    palette: ["#211b17", "#342922", "#bf8c76", "#faf4ef"],
    nailShape: "Round",
    accentType: "micro-dot",
    alt: "Barely-there blush pink gel base punctuated with single obsidian micro dots at the cuticle moon",
    featured: true,
    layer: 3,
  },
  {
    id: "work-013",
    title: "Double Skinny French Vanilla",
    category: "French",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Dual Micro Line · Soft French Pink Base",
    finish: "Porcelain Shine",
    palette: ["#1d1714", "#30241e", "#e8ded4", "#fdfaf7"],
    nailShape: "Almond",
    accentType: "double-french",
    alt: "Contemporary double French manicure with twin ultra-fine vanilla and ivory smile lines",
    featured: false,
    layer: 1,
  },
  {
    id: "work-014",
    title: "Espresso Mocha Glaze",
    category: "Gel & Care",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Deep Mocha Gel · Top Tier Cuticle Cleanse",
    finish: "Caramel Mirror",
    palette: ["#15100d", "#261b15", "#5c3d2e", "#eeddcc"],
    nailShape: "Square",
    accentType: "mocha-glaze",
    alt: "Glossy dark espresso mocha gel nails on clean square shape with flawless cuticle contouring",
    featured: false,
    layer: 2,
  },
  {
    id: "work-015",
    title: "Aura Sunset Holographic Fade",
    category: "Editorial",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Airbrush Gradient · Holo Chrome Dust",
    finish: "Soft-Focus Aura",
    palette: ["#181519", "#281b2c", "#d9777f", "#fbe8ec"],
    nailShape: "Almond",
    accentType: "aura-gradient",
    alt: "Airbrushed aura nail art radiating soft terracotta, peony pink and lavender beneath crystal topcoat",
    featured: false,
    layer: 3,
  },
  {
    id: "work-016",
    title: "Frosted Matte Cashmere",
    category: "Minimal",
    aspect: "landscape",
    width: 1000,
    height: 750,
    technique: "Cashmere Pigment · Velvet Matte Finish",
    finish: "Velvety Matte",
    palette: ["#1c1815", "#2e2621", "#c7b299", "#f5eee6"],
    nailShape: "Squoval",
    accentType: "matte-cashmere",
    alt: "Soft cashmere taupe squoval nails sealed with a luxurious velvety touch matte topcoat",
    featured: false,
    layer: 1,
  },
  {
    id: "work-017",
    title: "Golden Hour Celestial Starlight",
    category: "Nail Art",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Hand-Painted Starbursts · Micro Pearls",
    finish: "Glistening Dew",
    palette: ["#1e1915", "#32261e", "#d4af37", "#fbf7f2"],
    nailShape: "Almond",
    accentType: "celestial-stars",
    alt: "Delicate four-point gold starlight motifs and miniature pearls hand-painted across nude canvas",
    featured: false,
    layer: 2,
  },
  {
    id: "work-018",
    title: "Rose Gold Chrome Mirror",
    category: "Chrome",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "High-Adhesion Base · Rose Gold Pigment",
    finish: "Pure Metallic Reflection",
    palette: ["#1f1614", "#35201c", "#b8937f", "#fbeee8"],
    nailShape: "Almond",
    accentType: "rose-chrome",
    alt: "Full-coverage rose gold mirror chrome nails reflecting studio lighting with seamless clarity",
    featured: false,
    layer: 3,
  },
  {
    id: "work-019",
    title: "Forest Olive Modern French",
    category: "French",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Deep Olive Pigment · Cream Base",
    finish: "Satin Cream",
    palette: ["#171914", "#242a1e", "#586847", "#f6f7f2"],
    nailShape: "Oval",
    accentType: "olive-french",
    alt: "Sophisticated deep forest olive French tips delicately curved on elegant oval natural nails",
    featured: false,
    layer: 1,
  },
  {
    id: "work-020",
    title: "3D Clear Dew Drops",
    category: "Editorial",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Hard Sculpture Gel · Raindrop Embossing",
    finish: "Wet Glass Drops",
    palette: ["#161618", "#25272e", "#8da4c4", "#f4f7fb"],
    nailShape: "Almond",
    accentType: "dew-drops",
    alt: "Sculpted transparent 3D water droplets suspended atop iridescent sea-glass sheer blue nails",
    featured: false,
    layer: 4,
  },
  {
    id: "work-021",
    title: "Milky Cloud Ombré Fade",
    category: "Gel & Care",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Baby Boomer Sponge Blend · Builder Gel",
    finish: "Seamless Milky Gradient",
    palette: ["#1e1916", "#312620", "#e6ded6", "#ffffff"],
    nailShape: "Almond",
    accentType: "milky-ombre",
    alt: "Flawless baby boomer gradient fading seamlessly from sheer warm beige to milky white tip",
    featured: false,
    layer: 2,
  },
  {
    id: "work-022",
    title: "Botanical Sage Fine Vine",
    category: "Nail Art",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "000 Fine Liner Brush · Organic Olive Ink",
    finish: "Porcelain Gloss",
    palette: ["#181a17", "#282d24", "#7d8b74", "#f8faf5"],
    nailShape: "Almond",
    accentType: "botanical-vine",
    alt: "Hand-painted organic sage botanical vine winding along natural sheer nude almond manicure",
    featured: false,
    layer: 1,
  },
  {
    id: "work-023",
    title: "Smoky Quartz Translucent Glass",
    category: "Minimal",
    aspect: "landscape",
    width: 1000,
    height: 750,
    technique: "Translucent Brown Syrup Gel · E-File Cuticle",
    finish: "Smoky Gloss",
    palette: ["#171310", "#2c211a", "#634e40", "#f2ece6"],
    nailShape: "Squoval",
    accentType: "smoky-quartz",
    alt: "Translucent smoky quartz jelly gel on squoval nails showing healthy natural nail line underneath",
    featured: false,
    layer: 2,
  },
  {
    id: "work-024",
    title: "Molten Gold Cuticle Outline",
    category: "French",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Reverse French Line · Raised Metallic Paste",
    finish: "Embossed 24K Gold",
    palette: ["#1c1714", "#2d231d", "#d1a84f", "#fdf8f4"],
    nailShape: "Oval",
    accentType: "reverse-french",
    alt: "Reverse French cuff featuring embossed molten gold metallic lining hugging the cuticle curve",
    featured: false,
    layer: 3,
  },
  {
    id: "work-025",
    title: "Pure Alabaster Structured Overlay",
    category: "Gel & Care",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Russian E-File · Pure Alabaster Pigment",
    finish: "Clean High Gloss",
    palette: ["#1c1917", "#2f2824", "#eae5de", "#ffffff"],
    nailShape: "Square",
    accentType: "pure-alabaster",
    alt: "Crisp architectural square nails in clean alabaster white with flawless reflection lines",
    featured: false,
    layer: 1,
  },
  {
    id: "work-026",
    title: "Blue Hour Iridescent Aura",
    category: "Editorial",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Center-Focused Airbrush · Twilight Tone",
    finish: "Velvet Gloss",
    palette: ["#12151c", "#1c2230", "#5c79a8", "#eef4fd"],
    nailShape: "Coffin",
    accentType: "blue-aura",
    alt: "Deep twilight blue aura center softly diffusing outwards into cool sheer mist on long coffin nails",
    featured: false,
    layer: 2,
  },
  {
    id: "work-027",
    title: "Black Pearl Chrome Micro-Edge",
    category: "Chrome",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Black Chrome Rub · Sheer Smoke Foundation",
    finish: "Metallic Noir",
    palette: ["#0d0e10", "#181a1e", "#4d525f", "#dce0e9"],
    nailShape: "Almond",
    accentType: "black-chrome",
    alt: "Sheer smoked charcoal base tipped with razor-sharp black pearl chrome metallic edges",
    featured: false,
    layer: 3,
  },
  {
    id: "work-028",
    title: "Terracotta Earth Minimalist Half-Moon",
    category: "Minimal",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Lunula Isolation · Earth Pigment",
    finish: "Eggshell Satin",
    palette: ["#1a1310", "#2c1c16", "#a65943", "#fcf5f2"],
    nailShape: "Round",
    accentType: "terracotta-moon",
    alt: "Warm terracotta clay half-moon manicured negative space design on short round nails",
    featured: false,
    layer: 1,
  },
  {
    id: "work-029",
    title: "Abstract Line Art Face Silhouette",
    category: "Nail Art",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Single-Stroke Linework · Gel Ink",
    finish: "Glass Shine",
    palette: ["#1c1714", "#30241e", "#8c6b57", "#fffbf7"],
    nailShape: "Almond",
    accentType: "abstract-face",
    alt: "Continuous fine line art profile silhouette hand-drawn on sheer warm porcelain almond nails",
    featured: false,
    layer: 2,
  },
  {
    id: "work-030",
    title: "Diagonal Split Chrome French",
    category: "French",
    aspect: "landscape",
    width: 1000,
    height: 750,
    technique: "Precision Tape Stencil · Gold Chrome Powder",
    finish: "Two-Tone Contrast",
    palette: ["#1b1613", "#2c211a", "#cca43b", "#f9f5f0"],
    nailShape: "Squoval",
    accentType: "diagonal-french",
    alt: "Architectural diagonal asymmetric French tip split between mirror gold chrome and creamy nude",
    featured: false,
    layer: 1,
  },
  {
    id: "work-031",
    title: "Deep Olive Matcha Syrup",
    category: "Gel & Care",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Syrup Gel Formulation · Clean Cuticle Fold",
    finish: "High-Gloss Glass",
    palette: ["#141712", "#23291d", "#53603d", "#f4f6f0"],
    nailShape: "Square",
    accentType: "matcha-syrup",
    alt: "Translucent matcha olive syrup gel manicure with high refractive glass gloss on square tips",
    featured: false,
    layer: 2,
  },
  {
    id: "work-032",
    title: "Sculpted Gel Ribbon Flutter",
    category: "Editorial",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Solid 3D Gel Paste · Chrome Powder Dust",
    finish: "Dimensional Ribbon",
    palette: ["#181518", "#2a2128", "#b5879a", "#f9f2f5"],
    nailShape: "Coffin",
    accentType: "3d-ribbon",
    alt: "3D sculpted ethereal ribbon loops gracefully crossing sculpted coffin nails with rose chrome sheen",
    featured: false,
    layer: 4,
  },
  {
    id: "work-033",
    title: "Champagne Shimmer Sand",
    category: "Chrome",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Micro Flake Infusion · Smooth Glass Topcoat",
    finish: "Sparkling Luster",
    palette: ["#1d1915", "#30261f", "#d8c09a", "#faf5ec"],
    nailShape: "Almond",
    accentType: "champagne-shimmer",
    alt: "Ultra-fine champagne diamond dust shimmer suspended in translucent nude almond gel overlay",
    featured: false,
    layer: 1,
  },
  {
    id: "work-034",
    title: "Minimal Gold Cuticle Arc",
    category: "Minimal",
    aspect: "square",
    width: 800,
    height: 800,
    technique: "Metallic Foil Transfer · Clean Natural Nail",
    finish: "Refined Sheen",
    palette: ["#1f1814", "#32251e", "#c59f5a", "#fbf8f3"],
    nailShape: "Oval",
    accentType: "cuticle-arc",
    alt: "Bare naked buffed nails with a single hairline metallic gold arc hugging the base cuticle line",
    featured: false,
    layer: 2,
  },
  {
    id: "work-035",
    title: "Burgundy French Velvet Tip",
    category: "French",
    aspect: "portrait",
    width: 800,
    height: 1000,
    technique: "Deep Velvet Magnet · Nude Rubber Base",
    finish: "Velvet Shimmer Tip",
    palette: ["#170e10", "#2c1117", "#5a1724", "#faf2f3"],
    nailShape: "Almond",
    accentType: "burgundy-french",
    alt: "Almond manicure with deep burgundy magnetic velvet tips shimmering beneath crystal clear topcoat",
    featured: false,
    layer: 3,
  },
  {
    id: "work-036",
    title: "The KA Nails Signature Diamond Set",
    category: "Editorial",
    aspect: "landscape",
    width: 1000,
    height: 750,
    technique: "Full Exhibition Set · Bespoke Mixed Media",
    finish: "Exhibition Masterpiece",
    palette: ["#131110", "#221d1a", "#b8937f", "#faf6f0"],
    nailShape: "Almond",
    accentType: "signature-master",
    alt: "KA Nails signature luxury studio set combining micro-French chrome, 3D drops and sheer rose quartz",
    featured: true,
    layer: 1,
  },
];

function generateNailSvg(item) {
  const { width, height, title, category, palette, nailShape, accentType } =
    item;
  const bgDark = palette[0];
  const bgMid = palette[1];
  const accentColor = palette[2];

  // SVG artboard with realistic nail silhouette and editorial presentation
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" fill="none">
  <defs>
    <!-- Background studio atmosphere -->
    <radialGradient id="bg-${item.id}" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="${bgMid}" />
      <stop offset="100%" stop-color="${bgDark}" />
    </radialGradient>
    
    <!-- Nail bed 3D gradient -->
    <linearGradient id="nail-base-${item.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#faeee3" />
      <stop offset="30%" stop-color="#edd5c3" />
      <stop offset="70%" stop-color="#ddba9e" />
      <stop offset="100%" stop-color="#caa080" />
    </linearGradient>

    <!-- Gloss highlight arc -->
    <linearGradient id="gloss-${item.id}" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.65" />
      <stop offset="25%" stop-color="#ffffff" stop-opacity="0.15" />
      <stop offset="80%" stop-color="#ffffff" stop-opacity="0" />
    </linearGradient>

    <!-- Accent metallic gradient -->
    <linearGradient id="accent-grad-${item.id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${accentColor}" />
      <stop offset="45%" stop-color="#fff5eb" />
      <stop offset="70%" stop-color="${accentColor}" />
      <stop offset="100%" stop-color="${bgDark}" />
    </linearGradient>

    <!-- Drop shadow filter -->
    <filter id="shadow-${item.id}" x="-20%" y="-10%" width="140%" height="130%" filterUnits="userSpaceOnUse">
      <feDropShadow dx="0" dy="18" stdDeviation="24" flood-color="#000000" flood-opacity="0.55" />
    </filter>
  </defs>

  <!-- Canvas background -->
  <rect width="${width}" height="${height}" fill="url(#bg-${item.id})" />

  <!-- Subtle fine studio grid -->
  <g stroke="#ffffff" stroke-opacity="0.04" stroke-width="1">
    <line x1="40" y1="0" x2="40" y2="${height}" />
    <line x1="${width - 40}" y1="0" x2="${width - 40}" y2="${height}" />
    <line x1="0" y1="40" x2="${width}" y2="40" />
    <line x1="0" y1="${height - 40}" x2="${width}" y2="${height - 40}" />
  </g>

  <!-- Central Manicured Nail Silhouette -->
  <g transform="translate(${width / 2}, ${height / 2 - 20})">
    <!-- Main Center Nail -->
    <g filter="url(#shadow-${item.id})">
      <!-- Nail Shape Path (Almond / Oval / Squoval / Coffin) -->
      ${
        nailShape === "Coffin"
          ? `<path d="M -70 140 C -75 50 -70 -70 -45 -150 L 45 -150 C 70 -70 75 50 70 140 C 65 190 -65 190 -70 140 Z" fill="url(#nail-base-${item.id})" />`
          : nailShape === "Squoval" || nailShape === "Square"
            ? `<path d="M -75 140 C -75 40 -75 -60 -70 -130 C -68 -150 -50 -150 0 -150 C 50 -150 68 -150 70 -130 C 75 -60 75 40 75 140 C 65 190 -65 190 -75 140 Z" fill="url(#nail-base-${item.id})" />`
            : `<path d="M -70 140 C -75 50 -75 -40 0 -160 C 75 -40 75 50 70 140 C 65 190 -65 190 -70 140 Z" fill="url(#nail-base-${item.id})" />`
      }

      <!-- Design Layer Accents based on accentType -->
      ${
        accentType.includes("french") || accentType === "diagonal-french"
          ? `<path d="M -68 -110 C -40 -70 40 -70 68 -110 C 72 -135 40 -160 0 -160 C -40 -160 -72 -135 -68 -110 Z" fill="url(#accent-grad-${item.id})" />`
          : accentType.includes("chrome") || accentType.includes("shimmer")
            ? `<path d="M -65 130 C -70 50 -70 -40 0 -155 C 70 -40 70 50 65 130 C 55 175 -55 175 -65 130 Z" fill="url(#accent-grad-${item.id})" opacity="0.65" mix-blend-mode="color-dodge" />`
            : accentType.includes("tortoiseshell")
              ? `<g opacity="0.85">
                   <ellipse cx="-20" cy="-60" rx="30" ry="20" fill="#2d1708" opacity="0.75" />
                   <ellipse cx="25" cy="10" rx="25" ry="35" fill="#3a1e0b" opacity="0.8" />
                   <ellipse cx="-15" cy="80" rx="35" ry="25" fill="#1f1005" opacity="0.85" />
                   <ellipse cx="10" cy="-110" rx="20" ry="18" fill="#a05218" opacity="0.6" />
                 </g>`
              : accentType.includes("gold-foil") ||
                  accentType.includes("celestial")
                ? `<g fill="url(#accent-grad-${item.id})">
                   <polygon points="0,-120 8,-100 28,-100 12,-85 18,-65 0,-78 -18,-65 -12,-85 -28,-100 -8,-100" transform="scale(0.8) translate(0, -40)" />
                   <circle cx="-30" cy="20" r="4" />
                   <circle cx="25" cy="70" r="3" />
                   <polygon points="20,-30 24,-20 34,-20 26,-12 29,-2 20,-8 11,-2 14,-12 6,-20 16,-20" transform="scale(0.6)" />
                 </g>`
                : accentType.includes("marble")
                  ? `<path d="M -50 -130 Q 0 -60 20 20 T -10 120" stroke="#fcfbf9" stroke-width="4" stroke-linecap="round" opacity="0.6" />
                 <path d="M 30 -140 Q -10 -20 10 60" stroke="#9a918a" stroke-width="2.5" stroke-linecap="round" opacity="0.5" />`
                  : accentType.includes("geometric") ||
                      accentType.includes("line") ||
                      accentType.includes("face")
                    ? `<path d="M 0 -150 L 0 160" stroke="${accentColor}" stroke-width="2" />
                 <circle cx="0" cy="0" r="35" stroke="${accentColor}" stroke-width="2" fill="none" />`
                    : accentType.includes("dot") ||
                        accentType.includes("terracotta") ||
                        accentType.includes("moon")
                      ? `<circle cx="0" cy="120" r="14" fill="${accentColor}" />`
                      : accentType.includes("dew-drops") ||
                          accentType.includes("ribbon")
                        ? `<g fill="#ffffff" opacity="0.85">
                   <ellipse cx="-20" cy="-40" rx="14" ry="10" />
                   <ellipse cx="25" cy="20" rx="18" ry="12" />
                   <ellipse cx="-5" cy="80" rx="10" ry="7" />
                 </g>`
                        : `<ellipse cx="0" cy="0" rx="45" ry="80" fill="url(#accent-grad-${item.id})" opacity="0.3" />`
      }

      <!-- Specular Gloss Highlight -->
      <path d="M -55 130 C -60 40 -50 -40 -10 -140 C -5 -145 5 -145 0 -135 C -35 -40 -45 40 -40 130 Z" fill="url(#gloss-${item.id})" />
    </g>

    <!-- Side companion silhouettes (hands in composition) -->
    <g opacity="0.35" transform="translate(-115, 30) scale(0.75)" filter="url(#shadow-${item.id})">
      <path d="M -60 140 C -65 50 -65 -40 0 -150 C 65 -40 65 50 60 140 Z" fill="url(#nail-base-${item.id})" />
    </g>
    <g opacity="0.35" transform="translate(115, 30) scale(0.75)" filter="url(#shadow-${item.id})">
      <path d="M -60 140 C -65 50 -65 -40 0 -150 C 65 -40 65 50 60 140 Z" fill="url(#nail-base-${item.id})" />
    </g>
  </g>

  <!-- Editorial Typography & Metadata Stamp -->
  <g transform="translate(48, ${height - 48})">
    <text font-family="'Inter', -apple-system, sans-serif" font-size="11" font-weight="600" letter-spacing="2.5" fill="${accentColor}" text-transform="uppercase">KA NAILS · ${category.toUpperCase()}</text>
    <text y="-24" font-family="'Inter', -apple-system, sans-serif" font-size="22" font-weight="500" letter-spacing="-0.5" fill="#fdf8f2">${title}</text>
  </g>

  <!-- Index number in corner -->
  <g transform="translate(${width - 48}, 56)" text-anchor="end">
    <text font-family="'Inter', -apple-system, sans-serif" font-size="12" font-weight="600" letter-spacing="1.5" fill="#a0958c">${item.id.replace("work-", "")} / 36</text>
  </g>
</svg>`;
}

async function run() {
  const dir = path.resolve("public/gallery");
  await fs.mkdir(dir, { recursive: true });

  console.log(`Writing ${galleryItems.length} gallery assets to ${dir}...`);
  for (const item of galleryItems) {
    const svg = generateNailSvg(item);
    const filePath = path.join(dir, `${item.id}.svg`);
    await fs.writeFile(filePath, svg, "utf-8");
  }
  console.log("All 36 gallery assets generated successfully!");
}

run().catch(console.error);
