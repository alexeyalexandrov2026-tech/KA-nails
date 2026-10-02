import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL || "https://ka-nails.pages.dev";
const VIEWPORTS = [
  { width: 1440, height: 900, name: "desktop (1440x900)" },
  { width: 390, height: 844, name: "mobile (390x844)" },
  { width: 320, height: 800, name: "small mobile (320x800)" },
];

const ROUTES = [
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

async function main() {
  const browser = await chromium.launch({ headless: true });
  console.log(
    "================================================================================",
  );
  console.log(
    "WCAG 2.2 SC 2.5.8 TARGET SIZE GEOMETRY AUDIT ACROSS RESPONSIVE VIEWPORTS",
  );
  console.log(`Base URL: ${BASE_URL}`);
  console.log(
    "================================================================================\n",
  );

  const summary = {
    "desktop (1440x900)": { totalTargets: 0, violations: 0, details: [] },
    "mobile (390x844)": { totalTargets: 0, violations: 0, details: [] },
    "small mobile (320x800)": { totalTargets: 0, violations: 0, details: [] },
  };

  for (const vp of VIEWPORTS) {
    console.log(`\n>>> Testing Viewport: ${vp.name}`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    const page = await context.newPage();

    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(300);

      const targets = await page.$$eval(
        "button, a, [role='button'], input",
        (els) => {
          return els
            .map((el) => {
              const rect = el.getBoundingClientRect();
              const computed = window.getComputedStyle(el);
              const isInline =
                computed.display === "inline" &&
                el.tagName.toLowerCase() === "a";
              const isVisible =
                rect.width > 0 &&
                rect.height > 0 &&
                computed.visibility !== "hidden" &&
                computed.display !== "none";
              return {
                tag: el.tagName.toLowerCase(),
                text: (el.innerText || el.getAttribute("aria-label") || "")
                  .trim()
                  .slice(0, 30)
                  .replace(/\n/g, " "),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                isInline,
                isVisible,
              };
            })
            .filter((t) => t.isVisible);
        },
      );

      const nonInlineTargets = targets.filter((t) => !t.isInline);
      const smallTargets = nonInlineTargets.filter(
        (t) => t.width < 24 || t.height < 24,
      );

      summary[vp.name].totalTargets += nonInlineTargets.length;
      summary[vp.name].violations += smallTargets.length;

      if (smallTargets.length > 0) {
        console.log(
          `  [FAIL] ${route}: ${smallTargets.length} targets < 24x24px`,
        );
        for (const st of smallTargets) {
          console.log(
            `    - <${st.tag}> "${st.text}" (${st.width}x${st.height}px)`,
          );
          summary[vp.name].details.push({ route, target: st });
        }
      } else {
        console.log(
          `  [PASS] ${route}: ${nonInlineTargets.length} targets checked (0 < 24x24px)`,
        );
      }
    }
    await context.close();
  }

  await browser.close();

  console.log(
    "\n================================================================================",
  );
  console.log("VIEWPORT-SPECIFIC TARGET SIZE SUMMARY");
  console.log(
    "================================================================================",
  );
  for (const [vpName, res] of Object.entries(summary)) {
    const status = res.violations === 0 ? "PASS" : "FAIL";
    console.log(
      `${vpName.padEnd(25)} : ${status} (Checked: ${res.totalTargets}, Violations: ${res.violations})`,
    );
  }
  console.log(
    "================================================================================",
  );

  if (Object.values(summary).some((r) => r.violations > 0)) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Error running audit:", err);
  process.exit(1);
});
