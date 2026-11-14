"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const demo = fs.readFileSync(path.join(root, "demos/canvas-renderer-integration.html"), "utf8");
const docs = fs.readFileSync(path.join(root, "docs/CANVAS_RENDERER_INTEGRATION.md"), "utf8");

test("isolated demo loads project, viewport, renderer and adapter modules locally in dependency order", () => {
  const sources = Array.from(demo.matchAll(/<script src="([^"]+)"><\/script>/g), match => match[1]);
  assert.deepEqual(sources, [
    "../js/project-model.js",
    "../js/canvas-viewport.js",
    "../js/canvas-renderer.js",
    "../js/canvas-renderer-adapter.js"
  ]);
  assert.equal(demo.includes("https://"), false);
  assert.equal(demo.includes("http://"), false);
});

test("demo provides labelled canvas, visible focus path and bounded DOM fallback", () => {
  assert.match(demo, /<canvas[^>]+tabindex="0"[^>]+role="img"/);
  assert.match(demo, /aria-label="Pixel art preview/);
  assert.match(demo, /id="dom-fallback" role="grid"/);
  assert.match(demo, /width:32/);
  assert.match(demo, /height:24/);
  assert.match(demo, /fallback\.appendChild\(cell\)/);
});

test("demo exercises frame, onion, overlay and viewport interactions", () => {
  for (const id of [
    "frame-select", "grid-toggle", "onion-toggle", "selection-toggle",
    "fit", "actual", "zoom-in", "zoom-out", "viewport"
  ]) {
    assert.match(demo, new RegExp('id="' + id + '"'));
  }
  assert.match(demo, /buildRendererState\(project/);
  assert.match(demo, /expectedActiveFrameId/);
  assert.match(demo, /onionSkin/);
  assert.match(demo, /zoomBy\(viewportState/);
  assert.match(demo, /screenToCanvas\(viewportState/);
  assert.match(demo, /resizeViewport\(/);
});

test("demo includes keyboard navigation and renderer teardown", () => {
  for (const key of ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"]) {
    assert.ok(demo.includes('"' + key + '"'), "missing keyboard command " + key);
  }
  assert.match(demo, /renderer\.destroy\(\)/);
  assert.match(demo, /ResizeObserver/);
  assert.match(demo, /pagehide/);
});

test("integration contract documents fallback, coordinate, accessibility, lifecycle and adoption gates", () => {
  for (const section of [
    "Coordinate and resize contract",
    "Invalidation contract",
    "Fallback and failure behavior",
    "Keyboard and accessibility contract",
    "Resize, lifecycle and cleanup",
    "Adoption gates before any renderer switch",
    "Current recommendation"
  ]) {
    assert.ok(docs.includes(section), "missing contract section: " + section);
  }
  assert.match(docs, /Defer production Canvas renderer replacement/);
  assert.match(docs, /dirty-call-per-pixel/);
  assert.match(docs, /does not modify/);
});


test("dedicated Chromium runner is valid Node ESM and covers all four DPR contexts", () => {
  const runnerPath = path.join(root, "tests/canvas-renderer-integration-demo.browser.mjs");
  const syntax = spawnSync(process.execPath, ["--check", runnerPath], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr || syntax.stdout || "browser runner syntax check failed");
  const runner = fs.readFileSync(runnerPath, "utf8");
  assert.match(runner, /\[1, 1\.25, 1\.5, 2\]/);
  assert.match(runner, /fallback/);
  assert.match(runner, /cleanup/);
  assert.match(runner, /pageErrors/);
});
