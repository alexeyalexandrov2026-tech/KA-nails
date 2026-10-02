import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.BASE_URL || "https://ka-nails.pages.dev";
const SCREENSHOT_DIR = path.resolve("test-results/text-spacing-audit");

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const ROUTES = [
  "/",
  "/ru/",
  "/gallery/",
  "/ru/gallery/",
  "/book/",
  "/ru/book/",
];

const VIEWPORTS = [
  { width: 1440, height: 900, name: "desktop-1440x900" },
  { width: 390, height: 844, name: "mobile-390x844" },
  { width: 320, height: 800, name: "mobile-320x800" },
];

const textSpacingCss = `
  * {
    line-height: 1.5 !important;
    letter-spacing: 0.12em !important;
    word-spacing: 0.16em !important;
  }
  p {
    margin-bottom: 2em !important;
  }
`;

async function run() {
  const browser = await chromium.launch();
  console.log(
    "================================================================================",
  );
  console.log(
    "WCAG 1.4.12 TEXT SPACING DEEP AUDIT & OVERLAP/CLIPPING VERIFICATION",
  );
  console.log(`Base URL: ${BASE_URL}`);
  console.log(
    "================================================================================\n",
  );

  const report = [];

  for (const vp of VIEWPORTS) {
    console.log(`\n>>> Viewport: ${vp.name}`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      const url = `${BASE_URL}${route}`;
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await page.addStyleTag({ content: textSpacingCss });
      await page.waitForTimeout(300);

      // Screenshot capture
      const shotName = `${vp.name}_${route.replace(/\//g, "_")}.png`;
      const shotPath = path.join(SCREENSHOT_DIR, shotName);
      await page.screenshot({ path: shotPath, fullPage: true });

      // Check text clipping
      const analysis = await page.evaluate(() => {
        const textElements = [];
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
        );
        let node;
        while ((node = walker.nextNode())) {
          if (node.textContent?.trim().length > 0) {
            const el = node.parentElement;
            if (el && el.offsetParent !== null) {
              textElements.push(el);
            }
          }
        }
        const uniqueEls = Array.from(new Set(textElements));
        const clippedElements = [];

        for (const el of uniqueEls) {
          const style = window.getComputedStyle(el);
          const isOverflowHiddenY =
            style.overflowY === "hidden" || style.overflowY === "clip";
          const isOverflowHiddenX =
            style.overflowX === "hidden" || style.overflowX === "clip";

          // Exclude known media wrappers or decorative overlays that don't hold text
          if (el.classList.contains("sr-only")) continue;
          if (el.classList.contains("moving-card-media")) continue;
          if (el.classList.contains("gallery-card-media")) continue;
          if (el.classList.contains("moving-wall-viewport")) continue;

          if (isOverflowHiddenY && el.scrollHeight > el.clientHeight + 2) {
            clippedElements.push({
              tag: el.tagName.toLowerCase(),
              className: el.className,
              text: el.textContent?.trim().slice(0, 30),
              scrollHeight: el.scrollHeight,
              clientHeight: el.clientHeight,
              type: "vertical-clip",
            });
          }

          if (
            isOverflowHiddenX &&
            el.scrollWidth > el.clientWidth + 2 &&
            !el.className.includes("moving-wall")
          ) {
            clippedElements.push({
              tag: el.tagName.toLowerCase(),
              className: el.className,
              text: el.textContent?.trim().slice(0, 30),
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
              type: "horizontal-clip",
            });
          }
        }

        // Check for button/control overlaps
        const interactive = Array.from(
          document.querySelectorAll(
            "button, a, .filter-pill, .gallery-card-trigger",
          ),
        );
        const visibleInteractive = interactive.filter((el) => {
          const r = el.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            window.getComputedStyle(el).display !== "none"
          );
        });

        const overlaps = [];
        for (let i = 0; i < visibleInteractive.length; i++) {
          for (let j = i + 1; j < visibleInteractive.length; j++) {
            const a = visibleInteractive[i];
            const b = visibleInteractive[j];
            // If one is descendant of another or part of the same composite card, skip
            if (a.contains(b) || b.contains(a)) continue;
            if (
              a.closest(".gallery-card") &&
              a.closest(".gallery-card") === b.closest(".gallery-card")
            )
              continue;
            if (
              a.closest(".moving-wall-card") &&
              a.closest(".moving-wall-card") === b.closest(".moving-wall-card")
            )
              continue;

            const ra = a.getBoundingClientRect();
            const rb = b.getBoundingClientRect();

            // Check geometric intersection with tolerance (3px)
            const overlapX = Math.max(
              0,
              Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left),
            );
            const overlapY = Math.max(
              0,
              Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top),
            );

            if (overlapX > 4 && overlapY > 4) {
              overlaps.push({
                a: `<${a.tagName.toLowerCase()} class="${a.className}"> "${a.textContent?.trim().slice(0, 20)}"`,
                b: `<${b.tagName.toLowerCase()} class="${b.className}"> "${b.textContent?.trim().slice(0, 20)}"`,
                overlapArea: `${Math.round(overlapX)}x${Math.round(overlapY)}px`,
              });
            }
          }
        }

        // Check document horizontal scroll overflow
        const docOverflow =
          document.documentElement.scrollWidth > window.innerWidth;

        return {
          totalTextElements: uniqueEls.length,
          clippedElements,
          interactiveCount: visibleInteractive.length,
          overlaps,
          docOverflow,
        };
      });

      console.log(`  Route: ${route}`);
      console.log(`    - Text elements checked: ${analysis.totalTextElements}`);
      console.log(
        `    - Clipped text containers: ${analysis.clippedElements.length}`,
      );
      if (analysis.clippedElements.length > 0) {
        for (const c of analysis.clippedElements) {
          console.log(
            `      * [${c.type}] <${c.tag}.${c.className}> "${c.text}" (client:${c.clientHeight}px, scroll:${c.scrollHeight}px)`,
          );
        }
      }
      console.log(
        `    - Interactive controls checked: ${analysis.interactiveCount}`,
      );
      console.log(`    - Overlapping controls: ${analysis.overlaps.length}`);
      if (analysis.overlaps.length > 0) {
        for (const o of analysis.overlaps) {
          console.log(`      * Overlap: ${o.a} <-> ${o.b} (${o.overlapArea})`);
        }
      }
      console.log(
        `    - Document horizontal overflow: ${analysis.docOverflow}`,
      );
      console.log(`    - Screenshot saved: ${shotName}`);

      report.push({
        viewport: vp.name,
        route,
        analysis,
        screenshot: shotName,
      });
    }

    await context.close();
  }

  await browser.close();

  console.log(
    "\n================================================================================",
  );
  console.log("TEXT SPACING AUDIT SUMMARY");
  console.log(
    "================================================================================",
  );
  let allPass = true;
  for (const r of report) {
    const hasClipping = r.analysis.clippedElements.length > 0;
    const hasOverlap = r.analysis.overlaps.length > 0;
    const hasOverflow = r.analysis.docOverflow;
    const status =
      !hasClipping && !hasOverlap && !hasOverflow ? "PASS" : "FAIL";
    if (status === "FAIL") allPass = false;
    console.log(
      `${r.viewport.padEnd(20)} ${r.route.padEnd(15)} : ${status} (Clipped: ${r.analysis.clippedElements.length}, Overlaps: ${r.analysis.overlaps.length}, DocOverflow: ${hasOverflow})`,
    );
  }
  console.log(
    "================================================================================",
  );

  if (!allPass) {
    console.error("Some routes failed text spacing audit!");
  } else {
    console.log(
      "ALL ROUTES PASSED TEXT SPACING AUDIT WITH ZERO CLIPPING, ZERO OVERLAPS, AND ZERO OVERFLOW!",
    );
  }
}

run().catch(console.error);
