"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const SafeEdit = require("../js/safe-edit-operations.js");
const Guard = require("../js/layer-edit-guard.js");

function makeProject() {
  const layer = { id: "layer-active", name: "Layer 1", visible: true, locked: false, opacity: 1 };
  const frame = { id: "frame-active", name: "Frame 1", durationMs: 100 };
  return {
    format: "one-pixel-studio",
    version: 2,
    id: "project-1",
    name: "Fixture",
    canvas: { width: 3, height: 2, background: null },
    palette: ["#112233"],
    selectedColorIndex: 0,
    layers: [layer],
    frames: [frame],
    cels: [{
      layerId: layer.id,
      frameId: frame.id,
      pixels: ["#112233", null, null, null, "#112233", null]
    }],
    activeLayerId: layer.id,
    activeFrameId: frame.id,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
}

test("clears the active cel immutably when no selection is supplied", () => {
  const project = makeProject();
  const before = JSON.stringify(project);
  const result = SafeEdit.clearActiveCel(project);

  assert.equal(result.ok, true);
  assert.deepEqual(result.project.cels[0].pixels, Array(6).fill(null));
  assert.equal(result.changedPixels, 2);
  assert.equal(JSON.stringify(project), before);
  assert.notEqual(result.project, project);
  assert.notEqual(result.project.cels[0], project.cels[0]);
  assert.notEqual(result.project.cels[0].pixels, project.cels[0].pixels);
});

test("clears only pixels inside a validated selection", () => {
  const project = makeProject();
  const result = SafeEdit.clearActiveCel(project, {
    selection: { x: 0, y: 0, width: 2, height: 1 }
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.project.cels[0].pixels, [null, null, null, null, "#112233", null]);
  assert.deepEqual(project.cels[0].pixels, ["#112233", null, null, null, "#112233", null]);
});

test("applies a valid pixel patch batch immutably", () => {
  const project = makeProject();
  const result = SafeEdit.applyPixelPatches(project, [
    { x: 1, y: 0, color: "#abcdef" },
    { x: 2, y: 1, color: null }
  ]);

  assert.equal(result.ok, true);
  assert.deepEqual(result.project.cels[0].pixels, ["#112233", "#abcdef", null, null, "#112233", null]);
  assert.equal(result.changedPixels, 1);
  assert.deepEqual(project.cels[0].pixels, ["#112233", null, null, null, "#112233", null]);
});

test("rejects malformed patch batches before producing a new project", () => {
  const project = makeProject();
  const before = JSON.stringify(project);
  const invalid = [
    null,
    [{ x: 0, y: 0, color: "red" }],
    [{ x: 0.5, y: 0, color: "#123456" }],
    [{ x: 0, y: 0, color: undefined }],
    [{ x: 0, y: 0, color: "#12345g" }]
  ];
  for (const patches of invalid) {
    const result = SafeEdit.applyPixelPatches(project, patches);
    assert.equal(result.ok, false);
    assert.equal(result.reason, SafeEdit.REASONS.PATCHES_INVALID);
    assert.equal(JSON.stringify(project), before);
  }
});

test("rejects out-of-bounds and duplicate pixel patches without mutation", () => {
  const project = makeProject();
  const before = JSON.stringify(project);
  const outOfBounds = SafeEdit.applyPixelPatches(project, [{ x: 3, y: 0, color: "#ffffff" }]);
  assert.equal(outOfBounds.reason, SafeEdit.REASONS.PATCH_OUT_OF_BOUNDS);
  const duplicate = SafeEdit.applyPixelPatches(project, [
    { x: 1, y: 1, color: "#ffffff" },
    { x: 1, y: 1, color: "#000000" }
  ]);
  assert.equal(duplicate.reason, SafeEdit.REASONS.PATCHES_INVALID);
  assert.equal(JSON.stringify(project), before);
});

test("constrains patch coordinates to the supplied selection", () => {
  const project = makeProject();
  const result = SafeEdit.applyPixelPatches(project, [
    { x: 2, y: 1, color: "#ffffff" }
  ], { selection: { x: 0, y: 0, width: 2, height: 2 } });

  assert.equal(result.reason, SafeEdit.REASONS.PATCH_OUTSIDE_SELECTION);
  assert.deepEqual(project.cels[0].pixels, ["#112233", null, null, null, "#112233", null]);
});

test("rejects hidden, locked, zero-opacity and non-active targets before changing pixels", () => {
  const cases = [
    { change: layer => { layer.visible = false; }, reason: Guard.REASONS.LAYER_HIDDEN },
    { change: layer => { layer.locked = true; }, reason: Guard.REASONS.LAYER_LOCKED },
    { change: layer => { layer.opacity = 0; }, reason: Guard.REASONS.LAYER_ZERO_OPACITY }
  ];
  for (const item of cases) {
    const project = makeProject();
    item.change(project.layers[0]);
    const before = JSON.stringify(project);
    const result = SafeEdit.clearActiveCel(project);
    assert.equal(result.reason, item.reason);
    assert.equal(JSON.stringify(project), before);
  }

  const project = makeProject();
  const otherLayer = { id: "layer-other", name: "Other", visible: true, locked: false, opacity: 1 };
  project.layers.push(otherLayer);
  project.cels.push({ layerId: otherLayer.id, frameId: project.activeFrameId, pixels: Array(6).fill(null) });
  const before = JSON.stringify(project);
  const result = SafeEdit.applyPixelPatches(project, [{ x: 0, y: 0, color: "#ffffff" }], {
    layerId: otherLayer.id
  });
  assert.equal(result.reason, Guard.REASONS.LAYER_NOT_ACTIVE);
  assert.equal(JSON.stringify(project), before);
});

test("rejects stale project/frame/composite revisions before editing", () => {
  const project = makeProject();
  const result = SafeEdit.clearActiveCel(project, {
    expectedRevisions: { project: 1, frame: 2, composite: 3 },
    currentRevisions: { project: 1, frame: 2, composite: 4 }
  });
  assert.equal(result.reason, Guard.REASONS.COMPOSITE_REVISION_STALE);
  assert.deepEqual(project.cels[0].pixels, ["#112233", null, null, null, "#112233", null]);
});

test("replaces a cel only after complete buffer validation", () => {
  const project = makeProject();
  const candidate = [null, "#123456", null, "#abcdef", null, "#000000"];
  const result = SafeEdit.replaceActiveCel(project, candidate);

  assert.equal(result.ok, true);
  assert.deepEqual(result.project.cels[0].pixels, candidate);
  assert.deepEqual(candidate, [null, "#123456", null, "#abcdef", null, "#000000"]);
  assert.deepEqual(project.cels[0].pixels, ["#112233", null, null, null, "#112233", null]);
});

test("rejects sparse, undefined, malformed and wrong-length replacement buffers", () => {
  const project = makeProject();
  const sparse = [null, "#123456", null, "#abcdef", null, "#000000"];
  delete sparse[1];
  const candidates = [
    sparse,
    [null, undefined, null, "#abcdef", null, "#000000"],
    [null, "#12345g", null, "#abcdef", null, "#000000"],
    [null, "#123456"]
  ];
  const before = JSON.stringify(project);
  for (const candidate of candidates) {
    const result = SafeEdit.replaceActiveCel(project, candidate);
    assert.equal(result.reason, SafeEdit.REASONS.PIXEL_BUFFER_INVALID);
    assert.equal(JSON.stringify(project), before);
  }
});

test("applies generic algorithm result buffers through the same safe replacement path", () => {
  const project = makeProject();
  const result = SafeEdit.applyResultBuffer(project, Array(6).fill("#778899"));
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.cels[0].pixels, Array(6).fill("#778899"));
});

test("does not expose mutable caller-owned objects through results", () => {
  const project = makeProject();
  const result = SafeEdit.applyPixelPatches(project, [{ x: 2, y: 1, color: "#010203" }]);
  result.project.layers[0].name = "Changed in result";
  result.project.metadata.updatedAt = "changed";

  assert.equal(project.layers[0].name, "Layer 1");
  assert.equal(project.metadata.updatedAt, "2026-01-01T00:00:00.000Z");
});

test("returns a structured denial for projects that cannot be safely cloned", () => {
  const project = makeProject();
  project.metadata.self = project.metadata;
  const result = SafeEdit.clearActiveCel(project);

  assert.equal(result.ok, false);
  assert.equal(result.reason, SafeEdit.REASONS.PROJECT_CLONE_FAILED);
  assert.equal(project.cels[0].pixels[0], "#112233");
});
