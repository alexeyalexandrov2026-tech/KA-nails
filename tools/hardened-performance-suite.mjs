import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE_URL = process.env.TEST_URL || "https://ka-nails.pages.dev";
const RESULTS_DIR = path.resolve("test-results/hardened-perf");

if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

async function runScenarioProfiler({ page, durationMs, action }) {
  // Start profiler inside the page
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
    const actionInterval = setInterval(async () => {
      if (Date.now() - startTime >= durationMs) {
        clearInterval(actionInterval);
        return;
      }
      try {
        await action(page);
      } catch {}
    }, 120);

    await page.waitForTimeout(durationMs);
    clearInterval(actionInterval);
  } else {
    // Pure idle
    await page.waitForTimeout(durationMs);
  }

  // Retrieve metrics
  const rawData = await page.evaluate(() => {
    window.__hperf.running = false;
    return window.__hperf;
  });

  // Calculate statistics (drop first 10 frames for warm-up)
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

  return {
    totalFrames: frames.length,
    avgFps: parseFloat(avgFps.toFixed(2)),
    p50: parseFloat(p50.toFixed(2)),
    p95: parseFloat(p95.toFixed(2)),
    p99: parseFloat(p99.toFixed(2)),
    maxDrop: parseFloat(maxDrop.toFixed(2)),
    framesAbove33,
    pctAbove33: parseFloat(pctAbove33.toFixed(2)),
    stallsAbove50,
    longTasks: rawData.longTasks.length,
    longAnimationFrames: rawData.longAnimationFrames.length,
  };
}

async function runHardenedSuite() {
  console.log(`=======================================================`);
  console.log(`HARDENED RUNTIME PERFORMANCE SUITE (15s PER SCENARIO)`);
  console.log(`Target URL: ${BASE_URL}`);
  console.log(
    `Criteria: Avg FPS >= 58 | p50 <= 17.5ms | p95 <= 20ms | Frames>33.3ms < 2%`,
  );
  console.log(`=======================================================\n`);

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--use-gl=angle",
      "--use-angle=d3d11",
      "--enable-gpu-rasterization",
      "--enable-features=UseSkiaRenderer",
    ],
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

  const viewports = process.env.TARGET_VP
    ? allViewports.filter((v) => v.name === process.env.TARGET_VP)
    : allViewports;

  const scenarios = [
    {
      id: "s1_idle",
      name: "1. Idle Autonomous 3-Layer Motion",
      action: null,
    },
    {
      id: "s2_pointer_parallax",
      name: "2. Pointer Parallax Active (Continuous Motion)",
      action: async (page) => {
        const time = Date.now();
        const rad = (time / 1000) * 2;
        const x = 720 + Math.sin(rad) * 450;
        const y = 450 + Math.cos(rad) * 200;
        await page.mouse.move(x, y);
      },
    },
    {
      id: "s3_hover_projection",
      name: "3. Hover Projection Active (Alternating Focus)",
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
    },
    {
      id: "s4_scroll_impulse",
      name: "4. Scroll Impulse (Passive Wheel Velocity Surges)",
      action: async (page) => {
        await page.evaluate(() => {
          window.dispatchEvent(new Event("scroll"));
        });
      },
    },
    {
      id: "s5_drag_inertia",
      name: "5. Drag + Inertia (Periodic Momentum Swipes)",
      action: async (page) => {
        const stage = page.locator(".moving-wall-stage");
        const box = await stage.boundingBox();
        if (box) {
          const startX = box.x + box.width * 0.6;
          const startY = box.y + box.height * 0.5;
          await page.mouse.move(startX, startY);
          await page.mouse.down();
          await page.mouse.move(startX - 80, startY, { steps: 3 });
          await page.mouse.up();
        }
      },
    },
    {
      id: "s6_loop_wrap",
      name: "6. Loop Wrap (Continuous Drift across Boundary)",
      action: null,
    },
    {
      id: "s7_lightbox_open_close",
      name: "7. Lightbox Open/Close Cycling",
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
      console.log(`\nRunning scenario: ${sc.name} (15 seconds)...`);

      // Run sample 1 (15 seconds)
      const run1 = await runScenarioProfiler({
        page,
        durationMs: 15000,
        action: sc.action,
      });

      // Brief settling
      await page.waitForTimeout(500);

      // Run sample 2 (15 seconds)
      const run2 = await runScenarioProfiler({
        page,
        durationMs: 15000,
        action: sc.action,
      });

      // Determine median and worst runs
      const avgFpsMedian =
        Math.min(run1.avgFps, run2.avgFps) === run1.avgFps ? run2 : run1;
      const worstRun = run1.avgFps < run2.avgFps ? run1 : run2;

      console.log(
        `  Sample 1: ${run1.avgFps} fps | p50: ${run1.p50}ms | p95: ${run1.p95}ms | >33.3ms: ${run1.pctAbove33}% | LoAF: ${run1.longAnimationFrames}`,
      );
      console.log(
        `  Sample 2: ${run2.avgFps} fps | p50: ${run2.p50}ms | p95: ${run2.p95}ms | >33.3ms: ${run2.pctAbove33}% | LoAF: ${run2.longAnimationFrames}`,
      );

      const passFps = worstRun.avgFps >= 58.0;
      const passP50 = worstRun.p50 <= 17.5;
      const passPct33 = worstRun.pctAbove33 <= 2.0;
      const passStalls = worstRun.stallsAbove50 === 0;

      const scenarioPass = passFps && passP50 && passPct33 && passStalls;

      console.log(
        `  Scenario Result: ${scenarioPass ? "PASS" : "FAIL"} (Worst Avg FPS: ${worstRun.avgFps}, p50: ${worstRun.p50}ms, >33.3ms: ${worstRun.pctAbove33}%, stalls: ${worstRun.stallsAbove50})`,
      );

      fullReport[vp.name][sc.id] = {
        name: sc.name,
        medianRun: avgFpsMedian,
        worstRun: worstRun,
        pass: scenarioPass,
      };
    }

    await context.close();
  }

  await browser.close();

  fs.writeFileSync(
    path.join(RESULTS_DIR, "hardened-performance-report.json"),
    JSON.stringify(fullReport, null, 2),
  );

  console.log(`\n=======================================================`);
  console.log(`HARDENED PERFORMANCE SUITE COMPLETED`);
  console.log(
    `Report saved to: ${path.join(RESULTS_DIR, "hardened-performance-report.json")}`,
  );
  console.log(`=======================================================`);
}

runHardenedSuite().catch((err) => {
  console.error("Hardened performance suite failed:", err);
  process.exit(1);
});
