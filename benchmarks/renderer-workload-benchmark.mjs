import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireFromBridge = createRequire(new URL("../agent-bridge/package.json", import.meta.url));
const { chromium } = requireFromBridge("playwright");
const HTML_PATH = resolve(ROOT, "benchmarks/renderer-workload-benchmark.html");
const RENDERER_PATH = resolve(ROOT, "js/canvas-renderer.js");
const OUTPUT_PATH = resolve(ROOT, "benchmarks/renderer-workload-report.json");

const SIZES = [32, 64, 128, 256, 512];
const SCENARIOS = [
  "full_sparse",
  "full_dense",
  "dirty_1px_sparse",
  "dirty_1px_dense",
  "overlay_grid_selection_dense",
  "onion_before_after_sparse",
  "onion_before_after_dense"
];
const TOTAL_CASES = SIZES.length * SCENARIOS.length;
const DPR = Number(process.env.ARTCLUB_BENCHMARK_DPR) || 1.5;
const WARMUPS = Math.max(1, Math.min(4, Number(process.env.ARTCLUB_WORKLOAD_WARMUPS) || 2));
const SAMPLES = Math.max(5, Math.min(11, Number(process.env.ARTCLUB_WORKLOAD_SAMPLES) || 5));
const CASE_TIMEOUT_MS = Math.max(30000, Number(process.env.ARTCLUB_WORKLOAD_CASE_TIMEOUT_MS) || 180000);

function dirtyUpdatesForSize(size) {
  // The current renderer validates the complete source array on every render call.
  // Keep the largest per-sample edit batch bounded so a stress case cannot lock the runner.
  return size <= 128 ? 256 : 64;
}

function makeInitialReport(environment) {
  return {
    benchmark: "Art Club renderer workload characterization",
    completedAt: null,
    environment,
    methodology: {
      sizes: SIZES,
      scenarios: SCENARIOS,
      warmupRunsPerRenderer: WARMUPS,
      measuredSamplesPerRenderer: SAMPLES,
      dirtyUpdatesPerSampleBySize: {
        "32": 256,
        "64": 256,
        "128": 256,
        "256": 64,
        "512": 64
      },
      sampleOrder: "DOM-first and Canvas-first alternate across measured samples",
      timing: "performance.now around synchronous renderer work; DOM reads computed style/layout after updates, Canvas reads one visible pixel after the update batch to flush pending Canvas 2D work",
      domBaseline: "One accessible pixel-cell div per logical pixel created in a DocumentFragment; full cases replace the grid; overlay cases add per-cell borders/selection outlines; onion masks are represented by RGBA CSS backgrounds; dirty cases update existing cell background styles and force computed style",
      canvasPath: "Production CanvasPixelRenderer; full cases call renderer.render(state); dirty cases call render(state, one-pixel dirtyRect) once per edit and read the visible canvas at batch end; overlay/onion use production renderer options",
      statistics: "median, nearest-rank p95, mean, population standard deviation, coefficient of variation and raw samples; dirty timings also include batch size and median milliseconds per edit",
      memory: "known renderer-owned typed/backing-buffer lower bound: ImageData, raster OffscreenCanvas, visible canvas, overlay canvas and optional two Uint32Array onion snapshots; excludes DOM nodes, project JS strings, browser/GPU copies and allocator slack",
      dirtyDomFlush: "After a dirty batch, read computed backgroundColor from a changed cell and force grid offsetHeight before stopping the timer. Values close to 0.1 ms remain near browser timer resolution.",
      dirtyBatchRationale: "Dirty batches use 256 edits for 32–128 sizes, and 64 edits for 256–512 because repeated render() calls validate the complete source array and larger batches exceeded the isolated-runner budget.",
      scope: "renderer-only microbenchmark; excludes application compositing, brush/fill model work, pointer latency, scheduling, accessibility interaction and frame pacing",
      executionNote: "Each size/scenario uses a fresh Chromium process to isolate DOM-node accumulation. Some 512×512 DOM-heavy scenarios may exceed the per-case timeout; such cases are recorded as unmeasured rather than omitted."
    },
    results: [],
    unmeasuredCases: [],
    execution: {
      runner: "Node Playwright, one browser process per workload case",
      browserPage: "benchmarks/renderer-workload-benchmark.html",
      caseTimeoutMs: CASE_TIMEOUT_MS,
      expectedCases: TOTAL_CASES
    }
  };
}

async function persist(report) {
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2) + "\n", "utf8");
}

