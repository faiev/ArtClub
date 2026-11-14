import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const requireFromBridge = createRequire(path.join(ROOT, "agent-bridge", "package.json"));
const { chromium } = requireFromBridge("playwright");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function startStaticServer() {
  const server = http.createServer((request, response) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
    } catch {
      response.writeHead(400).end("Bad request");
      return;
    }

    if (pathname === "/") pathname = "/tests/qa/browser/project-lifecycle.html";
    const filePath = path.resolve(ROOT, "." + pathname);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      response.writeHead(200, {
        "content-type": MIME_TYPES[path.extname(filePath)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(data);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({
        server,
        url: "http://127.0.0.1:" + address.port + "/"
      });
    });
  });
}

function editorFrame(page) {
  return page.frames().find(frame => frame.url().endsWith("/index.html"));
}

async function waitForSaved(frame, timeout = 15000) {
  await frame.waitForFunction(
    () => document.querySelector("#saveState")?.textContent === "SAVED IN PROJECT LIBRARY",
    null,
    { timeout }
  );
}

async function pixel(frame, x, y) {
  const value = await frame.evaluate(
    ({ x: px, y: py }) => window.onePixelStudio.get_pixel({ x: px, y: py }),
    { x, y }
  );
  return value.color;
}

async function selectCel(frame, layerId, frameId) {
  await frame.evaluate(id => window.onePixelStudio.select_frame({ frame_id: id }), frameId);
  await frame.evaluate(id => window.onePixelStudio.select_layer({ layer_id: id }), layerId);
}

async function openProjectFromLibrary(frame, projectName, projectId) {
  await frame.locator("#projectLibraryBtn").click();
  const entry = frame.locator(".project-entry").filter({ hasText: projectName });
  await entry.waitFor({ state: "visible", timeout: 10000 });
  await entry.getByRole("button", { name: "Open", exact: true }).click();
  await frame.waitForFunction(
    expectedId => window.onePixelStudio.get_status().project_id === expectedId,
    projectId,
    { timeout: 10000 }
  );
}

