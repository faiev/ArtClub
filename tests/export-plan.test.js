/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Planner = require("../js/export-plan.js");

function makeProject() {
  const layer = { id: "layer-1", name: "Layer 1", visible: true, locked: false, opacity: 1 };
  return {
    format: "one-pixel-studio",
    version: 2,
    id: "export-plan-fixture",
    name: "Export plan fixture",
    canvas: { width: 2, height: 2, background: null },
    palette: ["#ff0000", "#00ff00", "#0000ff"],
    selectedColorIndex: 0,
    layers: [layer],
    frames: [
      { id: "f1", name: "Idle", durationMs: 100 },
      { id: "f2", name: "Step", durationMs: 145 },
      { id: "f3", name: "Contact", durationMs: 240 }
    ],
    cels: [
      { layerId: layer.id, frameId: "f1", pixels: ["#ff0000", null, null, null] },
      { layerId: layer.id, frameId: "f2", pixels: [null, "#00ff00", null, null] },
      { layerId: layer.id, frameId: "f3", pixels: [null, null, "#0000ff", null] }
    ],
    activeLayerId: layer.id,
    activeFrameId: "f1",
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
}

function diagCodes(plan) {
  return plan.diagnostics.map(item => item.code);
}

test("plans all GIF frames with centisecond timing, infinite loop and bounded size estimates", () => {
  const project = makeProject();
  const plan = Planner.buildExportPlan(project, { format: "gif" });

  assert.equal(plan.format, "one-pixel-studio-export-plan");
  assert.equal(plan.version, 1);
  assert.equal(plan.outputFormat, "gif");
  assert.equal(plan.projectId, project.id);
  assert.deepEqual(plan.selection, {
    mode: "all", startIndex: null, endIndex: null, frameIds: ["f1", "f2", "f3"]
  });
  assert.deepEqual(plan.timing, {
    policy: "nearest-centisecond", loopCount: 0, loopBehavior: "infinite"
  });
  assert.deepEqual([plan.output.width, plan.output.height, plan.output.frameCount], [2, 2, 3]);
  assert.equal(plan.output.totalFramePixels, 12);
  assert.equal(plan.output.rgbaBufferBytes, 48);
  assert.equal(plan.output.indexedBufferBytes, 12);
  assert.equal(plan.output.estimatedEncodedBytesUpperBound, 1298);
  assert.deepEqual(plan.frames.map(frame => [
    frame.frameId, frame.durationMs, frame.encodedDelayCentiseconds, frame.effectiveDurationMs
  ]), [
    ["f1", 100, 10, 100],
    ["f2", 145, 15, 150],
    ["f3", 240, 24, 240]
  ]);
  assert.ok(diagCodes(plan).includes("GIF_TIMING_ROUNDED"));
  assert.ok(diagCodes(plan).includes("INFINITE_LOOP"));
  assert.ok(diagCodes(plan).includes("GIF_SIZE_ESTIMATE"));
});

test("supports inclusive frame ranges, explicit frame order and loop policy variants", () => {
  const project = makeProject();

  const range = Planner.buildExportPlan(project, {
    format: "gif",
    frameRange: { startIndex: 1, endIndex: 2 },
    loopCount: null
  });
  assert.equal(range.selection.mode, "inclusive-range");
  assert.deepEqual(range.selection.frameIds, ["f2", "f3"]);
  assert.deepEqual([range.selection.startIndex, range.selection.endIndex], [1, 2]);
  assert.equal(range.timing.loopCount, null);
  assert.equal(range.timing.loopBehavior, "play-once");
  assert.ok(diagCodes(range).includes("FRAME_RANGE_SELECTED"));
  assert.ok(diagCodes(range).includes("PLAY_ONCE"));

  const ordered = Planner.buildExportPlan(project, {
    format: "gif",
    frameIds: ["f3", "f1"],
    loopCount: 5
  });
  assert.equal(ordered.selection.mode, "explicit-order");
  assert.deepEqual(ordered.selection.frameIds, ["f3", "f1"]);
  assert.deepEqual(ordered.frames.map(frame => frame.index), [0, 1]);
  assert.equal(ordered.timing.loopCount, 5);
  assert.equal(ordered.timing.loopBehavior, "finite-repeat");
  assert.ok(diagCodes(ordered).includes("EXPLICIT_FRAME_ORDER"));
  assert.ok(diagCodes(ordered).includes("FINITE_LOOP"));
});

test("plans sprite-sheet grid dimensions, frame rectangles, background and memory estimates", () => {
  const project = makeProject();
  const plan = Planner.buildExportPlan(project, {
    format: "sprite-sheet",
    frameIds: ["f3", "f1", "f2"],
    layout: "grid",
    columns: 2,
    rows: 2,
    margin: 1,
    spacing: 1,
    backgroundColor: "#123456"
  });

  assert.equal(plan.outputFormat, "sprite-sheet");
  assert.deepEqual(plan.selection.frameIds, ["f3", "f1", "f2"]);
  assert.deepEqual(plan.layout, {
    type: "grid",
    columns: 2,
    rows: 2,
    margin: 1,
    spacing: 1,
    backgroundColor: "#123456",
    unusedCells: 1
  });
  assert.deepEqual([plan.output.width, plan.output.height, plan.output.outputPixels], [7, 7, 49]);
  assert.equal(plan.output.rgbaBufferBytes, 196);
  assert.equal(plan.output.totalFramePixels, 12);
  assert.equal(plan.output.indexedBufferBytes, null);
  assert.deepEqual(plan.frames.map(frame => [frame.frameId, frame.x, frame.y, frame.durationMs]), [
    ["f3", 1, 1, 240],
    ["f1", 4, 1, 100],
    ["f2", 1, 4, 145]
  ]);
  assert.ok(diagCodes(plan).includes("EXPLICIT_FRAME_ORDER"));
  assert.ok(diagCodes(plan).includes("GRID_UNUSED_CELLS"));
  assert.ok(diagCodes(plan).includes("SPRITE_SHEET_SIZE_ESTIMATE"));
});

test("supports row-first and vertical sprite-sheet planning", () => {
  const project = makeProject();
  const rowsFirst = Planner.buildExportPlan(project, {
    format: "sprite-sheet",
    layout: "grid",
    rows: 2
  });
  assert.deepEqual([rowsFirst.layout.columns, rowsFirst.layout.rows], [2, 2]);
  assert.deepEqual(rowsFirst.frames.map(frame => [frame.x, frame.y]), [[0, 0], [2, 0], [0, 2]]);

  const vertical = Planner.buildExportPlan(project, {
    format: "sprite-sheet",
    layout: "vertical",
    margin: 1,
    spacing: 2
  });
  assert.deepEqual([vertical.output.width, vertical.output.height], [4, 10]);
  assert.deepEqual(vertical.frames.map(frame => [frame.x, frame.y]), [[1, 1], [1, 5], [1, 9]]);
});

test("serializes a stable JSON manifest with source selection and diagnostics", () => {
  const plan = Planner.buildExportPlan(makeProject(), {
    format: "sprite-sheet",
    frameRange: { startIndex: 0, endIndex: 1 },
    layout: "horizontal"
  });
  const serialized = Planner.serializeExportPlan(plan);
  const restored = JSON.parse(serialized);
  assert.deepEqual(restored, plan);
  assert.equal(restored.selection.mode, "inclusive-range");
  assert.deepEqual(restored.selection.frameIds, ["f1", "f2"]);
  assert.equal(typeof restored.diagnostics[0].code, "string");
  assert.throws(() => Planner.serializeExportPlan({ format: "wrong", version: 1 }), /version 1 export plan/);
});

test("does not mutate the input project while producing either plan", () => {
  const project = makeProject();
  const before = JSON.stringify(project);
  Planner.buildExportPlan(project, { format: "gif", frameIds: ["f2", "f1"] });
  Planner.buildExportPlan(project, { format: "sprite-sheet", layout: "grid", rows: 2 });
  assert.equal(JSON.stringify(project), before);
});

test("rejects invalid frame selection, range, output format and cross-format options", () => {
  const project = makeProject();
  assert.throws(() => Planner.buildExportPlan(project, { format: "gif", frameIds: [] }), /non-empty array/);
  assert.throws(() => Planner.buildExportPlan(project, { format: "gif", frameIds: ["missing"] }), /Unknown frame ID/);
  assert.throws(() => Planner.buildExportPlan(project, { format: "gif", frameIds: ["f1", "f1"] }), /cannot contain duplicates/);
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "gif", frameIds: ["f1"], frameRange: { startIndex: 0, endIndex: 0 }
  }), /either frameIds or frameRange/);
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "gif", frameRange: { startIndex: 2, endIndex: 1 }
  }), /cannot be after endIndex/);
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "gif", frameRange: { startIndex: -1, endIndex: 1 }
  }), /startIndex/);
  assert.throws(() => Planner.buildExportPlan(project, { format: "apng" }), /format must be gif or sprite-sheet/);
  assert.throws(() => Planner.buildExportPlan(project, { format: "gif", layout: "grid" }), /layout options cannot be used with GIF/);
  assert.throws(() => Planner.buildExportPlan(project, { format: "sprite-sheet", loopCount: 3 }), /loop and output-byte options/);
  assert.throws(() => Planner.buildExportPlan(project, { format: "gif", timingPolicy: "preserve-ms" }), /nearest-centisecond/);
  assert.throws(() => Planner.buildExportPlan(project, { format: "sprite-sheet", timingPolicy: "rounded" }), /preserve-source-ms/);
});

