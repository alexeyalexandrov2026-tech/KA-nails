import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

async function inspect() {
  const outDir = path.resolve("test-results/reference");
  await fs.mkdir(outDir, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  console.log("Navigating to https://studio.design/ ...");
  await page.goto("https://studio.design/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(4000);

  // Capture desktop hero
  await page.screenshot({
    path: path.join(outDir, "studio-design-desktop-hero.png"),
  });
  console.log("Saved studio-design-desktop-hero.png");

  // Inspect page details
  const details = await page.evaluate(() => {
    const heroH1 = document.querySelector("h1");
    const h1Style = heroH1 ? window.getComputedStyle(heroH1) : null;
    const bodyStyle = window.getComputedStyle(document.body);
    const nav =
      document.querySelector("nav") || document.querySelector("header");
    const navStyle = nav ? window.getComputedStyle(nav) : null;
    const buttons = Array.from(document.querySelectorAll("button, a")).filter(
      (el) =>
        el.className &&
        (el.className.includes("btn") ||
          el.className.includes("button") ||
          el.getAttribute("role") === "button"),
    );
    const buttonStyles = buttons.slice(0, 3).map((b) => {
      const s = window.getComputedStyle(b);
      return {
        text: b.textContent?.trim(),
        bg: s.backgroundColor,
        color: s.color,
        radius: s.borderRadius,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
      };
    });

    // Inspect hero / visual tiles / animated sections
    const allImages = Array.from(
      document.querySelectorAll("img, video, canvas"),
    );
    const heroMedia = allImages.slice(0, 15).map((img) => {
      const rect = img.getBoundingClientRect();
      const s = window.getComputedStyle(img);
      return {
        tag: img.tagName,
        src: img.src?.slice(0, 80),
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        transform: s.transform,
        zIndex: s.zIndex,
        borderRadius: s.borderRadius,
      };
    });

    // Check keyframe animations / stylesheets
    const animations = [];
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        for (const rule of Array.from(sheet.cssRules)) {
          if (rule.type === CSSRule.KEYFRAMES_RULE) {
            animations.push(rule.name);
          }
        }
      } catch {}
    }

    return {
      title: document.title,
      bodyBg: bodyStyle.backgroundColor,
      bodyColor: bodyStyle.color,
      bodyFont: bodyStyle.fontFamily,
      h1: h1Style
        ? {
            fontFamily: h1Style.fontFamily,
            fontSize: h1Style.fontSize,
            lineHeight: h1Style.lineHeight,
            letterSpacing: h1Style.letterSpacing,
            fontWeight: h1Style.fontWeight,
            color: h1Style.color,
          }
        : null,
      nav: navStyle
        ? {
            bg: navStyle.backgroundColor,
            height: navStyle.height,
            padding: navStyle.padding,
          }
        : null,
      buttonStyles,
      heroMedia,
      animations: Array.from(new Set(animations)),
    };
  });

  console.log("Studio.Design details:", JSON.stringify(details, null, 2));

  // Scroll 600px down and capture
  await page.evaluate(() => window.scrollBy(0, 700));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(outDir, "studio-design-desktop-scroll1.png"),
  });
  console.log("Saved studio-design-desktop-scroll1.png");

  // Scroll further down
  await page.evaluate(() => window.scrollBy(0, 1000));
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: path.join(outDir, "studio-design-desktop-scroll2.png"),
  });
  console.log("Saved studio-design-desktop-scroll2.png");

  // Full page screenshot
  await page.screenshot({
    path: path.join(outDir, "studio-design-desktop-full.png"),
    fullPage: true,
  });
  console.log("Saved studio-design-desktop-full.png");

  // Mobile viewport 390x844 (iPhone 13 / 14 / modern phone)
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const mobilePage = await mobileContext.newPage();
  await mobilePage.goto("https://studio.design/", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await mobilePage.waitForTimeout(4000);

  await mobilePage.screenshot({
    path: path.join(outDir, "studio-design-mobile-hero.png"),
  });
  console.log("Saved studio-design-mobile-hero.png");

  await mobilePage.evaluate(() => window.scrollBy(0, 600));
  await mobilePage.waitForTimeout(1000);
  await mobilePage.screenshot({
    path: path.join(outDir, "studio-design-mobile-scroll1.png"),
  });
  console.log("Saved studio-design-mobile-scroll1.png");

  // Now inspect Refero style reference
  console.log("Navigating to Refero style reference ...");
  try {
    await page.goto(
      "https://styles.refero.design/style/bb2e29c9-d20a-4b8d-8959-5b506f517ec4",
      { waitUntil: "domcontentloaded", timeout: 30000 },
    );
    await page.screenshot({
      path: path.join(outDir, "refero-style-desktop.png"),
    });
    console.log("Saved refero-style-desktop.png");

    const referoDetails = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll("h1, h2, h3")).map(
        (h) => ({
          tag: h.tagName,
          text: h.textContent?.trim(),
          font: window.getComputedStyle(h).fontFamily,
          size: window.getComputedStyle(h).fontSize,
        }),
      );
      return { title: document.title, headings };
    });
    console.log("Refero details:", JSON.stringify(referoDetails, null, 2));
  } catch (err) {
    console.warn("Could not load Refero style reference:", err.message);
  }

  await browser.close();
  console.log("Reference inspection complete!");
}

inspect().catch(console.error);
