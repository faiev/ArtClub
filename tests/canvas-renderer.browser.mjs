import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import os from "node:os";
import { extname, resolve, sep } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireFromBridge = createRequire(new URL("../agent-bridge/package.json", import.meta.url));
const { chromium } = requireFromBridge("playwright");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(
        url.pathname === "/" ? "/tests/canvas-renderer.browser.html" : url.pathname
      );
      const filePath = resolve(REPO_ROOT, "." + pathname);
      if (filePath !== REPO_ROOT && !filePath.startsWith(REPO_ROOT + sep)) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }
      const body = await readFile(filePath);
      response.writeHead(200, {
        "content-type": MIME_TYPES[extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch (error) {
      response.writeHead(error && error.code === "ENOENT" ? 404 : 500);
      response.end(error && error.code === "ENOENT" ? "Not found" : String(error));
    }
  });

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({
        server,
        origin: "http://127.0.0.1:" + address.port
      });
    });
  });
}

async function main() {
  const { server, origin } = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      deviceScaleFactor: 1.5
    });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    const pageErrors = [];
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.goto(origin + "/tests/canvas-renderer.browser.html", { waitUntil: "load" });
    await page.waitForFunction(() => document.documentElement.dataset.rendererReady === "true");
    const rasterResult = await page.evaluate(() => {
      const cases = [];
      const failures = [];

      function check(condition, message) {
        if (!condition) throw new Error(message);
      }

      function equalBytes(actual, expected, message) {
        check(actual.length === expected.length,
          message + ": length " + actual.length + " !== " + expected.length);
        for (let i = 0; i < expected.length; i++) {
          if (actual[i] !== expected[i]) {
            throw new Error(message + ": byte " + i + " was " + actual[i] +
              ", expected " + expected[i]);
          }
        }
      }

      function assertThrows(callback, pattern) {
        let error = null;
        try {
          callback();
        } catch (caught) {
          error = caught;
        }
        check(error instanceof Error, "expected operation to throw");
        check(pattern.test(error.message),
          "unexpected validation error: " + error.message);
      }

      function run(name, callback) {
        try {
          callback();
          cases.push({ name, status: "passed" });
        } catch (error) {
          failures.push({
            name,
            message: error && error.message ? error.message : String(error)
          });
          cases.push({ name, status: "failed" });
        }
      }

      function makeCanvas(options) {
        const settings = Object.assign({
          width: 2,
          height: 2,
          left: 0,
          top: 0,
          dpr: 1,
          setDpr: true
        }, options || {});
        const canvas = document.createElement("canvas");
        canvas.style.position = "absolute";
        canvas.style.left = settings.left + "px";
        canvas.style.top = settings.top + "px";
        canvas.style.width = settings.width + "px";
        canvas.style.height = settings.height + "px";
        canvas.style.margin = "0";
        canvas.style.padding = "0";
        canvas.style.border = "0";
        canvas.style.display = "block";
        document.body.appendChild(canvas);

        const rendererOptions = {};
        if (settings.setDpr) rendererOptions.devicePixelRatio = settings.dpr;
        if (settings.displayWidth !== undefined) rendererOptions.displayWidth = settings.displayWidth;
        if (settings.displayHeight !== undefined) rendererOptions.displayHeight = settings.displayHeight;
        const renderer = new window.ArtClubCanvasRenderer.CanvasPixelRenderer(canvas, rendererOptions);
        return { canvas, renderer };
      }

      function visibleBytes(canvas) {
        return Array.from(
          canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data
        );
      }

      run("native-size browser raster matches every source RGBA byte, including transparency", () => {
        const pair = makeCanvas({
          width: 2, height: 1, displayWidth: 2, displayHeight: 1, dpr: 1
        });
        pair.renderer.render({
          width: 2, height: 1, pixels: ["#ff0000", null], grid: false
        });
        equalBytes(visibleBytes(pair.canvas),
          [255, 0, 0, 255, 0, 0, 0, 0],
          "native visible canvas raster");
        equalBytes(Array.from(pair.renderer.imageData.data),
          [255, 0, 0, 255, 0, 0, 0, 0],
          "native renderer ImageData");
        check(pair.canvas.getContext("2d").imageSmoothingEnabled === false,
          "native canvas must disable smoothing");
        pair.renderer.destroy();
        pair.canvas.remove();
      });

      run("enlarged browser raster uses exact nearest-neighbor replication", () => {
        const pair = makeCanvas({
          width: 4, height: 2, displayWidth: 4, displayHeight: 2, dpr: 1
        });
        pair.renderer.render({
          width: 2, height: 1, pixels: ["#ff0000", null], grid: false
        });
        const expected = [
          255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0,
          255, 0, 0, 255, 255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0
        ];
        equalBytes(visibleBytes(pair.canvas), expected, "2× nearest-neighbor output");
        equalBytes(Array.from(pair.renderer.imageData.data),
          [255, 0, 0, 255, 0, 0, 0, 0],
          "enlarged renderer source ImageData");
        pair.renderer.destroy();
        pair.canvas.remove();
      });

      run("grid and selection remain on the overlay surface, not the artwork buffer", () => {
        const pair = makeCanvas({
          width: 40, height: 40, displayWidth: 40, displayHeight: 40, dpr: 1
        });
        const source = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"];
        pair.renderer.render({
          width: 2, height: 2, pixels: source, grid: true,
          selection: { x: 0, y: 0, width: 1, height: 1 }
        });
        const expectedArtwork = [
          255, 0, 0, 255, 0, 255, 0, 255,
          0, 0, 255, 255, 255, 255, 255, 255
        ];
        equalBytes(Array.from(pair.renderer.imageData.data), expectedArtwork,
          "overlay-free artwork buffer");
        const visible = visibleBytes(pair.canvas);
        let overlayDiffersFromArtwork = false;
        for (let y = 0; y < 40; y++) {
          for (let x = 0; x < 40; x++) {
            const sourceIndex = (Math.floor(y / 20) * 2 + Math.floor(x / 20)) * 4;
            const outputIndex = (y * 40 + x) * 4;
            for (let channel = 0; channel < 4; channel++) {
              if (visible[outputIndex + channel] !== expectedArtwork[sourceIndex + channel]) {
                overlayDiffersFromArtwork = true;
              }
            }
          }
        }
        check(overlayDiffersFromArtwork,
          "visible canvas should contain separate grid/selection overlay pixels");
        check(visible.length === 40 * 40 * 4,
          "visible canvas should retain the expected display raster dimensions");
        pair.renderer.destroy();
        pair.canvas.remove();
      });

      run("pointer mapping respects fractional CSS bounds with a 1.5 DPR browser", () => {
        check(window.devicePixelRatio === 1.5,
          "test context DPR should be 1.5; got " + window.devicePixelRatio);
        const pair = makeCanvas({
          width: 5.5, height: 3.25, left: 11.25, top: 7.5, setDpr: false
        });
        pair.renderer.render({
          width: 4, height: 2, pixels: Array(8).fill(null), grid: false
        });
        const bounds = pair.canvas.getBoundingClientRect();
        check(Math.abs(bounds.width - 5.5) < 0.001,
          "fractional CSS width was not preserved: " + bounds.width);
        check(Math.abs(bounds.height - 3.25) < 0.001,
          "fractional CSS height was not preserved: " + bounds.height);
        check(pair.renderer.getStats().devicePixelRatio === 1.5,
          "renderer should preserve the browser DPR");
        const point = pair.renderer.mapClientToPixel(
          bounds.left + bounds.width * 0.76,
          bounds.top + bounds.height * 0.76
        );
        check(JSON.stringify(point) === JSON.stringify({ x: 3, y: 1, i: 7 }),
          "fractional-bounds pointer mapping returned " + JSON.stringify(point));
        check(pair.renderer.mapClientToPixel(bounds.right, bounds.top) === null,
          "right edge must be outside the canvas");
        check(pair.renderer.mapClientToPixel(bounds.left - 0.001, bounds.top) === null,
          "point just left of the canvas must be outside");
        pair.renderer.destroy();
        pair.canvas.remove();
      });

      run("frame and composite revision changes force full-frame invalidation", () => {
        const pair = makeCanvas({
          width: 2, height: 2, displayWidth: 2, displayHeight: 2, dpr: 1
        });
        const pixels = ["#ff0000", null, null, null];
        pair.renderer.render({
          width: 2, height: 2, pixels, grid: false,
          frameId: "frame-a", compositeRevision: 1
        });

        pixels[0] = "#0000ff";
        pixels[3] = "#00ff00";
        const frameChange = pair.renderer.render({
          width: 2, height: 2, pixels, grid: false,
          frameId: "frame-b", compositeRevision: 1
        }, { x: 1, y: 1, width: 1, height: 1 });
        check(frameChange.lastRenderMode === "full",
          "frameId change should force a full render");
        equalBytes(visibleBytes(pair.canvas), [
          0, 0, 255, 255, 0, 0, 0, 0,
          0, 0, 0, 0, 0, 255, 0, 255
        ], "full raster after frame switch");

        pixels[1] = "#ffff00";
        const compositeChange = pair.renderer.render({
          width: 2, height: 2, pixels, grid: false,
          frameId: "frame-b", compositeRevision: 2
        }, { x: 0, y: 1, width: 1, height: 1 });
        check(compositeChange.lastRenderMode === "full",
          "compositeRevision change should force a full render");
        equalBytes(visibleBytes(pair.canvas), [
          0, 0, 255, 255, 255, 255, 0, 255,
          0, 0, 0, 0, 0, 255, 0, 255
        ], "full raster after composite revision");
        pair.renderer.destroy();
        pair.canvas.remove();
      });

      run("onion-mask changes and clearing erase stale tinted pixels", () => {
        const pair = makeCanvas({
          width: 2, height: 1, displayWidth: 2, displayHeight: 1, dpr: 1
        });
        const before = ["#ff0000", null];
        const state = {
          width: 2, height: 1, pixels: [null, null],
          onionBefore: before, onionAfter: null, grid: false
        };
        pair.renderer.render(state);
        equalBytes(visibleBytes(pair.canvas),
          [232, 95, 100, 89, 0, 0, 0, 0],
          "initial before-onion tint");
        before[0] = null;
        state.onionAfter = [null, "#0000ff"];
        const stats = pair.renderer.render(state, { x: 1, y: 0, width: 1, height: 1 });
        check(stats.lastRenderMode === "full",
          "onion mask content change should force a full render");
        equalBytes(visibleBytes(pair.canvas),
          [0, 0, 0, 0, 76, 144, 210, 89],
          "tint clearing and next-onion replacement");
        pair.renderer.destroy();
        pair.canvas.remove();
      });

      run("invalid sparse/undefined arrays fail before visible or buffer mutation", () => {
        const pair = makeCanvas({
          width: 2, height: 2, displayWidth: 2, displayHeight: 2, dpr: 1
        });
        const valid = {
          width: 2, height: 2,
          pixels: ["#123456", null, null, null],
          grid: false
        };
        pair.renderer.render(valid);
        const visibleBefore = visibleBytes(pair.canvas);
        const bufferBefore = Array.from(pair.renderer.imageData.data);
        const countBefore = pair.renderer.renderCount;

        const sparsePixels = [null, null, null, null];
        delete sparsePixels[3];
        assertThrows(() => pair.renderer.render({ ...valid, pixels: sparsePixels }),
          /sparse or undefined/);
        assertThrows(() => pair.renderer.render({
          ...valid, pixels: [null, null, null, undefined]
        }), /explicit null/);
        const sparseOnion = ["#ff0000", null, null, null];
        delete sparseOnion[2];
        assertThrows(() => pair.renderer.render({
          ...valid, onionBefore: sparseOnion
        }), /sparse or undefined/);

        equalBytes(visibleBytes(pair.canvas), visibleBefore,
          "visible canvas after rejected inputs");
        equalBytes(Array.from(pair.renderer.imageData.data), bufferBefore,
          "renderer buffer after rejected inputs");
        check(pair.renderer.renderCount === countBefore,
          "failed input must not increment renderCount");
        pair.renderer.destroy();
        pair.canvas.remove();
      });

      return { cases, failures };
    });

    assert.equal(rasterResult.failures.length, 0,
      "Real Chromium renderer checks failed:\n" + JSON.stringify(rasterResult.failures, null, 2));
    assert.equal(pageErrors.length, 0, "Browser page errors: " + pageErrors.join("; "));
    console.log("REAL CHROMIUM RENDERER CHECKS");
    for (const item of rasterResult.cases) {
      console.log("  " + item.status.toUpperCase() + "  " + item.name);
    }

    const benchmarkSamples = Math.max(3, Math.min(15,
      Number(process.env.ARTCLUB_BENCHMARK_SAMPLES) || 3));
    const benchmarkWarmups = Math.max(1, Math.min(5,
      Number(process.env.ARTCLUB_BENCHMARK_WARMUPS) || 1));
    const benchmarkPage = await context.newPage();
    const benchmarkPageErrors = [];
    benchmarkPage.on("pageerror", error => benchmarkPageErrors.push(error.message));
    const benchmarkUrl = origin + "/benchmarks/renderer-benchmark.html?samples=" +
      benchmarkSamples + "&warmup=" + benchmarkWarmups;
    await benchmarkPage.goto(benchmarkUrl, { waitUntil: "load" });
    await benchmarkPage.waitForFunction(() => {
      const status = document.documentElement.dataset.benchmarkComplete;
      return status === "true" || status === "false";
    }, null, { timeout: 360000 });
    const benchmarkState = await benchmarkPage.evaluate(() => ({
      status: document.documentElement.dataset.benchmarkComplete,
      raw: document.querySelector("#raw").textContent,
      message: document.querySelector("#status").textContent
    }));
    assert.equal(benchmarkState.status, "true",
      "Renderer benchmark failed: " + benchmarkState.message + "\n" + benchmarkState.raw);
    assert.equal(benchmarkPageErrors.length, 0,
      "Benchmark page errors: " + benchmarkPageErrors.join("; "));

    const benchmark = JSON.parse(benchmarkState.raw);
    benchmark.environment.browserVersion = browser.version();
    benchmark.environment.runner = {
      platform: os.platform(),
      release: os.release(),
      architecture: os.arch(),
      cpuModel: os.cpus()[0] ? os.cpus()[0].model : null,
      logicalCpuCount: os.cpus().length,
      totalMemoryBytes: os.totalmem(),
      githubActions: process.env.GITHUB_ACTIONS === "true",
      runnerOs: process.env.RUNNER_OS || null,
      runnerArch: process.env.RUNNER_ARCH || null,
      ci: process.env.CI === "true"
    };
    benchmark.environment.benchmarkUrl = benchmarkUrl.replace(origin, "");
    benchmark.methodology.warmupRunsPerRenderer = benchmarkWarmups;
    benchmark.methodology.measuredSamplesPerRenderer = benchmarkSamples;

    assert.deepEqual(benchmark.results.map(result => result.width), [32, 64, 128, 256, 512],
      "Benchmark should include all five required canvas dimensions");
    for (const result of benchmark.results) {
      assert.equal(result.domSamplesMs.length, benchmarkSamples);
      assert.equal(result.canvasSamplesMs.length, benchmarkSamples);
    }

    console.log("\nDOM-GRID VS CANVAS BENCHMARK");
    console.log("Browser: " + browser.version());
    console.log("Platform: " + os.platform() + " " + os.release() + " (" + os.arch() + ")");
    console.log("CPU: " + (benchmark.environment.runner.cpuModel || "unknown") +
      "; logical CPUs: " + benchmark.environment.runner.logicalCpuCount +
      "; RAM: " + Math.round(benchmark.environment.runner.totalMemoryBytes / 1024 / 1024) + " MiB");
    console.log("Warm-ups per renderer: " + benchmarkWarmups +
      "; measured samples per renderer: " + benchmarkSamples);
    console.log(JSON.stringify(benchmark, null, 2));
    console.log("\nPASS: " + rasterResult.cases.length +
      " real-browser renderer checks; benchmark captured at 32, 64, 128, 256 and 512.");
    await context.close();
  } finally {
    if (browser) await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