async function run() {
  const { server, url } = await startStaticServer();
  let browser;
  const pageErrors = [];
  const consoleErrors = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("dialog", dialog => dialog.accept());

    await page.goto(url + "tests/qa/browser/project-lifecycle.html", {
      waitUntil: "domcontentloaded"
    });
    await page.waitForFunction(() => {
      const iframe = document.querySelector("#editor");
      return Boolean(iframe && iframe.contentWindow && iframe.contentWindow.onePixelStudio);
    }, null, { timeout: 30000 });

    let frame = editorFrame(page);
    assert.ok(frame, "the harness should load the editor in its isolated iframe");
    await frame.waitForFunction(() => Boolean(window.OnePixelStudioReady), null, { timeout: 30000 });
    await frame.evaluate(async () => window.OnePixelStudioReady);

    // Project Alpha: create two layers and two frames with distinct cels.
    let statusA = await frame.evaluate(() => window.onePixelStudio.get_status());
    const projectAId = statusA.project_id;
    const firstFrameAId = statusA.active_frame.id;
    const baseLayerAId = statusA.active_layer.id;

    await frame.locator("#projectName").fill("Lifecycle Alpha");
    await frame.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 1, y: 1, color: "#aa1100" })
    );

    const overlayResult = await frame.evaluate(() =>
      window.onePixelStudio.add_layer({ name: "Lifecycle Overlay" })
    );
    const overlayLayerAId = overlayResult.active_layer.id;
    await frame.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 2, y: 2, color: "#00bb00" })
    );

    const secondFrameResult = await frame.evaluate(() =>
      window.onePixelStudio.add_frame({ name: "Lifecycle Frame 2", duration_ms: 180 })
    );
    const secondFrameAId = secondFrameResult.active_frame.id;
    await frame.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 3, y: 3, color: "#0000cc" })
    );
    await waitForSaved(frame);

    statusA = await frame.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(statusA.project_id, projectAId);
    assert.equal(statusA.active_layer.id, overlayLayerAId);
    assert.equal(statusA.active_frame.id, secondFrameAId);

    // Create Project Beta through the actual new-canvas UI. The app must
    // persist Alpha before switching the active project.
    await frame.locator("#newProjectBtn").click();
    await frame.locator("#canvasWidthInput").fill("24");
    await frame.locator("#canvasHeightInput").fill("24");
    await frame.locator("#confirmCanvasDialog").click();
    await frame.waitForFunction(
      previousId => window.onePixelStudio.get_status().project_id !== previousId,
      projectAId,
      { timeout: 15000 }
    );

    let statusB = await frame.evaluate(() => window.onePixelStudio.get_status());
    const projectBId = statusB.project_id;
    const layerBId = statusB.active_layer.id;
    const frameBId = statusB.active_frame.id;
    assert.notEqual(projectBId, projectAId);

    await frame.locator("#projectName").fill("Lifecycle Beta");
    await frame.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 5, y: 5, color: "#2244ee" })
    );
    await waitForSaved(frame);

    // Switch back to Alpha and verify its active layer/frame and separate cels.
    await openProjectFromLibrary(frame, "Lifecycle Alpha", projectAId);
    let openedA = await frame.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(openedA.project_id, projectAId);
    assert.equal(openedA.active_layer.id, overlayLayerAId,
      "opening Alpha should restore its active overlay layer");
    assert.equal(openedA.active_frame.id, secondFrameAId,
      "opening Alpha should restore its active second frame");

    await selectCel(frame, baseLayerAId, firstFrameAId);
    assert.equal(await pixel(frame, 1, 1), "#aa1100",
      "Alpha's base-layer first-frame pixel should survive switching");
    await selectCel(frame, overlayLayerAId, firstFrameAId);
    assert.equal(await pixel(frame, 2, 2), "#00bb00",
      "Alpha's overlay first-frame pixel should survive switching");
    await selectCel(frame, overlayLayerAId, secondFrameAId);
    assert.equal(await pixel(frame, 3, 3), "#0000cc",
      "Alpha's overlay second-frame pixel should survive switching");
    assert.equal(await pixel(frame, 5, 5), null,
      "Beta artwork must not leak into Alpha");

    // Restore Alpha's persisted active cel before switching away.
    await selectCel(frame, overlayLayerAId, secondFrameAId);
    await openProjectFromLibrary(frame, "Lifecycle Beta", projectBId);
    statusB = await frame.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(statusB.project_id, projectBId);
    assert.equal(statusB.active_layer.id, layerBId);
    assert.equal(statusB.active_frame.id, frameBId);
    assert.equal(await pixel(frame, 5, 5), "#2244ee",
      "Beta should retain its own pixel");
    assert.equal(await pixel(frame, 1, 1), null,
      "Alpha artwork must not leak into Beta");

    await waitForSaved(frame);
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const iframe = document.querySelector("#editor");
      return Boolean(iframe && iframe.contentWindow && iframe.contentWindow.onePixelStudio);
    }, null, { timeout: 30000 });
    frame = editorFrame(page);
    assert.ok(frame, "the editor iframe should be recreated after page reload");
    await frame.waitForFunction(() => Boolean(window.OnePixelStudioReady), null, { timeout: 30000 });
    await frame.evaluate(async () => window.OnePixelStudioReady);

    statusB = await frame.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(statusB.project_id, projectBId,
      "reload should restore the active Beta project");
    assert.equal(statusB.active_layer.id, layerBId);
    assert.equal(statusB.active_frame.id, frameBId);
    assert.equal(await pixel(frame, 5, 5), "#2244ee",
      "reload should preserve Beta's saved pixel");

    // Reload and revisit Alpha to verify its own active frame/layer and cels.
    await openProjectFromLibrary(frame, "Lifecycle Alpha", projectAId);
    openedA = await frame.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(openedA.project_id, projectAId);
    assert.equal(openedA.active_layer.id, overlayLayerAId);
    assert.equal(openedA.active_frame.id, secondFrameAId);
    await selectCel(frame, baseLayerAId, firstFrameAId);
    assert.equal(await pixel(frame, 1, 1), "#aa1100");
    await selectCel(frame, overlayLayerAId, secondFrameAId);
    assert.equal(await pixel(frame, 3, 3), "#0000cc");
    await openProjectFromLibrary(frame, "Lifecycle Beta", projectBId);

    // Exercise the one-step recovery path in Beta with real autosave and
    // Project Library UI. Opening the library must be a no-op save and must
    // not rotate version A out of the recovery slot.
    await frame.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 20, y: 20, color: "#aa00aa" })
    );
    await waitForSaved(frame);
    const versionABaseline = await pixel(frame, 21, 20);
    assert.equal(await pixel(frame, 20, 20), "#aa00aa",
      "Beta version A should be present before the later edit");
    await frame.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 21, y: 20, color: "#00aaff" })
    );
    await waitForSaved(frame);
    assert.equal(await pixel(frame, 21, 20), "#00aaff",
      "Beta version B should be autosaved before recovery is attempted");

    await frame.locator("#projectLibraryBtn").click();
    const betaEntry = frame.locator(".project-entry").filter({ hasText: "Lifecycle Beta" });
    await betaEntry.waitFor({ state: "visible", timeout: 10000 });
    await betaEntry.getByRole("button", { name: "Recover", exact: true }).click();
    await frame.waitForFunction(
      expected => window.onePixelStudio.get_pixel({ x: 21, y: 20 }).color === expected,
      versionABaseline,
      { timeout: 10000 }
    );
    assert.equal(await pixel(frame, 20, 20), "#aa00aa",
      "Recover should restore Beta's previous autosaved version A");
    assert.equal(await pixel(frame, 21, 20), versionABaseline,
      "Recover should discard the later B pixel and restore the exact previous composite");

    assert.deepEqual(pageErrors, [], "the browser should not report page errors");
    assert.deepEqual(consoleErrors, [], "the editor should not log console errors");

    console.log(
      "AC-032 Chromium lifecycle harness passed: create, autosave, layer/frame state, project switching, reload persistence, cel isolation and recovery."
    );
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
