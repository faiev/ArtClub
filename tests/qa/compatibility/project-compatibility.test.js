"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  Project,
  makeBoundaryProject,
  makeLegacyProject,
  makeSparseCelProject,
  makeUndefinedCelProject,
  makeOverBudgetCelProject
} = require("../../fixtures/qa/compatibility-fixtures.js");

function errorsOf(project) {
  return Project.validateProject(project).errors.join("\n");
}

function logicalProject(project) {
  return {
    format: project.format,
    version: project.version,
    name: project.name,
    canvas: project.canvas,
    palette: project.palette,
    selectedColorIndex: project.selectedColorIndex,
    layers: project.layers.map(layer => ({
      name: layer.name,
      visible: layer.visible,
      locked: layer.locked,
      opacity: layer.opacity
    })),
    frames: project.frames.map(frame => ({
      name: frame.name,
      durationMs: frame.durationMs
    })),
    cels: project.cels.map(cel => ({
      layerOrder: project.layers.findIndex(layer => layer.id === cel.layerId),
      frameOrder: project.frames.findIndex(frame => frame.id === cel.frameId),
      pixels: cel.pixels
    }))
  };
}

test("accepts current v2 minimum and maximum supported boundaries", () => {
  const minimum = makeBoundaryProject({
    id: "qa-minimum",
    name: "M",
    width: 1,
    height: 1,
    paletteCount: 1,
    layerCount: 1,
    frameCount: 1,
    firstDuration: 10
  });
  assert.equal(Project.validateProject(minimum).valid, true);

  const maximum = makeBoundaryProject({
    id: "qa-maximum",
    name: "M".repeat(100),
    width: Project.LIMITS.maxDimension,
    height: Project.LIMITS.maxDimension,
    paletteCount: Project.LIMITS.maxPaletteColors,
    layerCount: Project.LIMITS.maxLayers,
    frameCount: Project.LIMITS.maxFrames,
    selectedColorIndex: Project.LIMITS.maxPaletteColors - 1,
    firstDuration: 10,
    lastDuration: 60000,
    activeLayerLast: true,
    activeFrameLast: true
  });
  assert.equal(Project.validateProject(maximum).valid, true);
  assert.equal(maximum.canvas.width, 512);
  assert.equal(maximum.canvas.height, 512);
  assert.equal(maximum.layers.length, 32);
  assert.equal(maximum.frames.length, 256);
  assert.equal(maximum.palette.length, 256);
  assert.equal(maximum.name.length, 100);
  assert.equal(maximum.frames[0].durationMs, 10);
  assert.equal(maximum.frames[maximum.frames.length - 1].durationMs, 60000);
});

test("rejects malformed JSON and unsupported versioned documents with stable diagnostics", () => {
  assert.throws(
    () => Project.deserializeProject("{not valid JSON"),
    /Project file is not valid JSON\./
  );

  const unknownVersion = makeBoundaryProject({ id: "qa-unknown-version" });
  unknownVersion.version = 99;
  assert.match(errorsOf(unknownVersion), /Unsupported project version\./);
  assert.throws(
    () => Project.deserializeProject(unknownVersion),
    /Unsupported project version\./
  );

  const wrongFormat = makeBoundaryProject({ id: "qa-wrong-format" });
  wrongFormat.format = "another-editor";
  assert.match(errorsOf(wrongFormat), /Unrecognized project format\./);
});

test("rejects missing references, duplicate IDs, invalid HEX, metadata and duration fields", () => {
  const missingCelLayer = makeBoundaryProject({ id: "qa-missing-cel-layer" });
  missingCelLayer.cels[0].layerId = "missing-layer";
  assert.match(errorsOf(missingCelLayer), /Every cel must reference an existing layer and frame\./);

  const missingCelFrame = makeBoundaryProject({ id: "qa-missing-cel-frame" });
  missingCelFrame.cels[0].frameId = "missing-frame";
  assert.match(errorsOf(missingCelFrame), /Every cel must reference an existing layer and frame\./);

  const missingActiveLayer = makeBoundaryProject({ id: "qa-missing-active-layer" });
  missingActiveLayer.activeLayerId = "missing-layer";
  assert.match(errorsOf(missingActiveLayer), /Active layer does not exist\./);

  const missingActiveFrame = makeBoundaryProject({ id: "qa-missing-active-frame" });
  missingActiveFrame.activeFrameId = "missing-frame";
  assert.match(errorsOf(missingActiveFrame), /Active frame does not exist\./);

  const duplicateLayer = makeBoundaryProject({ id: "qa-duplicate-layer" });
  const repeatedLayer = Project.makeLayer("Repeated");
  repeatedLayer.id = duplicateLayer.layers[0].id;
  duplicateLayer.layers.push(repeatedLayer);
  assert.match(errorsOf(duplicateLayer), /Layer IDs must be present and unique\./);

  const duplicateFrame = makeBoundaryProject({ id: "qa-duplicate-frame" });
  const repeatedFrame = Project.makeFrame("Repeated frame", 100);
  repeatedFrame.id = duplicateFrame.frames[0].id;
  duplicateFrame.frames.push(repeatedFrame);
  assert.match(errorsOf(duplicateFrame), /Frame IDs must be present and unique\./);

  const invalidPalette = makeBoundaryProject({ id: "qa-invalid-palette" });
  invalidPalette.palette[0] = "#12GG00";
  assert.match(errorsOf(invalidPalette), /Palette must contain 1–256 valid HEX colors\./);

  const invalidCelColor = makeBoundaryProject({ id: "qa-invalid-cel-color" });
  invalidCelColor.cels[0].pixels[0] = "red";
  assert.match(errorsOf(invalidCelColor), /Cel pixels must be transparent or valid HEX colors\./);

  for (const duration of [9, 60001, 10.5]) {
    const invalidDuration = makeBoundaryProject({ id: "qa-duration-" + duration });
    invalidDuration.frames[0].durationMs = duration;
    assert.match(errorsOf(invalidDuration), /Frame duration must be between 10 and 60000 milliseconds\./);
  }

  const invalidMetadata = makeBoundaryProject({ id: "qa-invalid-metadata" });
  invalidMetadata.metadata = [];
  assert.match(errorsOf(invalidMetadata), /Project metadata must be an object\./);

  const tooLongName = makeBoundaryProject({ id: "qa-long-name" });
  tooLongName.name = "N".repeat(101);
  assert.match(errorsOf(tooLongName), /Project name must contain 1–100 characters\./);
});

