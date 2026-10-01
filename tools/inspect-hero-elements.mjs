import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto("https://studio.design/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const heroElements = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll("body *"));
    return all
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.top < 900 && r.width > 20 && r.height > 20;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          class: el.className,
          text: el.innerText
            ? el.innerText.slice(0, 40).replace(/\n/g, " ")
            : "",
          rect: {
            top: Math.round(r.top),
            left: Math.round(r.left),
            width: Math.round(r.width),
            height: Math.round(r.height),
          },
          bg: s.backgroundColor,
          color: s.color,
          transform: s.transform,
          zIndex: s.zIndex,
        };
      })
      .filter(
        (el) =>
          el.text ||
          el.class.includes("img") ||
          el.tag === "IMG" ||
          el.bg !== "rgba(0, 0, 0, 0)",
      );
  });

  console.log(
    "Hero Elements (first 25):",
    JSON.stringify(heroElements.slice(0, 25), null, 2),
  );
  await browser.close();
}

run().catch(console.error);
