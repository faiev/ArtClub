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

    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.onePixelStudio), null, { timeout: 30_000 });
    const afterReload = await page.evaluate(() => window.onePixelStudio.get_status());
    assert.equal(afterReload.project_id, firstProjectId, "refresh should restore the active project");
    const afterReloadPixel = await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 1, y: 1 }));
    assert.equal(afterReloadPixel.color, "#ff0000", "refresh should preserve saved pixels");

    assert.deepEqual(pageErrors, [], "the app should not throw browser runtime errors");
    console.log("Browser E2E passed: mouse drawing, undo/redo, agent batch, PNG, IndexedDB library and reload recovery.");
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
