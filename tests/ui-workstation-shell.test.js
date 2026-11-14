"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function idCount(id) {
  return [...html.matchAll(new RegExp("\\bid=[\\"']" + id + "[\\"']", "g"))].length;
}

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function luminance(hex) {
  const values = hex.slice(1).match(/.{2}/g).map(value => parseInt(value, 16));
  return 0.2126 * channel(values[0]) + 0.7152 * channel(values[1]) + 0.0722 * channel(values[2]);
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test("UI-01 workstation shell is a compact three-region production layout", () => {
  assert.match(html, /UI-01 — live workstation shell/);
  assert.match(html, /grid-template-rows:50px minmax\(0,1fr\) 22px/);
  assert.match(html, /grid-template-columns:190px minmax\(0,1fr\) 286px/);
  assert.match(html, /\.intro\{display:none!important\}/);
  assert.match(html, /@media\(max-width:900px\)/);
  assert.match(html, /@media\(max-width:680px\)/);
  assert.match(html, /prefers-reduced-motion:reduce/);
});

test("workstation layout preserves the live editor command and data targets", () => {
  const requiredIds = [
    "projectLibraryBtn", "saveState", "toolList", "selectionCopyBtn",
    "selectionCutBtn", "selectionPasteBtn", "selectionClearBtn",
    "selectionAllBtn", "selectionDeselectBtn", "gridSize", "projectName",
    "undoBtn", "redoBtn", "zoomOut", "zoomReset", "zoomIn", "clearBtn",
    "pixelGrid", "timelineArea", "frameList", "playBtn", "playbackMode",
    "onionToggle", "paletteGrid", "colorPicker", "hexValue", "layerList",
    "addLayerBtn", "duplicateLayerBtn", "deleteLayerBtn", "pngBtn",
    "scaledBtn", "svgBtn", "jsonBtn", "importProjectBtn", "projectInput",
    "importImageBtn", "imageInput", "projectDialog", "canvasDialog"
  ];

  for (const id of requiredIds) {
    assert.equal(idCount(id), 1, "#" + id + " must remain present exactly once");
  }

  assert.match(html, /id="pixelGrid" class="pixel-grid" role="grid"/);
  assert.match(html, /id="timelineArea"/);
  assert.match(html, /id="layerList"/);
  assert.match(html, /id="paletteGrid"/);
});

test("local-first production modules and existing renderer remain in place", () => {
  assert.match(html, /<script src="\.\/js\/project-model\.js"><\/script>/);
  assert.match(html, /<script src="\.\/js\/project-storage\.js"><\/script>/);
  assert.match(html, /<script src="\.\/js\/agent-api\.js"><\/script>/);
  assert.match(html, /function renderGrid\s*\(/);
  assert.match(html, /function renderTimeline\s*\(/);
  assert.match(html, /function renderLayers\s*\(/);
  assert.match(html, /function exportPNG\s*\(/);
});

test("essential workstation text and focus colors meet the 4.5:1 contrast target", () => {
  const panel = "#202729";
  const canvas = "#171e20";
  assert.ok(contrast("#e2e6e2", panel) >= 4.5, "primary text contrast");
  assert.ok(contrast("#b7c0bc", panel) >= 4.5, "secondary text contrast");
  assert.ok(contrast("#899692", panel) >= 4.5, "muted essential text contrast");
  assert.ok(contrast("#e1c477", canvas) >= 4.5, "keyboard focus contrast");
});
