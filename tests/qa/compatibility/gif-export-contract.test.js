"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const GIF = require("../../../js/gif-export.js");

function makeProject() {
  const layer = {
    id: "qa-gif-visible",
    name: "Visible",
    visible: true,
    locked: false,
    opacity: 1
  };
  const hiddenLayer = {
    id: "qa-gif-hidden",
    name: "Hidden",
    visible: false,
    locked: false,
    opacity: 1
  };
  const frames = [
    { id: "qa-frame-a", name: "Pose A", durationMs: 95 },
    { id: "qa-frame-b", name: "Pose B", durationMs: 145 },
    { id: "qa-frame-c", name: "Pose C", durationMs: 205 }
  ];

  return {
    format: "one-pixel-studio",
    version: 2,
    id: "qa-gif-project",
    name: "GIF contract fixture",
    canvas: { width: 2, height: 1, background: null },
    palette: ["#112233", "#445566", "#778899", "#abcdef"],
    selectedColorIndex: 0,
    layers: [layer, hiddenLayer],
    frames,
    cels: [
      { layerId: layer.id, frameId: frames[0].id, pixels: ["#112233", null] },
      { layerId: layer.id, frameId: frames[1].id, pixels: ["#445566", "#778899"] },
      { layerId: layer.id, frameId: frames[2].id, pixels: ["#abcdef", null] },
      { layerId: hiddenLayer.id, frameId: frames[0].id, pixels: ["#010101", "#020202"] },
      { layerId: hiddenLayer.id, frameId: frames[1].id, pixels: ["#030303", "#040404"] },
      { layerId: hiddenLayer.id, frameId: frames[2].id, pixels: ["#050505", "#060606"] }
    ],
    activeLayerId: layer.id,
    activeFrameId: frames[0].id,
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  };
}

function snapshot(project) {
  return JSON.stringify(project);
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

test("GIF contract preserves requested frame order and reports source/effective timing", () => {
  const project = makeProject();
  const before = snapshot(project);
  const [frameA, , frameC] = project.frames;

  const result = GIF.encodeGIF(project, {
    frameIds: [frameC.id, frameA.id]
  });

  assert.equal(result.metadata.format, "one-pixel-studio-gif");
  assert.equal(result.metadata.version, GIF.VERSION);
  assert.deepEqual(result.metadata.image, {
    mimeType: "image/gif",
    width: 2,
    height: 1
  });
  assert.equal(result.metadata.frameCount, 2);
  assert.deepEqual(
    result.metadata.frames.map(frame => frame.frameId),
    [frameC.id, frameA.id],
    "requested order must be the encoded playback order"
  );
  assert.deepEqual(
    result.metadata.frames.map(frame => frame.index),
    [0, 1]
  );
  assert.deepEqual(
    result.metadata.frames.map(frame => frame.durationMs),
    [205, 95],
    "metadata must preserve original source durations"
  );
  assert.deepEqual(
    result.metadata.frames.map(frame => frame.encodedDelayCentiseconds),
    [21, 10]
  );
  assert.deepEqual(
    result.metadata.frames.map(frame => frame.effectiveDurationMs),
    [210, 100],
    "effective timing must disclose centisecond rounding"
  );
  assert.equal(result.diagnostics.loopCount, 0);
  assert.equal(result.diagnostics.loopBehavior, "Infinite loop");
  assert.equal(result.diagnostics.totalFramePixels, 4);
  assert.equal(snapshot(project), before, "export must not mutate the source document");
});

test("GIF contract exposes one-shot and finite loop policies without changing frame metadata", () => {
  const project = makeProject();
  const frameIds = project.frames.map(frame => frame.id);

  const oneShot = GIF.encodeGIF(project, { loopCount: null });
  const finite = GIF.encodeGIF(project, { loopCount: 7 });

  assert.equal(oneShot.diagnostics.loopCount, null);
  assert.equal(oneShot.diagnostics.loopBehavior, "No looping extension; play once");
  assert.equal(finite.diagnostics.loopCount, 7);
  assert.equal(finite.diagnostics.loopBehavior, "7 repeat(s)");
  assert.deepEqual(oneShot.metadata.frames.map(frame => frame.frameId), frameIds);
  assert.deepEqual(finite.metadata.frames.map(frame => frame.frameId), frameIds);
});

test("GIF contract reserves transparency and excludes hidden layers by default", () => {
  const project = makeProject();
  const result = GIF.encodeGIF(project, { frameIds: ["qa-frame-c", "qa-frame-a"] });

  assert.equal(result.diagnostics.transparentPixelCount, 2,
    "the two transparent visible-layer pixels must remain transparent");
  assert.match(result.diagnostics.transparency, /reserved fully-transparent palette index/);
  assert.equal(result.diagnostics.paletteMode, "exact",
    "hidden-layer colors must not contaminate the default visible-layer palette");

  const includeHidden = GIF.encodeGIF(project, {
    frameIds: ["qa-frame-c", "qa-frame-a"],
    layerIds: [project.layers[0].id, project.layers[1].id]
  });
  assert.equal(includeHidden.diagnostics.transparentPixelCount, 0,
    "explicitly selected hidden layers should contribute their opaque pixels");
});

test("GIF export returns an image/gif Blob and does not mutate a frozen project", async () => {
  const project = deepFreeze(makeProject());
  const result = GIF.exportGIF(project, { loopCount: null });

  assert.equal(result.blob.type, "image/gif");
  assert.ok(result.blob.size > 30);
  assert.equal(result.metadata.image.mimeType, "image/gif");
  const signature = new Uint8Array(await result.blob.slice(0, 6).arrayBuffer());
  assert.equal(String.fromCharCode(...signature), "GIF89a");
});

test("malformed and oversized selected exports fail without changing the project", () => {
  const malformed = makeProject();
  malformed.cels[0].pixels[0] = "not-hex";
  const malformedBefore = snapshot(malformed);
  assert.throws(() => GIF.encodeGIF(malformed), /Cel pixels must be transparent or valid HEX colors/);
  assert.equal(snapshot(malformed), malformedBefore);

  const width = 512;
  const height = 512;
  const pixels = new Array(width * height).fill("#123456");
  const tooManyFrames = {
    format: "one-pixel-studio",
    version: 2,
    id: "qa-gif-over-budget",
    name: "Over budget",
    canvas: { width, height, background: null },
    palette: ["#123456"],
    selectedColorIndex: 0,
    layers: [{
      id: "qa-gif-over-budget-layer",
      name: "Layer",
      visible: true,
      locked: false,
      opacity: 1
    }],
    frames: [],
    cels: [],
    activeLayerId: "qa-gif-over-budget-layer",
    activeFrameId: "qa-gif-over-budget-frame-1",
    metadata: {}
  };
  for (let index = 0; index < 5; index += 1) {
    const frameId = "qa-gif-over-budget-frame-" + (index + 1);
    tooManyFrames.frames.push({ id: frameId, name: frameId, durationMs: 100 });
    tooManyFrames.cels.push({
      layerId: tooManyFrames.layers[0].id,
      frameId,
      pixels
    });
  }
  const before = snapshot(tooManyFrames);
  assert.throws(() => GIF.encodeGIF(tooManyFrames), /too large|Maximum total export pixels/i);
  assert.equal(snapshot(tooManyFrames), before,
    "an oversized export must fail without modifying the project");
});
