/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const PaletteTools = require("../js/palette-tools.js");

let nextId = 1;
const Project = {
  makeLayer(name) {
    return { id: "layer-" + nextId++, name: name || "Layer", visible: true, locked: false, opacity: 1 };
  },
  makeFrame(name, durationMs) {
    return { id: "frame-" + nextId++, name: name || "Frame", durationMs: durationMs || 100 };
  },
  createProject(options) {
    options = options || {};
    const width = options.width || 2;
    const height = options.height || 2;
    const layer = this.makeLayer("Layer 1");
    const frame = this.makeFrame("Frame 1");
    return {
      format: "one-pixel-studio",
      version: 2,
      id: "project-" + nextId++,
      name: "Test project",
      canvas: { width, height, background: null },
      palette: (options.palette || ["#000000"]).slice(),
      layers: [layer],
      frames: [frame],
      cels: [{ layerId: layer.id, frameId: frame.id, pixels: options.pixels ? options.pixels.slice() : Array(width * height).fill(null) }],
      activeLayerId: layer.id,
      activeFrameId: frame.id
    };
  },
  ensureCel(project, layerId, frameId) {
    let cel = project.cels.find(item => item.layerId === layerId && item.frameId === frameId);
    if (!cel) {
      cel = { layerId, frameId, pixels: Array(project.canvas.width * project.canvas.height).fill(null) };
      project.cels.push(cel);
    }
    return cel;
  },
  cloneProject(project) {
    return JSON.parse(JSON.stringify(project));
  }
};

function makeProject() {
  const project = Project.createProject({
    width: 2,
    height: 2,
    palette: ["#aa0000", "#AA0000", "#00ff00", "#0000FF", "#ABCDEF"],
    pixels: ["#aa0000", null, "#00FF00", "#AA0000"]
  });
  const firstFrameId = project.activeFrameId;
  const firstLayerId = project.activeLayerId;
  const secondFrame = Project.makeFrame("Frame 2", 120);
  project.frames.push(secondFrame);
  const secondCel = Project.ensureCel(project, firstLayerId, secondFrame.id);
  secondCel.pixels = ["#0000ff", "#aa0000", null, null];

  const hiddenLayer = Project.makeLayer("Hidden guide");
  hiddenLayer.visible = false;
  project.layers.push(hiddenLayer);
  const hiddenCel = Project.ensureCel(project, hiddenLayer.id, firstFrameId);
  hiddenCel.pixels = ["#123456", "#123456", null, "#aa0000"];
  return { project, firstFrameId, secondFrameId: secondFrame.id, firstLayerId, hiddenLayerId: hiddenLayer.id };
}

test("counts visible-layer color usage across frames and includes transparent samples", () => {
  const { project } = makeProject();
  const report = PaletteTools.countColorUsage(project);
  const usage = Object.fromEntries(report.colors.map(item => [item.color, item.count]));

  assert.equal(report.totalPixels, 8);
  assert.equal(report.opaquePixels, 5);
  assert.equal(report.transparentPixels, 3);
  assert.equal(usage["#AA0000"], 3);
  assert.equal(usage["#00FF00"], 1);
  assert.equal(usage["#0000FF"], 1);
  assert.equal(usage["#123456"], undefined);
  assert.equal(report.storedCelCount, 2);
  assert.equal(report.missingCelCount, 0);
});

test("hidden layers are excluded by default and included on request", () => {
  const { project } = makeProject();
  const visible = PaletteTools.countColorUsage(project);
  const allLayers = PaletteTools.countColorUsage(project, { includeHiddenLayers: true });
  const visibleUsage = Object.fromEntries(visible.colors.map(item => [item.color, item.count]));
  const allUsage = Object.fromEntries(allLayers.colors.map(item => [item.color, item.count]));

  assert.equal(visibleUsage["#123456"], undefined);
  assert.equal(allUsage["#123456"], 2);
  assert.equal(allLayers.totalPixels, 12);
  assert.equal(allLayers.transparentPixels, 4);
});

