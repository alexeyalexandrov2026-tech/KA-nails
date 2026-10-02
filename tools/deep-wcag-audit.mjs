import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const BASE_URL = process.env.BASE_URL || "https://ka-nails.pages.dev";
const ENDPOINTS = [
  "/",
  "/services/",
  "/gallery/",
  "/contact/",
  "/book/",
  "/ru/",
  "/ru/services/",
  "/ru/gallery/",
  "/ru/contact/",
  "/ru/book/",
];

async function runAudit() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  console.log(
    "================================================================================",
  );
  console.log(
    "FULL WCAG 2.1 / 2.2 AA MANUAL & AUTOMATED ACCESSIBILITY AUDIT - KA NAILS",
  );
  console.log(`Base Target: ${BASE_URL}`);
  console.log(
    "================================================================================\n",
  );

  const results = {
    pages: {},
    summary: {
      totalViolations: 0,
      totalIncomplete: 0,
      totalPasses: 0,
    },
  };

  for (const ep of ENDPOINTS) {
    const url = `${BASE_URL}${ep}`;
    console.log(`\n>>> Auditing Endpoint: ${ep} (${url})`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    await page.waitForTimeout(1000);

    // 1. Axe-core scan with wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa, best-practice
    const axeResults = await new AxeBuilder({ page })
      .withTags([
        "wcag2a",
        "wcag2aa",
        "wcag21a",
        "wcag21aa",
        "wcag22aa",
        "best-practice",
      ])
      .analyze();

    console.log(
      `  [Axe Core] Violations: ${axeResults.violations.length}, Incomplete: ${axeResults.incomplete.length}, Passes: ${axeResults.passes.length}`,
    );
    if (axeResults.violations.length > 0) {
      for (const v of axeResults.violations) {
        console.log(
          `    - VIOLATION [${v.id}] (${v.impact}): ${v.description}`,
        );
        for (const n of v.nodes) {
          console.log(`      Node: ${n.html}`);
          console.log(`      Failure summary: ${n.failureSummary}`);
        }
      }
    }

    // 2. Heading hierarchy check
    const headings = await page.$$eval("h1, h2, h3, h4, h5, h6", (elements) =>
      elements.map((el) => ({
        tag: el.tagName.toLowerCase(),
        level: parseInt(el.tagName.substring(1), 10),
        text: el.innerText.trim().replace(/\n+/g, " "),
      })),
    );
    console.log(`  [Heading Tree] Count: ${headings.length}`);
    let headingSkips = [];
    let prevLevel = 0;
    for (const h of headings) {
      if (prevLevel > 0 && h.level > prevLevel + 1) {
        headingSkips.push(
          `Skip detected: ${prevLevel} -> ${h.level} ("${h.text}")`,
        );
      }
      prevLevel = h.level;
    }
    if (headingSkips.length > 0) {
      console.log(`    WARNING Heading Skips: ${headingSkips.join("; ")}`);
    } else {
      console.log("    Heading hierarchy is fully sequential.");
    }

    // 3. Landmarks check
    const landmarks = await page.$$eval(
      "header, nav, main, footer, section, aside",
      (elements) =>
        elements.map((el) => ({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role") || el.tagName.toLowerCase(),
          ariaLabel: el.getAttribute("aria-label"),
          ariaLabelledBy: el.getAttribute("aria-labelledby"),
        })),
    );
    console.log(`  [Landmarks] Total: ${landmarks.length}`);

    // 4. Skip link check
    const skipLink = await page
      .$eval(".skip", (el) => ({
        href: el.getAttribute("href"),
        text: el.innerText.trim(),
      }))
      .catch(() => null);
    console.log(
      `  [Skip Link] Found: ${!!skipLink} (Target: ${skipLink?.href}, Text: "${skipLink?.text}")`,
    );

    // 5. Images audit
    const images = await page.$$eval("img", (els) =>
      els.map((img) => ({
        src: img.getAttribute("src"),
        alt: img.getAttribute("alt"),
        hasAlt: img.hasAttribute("alt"),
        ariaHidden: img.getAttribute("aria-hidden"),
      })),
    );
    const missingAlt = images.filter((i) => !i.hasAlt);
    console.log(
      `  [Images] Total: ${images.length}, Missing Alt: ${missingAlt.length}`,
    );

    // 6. Interactive target size check (< 24x24 px)
    const smallTargets = await page.$$eval(
      "button, a, [role='button'], input",
      (els) =>
        els
          .map((el) => {
            const rect = el.getBoundingClientRect();
            return {
              tag: el.tagName.toLowerCase(),
              text: el.innerText.trim().slice(0, 30),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
              ariaLabel: el.getAttribute("aria-label"),
            };
          })
          .filter(
            (t) =>
              t.width > 0 && t.height > 0 && (t.width < 24 || t.height < 24),
          ),
    );
    console.log(`  [Target Size < 24x24px] Found: ${smallTargets.length}`);
    if (smallTargets.length > 0) {
      for (const t of smallTargets) {
        console.log(
          `    - Small target: <${t.tag}> "${t.text || t.ariaLabel}" (${t.width}x${t.height}px)`,
        );
      }
    }

    // 7. Language and titles
    const htmlLang = await page.$eval("html", (el) => el.getAttribute("lang"));
    const pageTitle = await page.title();
    console.log(
      `  [Document Meta] <html lang="${htmlLang}">, <title>: "${pageTitle}"`,
    );

    results.pages[ep] = {
      violations: axeResults.violations,
      incomplete: axeResults.incomplete,
      passesCount: axeResults.passes.length,
      headings,
      headingSkips,
      landmarksCount: landmarks.length,
      imagesCount: images.length,
      missingAltCount: missingAlt.length,
      smallTargets,
      htmlLang,
      pageTitle,
    };

    results.summary.totalViolations += axeResults.violations.length;
    results.summary.totalIncomplete += axeResults.incomplete.length;
    results.summary.totalPasses += axeResults.passes.length;
  }

  // INTERACTIVE COMPONENT AUDIT: Lightbox Focus Trap & Restoration
  console.log(
    "\n>>> Deep Component Test: Lightbox Modal Accessibility (Gallery Page)",
  );
  await page.goto(`${BASE_URL}/gallery/`, { waitUntil: "domcontentloaded" });

  // Focus and activate first card trigger button
  const firstCardTrigger = page.locator(".gallery-card-trigger").first();
  await firstCardTrigger.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);

  const lightbox = page.locator('div[role="dialog"].lightbox-overlay');
  const isLightboxVisible = await lightbox.isVisible();
  console.log(`  - Lightbox opened on Enter key: ${isLightboxVisible}`);

  const activeElementInDialog = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      className: el?.className,
      ariaLabel: el?.getAttribute("aria-label"),
    };
  });
  console.log(
    `  - Active element on open: <${activeElementInDialog.tag}> .${activeElementInDialog.className} (aria-label: "${activeElementInDialog.ariaLabel}")`,
  );

  // Test Tab focus trapping inside dialog
  let tabStops = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(
      () => document.activeElement?.className,
    );
    tabStops.push(focused);
  }
  console.log(
    `  - Sequential Tab focus path in dialog: ${tabStops.join(" -> ")}`,
  );

  // Test Escape key close and focus restoration
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const isLightboxClosed = !(await lightbox.isVisible());
  const activeElementAfterClose = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName,
      id: el?.getAttribute("id"),
      className: el?.className,
    };
  });
  console.log(`  - Lightbox closed on Escape: ${isLightboxClosed}`);
  console.log(
    `  - Focus after close: <${activeElementAfterClose.tag}> #${activeElementAfterClose.id} .${activeElementAfterClose.className}`,
  );

  // INTERACTIVE COMPONENT AUDIT: Section 02 Moving Wall Keyboard Navigation
  console.log("\n>>> Deep Component Test: Section 02 Moving Wall (Homepage)");
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });

  const stage = page.locator(".moving-wall-stage");
  const stageTabIndex = await stage.getAttribute("tabindex");
  const stageAriaLabel = await stage.getAttribute("aria-label");
  console.log(
    `  - Moving wall stage: tabIndex=${stageTabIndex}, aria-label="${stageAriaLabel}"`,
  );

  // Check pause / resume motion control
  const pauseBtn = page.locator(".showcase-pause-btn");
  const pauseExists = (await pauseBtn.count()) > 0;
  const pausePressed = await pauseBtn.getAttribute("aria-pressed");
  const pauseAria = await pauseBtn.getAttribute("aria-label");
  console.log(
    `  - Pause control: exists=${pauseExists}, aria-pressed=${pausePressed}, aria-label="${pauseAria}"`,
  );

  // Check card keyboard accessibility
  const firstMovingCard = page.locator(".moving-wall-card").first();
  await firstMovingCard.focus();
  const cardActiveBeforeEnter = await page.evaluate(
    () => document.activeElement?.className,
  );
  console.log(`  - Focus on moving card: .${cardActiveBeforeEnter}`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const homeLightboxOpen = await page
    .locator('div[role="dialog"].lightbox-overlay')
    .isVisible();
  console.log(
    `  - Lightbox opened from moving wall via Enter: ${homeLightboxOpen}`,
  );
  if (homeLightboxOpen) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
  }

  // Reduced motion test on Section 02
  console.log("\n>>> Deep Component Test: Reduced Motion Contract");
  const reducedMotionContext = await browser.newContext({
    reducedMotion: "reduce",
    viewport: { width: 1440, height: 900 },
  });
  const rmPage = await reducedMotionContext.newPage();
  await rmPage.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  const isBgHidden = await rmPage.evaluate(() => {
    const bg = document.querySelector(".moving-layer-bg");
    const fg = document.querySelector(".moving-layer-fg");
    const primary = document.querySelector(".moving-layer-primary");
    return {
      bgDisplay: window.getComputedStyle(bg).display,
      fgDisplay: window.getComputedStyle(fg).display,
      primaryPosition: window.getComputedStyle(primary).position,
    };
  });
  console.log(
    `  - Reduced motion layer styles: bg=${isBgHidden.bgDisplay}, fg=${isBgHidden.fgDisplay}, primary=${isBgHidden.primaryPosition}`,
  );

  await browser.close();
  console.log(
    "\n================================================================================",
  );
  console.log("AUDIT COMPLETE");
  console.log(`Total Violations: ${results.summary.totalViolations}`);
  console.log(
    `Total Incomplete (Needs manual review): ${results.summary.totalIncomplete}`,
  );
  console.log(`Total Automated Passes: ${results.summary.totalPasses}`);
  console.log(
    "================================================================================",
  );
}

runAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
