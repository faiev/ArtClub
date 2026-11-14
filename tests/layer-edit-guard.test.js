"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Guard = require("../js/layer-edit-guard.js");

function makeProject() {
  const layer = { id: "layer-active", name: "Layer 1", visible: true, locked: false, opacity: 1 };
  const frame = { id: "frame-active", name: "Frame 1", durationMs: 100 };
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

test("rejects sparse cel pixel holes without mutating the project", () => {
  const project = makeProject();
  project.cels[0].pixels[0] = "#123456";
  delete project.cels[0].pixels[1];
  const pixelsBefore = project.cels[0].pixels.slice();
  const keysBefore = Object.keys(project.cels[0].pixels);

  const result = Guard.resolveEditableTarget(project);

  assert.equal(result.ok, false);
  assert.equal(result.reason, Guard.REASONS.CEL_INVALID);
  assert.deepEqual(project.cels[0].pixels, pixelsBefore);
  assert.deepEqual(Object.keys(project.cels[0].pixels), keysBefore);
});

test("rejects explicit undefined cel pixels without mutating the project", () => {
  const project = makeProject();
  project.cels[0].pixels[1] = undefined;
  const pixelsBefore = project.cels[0].pixels.slice();
  const keysBefore = Object.keys(project.cels[0].pixels);

  const result = Guard.resolveEditableTarget(project);

  assert.equal(result.ok, false);
  assert.equal(result.reason, Guard.REASONS.CEL_INVALID);
  assert.deepEqual(project.cels[0].pixels, pixelsBefore);
  assert.deepEqual(Object.keys(project.cels[0].pixels), keysBefore);
});

test("rejects malformed HEX pixels without mutating the project", () => {
  const project = makeProject();
  project.cels[0].pixels[0] = "#12345g";
  const before = JSON.stringify(project);

  const result = Guard.resolveEditableTarget(project);

  assert.equal(result.ok, false);
  assert.equal(result.reason, Guard.REASONS.CEL_INVALID);
  assert.equal(JSON.stringify(project), before);
});

test("accepts explicit null and valid HEX cel pixel values", () => {
  const project = makeProject();
  project.cels[0].pixels = [null, "#123456", null, "#abcdef", null, "#000000"];

  const result = Guard.resolveEditableTarget(project);

  assert.equal(result.ok, true);
  assert.equal(result.reason, null);
  assert.deepEqual(project.cels[0].pixels, [null, "#123456", null, "#abcdef", null, "#000000"]);
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


test("rejects zero-opacity target layers", () => {
  const project = makeProject();
  project.layers[0].opacity = 0;
  const before = JSON.stringify(project);

  const result = Guard.resolveEditableTarget(project);

  assert.equal(result.reason, Guard.REASONS.LAYER_ZERO_OPACITY);
  assert.equal(JSON.stringify(project), before);
});

test("rejects malformed layer opacity and metadata", () => {
  const values = [-0.01, 1.01, NaN, Infinity, "1", undefined];
  for (const opacity of values) {
    const project = makeProject();
    project.layers[0].opacity = opacity;
    assert.equal(
      Guard.resolveEditableTarget(project).reason,
      Guard.REASONS.LAYER_METADATA_INVALID,
      "opacity " + String(opacity) + " should be rejected"
    );
  }
  const unnamed = makeProject();
  unnamed.layers[0].name = "  ";
  assert.equal(Guard.resolveEditableTarget(unnamed).reason, Guard.REASONS.LAYER_METADATA_INVALID);
});

test("rejects malformed target frame metadata", () => {
  const project = makeProject();
  project.frames[0].durationMs = 0;
  assert.equal(Guard.resolveEditableTarget(project).reason, Guard.REASONS.FRAME_METADATA_INVALID);
});

test("rejects duplicate active layer and frame IDs", () => {
  const duplicateLayer = makeProject();
  duplicateLayer.layers.push({ ...duplicateLayer.layers[0] });
  assert.equal(Guard.resolveEditableTarget(duplicateLayer).reason, Guard.REASONS.LAYER_AMBIGUOUS);

  const duplicateFrame = makeProject();
  duplicateFrame.frames.push({ ...duplicateFrame.frames[0] });
  assert.equal(Guard.resolveEditableTarget(duplicateFrame).reason, Guard.REASONS.FRAME_AMBIGUOUS);
});

test("accepts matching project, frame and composite revisions", () => {
  const project = makeProject();
  const revisions = { project: 12, frame: 3, composite: 9 };
  const result = Guard.resolveEditableTarget(project, {
    expectedRevisions: revisions,
    currentRevisions: { ...revisions }
  });
  assert.equal(result.ok, true);
});

test("rejects stale project revision", () => {
  const project = makeProject();
  const result = Guard.resolveEditableTarget(project, {
    expectedRevisions: { project: 4, frame: 2, composite: 7 },
    currentRevisions: { project: 5, frame: 2, composite: 7 }
  });
  assert.equal(result.reason, Guard.REASONS.PROJECT_REVISION_STALE);
});

test("rejects stale frame revision", () => {
  const project = makeProject();
  const result = Guard.resolveEditableTarget(project, {
    expectedRevisions: { project: 4, frame: 2, composite: 7 },
    currentRevisions: { project: 4, frame: 3, composite: 7 }
  });
  assert.equal(result.reason, Guard.REASONS.FRAME_REVISION_STALE);
});

test("rejects stale composite revision", () => {
  const project = makeProject();
  const result = Guard.resolveEditableTarget(project, {
    expectedRevisions: { project: 4, frame: 2, composite: 7 },
    currentRevisions: { project: 4, frame: 2, composite: 8 }
  });
  assert.equal(result.reason, Guard.REASONS.COMPOSITE_REVISION_STALE);
});

test("rejects incomplete or malformed revision contexts", () => {
  const project = makeProject();
  assert.equal(
    Guard.resolveEditableTarget(project, { expectedRevisions: { project: 1, frame: 1, composite: 1 } }).reason,
    Guard.REASONS.REVISION_CONTEXT_INVALID
  );
  assert.equal(
    Guard.resolveEditableTarget(project, {
      expectedRevisions: { project: 1, frame: 1, composite: 1 },
      currentRevisions: { project: 1, frame: -1, composite: 1 }
    }).reason,
    Guard.REASONS.REVISION_CONTEXT_INVALID
  );
  assert.equal(
    Guard.resolveEditableTarget(project, {
      expectedRevisions: [],
      currentRevisions: {}
    }).reason,
    Guard.REASONS.REVISION_CONTEXT_INVALID
  );
});

test("accepts absent and valid in-canvas selections", () => {
  const project = makeProject();
  assert.equal(Guard.resolveEditableTarget(project, { selection: null }).ok, true);
  assert.equal(Guard.resolveEditableTarget(project, {
    selection: { x: 1, y: 0, width: 2, height: 2 }
  }).ok, true);
});

test("rejects malformed, empty, fractional and out-of-bounds selections", () => {
  const invalidSelections = [
    {},
    { x: 0, y: 0, width: 0, height: 1 },
    { x: 0, y: 0, width: 1, height: -1 },
    { x: 0.5, y: 0, width: 1, height: 1 },
    { x: -1, y: 0, width: 1, height: 1 },
    { x: 0, y: -1, width: 1, height: 1 },
    { x: 2, y: 0, width: 2, height: 1 },
    { x: 0, y: 1, width: 1, height: 2 },
    "not-a-selection"
  ];
  for (const selection of invalidSelections) {
    const project = makeProject();
    const before = JSON.stringify(project);
    const result = Guard.resolveEditableTarget(project, { selection });
    assert.equal(result.reason, Guard.REASONS.SELECTION_INVALID);
    assert.equal(JSON.stringify(project), before);
  }
});

test("enforces the canvas dimension ceiling and accepts the maximum canvas", () => {
  const oversized = makeProject();
  oversized.canvas.width = Guard.LIMITS.maxDimension + 1;
  assert.equal(Guard.resolveEditableTarget(oversized).reason, Guard.REASONS.CANVAS_SIZE_INVALID);

  const maxSize = makeProject();
  maxSize.canvas.width = Guard.LIMITS.maxDimension;
  maxSize.canvas.height = Guard.LIMITS.maxDimension;
  maxSize.cels[0].pixels = Array(Guard.LIMITS.maxCanvasPixels).fill(null);
  assert.equal(Guard.resolveEditableTarget(maxSize).ok, true);
});
