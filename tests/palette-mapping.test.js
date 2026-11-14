/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Mapping = require("../js/palette-mapping.js");

function makeProject() {
  const layers = [
    { id: "base", name: "Base", visible: true, locked: false, opacity: 1 },
    { id: "hidden", name: "Guide", visible: false, locked: false, opacity: 1 }
  ];
  const frames = [
    { id: "f1", name: "Frame 1", durationMs: 100 },
    { id: "f2", name: "Frame 2", durationMs: 140 }
  ];
  return {
    format: "one-pixel-studio",
    version: 2,
    id: "project-1",
    name: "Mapping fixture",
    canvas: { width: 2, height: 2, background: null },
    palette: ["#AA0000", "#00AA00", "#0000FF"],
    selectedColorIndex: 0,
    layers,
    frames,
    cels: [
      { layerId: "base", frameId: "f1", pixels: ["#aa0000", null, "#00AA00", "#123456"] },
      { layerId: "base", frameId: "f2", pixels: ["#0000FF", "#AA0000", null, null] },
      { layerId: "hidden", frameId: "f1", pixels: ["#123456", "#123456", null, "#AA0000"] }
    ],
    activeLayerId: "base",
    activeFrameId: "f1",
    metadata: { keep: true }
  };
}

test("extractUsedColors reports first-seen deterministic order, counts and palette indices", () => {
  const project = makeProject();
  const report = Mapping.extractUsedColors(project);
  assert.deepEqual(report.colors.map(item => item.hex), ["#AA0000", "#00AA00", "#123456", "#0000FF"]);
  assert.deepEqual(report.colors.map(item => item.count), [2, 1, 1, 1]);
  assert.deepEqual(report.colors.map(item => item.paletteIndex), [0, 1, null, 2]);
  assert.deepEqual(report.colors[0].firstOccurrence, {
    layerId: "base", layerName: "Base", frameId: "f1", frameName: "Frame 1",
    celIndex: 0, pixelIndex: 0, x: 0, y: 0
  });
  assert.equal(report.summary.totalPixels, 8);
  assert.equal(report.summary.transparentPixels, 3);
  assert.equal(report.summary.opaquePixels, 5);
  assert.equal(report.summary.unlistedUsedColorCount, 1);
});

test("extraction excludes hidden layers by default and includes them on request", () => {
  const project = makeProject();
  const visible = Mapping.extractUsedColors(project);
  const all = Mapping.extractUsedColors(project, { includeHiddenLayers: true });
  assert.equal(visible.colors.find(item => item.hex === "#123456").count, 1);
  assert.equal(all.colors.find(item => item.hex === "#123456").count, 3);
  assert.equal(all.summary.totalPixels, 12);
  assert.deepEqual(all.scope.layerIds, ["base", "hidden"]);
});

test("extraction frame/layer scopes retain project order and report missing cels", () => {
  const project = makeProject();
  const empty = { id: "empty", name: "Empty", visible: true, locked: false, opacity: 1 };
  project.layers.push(empty);
  const report = Mapping.extractUsedColors(project, { layerIds: ["empty"], frameIds: ["f2", "f1"] });
  assert.deepEqual(report.scope.frameIds, ["f1", "f2"]);
  assert.deepEqual(report.scope.layerIds, ["empty"]);
  assert.equal(report.summary.totalPixels, 0);
  assert.equal(report.summary.missingCelCount, 2);
  assert.equal(report.summary.uniqueUsedColorCount, 0);
});

test("extraction handles empty frame scopes without dividing by zero", () => {
  const report = Mapping.extractUsedColors(makeProject(), { frameIds: [] });
  assert.equal(report.summary.totalPixels, 0);
  assert.equal(report.summary.transparencyRatio, null);
  assert.deepEqual(report.colors, []);
});

test("exact mapping maps normalized exact colors and explicitly reports missing targets", () => {
  const result = Mapping.createPaletteMapping(["#aa0000", "#00FF00", "#0000FF"], ["#AA0000", "#0000FF"], { policy: "exact" });
  assert.equal(result.accepted, true);
  assert.deepEqual(result.mappings.map(item => item.targetIndex), [0, 1]);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.unmatched[0].sourceColor, "#00FF00");
  assert.equal(result.report.exactMatchCount, 2);
});

