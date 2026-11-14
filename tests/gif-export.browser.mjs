import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { chromium } = require("../agent-bridge/node_modules/playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(path.join(here, "gif-export.browser.html")).href;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on("pageerror", error => consoleErrors.push(error.message));
  await page.goto(pageUrl);
  await page.waitForFunction(() => ["PASS", "FAIL"].includes(document.body.dataset.result), { timeout: 15000 });
  const report = await page.locator("#result").textContent();
  assert.ok(report && report.startsWith("PASS "), report || "Browser GIF test did not report a result.");
  assert.deepEqual(consoleErrors, [], "Browser page should not emit uncaught errors.");
  process.stdout.write(report + "\n");
} finally {
  await browser.close();
}