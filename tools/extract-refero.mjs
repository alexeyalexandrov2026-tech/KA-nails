import { chromium } from "@playwright/test";
import fs from "node:fs/promises";

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(
    "https://styles.refero.design/style/bb2e29c9-d20a-4b8d-8959-5b506f517ec4",
    { waitUntil: "domcontentloaded" },
  );
  await page.waitForTimeout(4000);

  const markdown = await page.evaluate(() => {
    const el =
      document.querySelector("pre") ||
      document.querySelector("code") ||
      document.querySelector('[class*="markdown"]') ||
      document.querySelector("main");
    return el ? el.innerText : document.body.innerText;
  });

  await fs.writeFile("tools/refero-spec.txt", markdown, "utf-8");
  console.log("Saved tools/refero-spec.txt length:", markdown.length);
  await browser.close();
}

run().catch(console.error);