test("frameId scopes analysis to one frame", () => {
  const { project, secondFrameId } = makeProject();
  const report = PaletteTools.countColorUsage(project, { frameId: secondFrameId });
  const usage = Object.fromEntries(report.colors.map(item => [item.color, item.count]));

  assert.deepEqual(report.scope.frameIds, [secondFrameId]);
  assert.equal(report.totalPixels, 4);
  assert.equal(usage["#AA0000"], 1);
  assert.equal(usage["#0000FF"], 1);
  assert.equal(report.transparentPixels, 2);
});

test("frameIds preserve project order rather than caller order", () => {
  const { project, firstFrameId, secondFrameId } = makeProject();
  const report = PaletteTools.countColorUsage(project, { frameIds: [secondFrameId, firstFrameId] });
  assert.deepEqual(report.scope.frameIds, [firstFrameId, secondFrameId]);
});

test("layerIds can restrict analysis to chosen visible layers", () => {
  const { project, hiddenLayerId } = makeProject();
  const report = PaletteTools.countColorUsage(project, {
    includeHiddenLayers: true,
    layerIds: [hiddenLayerId]
  });
  assert.deepEqual(report.scope.layerIds, [hiddenLayerId]);
  assert.equal(report.totalPixels, 4);
  assert.equal(report.colors.find(item => item.color === "#123456").count, 2);
});

test("analysis reports unused colors and case-normalized duplicate palette entries", () => {
  const { project } = makeProject();
  const report = PaletteTools.analyzePalette(project);

  assert.equal(report.duplicateColors.length, 1);
  assert.deepEqual(report.duplicateColors[0].paletteIndices, [0, 1]);
  assert.equal(report.duplicateColors[0].caseVariant, true);
  assert.equal(report.duplicateColors[0].duplicateEntryCount, 1);
  assert.deepEqual(report.unusedColors.map(item => item.color), ["#ABCDEF"]);
});

test("analysis marks duplicate palette entries with identical spelling separately from case variants", () => {
  const project = Project.createProject({ width: 1, height: 1, palette: ["#123456", "#123456", "#123456"] });
  const report = PaletteTools.analyzePalette(project);
  assert.equal(report.duplicateColors.length, 1);
  assert.equal(report.duplicateColors[0].caseVariant, false);
  assert.equal(report.duplicateColors[0].duplicateEntryCount, 2);
});

test("analysis reports cel colors absent from the declared palette", () => {
  const { project } = makeProject();
  const report = PaletteTools.analyzePalette(project, { includeHiddenLayers: true });
  assert.deepEqual(report.unlistedColors, [{ color: "#123456", count: 2 }]);
});

test("missing layer/frame cels are reported but are not counted as stored pixel samples", () => {
  const { project } = makeProject();
  const emptyLayer = Project.makeLayer("Empty layer");
  project.layers.push(emptyLayer);
  const report = PaletteTools.countColorUsage(project, { layerIds: [emptyLayer.id] });
  assert.equal(report.totalPixels, 0);
  assert.equal(report.storedCelCount, 0);
  assert.equal(report.missingCelCount, 2);
  assert.equal(report.selectedCelSlotCount, 2);
});

test("nearest-color lookup returns exact squared RGB distance and normalized HEX", () => {
  const match = PaletteTools.findNearestColor("#aa0000", ["#000000", "#AA0000", "#FFFFFF"]);
  assert.deepEqual(match, {
    color: "#AA0000",
    index: 1,
    distanceSquared: 0,
    distance: 0,
    metric: "rgb-euclidean"
  });
});

test("nearest-color ties deterministically prefer the first palette entry", () => {
  const match = PaletteTools.findNearestColor("#010000", ["#000000", "#020000"]);
  assert.equal(match.index, 0);
  assert.equal(match.distanceSquared, 1);
  assert.equal(match.distance, 1);
});

