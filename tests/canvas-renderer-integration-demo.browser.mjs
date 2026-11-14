import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const requireFromBridge = createRequire(new URL("../agent-bridge/package.json", import.meta.url));
const { chromium } = requireFromBridge("playwright");

const MODULE_PATHS = [
  ["../js/project-model.js", "js/project-model.js"],
  ["../js/canvas-viewport.js", "js/canvas-viewport.js"],
  ["../js/canvas-renderer.js", "js/canvas-renderer.js"],
  ["../js/canvas-renderer-adapter.js", "js/canvas-renderer-adapter.js"]
];

async function buildPageHtml({ omitRenderer = false } = {}) {
  let html = await readFile(resolve(ROOT, "demos/canvas-renderer-integration.html"), "utf8");
  for (const [src, file] of MODULE_PATHS) {
    const source = omitRenderer && file === "js/canvas-renderer.js"
      ? ""
      : await readFile(resolve(ROOT, file), "utf8");
    const tag = '<script src="' + src + '"></script>';
    assert.ok(html.includes(tag), "demo script tag not found: " + src);
    html = html.replace(tag, "<script>\n" + source + "\n</script>");
  }
  return html;
}

async function runMainContext(browser, dpr) {
  const context = await browser.newContext({
    viewport: { width: 820, height: 740 },
    deviceScaleFactor: dpr
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  try {
    await page.setContent(await buildPageHtml(), { waitUntil: "load" });
    await page.waitForFunction(() => window.__ARTCLUB_INTEGRATION_DEMO__ !== undefined);

    const status = await page.locator("#runtime-status").innerText();
    assert.match(status, /^Canvas 2D ready/, "renderer did not initialize: " + status);
    assert.ok(await page.locator("#art-canvas").getAttribute("aria-label"), "canvas accessible name missing");
    assert.equal(await page.locator("#art-canvas").getAttribute("role"), "img");

    const initial = await page.evaluate(() => ({
      stats: window.__ARTCLUB_INTEGRATION_DEMO__.getRenderer().getStats(),
      project: window.__ARTCLUB_INTEGRATION_DEMO__.getProject()
    }));
    assert.equal(initial.project.canvas.width, 32);
    assert.equal(initial.project.canvas.height, 24);
    assert.equal(initial.project.frames.length, 3);
    assert.equal(initial.project.layers.length, 2);
    assert.equal(initial.stats.width, 32);
    assert.equal(initial.stats.height, 24);
    assert.equal(initial.stats.devicePixelRatio, dpr);
    assert.equal(initial.stats.lastRenderMode, "full");

    const onionPresent = await page.evaluate(() => {
      const project = window.__ARTCLUB_INTEGRATION_DEMO__.getProject();
      const state = ArtClubCanvasRendererAdapter.buildRendererState(project, { onionSkin: true });
      return state.onionBefore === null && Array.isArray(state.onionAfter) &&
        state.onionAfter.length === 768 && state.onionAfter.some(pixel => pixel !== null);
    });
    assert.equal(onionPresent, true, "frame 1 should expose a populated onion-after mask");

    const beforeFrame = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getRenderer().getStats().renderCount);
    await page.locator("#frame-select").selectOption("1");
    await page.locator("#grid-toggle").uncheck();
    await page.locator("#selection-toggle").uncheck();
    await page.locator("#onion-toggle").uncheck();
    const afterToggles = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getRenderer().getStats());
    assert.ok(afterToggles.renderCount > beforeFrame, "frame and overlay changes must redraw");

    let scale = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getViewport().scale);
    await page.locator("#zoom-in").click();
    const zoomIn = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getViewport().scale);
    assert.ok(zoomIn > scale, "zoom button should increase scale");

    await page.locator("#toolbar-fit").click();
    const fitScale = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getViewport().scale);
    await page.locator("#toolbar-actual").click();
    const actualScale = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getViewport().scale);
    assert.ok(fitScale > 0);
    assert.ok(Math.abs(actualScale - 1) < 1e-9);

    await page.locator("#art-canvas").focus();
    await page.keyboard.press("Home");
    const homeScale = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getViewport().scale);
    await page.keyboard.press("1");
    const keyActualScale = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getViewport().scale);
    assert.ok(homeScale > 0);
    assert.ok(Math.abs(keyActualScale - 1) < 1e-9);

    const beforeWheel = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getViewport().scale);
    const box = await page.locator("#art-canvas").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -120);
    const afterWheel = await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.getViewport().scale);
    assert.ok(afterWheel > beforeWheel, "wheel should zoom around the pointer");

    await page.setViewportSize({ width: 700, height: 650 });
    await page.waitForTimeout(80);
    const resized = await page.evaluate(() => ({
      viewport: window.__ARTCLUB_INTEGRATION_DEMO__.getViewport(),
      stats: window.__ARTCLUB_INTEGRATION_DEMO__.getRenderer().getStats()
    }));
    assert.ok(resized.viewport.viewWidth > 0 && resized.viewport.viewHeight > 0);
    assert.equal(resized.stats.devicePixelRatio, dpr);
    assert.ok(resized.stats.renderCount > afterToggles.renderCount, "resize should trigger redraw");
    assert.deepEqual(pageErrors, [], "page errors at DPR " + dpr);

    await page.evaluate(() => window.__ARTCLUB_INTEGRATION_DEMO__.cleanup());
    const cleanup = await page.evaluate(() => {
      const renderer = window.__ARTCLUB_INTEGRATION_DEMO__.getRenderer();
      return {
        destroyed: renderer.destroyed,
        imageDataCleared: renderer.imageData === null,
        surfaceSize: [renderer.surface.width, renderer.surface.height]
      };
    });
    assert.equal(cleanup.destroyed, true);
    assert.equal(cleanup.imageDataCleared, true);
    assert.deepEqual(cleanup.surfaceSize, [1, 1]);

    return {
      dpr,
      result: "PASS",
      initialStats: initial.stats,
      frameAndToggleRenderCount: afterToggles.renderCount,
      fitScale,
      actualScale,
      homeScale,
      wheelScale: afterWheel,
      resizeStats: resized.stats,
      cleanup,
      pageErrors: pageErrors.length
    };
  } finally {
    await context.close();
  }
}

async function runFallbackContext(browser) {
  const context = await browser.newContext({ viewport: { width: 820, height: 740 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.setContent(await buildPageHtml({ omitRenderer: true }), { waitUntil: "load" });
    const status = await page.locator("#runtime-status").innerText();
    const count = await page.locator("#dom-fallback .pixel-cell").count();
    const canvasHidden = await page.locator("#art-canvas").evaluate(element => element.hidden);
    const fallbackVisible = await page.locator("#dom-fallback").evaluate(element => !element.hidden);
    assert.match(status, /^DOM fallback/);
    assert.equal(count, 32 * 24);
    assert.equal(canvasHidden, true);
    assert.equal(fallbackVisible, true);
    assert.deepEqual(errors, []);
    return { result: "PASS", status, cellCount: count, pageErrors: errors.length };
  } finally {
    await context.close();
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  try {
    const matrix = [];
    for (const dpr of [1, 1.25, 1.5, 2]) {
      matrix.push(await runMainContext(browser, dpr));
    }
    const fallback = await runFallbackContext(browser);
    console.log("Chromium " + browser.version());
    console.log(JSON.stringify({ matrix, fallback }, null, 2));
    console.log("PASS: AC-038 integration demo interactions across four DPR contexts and fallback.");
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
