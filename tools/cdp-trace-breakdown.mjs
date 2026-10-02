import { chromium } from "playwright";
import fs from "fs";

async function measureCDPTrace() {
  console.log(
    "Starting CDP Tracing on normal Chromium (headless: false, NO flags)...",
  );
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    viewport: { width: 1440, height: 900 },
  });

  await page.goto("https://ka-nails.pages.dev");
  await page.locator(".moving-wall-stage").scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);

  const client = await page.context().newCDPSession(page);
  const traceEvents = [];
  client.on("Tracing.dataCollected", (data) => {
    traceEvents.push(...data.value);
  });

  await client.send("Tracing.start", {
    traceConfig: {
      includedCategories: [
        "devtools.timeline",
        "disabled-by-default-devtools.timeline",
        "blink.user_timing",
        "v8.execute",
      ],
    },
  });

  // Profile 5 seconds of active multi-layer motion
  await page.waitForTimeout(5000);

  const tracingComplete = new Promise((resolve) =>
    client.on("Tracing.tracingComplete", resolve),
  );
  await client.send("Tracing.end");
  await tracingComplete;
  await browser.close();

  // Aggregate by category
  const categories = {
    scripting: 0,
    style_recalculation: 0,
    layout: 0,
    paint: 0,
    raster: 0,
    compositing: 0,
    image_decode: 0,
    gpu_layerization: 0,
    other: 0,
  };

  for (const ev of traceEvents) {
    if (!ev.dur) continue;
    const durMs = ev.dur / 1000;
    const name = ev.name;

    if (
      name === "EvaluateScript" ||
      name === "FunctionCall" ||
      name === "v8.compile" ||
      name === "RunMicrotasks"
    ) {
      categories.scripting += durMs;
    } else if (name === "UpdateLayoutTree" || name === "RecalculateStyles") {
      categories.style_recalculation += durMs;
    } else if (name === "Layout") {
      categories.layout += durMs;
    } else if (name === "Paint") {
      categories.paint += durMs;
    } else if (name === "RasterTask") {
      categories.raster += durMs;
    } else if (name === "CompositeLayers" || name === "Commit") {
      categories.compositing += durMs;
    } else if (name === "Decode Image" || name === "ImageDecodeTask") {
      categories.image_decode += durMs;
    } else if (name === "Layerize") {
      categories.gpu_layerization += durMs;
    } else {
      categories.other += durMs;
    }
  }

  const total = Object.values(categories).reduce((a, b) => a + b, 0);

  console.log(
    "\n================ CDP TRACE SUMMARY (5000ms SAMPLING) ================",
  );
  for (const [cat, dur] of Object.entries(categories)) {
    const pct = total > 0 ? ((dur / total) * 100).toFixed(2) : "0.00";
    console.log(
      `- ${cat.padEnd(22)}: ${dur.toFixed(2).padStart(8)} ms (${pct.padStart(5)}%)`,
    );
  }
  console.log(
    `- ${"TOTAL TRACED".padEnd(22)}: ${total.toFixed(2).padStart(8)} ms`,
  );
  console.log(
    "=======================================================================\n",
  );

  fs.writeFileSync(
    "test-results/cdp-trace-optimized.json",
    JSON.stringify(categories, null, 2),
  );
}

measureCDPTrace().catch(console.error);
