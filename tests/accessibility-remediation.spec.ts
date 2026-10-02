import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("WCAG 2.2 Accessibility Remediation Gates", () => {
  test("gallery cards use valid semantic button inside h3, without article role=button", async ({
    page,
  }) => {
    await page.goto("/gallery/");

    // Check that <article> tags in gallery do NOT have role="button" or tabIndex
    const articles = page.locator(".gallery-card");
    const count = await articles.count();
    expect(count).toBe(19);

    for (let i = 0; i < count; i++) {
      const role = await articles.nth(i).getAttribute("role");
      const tabIndex = await articles.nth(i).getAttribute("tabindex");
      expect(role).toBeNull();
      expect(tabIndex).toBeNull();

      // Check inner native button
      const btn = articles.nth(i).locator(".gallery-card-trigger");
      await expect(btn).toHaveCount(1);
      const btnType = await btn.getAttribute("type");
      expect(btnType).toBe("button");

      // Verify the button is nested within an h3
      const parentTag = await btn.evaluate((el) =>
        el.parentElement?.tagName.toLowerCase(),
      );
      expect(parentTag).toBe("h3");
    }
  });

  test("heading hierarchy: h1 -> h2 (sr-only) -> h3 on /gallery/ and /ru/gallery/", async ({
    page,
  }) => {
    for (const url of ["/gallery/", "/ru/gallery/"]) {
      await page.goto(url);

      const h1 = page.locator("h1");
      await expect(h1).toHaveCount(1);

      const h2 = page.locator("h2.sr-only");
      await expect(h2).toHaveCount(1);
      const h2Text = await h2.textContent();
      expect(h2Text?.trim().length).toBeGreaterThan(0);

      // Verify cards have h3 titles
      const h3s = page.locator(".gallery-card h3.card-title");
      await expect(h3s).toHaveCount(19);

      // Verify heading order in DOM: h1 precedes h2, h2 precedes the first h3
      const orderValid = await page.evaluate(() => {
        const h1El = document.querySelector("h1");
        const h2El = document.querySelector("h2.sr-only");
        const firstH3El = document.querySelector(".gallery-card h3.card-title");
        if (!h1El || !h2El || !firstH3El) return false;
        const pos12 = h1El.compareDocumentPosition(h2El);
        const pos23 = h2El.compareDocumentPosition(firstH3El);
        return (
          Boolean(pos12 & Node.DOCUMENT_POSITION_FOLLOWING) &&
          Boolean(pos23 & Node.DOCUMENT_POSITION_FOLLOWING)
        );
      });
      expect(orderValid).toBe(true);
    }
  });

  test("gallery native button keyboard activation (Enter & Space) and lightbox focus restoration", async ({
    page,
  }) => {
    await page.goto("/gallery/");

    const thirdTrigger = page
      .locator(".gallery-card")
      .nth(2)
      .locator(".gallery-card-trigger");
    await thirdTrigger.focus();
    await expect(thirdTrigger).toBeFocused();

    // Open via Enter key
    await page.keyboard.press("Enter");
    const dialog = page.locator('div[role="dialog"]');
    await expect(dialog).toBeVisible();

    // Close via Escape key
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);

    // Verify focus is restored to the exact third card trigger
    await expect(thirdTrigger).toBeFocused();

    // Test fifth card with Space key
    const fifthTrigger = page
      .locator(".gallery-card")
      .nth(4)
      .locator(".gallery-card-trigger");
    await fifthTrigger.focus();
    await expect(fifthTrigger).toBeFocused();

    await page.keyboard.press("Space");
    await expect(dialog).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(fifthTrigger).toBeFocused();
  });

  test("Section 02 pause/resume control exists, updates state and labels", async ({
    page,
  }) => {
    // Test on English homepage
    await page.goto("/");
    const pauseBtn = page.locator(".showcase-pause-btn");
    await expect(pauseBtn).toBeVisible();
    await expect(pauseBtn).toHaveAttribute("aria-pressed", "false");
    await expect(pauseBtn).toHaveAttribute(
      "aria-label",
      "Pause exhibition motion",
    );

    // Toggle pause
    await pauseBtn.click();
    await expect(pauseBtn).toHaveAttribute("aria-pressed", "true");
    await expect(pauseBtn).toHaveAttribute(
      "aria-label",
      "Resume exhibition motion",
    );

    // Toggle back to play
    await pauseBtn.click();
    await expect(pauseBtn).toHaveAttribute("aria-pressed", "false");
    await expect(pauseBtn).toHaveAttribute(
      "aria-label",
      "Pause exhibition motion",
    );

    // Test on Russian homepage
    await page.goto("/ru/");
    const ruPauseBtn = page.locator(".showcase-pause-btn");
    await expect(ruPauseBtn).toBeVisible();
    await expect(ruPauseBtn).toHaveAttribute("aria-pressed", "false");
    await expect(ruPauseBtn).toHaveAttribute(
      "aria-label",
      "Приостановить движение выставки",
    );

    await ruPauseBtn.click();
    await expect(ruPauseBtn).toHaveAttribute("aria-pressed", "true");
    await expect(ruPauseBtn).toHaveAttribute(
      "aria-label",
      "Возобновить движение выставки",
    );
  });

  test("Section 02 accessible duplicate clone suppression and 19 canonical works", async ({
    page,
  }) => {
    await page.goto("/");

    // Query all interactive card buttons in Section 02
    const movingWallSection = page.locator(".moving-wall-section");
    await expect(movingWallSection).toBeVisible();

    const accessibleCards = movingWallSection.locator(
      '.moving-wall-card[role="button"]',
    );
    // Exactly 19 canonical works across Foreground (5), Primary (8), Background (6)
    const accessibleCount = await accessibleCards.count();
    expect(accessibleCount).toBe(19);

    // Verify all 19 unique work IDs are represented
    const workIds = await accessibleCards.evaluateAll((cards) =>
      cards.map((c) => c.getAttribute("data-work-id")),
    );
    const uniqueIds = new Set(workIds);
    expect(uniqueIds.size).toBe(19);

    for (let i = 1; i <= 19; i++) {
      const id = `work-${String(i).padStart(2, "0")}`;
      expect(uniqueIds.has(id)).toBe(true);
    }

    // Verify clone cards are suppressed: aria-hidden="true", tabindex="-1", no role="button"
    const cloneCards = movingWallSection.locator(
      '.moving-wall-card[aria-hidden="true"]',
    );
    const cloneCount = await cloneCards.count();
    expect(cloneCount).toBeGreaterThan(0);

    for (let j = 0; j < cloneCount; j++) {
      const clone = cloneCards.nth(j);
      const role = await clone.getAttribute("role");
      const tabIndex = await clone.getAttribute("tabindex");
      expect(role).toBeNull();
      expect(tabIndex).toBe("-1");
    }
  });

  test("Axe-core automated accessibility scan passes on all 10 localized static routes", async ({
    page,
  }) => {
    const routes = [
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

    for (const route of routes) {
      await page.goto(route);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(results.violations, `Violations found on route: ${route}`).toEqual(
        [],
      );
    }
  });

  test("reduced motion: manual navigation ‹ and › arrows move the primary rail via click and keyboard", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });

    for (const url of ["/", "/ru/"]) {
      await page.goto(url);

      const movingWall = page.locator(".moving-wall-section");
      await expect(movingWall).toBeVisible();
      await movingWall.scrollIntoViewIfNeeded();

      // Pause/resume control must NOT be visible under reduced-motion
      const pauseBtn = page.locator(".showcase-pause-btn");
      await expect(pauseBtn).toBeHidden();

      // Manual navigation buttons (left/right nudge) remain visible
      const leftBtn = page.locator(".showcase-nav-btn", { hasText: "‹" });
      const rightBtn = page.locator(".showcase-nav-btn", { hasText: "›" });
      await expect(leftBtn).toBeVisible();
      await expect(rightBtn).toBeVisible();

      const stage = page.locator(".moving-wall-stage");
      await expect(stage).toBeVisible();

      // 1. Verify autonomous motion does NOT advance position
      const initialScrollLeft = await stage.evaluate((el) => el.scrollLeft);
      expect(initialScrollLeft).toBe(0);

      const initialTransform = await page
        .locator(".moving-layer-primary .moving-wall-track")
        .evaluate((el) => window.getComputedStyle(el).transform);
      expect(initialTransform).toBe("none");

      await page.waitForTimeout(500);
      const afterWaitScrollLeft = await stage.evaluate((el) => el.scrollLeft);
      expect(afterWaitScrollLeft).toBe(0);

      // 2. Click › -> assert primary gallery container scrollLeft advances
      await rightBtn.click();
      await page.waitForTimeout(100);
      const afterRightClick = await stage.evaluate((el) => el.scrollLeft);
      expect(afterRightClick).toBeGreaterThanOrEqual(200);

      // 3. Click ‹ -> assert position returns/decreases
      await leftBtn.click();
      await page.waitForTimeout(100);
      const afterLeftClick = await stage.evaluate((el) => el.scrollLeft);
      expect(afterLeftClick).toBeLessThan(afterRightClick);

      // 4. Keyboard activation on › via Enter
      await rightBtn.focus();
      await expect(rightBtn).toBeFocused();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(100);
      const afterEnterScroll = await stage.evaluate((el) => el.scrollLeft);
      expect(afterEnterScroll).toBeGreaterThan(afterLeftClick);

      // 5. Keyboard activation on ‹ via Space
      await leftBtn.focus();
      await expect(leftBtn).toBeFocused();
      await page.keyboard.press("Space");
      await page.waitForTimeout(100);
      const afterSpaceScroll = await stage.evaluate((el) => el.scrollLeft);
      expect(afterSpaceScroll).toBeLessThan(afterEnterScroll);
    }
  });

  test("WCAG 1.4.12 Text Spacing override deep audit across viewports (1440, 390, 320)", async ({
    page,
  }) => {
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

    const viewports = [
      { width: 1440, height: 900, label: "desktop-1440x900" },
      { width: 390, height: 844, label: "mobile-390x844" },
      { width: 320, height: 800, label: "mobile-320x800" },
    ];

    const routes = [
      "/",
      "/ru/",
      "/gallery/",
      "/ru/gallery/",
      "/book/",
      "/ru/book/",
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of routes) {
        await page.goto(route);
        await page.addStyleTag({ content: textSpacingCss });
        await page.waitForTimeout(100);

        // 1. Verify no horizontal document overflow
        const docOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(
          docOverflow,
          `Document overflow on ${route} at ${vp.label}`,
        ).toBe(false);

        // 2. Verify no clipped text in containers with overflow:hidden/clip or fixed height
        const clippedText = await page.evaluate(() => {
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
          );
          const parents = new Set<HTMLElement>();
          let n: Node | null;
          while ((n = walker.nextNode())) {
            if (n.textContent && n.textContent.trim().length > 0) {
              const p = n.parentElement;
              if (p && p.offsetParent !== null) {
                parents.add(p);
              }
            }
          }

          const clipped: {
            tag: string;
            className: string;
            text: string;
            type: string;
          }[] = [];

          for (const el of parents) {
            if (
              el.classList.contains("sr-only") ||
              el.classList.contains("moving-card-media") ||
              el.classList.contains("gallery-card-media") ||
              el.classList.contains("moving-wall-viewport")
            ) {
              continue;
            }

            const style = window.getComputedStyle(el);
            const hiddenY =
              style.overflowY === "hidden" || style.overflowY === "clip";
            const hiddenX =
              style.overflowX === "hidden" || style.overflowX === "clip";

            if (hiddenY && el.scrollHeight > el.clientHeight + 2) {
              clipped.push({
                tag: el.tagName.toLowerCase(),
                className: el.className,
                text: (el.textContent || "").trim().slice(0, 30),
                type: "vertical",
              });
            }

            if (
              hiddenX &&
              el.scrollWidth > el.clientWidth + 2 &&
              !el.className.includes("moving-wall")
            ) {
              clipped.push({
                tag: el.tagName.toLowerCase(),
                className: el.className,
                text: (el.textContent || "").trim().slice(0, 30),
                type: "horizontal",
              });
            }
          }
          return clipped;
        });

        expect(
          clippedText,
          `Clipped text found on ${route} at ${vp.label}: ${JSON.stringify(clippedText)}`,
        ).toEqual([]);

        // 3. Verify interactive controls do not collide/overlap (excluding intentional 3D hero collage layering)
        const overlaps = await page.evaluate(() => {
          const interactive = Array.from(
            document.querySelectorAll(
              "nav a, .filter-pill, .gallery-card-trigger, .button, .button-secondary, .service-book-cta",
            ),
          ) as HTMLElement[];
          const visible = interactive.filter((el) => {
            const r = el.getBoundingClientRect();
            return (
              r.width > 0 &&
              r.height > 0 &&
              window.getComputedStyle(el).display !== "none"
            );
          });

          const colliding: string[] = [];
          for (let i = 0; i < visible.length; i++) {
            for (let j = i + 1; j < visible.length; j++) {
              const a = visible[i];
              const b = visible[j];
              if (!a || !b) continue;
              if (a.contains(b) || b.contains(a)) continue;
              if (
                a.closest(".gallery-card") &&
                a.closest(".gallery-card") === b.closest(".gallery-card")
              )
                continue;

              const ra = a.getBoundingClientRect();
              const rb = b.getBoundingClientRect();
              const ox = Math.max(
                0,
                Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left),
              );
              const oy = Math.max(
                0,
                Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top),
              );

              if (ox > 4 && oy > 4) {
                colliding.push(
                  `${a.tagName}.${a.className} overlaps ${b.tagName}.${b.className} by ${Math.round(ox)}x${Math.round(oy)}px`,
                );
              }
            }
          }
          return colliding;
        });

        expect(
          overlaps,
          `Colliding controls on ${route} at ${vp.label}: ${JSON.stringify(overlaps)}`,
        ).toEqual([]);

        // 4. Verify route functional operability and readable headings
        const h1 = page.locator("h1");
        await expect(h1).toBeVisible();

        if (route.includes("gallery")) {
          const classicPill = page
            .locator(".gallery-filter-bar")
            .getByRole("button", {
              name: /Classic|Классика/,
            });
          await expect(classicPill).toBeVisible();
          await classicPill.click();

          const firstTrigger = page.locator(".gallery-card-trigger").first();
          await expect(firstTrigger).toBeVisible();
          await firstTrigger.click();

          const lightbox = page.locator('div[role="dialog"]');
          await expect(lightbox).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(lightbox).toHaveCount(0);
        } else if (route.includes("book")) {
          const notice = page.locator(".notice");
          await expect(notice).toBeVisible();
        } else {
          const nav = page.locator("nav.main-nav");
          await expect(nav).toBeVisible();
        }
      }
    }
  });

  test("WCAG 2.5.8 Target Size geometry checks at 1440x900, 390x844, and 320x800", async ({
    page,
  }) => {
    const viewports = [
      { width: 1440, height: 900, label: "desktop 1440x900" },
      { width: 390, height: 844, label: "mobile 390x844" },
      { width: 320, height: 800, label: "mobile 320x800" },
    ];

    const routes = [
      "/",
      "/ru/",
      "/gallery/",
      "/ru/gallery/",
      "/services/",
      "/ru/services/",
      "/book/",
      "/ru/book/",
      "/contact/",
      "/ru/contact/",
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });

      for (const route of routes) {
        await page.goto(route);

        // Find any interactive targets strictly smaller than 24x24 px
        // Exclude inline text links (explicitly exempted in WCAG 2.5.8)
        const violations = await page.$$eval(
          "button, a, [role='button'], input",
          (els) => {
            return els
              .map((el) => {
                const rect = el.getBoundingClientRect();
                const computed = window.getComputedStyle(el);
                const isInline =
                  computed.display === "inline" &&
                  el.tagName.toLowerCase() === "a";
                return {
                  tag: el.tagName.toLowerCase(),
                  text: (el.textContent || el.getAttribute("aria-label") || "")
                    .trim()
                    .slice(0, 30),
                  width: Math.round(rect.width),
                  height: Math.round(rect.height),
                  isInline,
                };
              })
              .filter(
                (t) =>
                  !t.isInline &&
                  t.width > 0 &&
                  t.height > 0 &&
                  (t.width < 24 || t.height < 24),
              );
          },
        );

        expect(
          violations,
          `Found targets < 24px on ${route} at ${vp.label}: ${JSON.stringify(violations)}`,
        ).toEqual([]);
      }
    }
  });
});
