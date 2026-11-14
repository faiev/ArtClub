"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Project = require("../js/project-model.js");
const Adapter = require("../js/canvas-renderer-adapter.js");

function projectWithFrames() {
  const project = Project.createProject({
    id: "project-1", width: 2, height: 1, palette: ["#000000", "#ffffff"]
  });
  project.layers[0].id = "base";
  project.activeLayerId = "base";
  project.frames[0].id = "f1";
  project.activeFrameId = "f1";
  project.cels[0].layerId = "base";
  project.cels[0].frameId = "f1";
  project.cels[0].pixels = ["#ff0000", null];
  const overlay = Project.makeLayer("Overlay");
  overlay.id = "overlay";
  project.layers.push(overlay);
  const f2 = Project.makeFrame("Frame 2", 120);
  f2.id = "f2";
  const f3 = Project.makeFrame("Frame 3", 140);
  f3.id = "f3";
  project.frames.push(f2, f3);
  project.cels.push(
    { layerId: "base", frameId: "f2", pixels: ["#00ff00", null] },
    { layerId: "overlay", frameId: "f2", pixels: [null, "#0000ff"] },
    { layerId: "base", frameId: "f3", pixels: ["#ffffff", "#ffffff"] }
  );
  return project;
}

test("builds a deterministic active-frame composite in bottom-to-top order", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  const first = Adapter.buildRendererState(project);
  const second = Adapter.buildRendererState(project);
  assert.deepEqual(first.pixels, ["#00ff00", "#0000ff"]);
  assert.equal(first.frameId, "f2");
  assert.equal(first.compositeRevision, second.compositeRevision);
  assert.deepEqual(first, second);
  assert.equal(Project.validateProject(project).valid, true);
});

test("transparent upper-layer pixels reveal lower visible pixels", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  project.cels.find(cel => cel.layerId === "base" && cel.frameId === "f2").pixels = ["#ff0000", "#00ff00"];
  project.cels.find(cel => cel.layerId === "overlay" && cel.frameId === "f2").pixels = [null, "#0000ff"];
  const state = Adapter.buildRendererState(project);
  assert.deepEqual(state.pixels, ["#ff0000", "#0000ff"]);
});

test("hidden layers and zero-opacity layers do not contribute pixels", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  project.layers[1].visible = false;
  const hidden = Adapter.buildRendererState(project);
  assert.deepEqual(hidden.pixels, ["#00ff00", null]);
  project.layers[1].visible = true;
  project.layers[1].opacity = 0;
  const zeroOpacity = Adapter.buildRendererState(project);
  assert.deepEqual(zeroOpacity.pixels, ["#00ff00", null]);
});

test("composites fractional layer opacity over an opaque canvas background", () => {
  const project = Project.createProject({ width: 1, height: 1, palette: ["#ffffff"] });
  project.id = "opacity-project";
  project.canvas.background = "#000000";
  project.layers[0].opacity = 0.5;
  Project.getCel(project).pixels = ["#ffffff"];
  const state = Adapter.buildRendererState(project);
  assert.deepEqual(state.pixels, ["#808080"]);
});

test("composites fractional opacity over an opaque lower layer with deterministic rounding", () => {
  const project = Project.createProject({ width: 1, height: 1, palette: ["#ff0000", "#0000ff"] });
  project.id = "blend-project";
  project.layers[0].id = "lower";
  project.activeLayerId = "lower";
  project.cels[0].layerId = "lower";
  Project.getCel(project).pixels = ["#ff0000"];
  const upper = Project.makeLayer("Half blue");
  upper.id = "upper";
  upper.opacity = 0.5;
  project.layers.push(upper);
  project.cels.push({ layerId: "upper", frameId: project.activeFrameId, pixels: ["#0000ff"] });
  assert.deepEqual(Adapter.buildRendererState(project).pixels, ["#800080"]);
});

