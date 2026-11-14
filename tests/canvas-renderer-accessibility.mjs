import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { extname, resolve, sep } from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireFromBridge = createRequire(new URL("../agent-bridge/package.json", import.meta.url));
const { chromium } = requireFromBridge("playwright");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

function serve() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", "http://127.0.0.1");
      const pathname = decodeURIComponent(url.pathname === "/" ? "/tests/canvas-renderer-accessibility.html" : url.pathname);
      const path = resolve(ROOT, "." + pathname);
      if (path !== ROOT && !path.startsWith(ROOT + sep)) {
        response.writeHead(403); response.end("Forbidden"); return;
      }
      const body = await readFile(path);
      response.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
      response.end(body);
    } catch (error) {
      response.writeHead(error && error.code === "ENOENT" ? 404 : 500);
      response.end(error && error.code === "ENOENT" ? "Not found" : String(error));
    }
  });
  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolveServer({
      server, origin: "http://127.0.0.1:" + server.address().port
    }));
  });
}

async function main() {
  const { server, origin } = await serve();
  let browser;
  const allResults = [];
  try {
    browser = await chromium.launch({ headless: true });
    for (const dpr of [1, 1.25, 1.5, 2]) {
      const context = await browser.newContext({
        viewport: { width: 1000, height: 800 },
        deviceScaleFactor: dpr
      });
      const page = await context.newPage();
      const pageErrors = [];
      page.on("pageerror", error => pageErrors.push(error.message));
      await page.goto(origin + "/tests/canvas-renderer-accessibility.html", { waitUntil: "load" });
      await page.waitForFunction(() => document.documentElement.dataset.inspectionReady === "true");
      const initial = await page.evaluate(() => window.__canvasInspection.result);
      assert.equal(initial.failures.length, 0,
        "DPR " + dpr + " visual/backing checks failed: " + JSON.stringify(initial.failures, null, 2));
      assert.equal(initial.devicePixelRatio, dpr);

      // Keyboard focus order: canvas is one accessible stop; decorative overlays are not stops.
      await page.locator("#before").focus();
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "art-canvas");
      const accessibleName = await page.locator("#art-canvas").getAttribute("aria-label");
      assert.ok(accessibleName && accessibleName.trim().length > 0, "canvas must have an accessible name");
      assert.equal(await page.locator("#art-canvas").getAttribute("role"), "img");
      const focusStyle = await page.locator("#art-canvas").evaluate(element => ({
        outlineStyle: getComputedStyle(element).outlineStyle,
        outlineWidth: parseFloat(getComputedStyle(element).outlineWidth)
      }));
      assert.equal(focusStyle.outlineStyle, "solid");
      assert.ok(focusStyle.outlineWidth >= 2);
      await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "after");
      await page.keyboard.press("Shift+Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "art-canvas");
      await page.keyboard.press("Shift+Tab");
      assert.equal(await page.evaluate(() => document.activeElement.id), "before");

      // A DOM affordance covering artwork must pass pointer input through to the canvas.
      const bounds = await page.locator("#art-canvas").boundingBox();
      await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
      const clickCounts = await page.evaluate(() => window.__canvasInspection.getClicks());
      assert.deepEqual(clickCounts, { canvasClicks: 1, overlayClicks: 0 });

      // Resize CSS viewport size and redraw; logical source buffer should not be recreated.
      await page.evaluate(() => window.__canvasInspection.resizeAndInspect());
      const afterResize = await page.evaluate(() => window.__canvasInspection.result);
      assert.equal(afterResize.failures.length, 0,
        "DPR " + dpr + " after-resize checks failed: " + JSON.stringify(afterResize.failures, null, 2));

      // Repeated mount/unmount must release ImageData/offscreen buffers and visible canvas nodes.
      const lifecycle = await page.evaluate(() => {
        const failures = [];
        for (let i = 0; i < 24; i++) {
          const canvas = document.createElement("canvas");
          canvas.style.width = "13.25px";
          canvas.style.height = "7.75px";
          document.body.appendChild(canvas);
          const renderer = new ArtClubCanvasRenderer.CanvasPixelRenderer(canvas);
          renderer.render({ width: 2, height: 1, pixels: ["#ff0000", null], grid: false });
          const surface = renderer.surface;
          const overlay = renderer.overlay;
          renderer.destroy();
          if (renderer.imageData !== null || surface.width !== 1 || surface.height !== 1 ||
              overlay.width !== 1 || overlay.height !== 1) {
            failures.push("cycle " + i + " did not release backing buffers");
          }
          let threw = false;
          try { renderer.render({ width: 1, height: 1, pixels: [null] }); } catch (_) { threw = true; }
          if (!threw) failures.push("cycle " + i + " accepted render after destroy");
          canvas.remove();
        }
        return { failures, remainingVisibleCanvases: document.querySelectorAll("canvas").length };
      });
      assert.deepEqual(lifecycle.failures, []);
      assert.equal(lifecycle.remainingVisibleCanvases, 1, "fixture canvas should be the only remaining canvas");
      assert.equal(pageErrors.length, 0, "page errors: " + pageErrors.join("; "));

      allResults.push({
        dpr,
        visualBackingChecks: initial.checks.length,
        focusBoundaries: "passed",
        accessibleNameAndRole: "passed",
        pointerTransparentOverlay: "passed",
        resizeAndBackingStore: "passed",
        lifecycle: "24/24 mount/destroy cycles passed"
      });
      console.log("DPR " + dpr + ": " + initial.checks.length +
        " visual/backing checks; focus, accessible name, pointer, resize and 24 teardown cycles passed.");
      if (process.env.ARTCLUB_RENDERER_SCREENSHOT_DIR) {
        const { mkdir } = await import("node:fs/promises");
        const directory = resolve(process.env.ARTCLUB_RENDERER_SCREENSHOT_DIR);
        await mkdir(directory, { recursive: true });
        await page.screenshot({
          path: resolve(directory, "renderer-accessibility-dpr-" + String(dpr).replace(".", "-") + ".png"),
          fullPage: true
        });
      }
      await context.close();
    }
    console.log("Chromium " + browser.version());
    console.log(JSON.stringify(allResults, null, 2));
    console.log("PASS: AC-036 inspection matrix across DPR 1, 1.25, 1.5 and 2.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolveClose => server.close(resolveClose));
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