test("rejects documents beyond palette, layer, frame and dimension limits", () => {
  const excessivePalette = makeBoundaryProject({
    id: "qa-palette-over",
    paletteCount: Project.LIMITS.maxPaletteColors + 1
  });
  assert.match(errorsOf(excessivePalette), /Palette must contain 1–256 valid HEX colors\./);

  const excessiveLayers = makeBoundaryProject({
    id: "qa-layers-over",
    layerCount: Project.LIMITS.maxLayers + 1,
    activeLayerLast: true
  });
  assert.match(errorsOf(excessiveLayers), /Project must contain 1–32 layers\./);

  const excessiveFrames = makeBoundaryProject({
    id: "qa-frames-over",
    frameCount: Project.LIMITS.maxFrames + 1,
    activeFrameLast: true
  });
  assert.match(errorsOf(excessiveFrames), /Project must contain 1–256 frames\./);

  const oversized = makeBoundaryProject({ id: "qa-dimension-over" });
  oversized.canvas.width = Project.LIMITS.maxDimension + 1;
  assert.match(errorsOf(oversized), /Canvas width must be a whole number between 1 and 512\./);

  const overBudget = makeOverBudgetCelProject();
  const originalPixelArrays = overBudget.cels.map(cel => cel.pixels);
  const overBudgetErrors = errorsOf(overBudget);
  assert.match(overBudgetErrors, /Project exceeds the safe pixel-data limit\./);
  assert.equal(overBudget.cels.length, 65);
  overBudget.cels.forEach((cel, index) => {
    assert.equal(cel.pixels, originalPixelArrays[index],
      "validation must not replace or repair input cel arrays");
  });
});

test("rejects explicitly undefined cel entries and identifies sparse holes as a known validator gap", () => {
  const undefinedPixel = makeUndefinedCelProject();
  const undefinedResult = Project.validateProject(undefinedPixel);
  assert.equal(undefinedResult.valid, false);
  assert.ok(undefinedResult.errors.includes("Cel pixels must be transparent or valid HEX colors."));

  const sparsePixel = makeSparseCelProject();
  // Current project-model.js uses Array.prototype.some() for cel color
  // validation; Array#some skips holes. Keep this expected-failure marker
  // until the project-model owner adds an indexed/sparse-safe validation pass.
  test("sparse cel array holes are rejected", {
    todo: "Known gap: validation currently skips sparse array holes"
  }, () => {
    const sparseResult = Project.validateProject(sparsePixel);
    assert.equal(sparseResult.valid, false);
    assert.ok(sparseResult.errors.includes("Cel pixels must be transparent or valid HEX colors."));
  });
});

test("validation and deserialization do not mutate v2 source documents", () => {
  const valid = makeBoundaryProject({ id: "qa-non-mutating" });
  const originalBytes = JSON.stringify(valid);
  const validation = Project.validateProject(valid);
  assert.equal(validation.valid, true);
  assert.equal(JSON.stringify(valid), originalBytes,
    "validation must not mutate its input");

  const reopened = Project.deserializeProject(valid);
  assert.notEqual(reopened, valid, "deserialization should return a detached document");
  assert.deepEqual(reopened, valid);
  assert.equal(JSON.stringify(valid), originalBytes,
    "deserialization must not overwrite the source object");

  const invalid = makeBoundaryProject({ id: "qa-invalid-non-mutating" });
  invalid.palette[0] = "invalid";
  const invalidBytes = JSON.stringify(invalid);
  assert.equal(Project.validateProject(invalid).valid, false);
  assert.equal(JSON.stringify(invalid), invalidBytes,
    "failed validation must leave malformed input untouched");
});

test("legacy v1 migration is logically deterministic and preserves source bytes", () => {
  const legacy = makeLegacyProject();
  const sourceBytes = JSON.stringify(legacy);
  const sourceSnapshot = JSON.parse(sourceBytes);

  const first = Project.deserializeProject(sourceBytes);
  const second = Project.deserializeProject(legacy);
  assert.equal(Project.validateProject(first).valid, true);
  assert.equal(Project.validateProject(second).valid, true);
  assert.deepEqual(logicalProject(first), logicalProject(second),
    "repeated in-memory migration should preserve the same logical project contents");

  assert.equal(JSON.stringify(legacy), sourceBytes,
    "migration must not modify the caller's legacy object");
  assert.deepEqual(legacy, sourceSnapshot);
  assert.equal(sourceBytes, JSON.stringify(sourceSnapshot),
    "the original serialized v1 bytes remain unchanged");
});
