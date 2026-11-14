"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Guard = require("../js/layer-edit-guard.js");

function makeProject() {
  const layer = { id: "layer-active", name: "Layer 1", visible: true, locked: false };
  const frame = { id: "frame-active", name: "Frame 1" };
  return {
    format: "one-pixel-studio",
    version: 2,
    canvas: { width: 3, height: 2 },
    layers: [layer],
    frames: [frame],
    cels: [{ layerId: layer.id, frameId: frame.id, pixels: Array(6).fill(null) }],
    activeLayerId: layer.id,
    activeFrameId: frame.id
  };
}

test("resolves the active visible, unlocked layer and its existing cel", () => {
  const project = makeProject();
  const result = Guard.resolveEditableTarget(project);

  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.equal(result.layerId, project.activeLayerId);
  assert.equal(result.frameId, project.activeFrameId);
  assert.equal(result.layer, project.layers[0]);
  assert.equal(result.cel, project.cels[0]);
});

test("accepts an explicit ID for the active layer and frame", () => {
  const project = makeProject();
  const result = Guard.resolveEditableTarget(project, {
    layerId: project.activeLayerId,
    frameId: project.activeFrameId
  });
  assert.equal(result.ok, true);
});

test("rejects a target layer that does not exist", () => {
  const project = makeProject();
  project.activeLayerId = "missing-layer";

  const result = Guard.resolveEditableTarget(project);
  assert.equal(result.ok, false);
  assert.equal(result.reason, Guard.REASONS.LAYER_NOT_FOUND);
});

test("rejects hidden layers with a specific denial reason", () => {
  const project = makeProject();
  project.layers[0].visible = false;

  const result = Guard.resolveEditableTarget(project);
  assert.equal(result.ok, false);
  assert.equal(result.reason, Guard.REASONS.LAYER_HIDDEN);
});

test("rejects locked layers with a specific denial reason", () => {
  const project = makeProject();
  project.layers[0].locked = true;

  const result = Guard.resolveEditableTarget(project);
  assert.equal(result.ok, false);
  assert.equal(result.reason, Guard.REASONS.LAYER_LOCKED);
});

test("rejects an existing but inactive layer ID", () => {
  const project = makeProject();
  const inactive = { id: "layer-inactive", name: "Inactive", visible: true, locked: false };
  project.layers.push(inactive);
  project.cels.push({ layerId: inactive.id, frameId: project.activeFrameId, pixels: Array(6).fill(null) });

  const result = Guard.resolveEditableTarget(project, { layerId: inactive.id });
  assert.equal(result.ok, false);
  assert.equal(result.reason, Guard.REASONS.LAYER_NOT_ACTIVE);
});

test("rejects a target whose active cel is missing instead of creating it", () => {
  const project = makeProject();
  project.cels.length = 0;

  const result = Guard.resolveEditableTarget(project);
  assert.equal(result.ok, false);
  assert.equal(result.reason, Guard.REASONS.CEL_NOT_FOUND);
  assert.equal(project.cels.length, 0);
});

test("rejects malformed documents and malformed target pixel buffers", () => {
  assert.equal(Guard.resolveEditableTarget(null).reason, Guard.REASONS.PROJECT_INVALID);
  assert.equal(Guard.resolveEditableTarget({}).reason, Guard.REASONS.PROJECT_INVALID);

  const badFormat = makeProject();
  badFormat.format = "other-editor";
  assert.equal(Guard.resolveEditableTarget(badFormat).reason, Guard.REASONS.PROJECT_INVALID);

  const badCanvas = makeProject();
  badCanvas.canvas.width = 0;
  assert.equal(Guard.resolveEditableTarget(badCanvas).reason, Guard.REASONS.PROJECT_INVALID);

  const badLayer = makeProject();
  delete badLayer.layers[0].visible;
  assert.equal(Guard.resolveEditableTarget(badLayer).reason, Guard.REASONS.LAYER_METADATA_INVALID);

  const badCel = makeProject();
  badCel.cels[0].pixels.pop();
  assert.equal(Guard.resolveEditableTarget(badCel).reason, Guard.REASONS.CEL_INVALID);
});

test("rejects duplicate target cels rather than choosing one", () => {
  const project = makeProject();
  project.cels.push({
    layerId: project.activeLayerId,
    frameId: project.activeFrameId,
    pixels: Array(6).fill(null)
  });

  const result = Guard.resolveEditableTarget(project);
  assert.equal(result.reason, Guard.REASONS.CEL_AMBIGUOUS);
});

test("assert helper throws an error carrying the structured denial code", () => {
  const project = makeProject();
  project.layers[0].locked = true;

  assert.throws(() => Guard.assertEditableTarget(project), error => {
    assert.equal(error.name, "LayerEditDeniedError");
    assert.equal(error.code, Guard.REASONS.LAYER_LOCKED);
    assert.equal(error.reason, Guard.REASONS.LAYER_LOCKED);
    assert.equal(error.layerId, project.activeLayerId);
    return true;
  });
});
