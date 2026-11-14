"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Staging = require("../js/import-staging.js");

function projectFixture() {
  const layer = { id: "layer-1", name: "Layer 1", visible: true, locked: false, opacity: 1 };
  const frame = { id: "frame-1", name: "Frame 1", durationMs: 100 };
  return {
    format: "one-pixel-studio",
    version: 2,
    id: "project-stage-test",
    name: "Stage fixture",
    canvas: { width: 2, height: 2, background: null },
    palette: ["#000000", "#ffffff"],
    selectedColorIndex: 0,
    layers: [layer],
    frames: [frame],
    cels: [{ layerId: layer.id, frameId: frame.id, pixels: [null, "#000000", "#ffffff", null] }],
    activeLayerId: layer.id,
    activeFrameId: frame.id,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
}

function rgbaFixture() {
  return new Uint8Array([
    0, 0, 0, 255, 255, 255, 255, 255,
    255, 0, 0, 255, 0, 0, 0, 0
  ]);
}

test("stages a valid project into a frozen detached commit candidate", () => {
  const input = projectFixture();
  const before = JSON.stringify(input);
  const result = Staging.stageProjectImport(input);

  assert.equal(result.ok, true);
  assert.equal(result.kind, "project");
  assert.equal(result.commit.kind, "replace-project");
  assert.deepEqual(result.commit.project, input);
  assert.notEqual(result.commit.project, input);
  assert.notEqual(result.commit.project.cels[0].pixels, input.cels[0].pixels);
  assert.equal(Object.isFrozen(result.commit), true);
  assert.equal(Object.isFrozen(result.commit.project.cels[0].pixels), true);
  assert.equal(JSON.stringify(input), before);
});

test("stages valid JSON strings and UTF-8 byte input", () => {
  const project = projectFixture();
  const json = JSON.stringify(project);
  assert.equal(Staging.stageProjectImport(json).ok, true);
  const bytes = new TextEncoder().encode(json);
  assert.deepEqual(Staging.stageProjectImport(bytes).commit.project, project);
});

test("rejects oversized JSON before attempting to parse it", () => {
  const result = Staging.stageProjectImport("{not valid JSON but oversized}", { maxBytes: 8 });
  assert.equal(result.ok, false);
  assert.equal(result.diagnostics[0].code, Staging.REASONS.PROJECT_BYTES_EXCEEDED);
  assert.equal(result.commit, null);
});

test("rejects malformed JSON and invalid import options", () => {
  assert.equal(Staging.stageProjectImport("{not json").diagnostics[0].code,
    Staging.REASONS.PROJECT_JSON_INVALID);
  assert.equal(Staging.stageProjectImport(projectFixture(), {
    maxBytes: Staging.LIMITS.maxProjectBytes + 1
  }).diagnostics[0].code, Staging.REASONS.OPTIONS_INVALID);
});

test("rejects project dimensions and collection counts above hard ceilings", () => {
  const badCanvas = projectFixture();
  badCanvas.canvas.width = Staging.LIMITS.maxDimension + 1;
  assert.equal(Staging.stageProjectImport(badCanvas).diagnostics[0].code,
    Staging.REASONS.PROJECT_DIMENSIONS_EXCEEDED);

  const badLayers = projectFixture();
  badLayers.layers = Array.from({ length: Staging.LIMITS.maxLayers + 1 }, (_, index) => ({
    id: "layer-" + index, name: "Layer " + index, visible: true, locked: false, opacity: 1
  }));
  assert.equal(Staging.stageProjectImport(badLayers).diagnostics[0].code,
    Staging.REASONS.PROJECT_COUNTS_EXCEEDED);
});

test("rejects sparse arrays and explicit undefined cel pixels before model validation", () => {
  const sparse = projectFixture();
  delete sparse.cels[0].pixels[1];
  const sparseBefore = JSON.stringify(sparse);
  const sparseResult = Staging.stageProjectImport(sparse);
  assert.equal(sparseResult.ok, false);
  assert.ok(sparseResult.diagnostics.some(d => d.code === Staging.REASONS.PROJECT_STRUCTURE_INVALID));
  assert.equal(JSON.stringify(sparse), sparseBefore);

  const undefinedPixel = projectFixture();
  undefinedPixel.cels[0].pixels[1] = undefined;
  const undefinedResult = Staging.stageProjectImport(undefinedPixel);
  assert.equal(undefinedResult.ok, false);
  assert.ok(undefinedResult.diagnostics.some(d => d.path === "cels[0].pixels[1]"));
});

test("rejects wrong-length and malformed cel pixels without mutating candidate", () => {
  const shortCel = projectFixture();
  shortCel.cels[0].pixels.pop();
  const before = JSON.stringify(shortCel);
  assert.equal(Staging.stageProjectImport(shortCel).ok, false);
  assert.equal(JSON.stringify(shortCel), before);

  const invalidColor = projectFixture();
  invalidColor.cels[0].pixels[1] = "#12345g";
  assert.equal(Staging.stageProjectImport(invalidColor).ok, false);
});

test("rejects excessive total cel-pixel budgets before scanning all cel values", () => {
  const project = projectFixture();
  project.canvas.width = 512;
  project.canvas.height = 512;
  project.cels = Array.from({ length: 65 }, (_, index) => ({
    layerId: "layer-1",
    frameId: "frame-1",
    pixels: Array(512 * 512).fill(null)
  }));
  const result = Staging.stageProjectImport(project);
  assert.equal(result.ok, false);
  assert.ok(result.diagnostics.some(d => d.code === Staging.REASONS.PROJECT_PIXEL_BUDGET_EXCEEDED));
});

test("reports legacy migration and optional metadata warnings", () => {
  const legacy = {
    app: "One Pixel Studio",
    w: 2,
    h: 2,
    pixels: [null, "#000000", "#ffffff", null],
    palette: ["#000000", "#ffffff"],
    selected: 0,
    projectName: "Legacy"
  };
  const result = Staging.stageProjectImport(legacy);
  assert.equal(result.ok, true);
  assert.equal(result.staged.migratedLegacy, true);
  assert.ok(result.warnings.some(d => d.code === "LEGACY_PROJECT_MIGRATED"));
});

test("rejects cyclic project objects without throwing or mutating them", () => {
  const project = projectFixture();
  project.metadata.self = project.metadata;
  const result = Staging.stageProjectImport(project);
  assert.equal(result.ok, false);
  assert.equal(result.commit, null);
  assert.equal(project.metadata.self, project.metadata);
});

test("stages image RGBA into a palette-mapped detached cel buffer", () => {
  const palette = ["#000000", "#ffffff"];
  const image = { width: 2, height: 2, rgba: rgbaFixture(), sourceBytes: 64 };
  const before = Array.from(image.rgba);
  const result = Staging.stageImageImport(image, { palette });

  assert.equal(result.ok, true);
  assert.equal(result.commit.kind, "replace-active-cel");
  assert.deepEqual(result.commit.pixels, ["#000000", "#ffffff", "#000000", null]);
  assert.equal(result.commit.width, 2);
  assert.equal(result.commit.height, 2);
  assert.ok(result.warnings.some(d => d.code === "PALETTE_QUANTIZATION"));
  assert.ok(result.warnings.some(d => d.code === "TRANSPARENT_PIXELS_PRESERVED"));
  assert.deepEqual(Array.from(image.rgba), before);
  assert.equal(Object.isFrozen(result.commit.pixels), true);
});

test("rejects compressed-source and decoded-RGBA byte ceilings", () => {
  const image = { width: 2, height: 2, rgba: rgbaFixture(), sourceBytes: 100 };
  assert.equal(Staging.stageImageImport(image, { palette: ["#000000"], maxBytes: 10 }).diagnostics[0].code,
    Staging.REASONS.IMAGE_BYTES_EXCEEDED);

  const decodedOver = { width: 2, height: 2, rgba: rgbaFixture(), sourceBytes: 1 };
  assert.equal(Staging.stageImageImport(decodedOver, { palette: ["#000000"], maxBytes: 10 }).diagnostics[0].code,
    Staging.REASONS.IMAGE_BYTES_EXCEEDED);
});

test("rejects image dimensions and hard pixel budgets", () => {
  const tooWide = { width: Staging.LIMITS.maxDimension + 1, height: 1, rgba: new Uint8Array(4) };
  assert.equal(Staging.stageImageImport(tooWide, { palette: ["#000000"] }).diagnostics[0].code,
    Staging.REASONS.IMAGE_DIMENSIONS_EXCEEDED);
});

test("rejects malformed palette and invalid RGBA length or values", () => {
  const image = { width: 2, height: 2, rgba: rgbaFixture() };
  assert.equal(Staging.stageImageImport(image, { palette: [] }).diagnostics[0].code,
    Staging.REASONS.PALETTE_INVALID);
  assert.equal(Staging.stageImageImport({ width: 2, height: 2, rgba: [0, 1] }, {
    palette: ["#000000"]
  }).diagnostics[0].code, Staging.REASONS.IMAGE_RGBA_INVALID);
  assert.equal(Staging.stageImageImport({ width: 1, height: 1, rgba: [0, 0, 0, 256] }, {
    palette: ["#000000"]
  }).diagnostics[0].code, Staging.REASONS.IMAGE_RGBA_INVALID);
});

test("rejects sparse RGBA arrays, invalid target dimensions and alpha threshold", () => {
  const sparse = [0, 0, 0, 255];
  delete sparse[2];
  assert.equal(Staging.stageImageImport({ width: 1, height: 1, rgba: sparse }, {
    palette: ["#000000"]
  }).diagnostics[0].code, Staging.REASONS.IMAGE_RGBA_INVALID);
  assert.equal(Staging.stageImageImport({ width: 1, height: 1, rgba: [0, 0, 0, 255] }, {
    palette: ["#000000"], targetWidth: 513
  }).diagnostics[0].code, Staging.REASONS.TARGET_DIMENSIONS_INVALID);
  assert.equal(Staging.stageImageImport({ width: 1, height: 1, rgba: [0, 0, 0, 255] }, {
    palette: ["#000000"], alphaThreshold: 256
  }).diagnostics[0].code, Staging.REASONS.ALPHA_THRESHOLD_INVALID);
});

test("fits image proportionally with nearest-neighbor sampling and transparent padding", () => {
  const image = { width: 2, height: 1, rgba: new Uint8Array([
    0, 0, 0, 255,
    255, 255, 255, 255
  ]) };
  const result = Staging.stageImageImport(image, {
    palette: ["#000000", "#ffffff"],
    targetWidth: 2,
    targetHeight: 2
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.commit.pixels, ["#000000", "#ffffff", null, null]);
  assert.ok(result.warnings.some(d => d.code === "IMAGE_FIT_RESAMPLED"));
});

test("preserves caller-owned project and source pixels on every denial", () => {
  const project = projectFixture();
  project.cels[0].pixels[2] = "broken";
  const before = JSON.stringify(project);
  const denied = Staging.stageProjectImport(project);
  assert.equal(denied.ok, false);
  assert.equal(denied.commit, null);
  assert.equal(JSON.stringify(project), before);

  const rgba = rgbaFixture();
  const beforeRgba = Array.from(rgba);
  const imageDenied = Staging.stageImageImport({ width: 2, height: 2, rgba }, {
    palette: ["invalid"]
  });
  assert.equal(imageDenied.ok, false);
  assert.equal(imageDenied.commit, null);
  assert.deepEqual(Array.from(rgba), beforeRgba);
});
