import { expect, test } from "@playwright/test";

test.describe("Brand foundation (logo palette and display serif)", () => {
  test("canvas matches the logo ground so the logo sits seamlessly", async ({
    page,
  }) => {
    for (const url of ["/", "/ru/", "/gallery/"]) {
      await page.goto(url);
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(253, 248, 242)",
      );
    }
  });

  test("headings use the Cormorant Garamond display serif", async ({
    page,
  }) => {
    await page.goto("/");
    const family = await page
      .locator("h1")
      .evaluate((el) => getComputedStyle(el).fontFamily);
    expect(family).toContain("Cormorant Garamond");
  });

  test("Russian pages load the Cyrillic Cormorant face", async ({ page }) => {
    await page.goto("/ru/");
    const cyrillicLoaded = await page.evaluate(async () => {
      await document.fonts.ready;
      return Array.from(document.fonts).some(
        (face) =>
          face.family.includes("Cormorant Garamond") &&
          face.status === "loaded" &&
          /U\+0?400-0?45F/i.test(face.unicodeRange),
      );
    });
    expect(cyrillicLoaded).toBe(true);
  });

  test("web fonts load without shifting the layout", async ({ page }) => {
    for (const url of ["/", "/ru/", "/gallery/"]) {
      await page.goto(url);
      const shift = await page.evaluate(async () => {
        await document.fonts.ready;
        await new Promise((resolve) => setTimeout(resolve, 500));
        let total = 0;
        for (const entry of performance.getEntriesByType("layout-shift")) {
          const shiftEntry = entry as PerformanceEntry & {
            value: number;
            hadRecentInput: boolean;
          };
          if (!shiftEntry.hadRecentInput) total += shiftEntry.value;
        }
        return total;
      });
      expect(shift, `${url} cumulative layout shift`).toBeLessThan(0.05);
    }
  });

  test("no animations keep running under reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const url of ["/", "/ru/", "/gallery/"]) {
      await page.goto(url);
      await page.waitForTimeout(300);
      const running = await page.evaluate(
        () =>
          document
            .getAnimations()
            .filter((animation) => animation.playState === "running").length,
      );
      expect(running, `${url} running animations`).toBe(0);
    }
  });
});
