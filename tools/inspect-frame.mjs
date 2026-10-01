import { chromium } from "@playwright/test";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });
  await page.goto("https://studio.design/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);

  const frameDetails = await page.evaluate(() => {
    const frame =
      document.querySelector(".sd-20") ||
      document.querySelector("div[class*='frame']");
    if (!frame) return { error: "no frame" };
    const children = Array.from(frame.querySelectorAll("*"))
      .map((el, i) => {
        const r = el.getBoundingClientRect();
        const s = window.getComputedStyle(el);
        return {
          i,
          tag: el.tagName,
          class: el.className,
          src: el.src || "",
          rect: {
            top: Math.round(r.top),
            left: Math.round(r.left),
            width: Math.round(r.width),
            height: Math.round(r.height),
          },
          transform: s.transform,
          opacity: s.opacity,
          zIndex: s.zIndex,
        };
      })
      .filter((x) => x.rect.width > 20);
    return {
      frameClass: frame.className,
      childrenCount: children.length,
      sample: children.slice(0, 15),
    };
  });

  console.log("Frame Details:", JSON.stringify(frameDetails, null, 2));
  await browser.close();
}

run().catch(console.error);