test("nearest-color rejects empty, oversized or malformed palettes", () => {
  assert.throws(() => PaletteTools.findNearestColor("#000000", []), /Palette must contain/);
  assert.throws(() => PaletteTools.findNearestColor("#000000", ["red"]), /six-digit HEX/);
  assert.throws(() => PaletteTools.findNearestColor("red", ["#000000"]), /six-digit HEX/);
  const sparse = ["#000000", "#FFFFFF"];
  delete sparse[0];
  assert.throws(() => PaletteTools.findNearestColor("#000000", sparse), /sparse or missing/);
});

test("replacement impact reports aggregate counts and per-cel coordinate bounds without mutation", () => {
  const { project, firstLayerId, firstFrameId, secondFrameId } = makeProject();
  const before = JSON.stringify(project);
  const report = PaletteTools.estimateReplacementImpact(project, "#aa0000", "#222222");

  assert.equal(report.fromColor, "#AA0000");
  assert.equal(report.toColor, "#222222");
  assert.equal(report.matchedPixels, 3);
  assert.equal(report.changedPixels, 3);
  assert.equal(report.affectedCelCount, 2);
  assert.equal(report.affectedLayerCount, 1);
  assert.equal(report.affectedFrameCount, 2);
  assert.deepEqual(report.paletteSourceIndices, [0, 1]);
  assert.equal(report.replacementAlreadyInPalette, false);
  assert.equal(report.targetColorIsUnlisted, true);
  assert.equal(report.impactsByCel[0].layerId, firstLayerId);
  assert.equal(report.impactsByCel[0].frameId, firstFrameId);
  assert.deepEqual(report.impactsByCel[0].bounds, { x: 0, y: 0, width: 2, height: 2 });
  assert.equal(report.impactsByCel[1].frameId, secondFrameId);
  assert.deepEqual(report.impactsByCel[1].bounds, { x: 1, y: 0, width: 1, height: 1 });
  assert.equal(JSON.stringify(project), before);
});

test("replacement impact respects hidden-layer and frame filters", () => {
  const { project, secondFrameId } = makeProject();
  const report = PaletteTools.estimateReplacementImpact(project, "#AA0000", "#0000FF", {
    includeHiddenLayers: true,
    frameId: secondFrameId
  });
  assert.equal(report.matchedPixels, 1);
  assert.equal(report.affectedCelCount, 1);
  assert.deepEqual(report.scope.frameIds, [secondFrameId]);
});

test("replacement of a color with itself is explicitly reported as a no-op", () => {
  const { project } = makeProject();
  const report = PaletteTools.estimateReplacementImpact(project, "#aa0000", "#AA0000");
  assert.equal(report.isNoOp, true);
  assert.equal(report.matchedPixels, 3);
  assert.equal(report.changedPixels, 0);
});

test("replacement impact notes when the target already exists in the palette", () => {
  const { project } = makeProject();
  const report = PaletteTools.estimateReplacementImpact(project, "#AA0000", "#00FF00");
  assert.equal(report.replacementAlreadyInPalette, true);
  assert.deepEqual(report.paletteTargetIndices, [2]);
});

test("summary reports palette coverage, duplicate entries and transparency", () => {
  const { project } = makeProject();
  const { summary } = PaletteTools.summarizePalette(project);
  assert.equal(summary.paletteLength, 5);
  assert.equal(summary.uniquePaletteColorCount, 4);
  assert.equal(summary.duplicatePaletteEntryCount, 1);
  assert.equal(summary.usedPaletteColorCount, 3);
  assert.equal(summary.unusedPaletteColorCount, 1);
  assert.equal(summary.colorCoverage, 0.75);
  assert.equal(summary.colorCoveragePercent, 75);
  assert.equal(summary.totalPixels, 8);
  assert.equal(summary.opaquePixels, 5);
  assert.equal(summary.transparentPixels, 3);
  assert.equal(summary.transparencyPercent, 37.5);
});

test("empty analysis scope returns null ratios instead of division by zero", () => {
  const { project } = makeProject();
  const summary = PaletteTools.summarizePalette(project, { layerIds: [] }).summary;
  assert.equal(summary.totalPixels, 0);
  assert.equal(summary.colorCoverage, 0);
  assert.equal(summary.transparencyRatio, null);
  assert.equal(summary.transparencyPercent, null);
});

