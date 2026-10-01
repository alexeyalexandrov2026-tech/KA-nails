import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto("https://studio.design/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  // Measure transforms and positions at different scroll offsets: 0, 200, 400, 600, 800
  const scrollSteps = [0, 150, 300, 500, 800];
  const results = [];

  for (const scrollY of scrollSteps) {
    await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    await page.waitForTimeout(500);

    const snapshot = await page.evaluate((y) => {
      // Find all elements with images or transforms
      const items = Array.from(
        document.querySelectorAll(
          "img, div[style*='transform'], [class*='hero'] *",
        ),
      )
        .filter((el) => {
          const rect = el.getBoundingClientRect();
          return rect.width > 50 && rect.height > 50;
        })
        .slice(0, 10)
        .map((el, i) => {
          const s = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            index: i,
            tag: el.tagName,
            class: el.className,
            transform: s.transform,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          };
        });

      return { scrollY: y, items };
    }, scrollY);

    results.push(snapshot);
  }

  console.log("Scroll Study Results:", JSON.stringify(results, null, 2));
  await browser.close();
}

run().catch(console.error);
