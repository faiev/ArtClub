import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function startStaticServer() {
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
    catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (pathname === "/") pathname = "/index.html";
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

async function run() {
  const { server, url } = await startStaticServer();
  let browser;
  const pageErrors = [];
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on("pageerror", error => pageErrors.push(error.message));

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.onePixelStudio), null, { timeout: 30_000 });

    const initialStatus = await page.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(initialStatus.protocol, "one-pixel-studio-agent");
    assert.equal(initialStatus.canvas.width, 24);
    assert.equal(initialStatus.canvas.height, 24);

    const firstCell = page.locator(".pixel-cell").nth(0);
    const bounds = await firstCell.boundingBox();
    assert.ok(bounds && bounds.width > 0 && bounds.height > 0, "pixel grid should have visible cells");
    await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);

    let pixel = await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }));
    assert.equal(pixel.color, "#e96f55", "a real mouse click should draw on the grid");

    await page.locator("#undoBtn").click();
    pixel = await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }));
    assert.equal(pixel.color, "#172b3a", "undo should restore the starter pixel");
    await page.locator("#redoBtn").click();
    pixel = await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }));
    assert.equal(pixel.color, "#e96f55", "redo should restore the mouse stroke");

    const beforeAgentEdit = await page.evaluate(() => window.onePixelStudio.get_status());
    const agentResult = await page.evaluate(status =>
      window.onePixelStudio.execute({
        label: "Browser agent E2E",
        expected_revision: status.revision,
        commands: [
          { type: "draw_pixel", x: 1, y: 1, color: "#ff0000" },
          { type: "draw_line", x1: 2, y1: 2, x2: 5, y2: 2, color: "#00ff00" },
          { type: "draw_rectangle", x1: 3, y1: 4, x2: 6, y2: 7, filled: true, color: "#0000ff" }
        ]
      }), beforeAgentEdit
    );
    assert.equal(agentResult.ok, true);
    assert.equal(agentResult.commands_applied, 3);
    const agentPixel = await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 1, y: 1 }));
    assert.equal(agentPixel.color, "#ff0000");

    const png = await page.evaluate(() => window.onePixelStudio.export_png());
    assert.equal(png.mime_type, "image/png");
    assert.equal(png.width, 24);
    assert.ok(png.data_base64.startsWith("iVBORw0KGgo"), "PNG preview should contain a valid PNG signature");

    const projectJson = await page.evaluate(() => window.onePixelStudio.export_project());
    const parsedProject = JSON.parse(projectJson);
    assert.equal(parsedProject.format, "one-pixel-studio");

    const firstSaved = await page.evaluate(() => window.onePixelStudio.save());
    assert.equal(firstSaved.ok, true);
    const firstProjectId = firstSaved.project_id;
    const listAfterFirstSave = await page.evaluate(() => window.onePixelStudio.list_projects());
    assert.ok(listAfterFirstSave.some(project => project.id === firstProjectId));

    await page.locator("#newProjectBtn").click();
    await page.locator("#canvasWidthInput").fill("32");
    await page.locator("#canvasHeightInput").fill("48");
    await page.locator("#confirmCanvasDialog").click();
    await page.waitForFunction(
      previousId => window.onePixelStudio.get_status().project_id !== previousId,
      firstProjectId
    );
    const rectangularStatus = await page.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(rectangularStatus.canvas.width, 32);
    assert.equal(rectangularStatus.canvas.height, 48);
    await page.evaluate(() => window.onePixelStudio.save());
    const projects = await page.evaluate(() => window.onePixelStudio.list_projects());
    assert.ok(projects.length >= 2, "creating a new project should keep the previous one in IndexedDB");

    await page.evaluate(id => window.onePixelStudio.open_project({ project_id: id }), firstProjectId);
    const reopenedStatus = await page.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(reopenedStatus.project_id, firstProjectId);
    const reopenedPixel = await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 1, y: 1 }));
    assert.equal(reopenedPixel.color, "#ff0000", "opening a saved project should preserve agent artwork");

    const baseLayerId = reopenedStatus.active_layer.id;
    const addedLayer = await page.evaluate(() =>
      window.onePixelStudio.add_layer({ name: "Browser Details" })
    );
    const frontLayerId = addedLayer.active_layer.id;
    assert.equal(addedLayer.layers.length, 2);
    await page.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 2, y: 2, color: "#ff8800" })
    );
    await page.evaluate(id => window.onePixelStudio.select_layer({ layer_id: id }), baseLayerId);
    await page.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 2, y: 2, color: "#0088ff" })
    );
    let compositePixel = await page.evaluate(() =>
      window.onePixelStudio.get_pixel({ x: 2, y: 2 })
    );
    assert.equal(compositePixel.color, "#ff8800", "front layer should cover the lower layer");
    await page.evaluate(id =>
      window.onePixelStudio.set_layer_visibility({ layer_id: id, visible: false }),
      frontLayerId
    );
    compositePixel = await page.evaluate(() =>
      window.onePixelStudio.get_pixel({ x: 2, y: 2 })
    );
    assert.equal(compositePixel.color, "#0088ff", "hiding front layer should reveal the lower layer");
    await page.evaluate(id =>
      window.onePixelStudio.set_layer_visibility({ layer_id: id, visible: true }),
      frontLayerId
    );
    await page.evaluate(id => window.onePixelStudio.select_layer({ layer_id: id }), frontLayerId);

    // Build three frames, then verify real playback advances a preview frame
    // without changing the selected editing frame.
    await page.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 10, y: 10, color: "#aa1100" })
    );
    const frameTwo = await page.evaluate(() =>
      window.onePixelStudio.add_frame({ name: "Preview Middle", duration_ms: 100 })
    );
    const frameTwoId = frameTwo.active_frame.id;
    await page.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 11, y: 11, color: "#00bb00" })
    );
    const frameThree = await page.evaluate(() =>
      window.onePixelStudio.add_frame({ name: "Preview End", duration_ms: 100 })
    );
    const frameThreeId = frameThree.active_frame.id;
    await page.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 12, y: 12, color: "#0000cc" })
    );
    await page.evaluate(id => window.onePixelStudio.select_frame({ frame_id: id }), frameTwoId);
    await page.evaluate(() => window.onePixelStudio.set_onion_skin({ enabled: true }));

    const previousOnion = await page.locator("#pixelGrid .pixel-cell").nth(10 * 24 + 10).getAttribute("class");
    const nextOnion = await page.locator("#pixelGrid .pixel-cell").nth(12 * 24 + 12).getAttribute("class");
    assert.match(previousOnion, /onion-before/, "previous frame pixels should appear as onion skin");
    assert.match(nextOnion, /onion-after/, "next frame pixels should appear as onion skin");
    const untouchedOnionPixels = await page.evaluate(async () => ({
      previous: (await window.onePixelStudio.get_pixel({ x: 10, y: 10 })).color,
      next: (await window.onePixelStudio.get_pixel({ x: 12, y: 12 })).color
    }));
    assert.equal(untouchedOnionPixels.previous, null, "onion overlay must not write pixels");
    assert.equal(untouchedOnionPixels.next, null, "onion overlay must not write pixels");

    await page.evaluate(() => window.onePixelStudio.set_playback_mode({ mode: "pingpong" }));
    const playState = await page.evaluate(() => window.onePixelStudio.play());
    assert.equal(playState.playback.playing, true);
    assert.equal(playState.active_frame.id, frameTwoId);
    await page.waitForTimeout(140);
    const advancedState = await page.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(advancedState.active_frame.id, frameTwoId, "playback must not change the editing frame");
    assert.notEqual(advancedState.playback.preview_frame_id, frameTwoId, "preview must advance in real time");
    assert.ok(
      [frameTwoId, frameThreeId].includes(advancedState.playback.preview_frame_id),
      "preview should reference a real timeline frame"
    );
    const pausedState = await page.evaluate(() => window.onePixelStudio.pause());
    assert.equal(pausedState.playback.playing, false);
    assert.equal(pausedState.active_frame.id, frameTwoId);
    await page.evaluate(() => window.onePixelStudio.stop_playback());
    await page.evaluate(() => window.onePixelStudio.save());

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.onePixelStudio), null, { timeout: 30_000 });
    const afterReload = await page.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(afterReload.project_id, firstProjectId, "refresh should restore the active project");
    assert.equal(afterReload.layers.length, 2, "refresh should preserve the layer stack");
    const afterReloadPixel = await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 1, y: 1 }));
    assert.equal(afterReloadPixel.color, "#ff0000", "refresh should preserve saved pixels");
    const persistedLayerPixel = await page.evaluate(() =>
      window.onePixelStudio.get_pixel({ x: 2, y: 2 })
    );
    assert.equal(persistedLayerPixel.color, "#ff8800", "refresh should preserve the visible layer composite");

    // Regression: A is the last good version, B is autosaved, and merely
    // opening the library must not overwrite A before the user can recover it.
    page.on("dialog", dialog => dialog.accept());
    await page.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 20, y: 20, color: "#aa00aa" })
    );
    await page.waitForFunction(
      () => document.querySelector("#saveState")?.textContent === "SAVED IN PROJECT LIBRARY",
      null,
      { timeout: 5_000 }
    );
    await page.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 21, y: 20, color: "#00aaff" })
    );
    await page.waitForFunction(
      () => document.querySelector("#saveState")?.textContent === "SAVED IN PROJECT LIBRARY",
      null,
      { timeout: 5_000 }
    );

    const explicitNoOpSave = await page.evaluate(() => window.onePixelStudio.save());
    assert.equal(explicitNoOpSave.ok, true, "an explicit clean save should succeed");
    await page.locator("#projectLibraryBtn").click();
    await page.getByRole("button", { name: "Recover", exact: true }).first().click();
    await page.waitForFunction(
      () => window.onePixelStudio.get_pixel({ x: 20, y: 20 }).color === "#aa00aa",
      null,
      { timeout: 5_000 }
    );
    let recoveredPixels = await page.evaluate(() => ({
      a: window.onePixelStudio.get_pixel({ x: 20, y: 20 }).color,
      b: window.onePixelStudio.get_pixel({ x: 21, y: 20 }).color
    }));
    assert.equal(recoveredPixels.a, "#aa00aa", "Recover should restore version A after opening the library");
    assert.equal(recoveredPixels.b, null, "version B's new pixel should be absent after recovering A");

    // A genuine edit after recovery must rotate the recovered A version into
    // the recovery slot. Opening the library once more must not rotate it away.
    await page.locator("#closeProjectDialog").click();
    await page.evaluate(() =>
      window.onePixelStudio.draw_pixel({ x: 22, y: 20, color: "#cc4400" })
    );
    await page.waitForFunction(
      () => document.querySelector("#saveState")?.textContent === "SAVED IN PROJECT LIBRARY",
      null,
      { timeout: 5_000 }
    );
    await page.locator("#projectLibraryBtn").click();
    await page.getByRole("button", { name: "Recover", exact: true }).first().click();
    await page.waitForFunction(
      () => window.onePixelStudio.get_pixel({ x: 20, y: 20 }).color === "#aa00aa",
      null,
      { timeout: 5_000 }
    );
    recoveredPixels = await page.evaluate(() => ({
      a: window.onePixelStudio.get_pixel({ x: 20, y: 20 }).color,
      c: window.onePixelStudio.get_pixel({ x: 22, y: 20 }).color
    }));
    assert.equal(recoveredPixels.a, "#aa00aa", "a genuine later save should keep the immediately previous version recoverable");
    assert.equal(recoveredPixels.c, null, "recovering A should remove C's newer pixel");

    assert.deepEqual(pageErrors, [], "the app should not throw browser runtime errors");
    console.log("Browser E2E passed: mouse drawing, undo/redo, agent batch, layers, custom canvas, real animation playback, onion skin, PNG, IndexedDB library and reload recovery.");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