test("rejects partial final alpha because renderer accepts only HEX or null", () => {
  const project = Project.createProject({ width: 1, height: 1, palette: ["#ff0000"] });
  Project.getCel(project).pixels = ["#ff0000"];
  project.layers[0].opacity = 0.5;
  assert.throws(() => Adapter.buildRendererState(project), /partially transparent pixel/);
});

test("opacity in the layer stack changes compositeRevision even when source pixels do not", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  project.canvas.background = "#000000";
  const first = Adapter.buildRendererState(project);
  project.layers[1].opacity = 0.5;
  const next = Adapter.buildRendererState(project);
  assert.notEqual(first.compositeRevision, next.compositeRevision);
});

test("layer ordering changes compositeRevision and output", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  project.cels.find(cel => cel.layerId === "base" && cel.frameId === "f2").pixels = ["#ff0000", null];
  project.cels.find(cel => cel.layerId === "overlay" && cel.frameId === "f2").pixels = ["#0000ff", null];
  const before = Adapter.buildRendererState(project);
  project.layers.reverse();
  const after = Adapter.buildRendererState(project);
  assert.deepEqual(before.pixels, ["#0000ff", null]);
  assert.deepEqual(after.pixels, ["#ff0000", null]);
  assert.notEqual(before.compositeRevision, after.compositeRevision);
});

test("visibility changes change compositeRevision", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  const before = Adapter.buildRendererState(project);
  project.layers[1].visible = false;
  const after = Adapter.buildRendererState(project);
  assert.notEqual(before.compositeRevision, after.compositeRevision);
});

test("active-frame changes force a different frameId and compositeRevision", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f1";
  const before = Adapter.buildRendererState(project);
  project.activeFrameId = "f2";
  const after = Adapter.buildRendererState(project);
  assert.notEqual(before.frameId, after.frameId);
  assert.notEqual(before.compositeRevision, after.compositeRevision);
});

test("onion masks use the immediately adjacent frames in timeline order", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  const state = Adapter.buildRendererState(project, { onionSkin: true });
  assert.deepEqual(state.onionBefore, ["#ff0000", null]);
  assert.deepEqual(state.onionAfter, ["#ffffff", "#ffffff"]);
  assert.equal(state.frameId, "f2");
});

test("onion-neighbor identity and enabled state participate in compositeRevision", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  const disabled = Adapter.buildRendererState(project);
  const enabled = Adapter.buildRendererState(project, { onionSkin: { before: true, after: false } });
  assert.notEqual(disabled.compositeRevision, enabled.compositeRevision);
  project.frames.splice(0, 1);
  project.cels = project.cels.filter(cel => cel.frameId !== "f1");
  const neighborChanged = Adapter.buildRendererState(project, { onionSkin: { before: true, after: false } });
  assert.notEqual(enabled.compositeRevision, neighborChanged.compositeRevision);
  assert.equal(neighborChanged.onionBefore, null);
});

test("no onion masks are exposed when the active frame has no corresponding neighbor", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f1";
  const state = Adapter.buildRendererState(project, { onionSkin: true });
  assert.equal(state.onionBefore, null);
  assert.deepEqual(state.onionAfter, ["#00ff00", "#0000ff"]);
});

test("pixel edits preserve compositeRevision so callers may use accurate dirty bounds", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  const before = Adapter.buildRendererState(project);
  project.cels.find(cel => cel.layerId === "base" && cel.frameId === "f2").pixels[0] = "#ffffff";
  const after = Adapter.buildRendererState(project);
  assert.equal(before.compositeRevision, after.compositeRevision);
  assert.notDeepEqual(before.pixels, after.pixels);
});

test("onion neighbor pixel edits change mask contents while structure token remains stable", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  const before = Adapter.buildRendererState(project, { onionSkin: true });
  project.cels.find(cel => cel.layerId === "base" && cel.frameId === "f1").pixels[0] = "#000000";
  const after = Adapter.buildRendererState(project, { onionSkin: true });
  assert.equal(before.compositeRevision, after.compositeRevision);
  assert.notDeepEqual(before.onionBefore, after.onionBefore);
});