async function runCase(html, rendererSource, size, scenario) {
  let browser;
  let context;
  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: DPR
    });
    const page = await context.newPage();
    page.setDefaultTimeout(CASE_TIMEOUT_MS);
    const config = {
      warmups: WARMUPS,
      samples: SAMPLES,
      dirtyUpdates: dirtyUpdatesForSize(size),
      sizes: [size],
      scenarios: [scenario]
    };
    await page.addInitScript(value => { window.__ARTCLUB_WORKLOAD_CONFIG = value; }, config);
    const source = html.replace(
      '<script src="../js/canvas-renderer.js"></script>',
      "<script>\n" + rendererSource + "\n</script>"
    );
    // domcontentloaded avoids waiting on an unresponsive main thread's load event.
    await page.setContent(source, { waitUntil: "domcontentloaded", timeout: CASE_TIMEOUT_MS });
    await page.waitForFunction(() => {
      const state = document.documentElement.dataset.workloadComplete;
      return state === "true" || state === "false";
    }, null, { timeout: CASE_TIMEOUT_MS });
    const pageResult = await page.evaluate(() => ({
      ok: document.documentElement.dataset.workloadComplete === "true",
      report: window.__rendererWorkloadReport || null,
      error: window.__rendererWorkloadError || null,
      status: document.querySelector("#status")?.textContent || ""
    }));
    assert.equal(pageResult.ok, true, "page benchmark failed: " + pageResult.status + " " + pageResult.error);
    assert.ok(pageResult.report, "workload report missing");
    assert.equal(pageResult.report.results.length, 1, "expected one isolated workload result");
    const result = pageResult.report.results[0];
    assert.equal(result.width, size);
    assert.equal(result.scenario, scenario);
    assert.equal(result.rendererOnly.dom.rawSamplesMs.length, SAMPLES);
    assert.equal(result.rendererOnly.canvas.rawSamplesMs.length, SAMPLES);
    assert.equal(result.rendererOnly.dirtyUpdatesPerSample || 0, scenario.startsWith("dirty_") ? config.dirtyUpdates : 0);
    return { result, browserVersion: browser.version() };
  } finally {
    if (context) await context.close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

async function main() {
  const [html, rendererSource] = await Promise.all([
    readFile(HTML_PATH, "utf8"),
    readFile(RENDERER_PATH, "utf8")
  ]);
  assert.ok(html.includes('<script src="../js/canvas-renderer.js"></script>'), "benchmark page is missing the renderer slot");

  const environment = {
    userAgent: "Headless Chromium; fresh process per workload case",
    platform: os.platform() + "-" + os.release(),
    devicePixelRatio: DPR,
    hardwareConcurrency: os.cpus().length,
    deviceMemoryGb: null,
    browserVersion: null,
    runner: {
      platform: os.platform(),
      release: os.release(),
      architecture: os.arch(),
      cpuModel: os.cpus()[0]?.model || null,
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      nodeVersion: process.version,
      runnerType: "Node Playwright; fresh headless Chromium process per workload case",
      ci: process.env.CI === "true"
    }
  };
  const report = makeInitialReport(environment);
  await persist(report);

  for (const size of SIZES) {
    for (const scenario of SCENARIOS) {
      const label = size + "x" + size + " " + scenario;
      process.stdout.write("RUN " + label + "\n");
      try {
        const measured = await runCase(html, rendererSource, size, scenario);
        report.results.push(measured.result);
        report.environment.browserVersion = measured.browserVersion;
        process.stdout.write("PASS " + label + " DOM=" + measured.result.rendererOnly.dom.medianMs +
          "ms Canvas=" + measured.result.rendererOnly.canvas.medianMs + "ms\n");
      } catch (error) {
        const reason = String(error?.message || error).slice(0, 1500);
        report.unmeasuredCases.push({ size, scenario, reason, timeoutMs: CASE_TIMEOUT_MS });
        process.stdout.write("UNMEASURED " + label + ": " + reason.slice(0, 240) + "\n");
      }
      report.completedAt = new Date().toISOString();
      await persist(report);
    }
  }

  assert.equal(report.results.length + report.unmeasuredCases.length, TOTAL_CASES,
    "every expected workload must be measured or explicitly recorded as unmeasured");
  const unique = new Set(report.results.map(item => item.size + "::" + item.scenario));
  assert.equal(unique.size, report.results.length, "duplicate workload result");
  console.log("Measured " + report.results.length + "/" + TOTAL_CASES + "; unmeasured " + report.unmeasuredCases.length);
  console.log("Report: " + OUTPUT_PATH);
  console.log(JSON.stringify(report.results.map(item => ({
    size: item.size,
    scenario: item.scenario,
    domMedianMs: item.rendererOnly.dom.medianMs,
    domP95Ms: item.rendererOnly.dom.p95Ms,
    canvasMedianMs: item.rendererOnly.canvas.medianMs,
    canvasP95Ms: item.rendererOnly.canvas.p95Ms,
    domCv: item.rendererOnly.dom.coefficientOfVariation,
    canvasCv: item.rendererOnly.canvas.coefficientOfVariation,
    rendererMiB: item.memory.knownRendererBufferMiB
  })), null, 2));
}

main().catch(error => {
  console.error(error?.stack || String(error));
  process.exitCode = 1;
});
