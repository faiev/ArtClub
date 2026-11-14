import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(new URL("../agent-bridge/package.json", import.meta.url));
const { chromium } = require("playwright");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function startStaticServer() {
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
    catch { response.writeHead(400).end("Bad request"); return; }
    if (pathname === "/") pathname = "/index.html";
    const file = path.resolve(ROOT, "." + pathname);
    if (file !== ROOT && !file.startsWith(ROOT + path.sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(file, (error, data) => {
      if (error) { response.writeHead(404).end("Not found"); return; }
      response.writeHead(200, {
        "content-type": mime[path.extname(file)] || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({ server, url: "http://127.0.0.1:" + server.address().port + "/" });
    });
  });
}

async function run() {
  const { server, url } = await startStaticServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    const pageErrors = [];
    const consoleErrors = [];
    let confirmationMessage = "";
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("dialog", async dialog => {
      if (dialog.type() === "confirm") {
        confirmationMessage = dialog.message();
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });
    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.onePixelStudio), null, { timeout: 30000 });

    const initial = await page.evaluate(() => window.onePixelStudio.get_status());
    const baseLayerId = initial.active_layer.id;
    await page.evaluate(() => window.onePixelStudio.draw_pixel({ x: 0, y: 0, color: "#ff0000" }));
    const overlay = await page.evaluate(() => window.onePixelStudio.add_layer({ name: "Preserved overlay" }));
    const overlayLayerId = overlay.active_layer.id;
    await page.evaluate(() => window.onePixelStudio.draw_pixel({ x: 1, y: 1, color: "#00ff00" }));
    await page.evaluate(id => window.onePixelStudio.select_layer({ layer_id: id }), baseLayerId);

    assert.equal(await page.locator("#clearBtn").isDisabled(), false);
    await page.locator("#clearBtn").evaluate(button => {
      window.__clearClickCount = 0;
      button.addEventListener("click", () => { window.__clearClickCount += 1; }, true);
    });
    await page.locator("#clearBtn").click();
    await page.waitForFunction(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }).color === null);
    assert.equal((await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }))).color, null);
    assert.match(confirmationMessage, /active layer for this frame/i);
    assert.match(confirmationMessage, /Other layers and frames will be preserved/i);
    assert.equal((await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 1, y: 1 }))).color, "#00ff00",
      "clearing the active cel must preserve pixels on another layer");
    await page.locator("#undoBtn").click();
    await page.waitForFunction(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }).color === "#ff0000");
    await page.locator("#redoBtn").click();
    await page.waitForFunction(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }).color === null);

    await page.evaluate(() => window.onePixelStudio.draw_pixel({ x: 2, y: 2, color: "#ff0000" }));
    await page.evaluate(() => window.onePixelStudio.draw_pixel({ x: 4, y: 4, color: "#0000ff" }));
    await page.evaluate(() => window.onePixelStudio.set_selection({ x: 2, y: 2, width: 1, height: 1 }));
    assert.equal(await page.locator("#selectionClearBtn").isDisabled(), false);
    await page.locator("#selectionClearBtn").click();
    await page.waitForFunction(() => window.onePixelStudio.get_pixel({ x: 2, y: 2 }).color === null);
    assert.equal((await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 4, y: 4 }))).color, "#0000ff",
      "selection Clear must preserve pixels outside the selected rectangle");
    await page.locator("#undoBtn").click();
    await page.waitForFunction(() => window.onePixelStudio.get_pixel({ x: 2, y: 2 }).color === "#ff0000");
    await page.locator("#redoBtn").click();
    await page.waitForFunction(() => window.onePixelStudio.get_pixel({ x: 2, y: 2 }).color === null);

    await page.evaluate(id => window.onePixelStudio.set_layer_locked({ layer_id: id, locked: true }), baseLayerId);
    await page.waitForFunction(() => document.getElementById("clearBtn").disabled);
    assert.equal(await page.locator("#selectionClearBtn").isDisabled(), true);
    const lockedPixel = await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 4, y: 4 }));
    assert.equal(lockedPixel.color, "#0000ff", "locked layer content must remain unchanged");
    const lockedDenial = await page.evaluate(async () => {
      try { await window.onePixelStudio.clear_selection(); return ""; }
      catch (error) { return error.message; }
    });
    assert.match(lockedDenial, /active selection to clear/i);
    assert.equal((await page.evaluate(() => window.onePixelStudio.get_pixel({ x: 4, y: 4 }))).color, "#0000ff");

    await page.evaluate(id => window.onePixelStudio.set_layer_locked({ layer_id: id, locked: false }), baseLayerId);
    await page.evaluate(id => window.onePixelStudio.set_layer_visibility({ layer_id: id, visible: false }), baseLayerId);
    await page.waitForFunction(() => document.getElementById("clearBtn").disabled);
    assert.equal(await page.locator("#selectionClearBtn").isDisabled(), true);
    await page.evaluate(id => window.onePixelStudio.set_layer_visibility({ layer_id: id, visible: true }), baseLayerId);
    await page.waitForFunction(() => !document.getElementById("clearBtn").disabled);

    assert.deepEqual(pageErrors, [], "safe Clear interactions must not produce page errors");
    await context.close();

    // A pending autosave must finish before the safe-edit transaction writes.
    // Delaying both saves makes an overlap observable rather than timing-dependent.
    const raceContext = await browser.newContext();
    const racePage = await raceContext.newPage();
    racePage.on("dialog", async dialog => {
      if (dialog.type() === "confirm") await dialog.accept();
      else await dialog.dismiss();
    });
    await racePage.goto(url, { waitUntil: "domcontentloaded" });
    await racePage.waitForFunction(() => Boolean(window.onePixelStudio && window.ArtClubStorage), null, { timeout: 30000 });
    await racePage.evaluate(() => {
      const original = window.ArtClubStorage.prototype.saveProject;
      const probe = window.__safeClearSaveProbe = { active: 0, maxActive: 0, snapshots: [] };
      window.ArtClubStorage.prototype.saveProject = async function (project) {
        probe.active += 1;
        probe.maxActive = Math.max(probe.maxActive, probe.active);
        const snapshot = JSON.parse(JSON.stringify(project));
        try {
          await new Promise(resolve => setTimeout(resolve, 400));
          probe.snapshots.push(snapshot);
          return await original.call(this, project);
        } finally {
          probe.active -= 1;
        }
      };
      window.onePixelStudio.draw_pixel({ x: 0, y: 0, color: "#ff0000" });
    });
    await racePage.waitForFunction(() => window.__safeClearSaveProbe.active === 1, null, { timeout: 5000 });
    await racePage.locator("#clearBtn").click();
    await racePage.waitForFunction(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }).color === null, null, { timeout: 10000 });
    await racePage.waitForFunction(() => window.__safeClearSaveProbe.snapshots.length >= 2 && window.__safeClearSaveProbe.active === 0, null, { timeout: 10000 });
    const saveProbe = await racePage.evaluate(() => {
      const probe = window.__safeClearSaveProbe;
      const finalProject = probe.snapshots[probe.snapshots.length - 1];
      const cel = finalProject.cels.find(item =>
        item.layerId === finalProject.activeLayerId && item.frameId === finalProject.activeFrameId);
      return { maxActive: probe.maxActive, saves: probe.snapshots.length, finalPixel: cel && cel.pixels[0] };
    });
    assert.equal(saveProbe.maxActive, 1, "autosave and safe Clear persistence must never overlap");
    assert.equal(saveProbe.finalPixel, null, "the last persisted project must match the cleared editor state");
    await raceContext.close();

    // With neither IndexedDB nor localStorage persistence available, the safe
    // transaction must refuse to publish the cleared pixels.
    const blockedContext = await browser.newContext();
    await blockedContext.addInitScript(() => {
      try { Object.defineProperty(window, "indexedDB", { configurable: true, value: null }); } catch {}
      try { if (window.indexedDB) window.indexedDB.open = function () { throw new Error("simulated IndexedDB open failure"); }; } catch {}
      Storage.prototype.setItem = function () { throw new Error("simulated local storage failure"); };
    });
    const blockedPage = await blockedContext.newPage();
    let blockedConfirmation = false;
    blockedPage.on("dialog", async dialog => {
      if (dialog.type() === "confirm") {
        blockedConfirmation = true;
        await dialog.accept();
      } else await dialog.dismiss();
    });
    await blockedPage.goto(url, { waitUntil: "domcontentloaded" });
    await blockedPage.waitForFunction(() => Boolean(window.onePixelStudio), null, { timeout: 30000 });
    const beforeFailure = await blockedPage.evaluate(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }));
    await blockedPage.locator("#clearBtn").click();
    await blockedPage.waitForFunction(() => document.getElementById("saveState").textContent.includes("SAVE FAILED"));
    const afterFailure = await blockedPage.evaluate(() => window.onePixelStudio.get_pixel({ x: 0, y: 0 }));
    assert.equal(blockedConfirmation, true);
    assert.deepEqual(afterFailure, beforeFailure, "storage failure must leave active pixels unchanged");
    await blockedContext.close();

    console.log("UI-02A browser checks passed: active-cel scope, selection scope, undo/redo, locked/hidden denial, and persistence-failure immutability.");
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