test("rejects invalid GIF and sprite-sheet budgets before planning output", () => {
  const project = makeProject();
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "gif", loopCount: 65536
  }), /Loop count/);
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "gif", maxTotalFramePixels: Planner.MAX_GIF_TOTAL_FRAME_PIXELS + 1
  }), /Maximum total GIF frame pixels/);
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "gif", maxBytes: 1024
  }), /encoded-byte budget estimate/);
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "sprite-sheet", maxPixels: 48, margin: 1, spacing: 1, layout: "grid", columns: 2
  }), /output pixel budget/);
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "sprite-sheet", maxPixels: Planner.MAX_SPRITE_SHEET_PIXELS + 1
  }), /Maximum sprite-sheet pixels/);
  assert.throws(() => Planner.buildExportPlan(project, {
    format: "sprite-sheet", layout: "grid", rows: 1, columns: 1
  }), /at least one cell/);
});

test("rejects malformed project structures and sparse cel pixel arrays", () => {
  const project = makeProject();
  const invalidVersion = structuredClone(project);
  invalidVersion.version = 1;
  assert.throws(() => Planner.buildExportPlan(invalidVersion, { format: "gif" }), /version 2/);

  const sparsePixels = structuredClone(project);
  delete sparsePixels.cels[0].pixels[0];
  assert.throws(() => Planner.buildExportPlan(sparsePixels, { format: "gif" }), /valid #RRGGBB/);

  const missingCel = structuredClone(project);
  delete missingCel.cels[0];
  assert.throws(() => Planner.buildExportPlan(missingCel, { format: "gif" }), /reference an existing layer and frame/);

  const sparseFrames = structuredClone(project);
  delete sparseFrames.frames[0];
  assert.throws(() => Planner.buildExportPlan(sparseFrames, { format: "gif" }), /Frame IDs/);

  const badDuration = structuredClone(project);
  badDuration.frames[0].durationMs = 5;
  assert.throws(() => Planner.buildExportPlan(badDuration, { format: "gif" }), /Frame duration/);
});

test("rejects GIF selection beyond the hard frame-pixel budget", () => {
  const width = 512;
  const height = 512;
  const frameCount = 5;
  const layer = { id: "layer-1", name: "Layer 1", visible: true, locked: false, opacity: 1 };
  const pixels = new Array(width * height).fill(null);
  const project = {
    format: "one-pixel-studio",
    version: 2,
    id: "oversized-plan",
    name: "Oversized plan",
    canvas: { width, height, background: null },
    layers: [layer],
    frames: Array.from({ length: frameCount }, (_, index) => ({
      id: "f" + index, name: "Frame " + index, durationMs: 100
    })),
    cels: Array.from({ length: frameCount }, (_, index) => ({
      layerId: layer.id, frameId: "f" + index, pixels: pixels
    }))
  };
  assert.throws(() => Planner.buildExportPlan(project, { format: "gif" }), /selected-frame pixel budget/);
});
