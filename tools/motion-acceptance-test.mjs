import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.TEST_URL || "https://ka-nails.pages.dev";
const RESULTS_DIR = path.resolve("test-results/motion-acceptance");
const VIDEOS_DIR = path.join(RESULTS_DIR, "videos");

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}
if (!fs.existsSync(VIDEOS_DIR)) {
  fs.mkdirSync(VIDEOS_DIR, { recursive: true });
}

function parseTranslateX(elemTransform) {
  if (!elemTransform || elemTransform === "none") return 0;
  const matrixMatch = elemTransform.match(/matrix\(([^)]+)\)/);
  if (matrixMatch) {
    const parts = matrixMatch[1].split(",").map((s) => parseFloat(s.trim()));
    return parts[4] || 0;
  }
  const matrix3dMatch = elemTransform.match(/matrix3d\(([^)]+)\)/);
  if (matrix3dMatch) {
    const parts = matrix3dMatch[1].split(",").map((s) => parseFloat(s.trim()));
    return parts[12] || 0;
  }
  return 0;
}

async function getVisibleCard(
  page,
  selector = ".moving-track-primary .moving-wall-card",
) {
  const cards = page.locator(selector);
  const count = await cards.count();
  const vpWidth = page.viewportSize().width;
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const box = await card.boundingBox();
    if (box && box.x >= 10 && box.x + box.width <= vpWidth - 10) {
      return card;
    }
  }
  for (let i = 0; i < count; i++) {
    const card = cards.nth(i);
    const box = await card.boundingBox();
    if (box && box.x > 0 && box.x < vpWidth) {
      return card;
    }
  }
  return cards.first();
}