test("nearest policy maps every source color and uses first-target stable tie-breaking", () => {
  const result = Mapping.createPaletteMapping(["#010000"], ["#000000", "#020000"], { policy: "nearest" });
  assert.equal(result.accepted, true);
  assert.equal(result.mappings[0].targetIndex, 0);
  assert.equal(result.mappings[0].match, "nearest");
  assert.equal(result.mappings[0].distanceSquared, 1);
  assert.equal(result.unmatched.length, 0);
});

test("reject-if-no-match policy rejects the entire mapping when any source color is missing", () => {
  const result = Mapping.createPaletteMapping(["#000000", "#FFFFFF"], ["#000000"], { policy: "reject-if-no-match" });
  assert.equal(result.accepted, false);
  assert.equal(result.mappings.length, 1);
  assert.equal(result.unmatched.length, 1);
  assert.equal(result.report.accepted, false);
});

test("mapping reports source collisions when multiple source entries map to one target", () => {
  const result = Mapping.createPaletteMapping(["#000000", "#010000"], ["#000000"], { policy: "nearest" });
  assert.deepEqual(result.collisions, [{ targetIndex: 0, targetColor: "#000000", sourceCount: 2 }]);
  assert.equal(result.report.targetCollisionCount, 1);
});

test("mapping rejects unsupported policy and invalid or oversized palettes", () => {
  assert.throws(() => Mapping.createPaletteMapping(["#000000"], ["#000000"], { policy: "nearest-ish" }), /policy must be/);
  assert.throws(() => Mapping.createPaletteMapping([], ["#000000"]), /Source palette/);
  assert.throws(() => Mapping.createPaletteMapping(["not-hex"], ["#000000"]), /six-digit HEX/);
  assert.throws(() => Mapping.createPaletteMapping(["#000000"], []), /Target palette/);
});

test("preview reports project pixel impact by cel, transparency and unmapped colors", () => {
  const project = makeProject();
  const mapping = Mapping.createPaletteMapping(["#AA0000", "#00AA00", "#0000FF"], ["#112233", "#00AA00", "#0000FF"], { policy: "nearest" });
  const preview = Mapping.previewProjectPaletteMapping(project, mapping);
  assert.equal(preview.totalPixels, 8);
  assert.equal(preview.transparentPixels, 3);
  assert.equal(preview.mappedPixels, 4);
  assert.equal(preview.changedPixels, 2);
  assert.equal(preview.unchangedPixels, 2);
  assert.equal(preview.unmappedPixels, 1);
  assert.deepEqual(preview.unmappedUsedColors, [{ hex: "#123456", count: 1 }]);
  assert.equal(preview.affectedCelCount, 2);
  assert.deepEqual(preview.impactsByCel[0].bounds, { x: 0, y: 0, width: 1, height: 1 });
});

test("preview can include hidden layers and filters by frame", () => {
  const project = makeProject();
  const mapping = Mapping.createPaletteMapping(["#123456", "#AA0000"], ["#333333", "#222222"], { policy: "nearest" });
  const preview = Mapping.previewProjectPaletteMapping(project, mapping, { includeHiddenLayers: true, frameId: "f1" });
  assert.equal(preview.totalPixels, 8);
  assert.equal(preview.changedPixels, 5);
  assert.equal(preview.affectedCelCount, 2);
  assert.deepEqual(preview.scope.frameIds, ["f1"]);
});

