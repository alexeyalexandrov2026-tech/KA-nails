import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.TEST_URL || "https://ka-nails.pages.dev";
const RESULTS_DIR = path.resolve("test-results/hardened-perf");

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

async function runScenarioProfiler({
  page,
  durationMs,
  action,
  actionIntervalMs = 120,
}) {
  // Reset and mount observer inside page
  await page.evaluate(() => {
    window.__hperf = {
      frames: [],
      longTasks: [],
      longAnimationFrames: [],
      running: true,
    };

    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === "long-animation-frame") {
            window.__hperf.longAnimationFrames.push({
              duration: entry.duration,
              blockingDuration: entry.blockingDuration,
              startTime: entry.startTime,
            });
          } else if (entry.entryType === "longtask") {
            window.__hperf.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        }
      });
      observer.observe({ entryTypes: ["long-animation-frame", "longtask"] });
    } catch {
      try {
        const fallback = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            window.__hperf.longTasks.push({
              duration: entry.duration,
              startTime: entry.startTime,
            });
          }
        });
        fallback.observe({ entryTypes: ["longtask"] });
      } catch {}
    }

    let last = performance.now();
    function tick(now) {
      if (!window.__hperf.running) return;
      const dt = now - last;
      last = now;
      window.__hperf.frames.push(dt);
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });

  const startTime = Date.now();

  // Execute scenario-specific continuous actions
  if (action) {
    const timer = setInterval(async () => {
      if (Date.now() - startTime >= durationMs) {
        clearInterval(timer);
        return;
      }
      try {
        await action(page);
      } catch {}
    }, actionIntervalMs);

    await page.waitForTimeout(durationMs);
    clearInterval(timer);
  } else {
    // Pure idle
    await page.waitForTimeout(durationMs);
  }

  // Retrieve metrics
  const rawData = await page.evaluate(() => {
    window.__hperf.running = false;
    return window.__hperf;
  });

  // Discard first 10 frames for stabilization
  const frames = rawData.frames.slice(10);
  if (frames.length === 0) return null;

  const avgDt = frames.reduce((a, b) => a + b, 0) / frames.length;
  const avgFps = 1000 / avgDt;

  const sorted = [...frames].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];
  const p99 = sorted[Math.floor(sorted.length * 0.99)];
  const maxDrop = sorted[sorted.length - 1];
  const framesAbove33 = frames.filter((f) => f > 33.3).length;
  const pctAbove33 = (framesAbove33 / frames.length) * 100;
  const stallsAbove50 = frames.filter((f) => f >= 50.0).length;

  const longestLoAF =
    rawData.longAnimationFrames.length > 0
      ? Math.max(...rawData.longAnimationFrames.map((f) => f.duration))
      : 0;

  return {
    totalFrames: frames.length,
    avgFps: parseFloat(avgFps.toFixed(2)),
    p50: parseFloat(p50.toFixed(2)),
    p95: parseFloat(p95.toFixed(2)),
    p99: parseFloat(p99.toFixed(2)),
    worstFrameTime: parseFloat(maxDrop.toFixed(2)),
    framesAbove33,
    pctAbove33: parseFloat(pctAbove33.toFixed(2)),
    stallsAbove50,
    longTasks: rawData.longTasks.length,
    longAnimationFrames: rawData.longAnimationFrames.length,
    longestLoAFDuration: parseFloat(longestLoAF.toFixed(2)),
  };
}

