import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("../agent-bridge/node_modules/playwright");
const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(path.join(here, "sprite-sheet-export.browser.html")).href;

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  const pageErrors = [];
  page.on("pageerror", error => pageErrors.push(error.message));
  await page.goto(pageUrl);
  await page.waitForFunction(
    () => ["PASS", "FAIL"].includes(document.body.dataset.result),
    { timeout: 20_000 }
  );
  const report = await page.locator("#result").textContent();
  assert.ok(report && report.startsWith("PASS "), report || "Browser PNG test did not report a result.");
  assert.deepEqual(pageErrors, [], "Browser page should not emit uncaught JavaScript errors.");
  process.stdout.write(report + "\n");
} finally {
  await browser.close();
}