test("apply returns a transformed project copy and leaves source project unchanged", () => {
  const project = makeProject();
  const before = JSON.stringify(project);
  const mapping = Mapping.createPaletteMapping(["#AA0000", "#00AA00", "#0000FF"], ["#112233", "#00AA00", "#0000FF"], { policy: "nearest" });
  const result = Mapping.applyProjectPaletteMapping(project, mapping);
  assert.notEqual(result.project, project);
  assert.equal(result.project.cels[0].pixels[0], "#112233");
  assert.equal(result.project.cels[1].pixels[1], "#112233");
  assert.equal(result.project.cels[0].pixels[1], null);
  assert.equal(result.project.cels[0].pixels[3], "#123456");
  assert.deepEqual(result.project.palette, ["#112233", "#00AA00", "#0000FF"]);
  assert.equal(result.report.applied, true);
  assert.equal(result.report.unmappedPixelsLeftUnchanged, 1);
  assert.equal(JSON.stringify(project), before);
});

test("reject-if-no-match blocks apply before any project copy is returned", () => {
  const project = makeProject();
  const mapping = Mapping.createPaletteMapping(["#AA0000", "#123456"], ["#112233"], { policy: "reject-if-no-match" });
  assert.equal(mapping.accepted, false);
  assert.throws(() => Mapping.applyProjectPaletteMapping(project, mapping), /Mapping was rejected/);
  assert.equal(project.cels[0].pixels[0], "#aa0000");
});

test("exact partial mappings leave unmatched colors unchanged with a preview warning", () => {
  const project = makeProject();
  const mapping = Mapping.createPaletteMapping(["#AA0000"], ["#112233"], { policy: "nearest" });
  const preview = Mapping.previewProjectPaletteMapping(project, mapping);
  assert.equal(preview.unmappedPixels, 3);
  const applied = Mapping.applyProjectPaletteMapping(project, mapping);
  assert.equal(applied.project.cels[0].pixels[0], "#112233");
  assert.equal(applied.project.cels[0].pixels[2], "#00AA00");
});

test("project validation enforces canvas, palette, cel dimensions, sparse arrays and project limits", () => {
  const oversized = makeProject();
  oversized.canvas.width = 513;
  assert.throws(() => Mapping.extractUsedColors(oversized), /Canvas width and height/);
  const invalidPalette = makeProject();
  invalidPalette.palette[0] = "bad";
  assert.throws(() => Mapping.extractUsedColors(invalidPalette), /six-digit HEX/);
  const sparseCel = makeProject();
  delete sparseCel.cels[0].pixels[0];
  assert.throws(() => Mapping.extractUsedColors(sparseCel), /sparse or missing/);
  const wrongCel = makeProject();
  wrongCel.cels[0].pixels.pop();
  assert.throws(() => Mapping.extractUsedColors(wrongCel), /exactly width/);
});

test("scope validation rejects unknown IDs, duplicate IDs and ambiguous frame filters", () => {
  const project = makeProject();
  assert.throws(() => Mapping.extractUsedColors(project, { frameId: "missing" }), /frameId does not exist/);
  assert.throws(() => Mapping.extractUsedColors(project, { layerIds: ["base", "base"] }), /cannot contain duplicates/);
  assert.throws(() => Mapping.extractUsedColors(project, { frameId: "f1", frameIds: ["f1"] }), /Use frameId or frameIds/);
});

test("module exposes browser global without CommonJS", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "palette-mapping.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.globalThis.ArtClubPaletteMapping.extractUsedColors, "function");
  assert.equal(typeof context.globalThis.ArtClubPaletteMapping.applyProjectPaletteMapping, "function");
});

test("mapping and extraction accept frozen project data and do not mutate it", () => {
  const project = makeProject();
  project.cels.forEach(cel => { Object.freeze(cel.pixels); Object.freeze(cel); });
  Object.freeze(project.cels);
  Object.freeze(project.palette);
  Object.freeze(project.layers);
  Object.freeze(project.frames);
  Object.freeze(project.canvas);
  Object.freeze(project);
  const before = JSON.stringify(project);
  const extracted = Mapping.extractUsedColors(project);
  const mapping = Mapping.createPaletteMapping(project.palette, ["#111111", "#00AA00", "#0000FF"], { policy: "nearest" });
  const preview = Mapping.previewProjectPaletteMapping(project, mapping);
  assert.ok(extracted.colors.length > 0);
  assert.ok(preview.changedPixels > 0);
  assert.equal(JSON.stringify(project), before);
});
