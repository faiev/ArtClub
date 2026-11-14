"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");

test("browser harness result parser reads a successful Chromium DOM result", async () => {
  const { extractResult } = await import("./layer-safety.browser.mjs");
  const dom = '<pre id="test-result" data-status="passed">{"ok":true,"total":9,"passed":9,"failed":0}</pre>';
  assert.deepEqual(extractResult(dom), {
    status: "passed",
    result: { ok: true, total: 9, passed: 9, failed: 0 }
  });
});

test("browser harness result parser decodes text-node entities and preserves escaped quotes", async () => {
  const { extractResult } = await import("./layer-safety.browser.mjs");
  const dom = '<pre id="test-result" data-status="failed">{"ok":false,"message":"A &lt; B &amp; C","quote":"\\"bad\\""}</pre>';
  assert.deepEqual(extractResult(dom), {
    status: "failed",
    result: { ok: false, message: "A < B & C", quote: '"bad"' }
  });
});

test("browser harness result parser rejects missing or malformed result elements", async () => {
  const { extractResult } = await import("./layer-safety.browser.mjs");
  assert.throws(() => extractResult("<html><body>no result</body></html>"), /did not return/);
  assert.throws(() => extractResult('<pre id="test-result" data-status="passed">not JSON</pre>'), SyntaxError);
});

test("browser harness page contains every required denial and saved-state assertion", async () => {
  const html = await fs.readFile(path.join(__dirname, "layer-safety.browser.html"), "utf8");
  for (const expected of [
    "hidden active layer",
    "locked active layer",
    "zero-opacity active layer",
    "stale project revision",
    "missing active cel",
    "invalid patch payload",
    "invalid replacement buffer",
    "out-of-canvas selection",
    "successful detached transaction",
    "serialized project state changed after denial",
    "composed raster/export pixels changed after denial"
  ]) {
    assert.ok(html.includes(expected), "missing browser assertion: " + expected);
  }
});