async function runHardenedSuite() {
  console.log(`=======================================================`);
  console.log(`HARDENED RUNTIME PERFORMANCE SUITE (15s PER SCENARIO)`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(
    `Authoritative Environment: Normal Chromium (NO flags/overrides)`,
  );
  console.log(
    `Criteria: Avg FPS >= 58 | p50 <= 17.5ms | p95 <= 20ms | Frames>33.3ms < 2%`,
  );
  console.log(`=======================================================\n`);

  // Authoritative run: standard normal browser without custom flags/overrides
  const browser = await chromium.launch({
    headless: false,
    args: [],
  });

  const allViewports = [
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

  const targetVpName = process.env.TARGET_VP;
  const viewports = targetVpName
    ? allViewports.filter((v) => v.name === targetVpName)
    : allViewports;

  const scenarios = [
    {
      id: "A_idle",
      name: "A. Autonomous Idle 3-Layer Motion",
      action: null,
      interval: 0,
    },
    {
      id: "B_pointer_parallax",
      name: "B. Pointer Parallax Active",
      action: async (page) => {
        const time = Date.now();
        const rad = (time / 1000) * 1.5;
        const x = 720 + Math.sin(rad) * 350;
        const y = 450 + Math.cos(rad) * 150;
        await page.mouse.move(x, y);
      },
      interval: 100,
    },
    {
      id: "C_hover_projection",
      name: "C. Hover Projection Active",
      action: async (page) => {
        const cards = page.locator(".moving-track-primary .moving-wall-card");
        const count = await cards.count();
        if (count > 0) {
          const idx = Math.floor(Math.random() * Math.min(count, 4));
          const card = cards.nth(idx);
          if (await card.isVisible()) {
            await card.hover({ force: true });
          }
        }
      },
      interval: 800,
    },
    {
      id: "D_scroll_impulse",
      name: "D. Scroll Impulse",
      action: async (page) => {
        await page.evaluate(() => {
          window.dispatchEvent(new Event("scroll"));
        });
      },
      interval: 400,
    },
    {
      id: "E_drag_inertia",
      name: "E. Drag + Inertia",
      action: async (page) => {
        const stage = page.locator(".moving-wall-stage");
        const box = await stage.boundingBox();
        if (box) {
          const startX = box.x + box.width * 0.6;
          const startY = box.y + box.height * 0.5;
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX - 60, startY, { steps: 3 });
          await page.mouse.up();
        }
      },
      interval: 1200,
    },
    {
      id: "F_loop_wrap",
      name: "F. Infinite-Loop Wrap",
      action: null,
      interval: 0,
    },
    {
      id: "G_lightbox",
      name: "G. Lightbox Open/Close",
      action: async (page) => {
        const dialog = page.locator('div[role="dialog"].lightbox-overlay');
        const isUp = await dialog.isVisible();
        if (isUp) {
          await page.keyboard.press("Escape");
        } else {
          const cards = page.locator(".moving-track-primary .moving-wall-card");
          const count = await cards.count();
          if (count > 0) {
            await cards.first().click({ force: true });
          }
        }
      },
      interval: 1500,
    },
  ];

  const fullReport = {};

  for (const vp of viewports) {
    console.log(`\n=======================================================`);
    console.log(`PROFILING VIEWPORT: ${vp.name} (${vp.width}x${vp.height})`);
    console.log(`=======================================================`);

    fullReport[vp.name] = {};

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.isMobile,
      hasTouch: vp.hasTouch,
      reducedMotion: "no-preference",
    });

    const page = await context.newPage();
    await page.goto(BASE_URL + "/", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("load");

    const section = page.locator(".moving-wall-section");
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1000);

    for (const sc of scenarios) {
      console.log(`Running scenario: ${sc.name} (15 seconds)...`);

      const result = await runScenarioProfiler({
        page,
        durationMs: 15000,
        action: sc.action,
        actionIntervalMs: sc.interval,
      });

      await page.waitForTimeout(500);

      const passFps = result.avgFps >= 58.0;
      const passP50 = result.p50 <= 17.5;
      const passP95 = result.p95 <= 20.0;
      const passPct33 = result.pctAbove33 <= 2.0;
      const scenarioPass = passFps && passP50 && passP95 && passPct33;

      console.log(
        `  Avg FPS: ${result.avgFps} | p50: ${result.p50}ms | p95: ${result.p95}ms | p99: ${result.p99}ms | Worst: ${result.worstFrameTime}ms`,
      );
      console.log(
        `  >33.3ms: ${result.framesAbove33} (${result.pctAbove33}%) | Long Tasks: ${result.longTasks} | LoAF: ${result.longAnimationFrames} (Max: ${result.longestLoAFDuration}ms)`,
      );
      console.log(`  Status: ${scenarioPass ? "PASS" : "FAIL"}\n`);

      fullReport[vp.name][sc.id] = {
        name: sc.name,
        result,
        pass: scenarioPass,
      };
    }

    await context.close();
  }

  await browser.close();

  const outPath = path.join(
    RESULTS_DIR,
    `hardened-report-${targetVpName || "all"}.json`,
  );
  fs.writeFileSync(outPath, JSON.stringify(fullReport, null, 2));

  console.log(`\n=======================================================`);
  console.log(`HARDENED PERFORMANCE SUITE COMPLETED`);
  console.log(`Report saved to: ${outPath}`);
  console.log(`=======================================================`);
}

runHardenedSuite().catch((err) => {
  console.error("Hardened performance suite failed:", err);
  process.exit(1);
});
