/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const inlineScript = html.match(/<script>\s*([\s\S]*?)<\/script>/);

test("editor inline JavaScript parses without syntax errors", () => {
  assert.ok(inlineScript, "main editor script should exist");
  assert.doesNotThrow(() => new vm.Script(inlineScript[1]));
});

test("brush pointer handler has a defined undo snapshot function", () => {
  assert.match(
    html,
    /function remember\(\)\s*\{\s*undoStack\.push\(snapshot\(\)\);/
  );
  assert.match(
    html,
    /grid\.addEventListener\("pointerdown",e=>\{[\s\S]*?remember\(\);drawing=true;strokeStart=p/
  );
});