test("analysis rejects unknown frame and layer scopes", () => {
  const { project } = makeProject();
  assert.throws(() => PaletteTools.countColorUsage(project, { frameId: "missing" }), /frameId does not exist/);
  assert.throws(() => PaletteTools.countColorUsage(project, { layerIds: ["missing"] }), /layerId must exist/);
  assert.throws(() => PaletteTools.countColorUsage(project, { frameId: project.frames[0].id, frameIds: [] }), /Use frameId or frameIds/);
  assert.throws(() => PaletteTools.countColorUsage(project, { includeHiddenLayers: 1 }), /includeHiddenLayers/);
});

test("analysis rejects sparse, malformed and duplicate cel data before scanning", () => {
  const { project } = makeProject();
  const sparse = Project.cloneProject(project);
  delete sparse.cels[0].pixels[0];
  assert.throws(() => PaletteTools.analyzePalette(sparse), /sparse or missing/);

  const malformed = Project.cloneProject(project);
  malformed.cels[0].pixels[0] = "not-hex";
  assert.throws(() => PaletteTools.analyzePalette(malformed), /six-digit HEX/);

  const duplicate = Project.cloneProject(project);
  duplicate.cels.push({
    layerId: duplicate.cels[0].layerId,
    frameId: duplicate.cels[0].frameId,
    pixels: Array(4).fill(null)
  });
  assert.throws(() => PaletteTools.analyzePalette(duplicate), /duplicate cels/);
});

test("analysis rejects sparse palette, layer, frame and cel collections", () => {
  const { project } = makeProject();
  const sparsePalette = Project.cloneProject(project);
  delete sparsePalette.palette[0];
  assert.throws(() => PaletteTools.analyzePalette(sparsePalette), /sparse or missing/);

  const sparseLayers = Project.cloneProject(project);
  delete sparseLayers.layers[0];
  assert.throws(() => PaletteTools.analyzePalette(sparseLayers), /sparse or missing/);

  const sparseFrames = Project.cloneProject(project);
  delete sparseFrames.frames[0];
  assert.throws(() => PaletteTools.analyzePalette(sparseFrames), /sparse or missing/);

  const sparseCels = Project.cloneProject(project);
  delete sparseCels.cels[0];
  assert.throws(() => PaletteTools.analyzePalette(sparseCels), /sparse or missing/);
});

test("analysis requires the supported project format and valid layer/frame names", () => {
  const { project } = makeProject();
  const wrongVersion = Project.cloneProject(project);
  wrongVersion.version = 1;
  assert.throws(() => PaletteTools.analyzePalette(wrongVersion), /version 2/);

  const unnamedLayer = Project.cloneProject(project);
  unnamedLayer.layers[0].name = "  ";
  assert.throws(() => PaletteTools.analyzePalette(unnamedLayer), /must have a name/);

  const unnamedFrame = Project.cloneProject(project);
  unnamedFrame.frames[0].name = "";
  assert.throws(() => PaletteTools.analyzePalette(unnamedFrame), /must have a name/);
});

test("module exposes a browser global without CommonJS", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "palette-tools.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.globalThis.ArtClubPaletteTools.analyzePalette, "function");
  assert.equal(typeof context.globalThis.ArtClubPaletteTools.findNearestColor, "function");
});

test("analysis accepts frozen project data and does not mutate arrays or objects", () => {
  const { project } = makeProject();
  project.cels.forEach(cel => Object.freeze(cel.pixels) && Object.freeze(cel));
  Object.freeze(project.cels);
  Object.freeze(project.palette);
  Object.freeze(project.layers);
  Object.freeze(project.frames);
  Object.freeze(project.canvas);
  Object.freeze(project);
  const report = PaletteTools.analyzePalette(project);
  assert.equal(report.summary.totalPixels, 8);
  assert.equal(report.summary.usedPaletteColorCount, 3);
});