async function runAcceptance() {
  console.log(`=======================================================`);
  console.log(`KA NAILS SECTION 02 - VISUAL MOTION ACCEPTANCE PASS`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(`Strict Policy: prefers-reduced-motion is NOT enabled`);
  console.log(`=======================================================\n`);

  const browser = await chromium.launch({ headless: true });

  const viewports = [
    { name: "desktop-1440", width: 1440, height: 900, isMobile: false },
    { name: "desktop-1280", width: 1280, height: 800, isMobile: false },
    {
      name: "mobile-390",
      width: 390,
      height: 844,
      isMobile: true,
      hasTouch: true,
    },
  ];

  const overallResults = {};

  for (const vp of viewports) {
    console.log(`\n-------------------------------------------------------`);
    console.log(`TESTING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`-------------------------------------------------------`);

    // 1. Measure Clean Runtime Performance Profile (without video encoder throttling)
    console.log(
      `Measuring runtime frame timing & Long Tasks during active motion...`,
    );
    const perfContext = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      reducedMotion: "no-preference",
    });
    const perfPage = await perfContext.newPage();
    await perfPage.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    await perfPage.waitForLoadState("load");

    const perfSection = perfPage.locator(".moving-wall-section");
    await perfSection.scrollIntoViewIfNeeded();
    await perfPage.waitForTimeout(600);

    const perfData = await perfPage.evaluate(async () => {
      const perf = {
        frames: [],
        longTasks: [],
      };

      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            perf.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch {
        // observer unsupported
      }

      return new Promise((resolve) => {
        let last = performance.now();
        function recordFrame(now) {
          const dt = now - last;
          last = now;
          perf.frames.push(dt);
          if (perf.frames.length < 150) {
            requestAnimationFrame(recordFrame);
          } else {
            resolve(perf);
          }
        }
        requestAnimationFrame(recordFrame);
      });
    });

    await perfContext.close();

    const frames = perfData.frames.slice(5); // drop warm-up frames
    const avgDt = frames.reduce((a, b) => a + b, 0) / frames.length;
    const avgFps = 1000 / avgDt;

    const sorted = [...frames].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    const p99 = sorted[Math.floor(sorted.length * 0.99)];
    const maxDrop = sorted[sorted.length - 1];
    const droppedFramesCount = frames.filter((f) => f > 33.3).length;
    const longTasks = perfData.longTasks || [];

    console.log(`  Sampled Frames:         ${frames.length}`);
    console.log(`  Average FPS:            ${avgFps.toFixed(1)} fps`);
    console.log(`  Median Frame Time:      ${p50.toFixed(2)} ms`);
    console.log(`  95th Percentile:        ${p95.toFixed(2)} ms`);
    console.log(`  99th Percentile:        ${p99.toFixed(2)} ms`);
    console.log(`  Worst Frame Drop:       ${maxDrop.toFixed(2)} ms`);
    console.log(
      `  Frames > 33.3ms:        ${droppedFramesCount} (${((droppedFramesCount / frames.length) * 100).toFixed(1)}%)`,
    );
    console.log(`  Long Tasks (> 50ms):    ${longTasks.length}`);

    const perfPass = avgFps >= 50 && longTasks.length === 0;
    console.log(`  Performance grade:     ${perfPass ? "PASS" : "WARN/FAIL"}`);

    // 2. Open Video Recording Context for Visual & Interaction Acceptance
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      reducedMotion: "no-preference",
      recordVideo: {
        dir: VIDEOS_DIR,
        size: { width: vp.width, height: vp.height },
      },
    });

    const page = await context.newPage();
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    const section = page.locator(".moving-wall-section");
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(600);

    const isVisible = await section.isVisible();
    console.log(`Section 02 visible: ${isVisible}`);

    // 3. Measure Continuous 3-Layer Drift over time (t0, t1, t2, t3) with screenshots
    console.log(`Capturing motion sequence and displacement over 3 seconds...`);
    const readTransforms = async () => {
      return page.evaluate(() => {
        const bg = document.querySelector(".moving-track-bg");
        const primary = document.querySelector(".moving-track-primary");
        const fg = document.querySelector(".moving-track-fg");
        return {
          bg: window.getComputedStyle(bg).transform,
          primary: window.getComputedStyle(primary).transform,
          fg: window.getComputedStyle(fg).transform,
          time: performance.now(),
        };
      });
    };

    const t0 = await readTransforms();
    await section.screenshot({
      path: path.join(RESULTS_DIR, `${vp.name}-t0.png`),
    });

    await page.waitForTimeout(1000);
    const t1 = await readTransforms();

    await page.waitForTimeout(1000);
    const t2 = await readTransforms();

    await page.waitForTimeout(1000);
    const t3 = await readTransforms();
    await section.screenshot({
      path: path.join(RESULTS_DIR, `${vp.name}-t3.png`),
    });

    const bgX0 = parseTranslateX(t0.bg);
    const bgX1 = parseTranslateX(t1.bg);
    const bgX2 = parseTranslateX(t2.bg);
    const bgX3 = parseTranslateX(t3.bg);

    const primX0 = parseTranslateX(t0.primary);
    const primX1 = parseTranslateX(t1.primary);
    const primX2 = parseTranslateX(t2.primary);
    const primX3 = parseTranslateX(t3.primary);

    const fgX0 = parseTranslateX(t0.fg);
    const fgX1 = parseTranslateX(t1.fg);
    const fgX2 = parseTranslateX(t2.fg);
    const fgX3 = parseTranslateX(t3.fg);

    const getMedianDelta3s = (x0, x1, x2, x3) => {
      const d01 = Math.abs(x1 - x0);
      const d12 = Math.abs(x2 - x1);
      const d23 = Math.abs(x3 - x2);
      const sorted = [d01, d12, d23].sort((a, b) => a - b);
      return sorted[1] * 3; // Median interval normalized to 3s
    };

    const deltaBg = getMedianDelta3s(bgX0, bgX1, bgX2, bgX3);
    const deltaPrim = getMedianDelta3s(primX0, primX1, primX2, primX3);
    const deltaFg = getMedianDelta3s(fgX0, fgX1, fgX2, fgX3);

    console.log(`Continuous Drift Displacement over ~3s:`);
    console.log(`  Background: ${deltaBg.toFixed(1)}px (Layer 3 drift rate)`);
    console.log(`  Primary:    ${deltaPrim.toFixed(1)}px (Layer 1 drift rate)`);
    console.log(`  Foreground: ${deltaFg.toFixed(1)}px (Layer 2 drift rate)`);

    const continuousDrift = deltaBg > 10 && deltaPrim > 20 && deltaFg > 30;
    const velocityHierarchy = deltaFg > deltaPrim && deltaPrim > deltaBg;

    console.log(
      `  Continuous motion:     ${continuousDrift ? "PASS" : "FAIL"}`,
    );
    console.log(
      `  Velocity hierarchy:    ${velocityHierarchy ? "PASS" : "FAIL"} (Foreground > Primary > Background)`,
    );

    // 4. Pointer Parallax Check
    console.log(`Testing pointer parallax...`);
    const stage = page.locator(".moving-wall-stage");
    const stageBox = await stage.boundingBox();
    let pointerParallaxPass = false;

    if (stageBox) {
      await page.mouse.move(
        stageBox.x + stageBox.width * 0.85,
        stageBox.y + stageBox.height * 0.85,
      );
      await page.waitForTimeout(300);

      const tiltActive = await stage.evaluate((el) => {
        const vpEl = el.querySelector(".moving-wall-viewport");
        return {
          mouseX: parseFloat(el.style.getPropertyValue("--mouse-x") || "0"),
          mouseY: parseFloat(el.style.getPropertyValue("--mouse-y") || "0"),
          viewportTransform: vpEl
            ? window.getComputedStyle(vpEl).transform
            : "",
        };
      });

      console.log(
        `  Viewport 3D transform on pointer: ${tiltActive.viewportTransform.substring(0, 30)}...`,
      );
      pointerParallaxPass = tiltActive.viewportTransform.includes("matrix3d");
      console.log(
        `  Pointer parallax:      ${pointerParallaxPass ? "PASS" : "FAIL"}`,
      );

      // Return mouse to neutral
      await page.mouse.move(5, 5);
      await page.waitForTimeout(300);
    }

    // 5. Scroll Coupling Check
    console.log(`Testing scroll coupling...`);
    const preScrollPos = parseTranslateX((await readTransforms()).primary);
    await page.evaluate(() => {
      window.scrollBy({ top: 250, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
    });
    await page.waitForTimeout(300);
    const postScrollPos = parseTranslateX((await readTransforms()).primary);
    const scrollCouplingPass = Math.abs(postScrollPos - preScrollPos) > 5;
    console.log(
      `  Scroll coupling:       ${scrollCouplingPass ? "PASS" : "FAIL"}`,
    );

    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);

    // 6. Drag Interaction & Inertia Check
    console.log(`Testing drag interaction & inertia...`);
    let dragInertiaPass = false;
    if (stageBox) {
      const startX = stageBox.x + stageBox.width * 0.5;
      const startY = stageBox.y + stageBox.height * 0.5;
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX - 140, startY, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(200);

      const postDragTransform = (await readTransforms()).primary;
      const postDragX = parseTranslateX(postDragTransform);
      dragInertiaPass = Math.abs(postDragX - postScrollPos) > 30;
      console.log(
        `  Drag response/inertia: ${dragInertiaPass ? "PASS" : "FAIL"}`,
      );
    }

    // 7. Hover Card 3D Projection (find a currently visible card)
    console.log(`Testing hover card 3D projection on visible card...`);
    const visibleCard = await getVisibleCard(
      page,
      ".moving-track-primary .moving-wall-card",
    );
    let hoverProjectionPass = false;
    if (await visibleCard.isVisible()) {
      await visibleCard.hover({ force: true });
      await page.waitForTimeout(300);

      const cardStyle = await visibleCard.evaluate((el) => {
        const cs = window.getComputedStyle(el);
        return {
          transform: cs.transform,
          zIndex: cs.zIndex,
          boxShadow: cs.boxShadow,
        };
      });

      console.log(
        `  Card hover zIndex: ${cardStyle.zIndex}, transform: ${cardStyle.transform.substring(0, 30)}...`,
      );
      hoverProjectionPass =
        cardStyle.zIndex === "50" || cardStyle.transform.includes("matrix3d");
      console.log(
        `  Hover 3D projection:   ${hoverProjectionPass ? "PASS" : "FAIL"}`,
      );
    }

    // 8. Lightbox Click Integrity (click a currently visible card)
    console.log(`Testing lightbox click opening on visible card...`);
    let lightboxPass = false;
    const cardToClick = await getVisibleCard(
      page,
      ".moving-track-primary .moving-wall-card",
    );
    await cardToClick.click({ force: true });
    await page.waitForTimeout(500);

    const dialog = page.locator('div[role="dialog"].lightbox-overlay');
    let dialogVisible = await dialog.isVisible();
    console.log(`  Lightbox dialog visible: ${dialogVisible}`);

    if (!dialogVisible) {
      await cardToClick.evaluate((el) => el.click());
      await page.waitForTimeout(400);
      dialogVisible = await dialog.isVisible();
      console.log(`  Lightbox dialog after direct click: ${dialogVisible}`);
    }

    if (dialogVisible) {
      const bodyOverflow = await page.evaluate(
        () => document.body.style.overflow,
      );
      await page.keyboard.press("Escape");
      await page.waitForTimeout(400);
      const dialogClosed = !(await dialog.isVisible());
      console.log(`  Lightbox closes on Escape: ${dialogClosed}`);
      lightboxPass = dialogVisible && dialogClosed && bodyOverflow === "hidden";
      console.log(`  Lightbox integrity:    ${lightboxPass ? "PASS" : "FAIL"}`);
    }

    overallResults[vp.name] = {
      continuousDrift,
      velocityHierarchy,
      pointerParallaxPass,
      scrollCouplingPass,
      dragInertiaPass,
      hoverProjectionPass,
      lightboxPass,
      avgFps: avgFps.toFixed(1),
      p50: p50.toFixed(1),
      p95: p95.toFixed(1),
      maxDrop: maxDrop.toFixed(1),
      longTasksCount: longTasks.length,
      droppedFramesCount,
      perfPass,
    };

    const video = page.video();
    await page.close();
    await context.close();

    if (video) {
      const videoPath = await video.path();
      const targetVideoPath = path.join(VIDEOS_DIR, `${vp.name}.webm`);
      try {
        fs.renameSync(videoPath, targetVideoPath);
        console.log(`  Screen recording saved: ${targetVideoPath}`);
      } catch {
        console.log(`  Screen recording path:  ${videoPath}`);
      }
    }
  }

  await browser.close();

  // 9. Reduced Motion Verification
  console.log(`\n-------------------------------------------------------`);
  console.log(`REDUCED MOTION CONTRACT CHECK`);
  console.log(`-------------------------------------------------------`);
  const reducedBrowser = await chromium.launch({ headless: true });
  const reducedContext = await reducedBrowser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const reducedPage = await reducedContext.newPage();
  await reducedPage.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
  await reducedPage.waitForLoadState("load");

  const reducedMotionState = await reducedPage.evaluate(() => {
    const bgLayer = document.querySelector(".moving-layer-bg");
    const fgLayer = document.querySelector(".moving-layer-fg");
    const stage = document.querySelector(".moving-wall-stage");

    const bgDisp = window.getComputedStyle(bgLayer).display;
    const fgDisp = window.getComputedStyle(fgLayer).display;
    const stageOverflow = window.getComputedStyle(stage).overflowX;

    return {
      bgDisplay: bgDisp,
      fgDisplay: fgDisp,
      stageOverflow: stageOverflow,
      reducedPass:
        (bgDisp === "none" && fgDisp === "none") || stageOverflow === "auto",
    };
  });
  console.log(
    `  Reduced motion contract: bgLayer display=${reducedMotionState.bgDisplay}, fgLayer display=${reducedMotionState.fgDisplay}`,
  );
  console.log(
    `  Reduced motion status:   ${reducedMotionState.reducedPass ? "PASS" : "FAIL"}`,
  );
  await reducedBrowser.close();

  overallResults.reducedMotionPass = reducedMotionState.reducedPass;

  // Print Summary Table
  console.log(`\n=======================================================`);
  console.log(`FINAL MOTION ACCEPTANCE SUMMARY`);
  console.log(`=======================================================`);
  console.table(overallResults);

  fs.writeFileSync(
    path.join(RESULTS_DIR, "motion-acceptance-summary.json"),
    JSON.stringify(overallResults, null, 2),
  );

  console.log(`\nEvidence files saved to: ${RESULTS_DIR}`);
}

runAcceptance().catch((err) => {
  console.error(`Acceptance test failed with error:`, err);
  process.exit(1);
});