test("stale expected active-frame token and mismatched requested frame are rejected", () => {
  const project = projectWithFrames();
  project.activeFrameId = "f2";
  assert.throws(() => Adapter.buildRendererState(project, { expectedActiveFrameId: "f1" }), /Stale frame state/);
  assert.throws(() => Adapter.buildRendererState(project, { frameId: "f3" }), /does not match/);
  assert.throws(() => Adapter.buildRendererState(project, { expectedActiveFrameId: "missing" }), /Stale frame state/);
});

test("rejects malformed project metadata and stale cel references", () => {
  const invalidVersion = projectWithFrames();
  invalidVersion.version = 3;
  assert.throws(() => Adapter.buildRendererState(invalidVersion), /version 2/);
  const badLayer = projectWithFrames();
  badLayer.layers[0].opacity = NaN;
  assert.throws(() => Adapter.buildRendererState(badLayer), /finite number/);
  const staleCel = projectWithFrames();
  staleCel.cels.push({ layerId: "missing", frameId: "f1", pixels: [null, null] });
  assert.throws(() => Adapter.buildRendererState(staleCel), /missing layer or frame/);
  const duplicate = projectWithFrames();
  duplicate.cels.push({ layerId: "base", frameId: "f1", pixels: [null, null] });
  assert.throws(() => Adapter.buildRendererState(duplicate), /duplicate cels/);
});

test("rejects sparse, undefined, malformed and wrong-length selected-frame cels", () => {
  const sparse = projectWithFrames();
  sparse.activeFrameId = "f2";
  const sparsePixels = [null, null];
  delete sparsePixels[1];
  sparse.cels.find(cel => cel.layerId === "base" && cel.frameId === "f2").pixels = sparsePixels;
  assert.throws(() => Adapter.buildRendererState(sparse), /sparse or undefined/);

  const undefinedPixel = projectWithFrames();
  undefinedPixel.activeFrameId = "f2";
  undefinedPixel.cels.find(cel => cel.layerId === "base" && cel.frameId === "f2").pixels[1] = undefined;
  assert.throws(() => Adapter.buildRendererState(undefinedPixel), /#RRGGBB or explicit null/);

  const wrongLength = projectWithFrames();
  wrongLength.activeFrameId = "f2";
  wrongLength.cels.find(cel => cel.layerId === "base" && cel.frameId === "f2").pixels.pop();
  assert.throws(() => Adapter.buildRendererState(wrongLength), /exactly width/);

  const malformed = projectWithFrames();
  malformed.activeFrameId = "f2";
  malformed.cels.find(cel => cel.layerId === "base" && cel.frameId === "f2").pixels[0] = "transparent";
  assert.throws(() => Adapter.buildRendererState(malformed), /#RRGGBB or explicit null/);
});

test("forwards overlay configuration without adding it to the structural revision", () => {
  const project = projectWithFrames();
  const base = Adapter.buildRendererState(project);
  const withOverlay = Adapter.buildRendererState(project, {
    grid: true,
    gridColor: "rgba(0,0,0,0.2)",
    selection: { x: 0, y: 0, width: 1, height: 1 },
    selectionColor: "#ff00ff"
  });
  assert.equal(withOverlay.grid, true);
  assert.equal(withOverlay.gridColor, "rgba(0,0,0,0.2)");
  assert.deepEqual(withOverlay.selection, { x: 0, y: 0, width: 1, height: 1 });
  assert.equal(withOverlay.selectionColor, "#ff00ff");
  assert.equal(withOverlay.compositeRevision, base.compositeRevision);
});

test("returns fresh output buffers and does not mutate project cels or layer state", () => {
  const project = projectWithFrames();
  const before = JSON.stringify(project);
  const first = Adapter.buildRendererState(project);
  const second = Adapter.buildRendererState(project);
  first.pixels[0] = "#000000";
  assert.equal(JSON.stringify(project), before);
  assert.deepEqual(second.pixels, ["#ff0000", null]);
});
