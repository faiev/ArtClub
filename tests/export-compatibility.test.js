/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const GIF = require("../js/gif-export.js");
const Sprite = require("../js/sprite-sheet-export.js");

function makeProject(options = {}) {
  const width = options.width || 2;
  const height = options.height || 2;
  const layer = { id: "layer-1", name: "Layer 1", visible: true, locked: false, opacity: 1 };
  const frames = options.frames || [
    { id: "f1", name: "Idle", durationMs: 100 },
    { id: "f2", name: "Step", durationMs: 145 },
    { id: "f3", name: "Contact", durationMs: 155 }
  ];
  return {
    format: "one-pixel-studio",
    version: 2,
    id: "export-compatibility-fixture",
    name: "Export compatibility fixture",
    canvas: { width, height, background: null },
    palette: ["#123456", "#abcdef", "#ff0000"],
    selectedColorIndex: 0,
    layers: options.layers || [layer],
    frames: frames,
    cels: options.cels || [],
    activeLayerId: layer.id,
    activeFrameId: frames[0] && frames[0].id,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
}

function rgbaAt(sheet, x, y) {
  const offset = (y * sheet.width + x) * 4;
  return Array.from(sheet.rgba.slice(offset, offset + 4));
}

function makeColor(index) {
  const red = index & 255;
  const green = (index >>> 8) & 255;
  const blue = (index * 17) & 255;
  return "#" + [red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("");
}

function makeSeededOverflowColors() {
  const pixels = ["#222799"];
  const seenBuckets = new Set([((0x22 >>> 3) << 10) | ((0x27 >>> 3) << 5) | (0x99 >>> 3)]);
  let state = 13;
  while (pixels.length < 257) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const red = (state >>> 24) & 255;
    const green = (state >>> 16) & 255;
    const blue = (state >>> 8) & 255;
    const bucket = ((red >>> 3) << 10) | ((green >>> 3) << 5) | (blue >>> 3);
    if (seenBuckets.has(bucket)) continue;
    seenBuckets.add(bucket);
    pixels.push("#" + [red, green, blue].map(value => value.toString(16).padStart(2, "0")).join(""));
  }
  assert.equal(pixels[58], "#d2384e");
  return pixels;
}

test("transparent, empty and missing cels retain the same blank-pixel semantics", () => {
  const layerId = "layer-1";
  const project = makeProject({
    frames: [
      { id: "opaque", name: "Opaque", durationMs: 100 },
      { id: "empty", name: "Empty cel", durationMs: 145 },
      { id: "missing", name: "Missing cel", durationMs: 155 }
    ],
    cels: [
      { layerId, frameId: "opaque", pixels: ["#123456", null, null, null] },
      { layerId, frameId: "empty", pixels: [null, null, null, null] }
      // The "missing" frame intentionally has no cel.
    ]
  });

  const sheet = Sprite.buildSpriteSheet(project, {
    layout: "horizontal",
    backgroundColor: null
  });
  assert.deepEqual(rgbaAt(sheet, 0, 0), [18, 52, 86, 255]);
  assert.deepEqual(rgbaAt(sheet, 1, 0), [0, 0, 0, 0]);
  assert.deepEqual(rgbaAt(sheet, 2, 0), [0, 0, 0, 0]);
  assert.deepEqual(rgbaAt(sheet, 4, 0), [0, 0, 0, 0]);
  assert.deepEqual(sheet.frames.map(frame => frame.frameId), ["opaque", "empty", "missing"]);

  const gif = GIF.encodeGIF(project);
  assert.equal(gif.metadata.frameCount, 3);
  assert.equal(gif.diagnostics.transparentPixelCount, 11);
  assert.deepEqual(gif.metadata.frames.map(frame => frame.durationMs), [100, 145, 155]);
});

test("accepts the 512×512 source boundary for PNG and GIF without resampling", () => {
  const width = 512;
  const height = 512;
  const pixels = new Array(width * height).fill(null);
  pixels[0] = "#123456";
  pixels[pixels.length - 1] = "#abcdef";
  const project = makeProject({
    width,
    height,
    frames: [{ id: "max", name: "Maximum canvas", durationMs: 100 }],
    cels: [{ layerId: "layer-1", frameId: "max", pixels }]
  });

  const sheet = Sprite.buildSpriteSheet(project);
  assert.deepEqual([sheet.width, sheet.height], [512, 512]);
  assert.equal(sheet.rgba.length, 512 * 512 * 4);
  assert.deepEqual(rgbaAt(sheet, 0, 0), [18, 52, 86, 255]);
  assert.deepEqual(rgbaAt(sheet, 511, 511), [171, 205, 239, 255]);

  const gif = GIF.encodeGIF(project);
  assert.deepEqual([gif.metadata.image.width, gif.metadata.image.height], [512, 512]);
  assert.equal(gif.diagnostics.totalFramePixels, 512 * 512);
});

test("supports the 256-frame limit and preserves timing/metadata across both formats", () => {
  const frames = Array.from({ length: 256 }, (_, index) => ({
    id: "f" + index,
    name: "Frame " + index,
    durationMs: index === 0 ? 145 : (index === 1 ? 155 : 100)
  }));
  const project = makeProject({
    width: 1,
    height: 1,
    frames,
    cels: []
  });

  const gif = GIF.encodeGIF(project, { loopCount: null });
  assert.equal(gif.metadata.frameCount, 256);
  assert.equal(gif.metadata.frames[0].encodedDelayCentiseconds, 15);
  assert.equal(gif.metadata.frames[0].effectiveDurationMs, 150);
  assert.equal(gif.metadata.frames[1].encodedDelayCentiseconds, 16);
  assert.equal(gif.metadata.frames[1].effectiveDurationMs, 160);
  assert.equal(gif.diagnostics.loopCount, null);

  const sheet = Sprite.buildSpriteSheet(project, {
    layout: "grid",
    columns: 16,
    rows: 16
  });
  assert.deepEqual([sheet.width, sheet.height, sheet.frameCount], [16, 16, 256]);
  assert.deepEqual([sheet.frames[255].index, sheet.frames[255].frameId, sheet.frames[255].x, sheet.frames[255].y], [
    255, "f255", 15, 15
  ]);
  const metadata = Sprite.buildMetadata(sheet, "256-frame-atlas.png");
  const roundTrip = JSON.parse(JSON.stringify(metadata));
  assert.deepEqual(roundTrip, metadata);
  assert.equal(roundTrip.frames.length, 256);
  assert.equal(roundTrip.frames[0].durationMs, 145);
  assert.equal(roundTrip.frames[1].durationMs, 155);
});

test("keeps median-cut palette overflow and deterministic source colors represented", () => {
  const pixels = makeSeededOverflowColors();
  const project = makeProject({
    width: 257,
    height: 1,
    frames: [{ id: "overflow", name: "257 colors", durationMs: 100 }],
    cels: [{ layerId: "layer-1", frameId: "overflow", pixels }]
  });
  const encoded = GIF.encodeGIF(project);
  assert.equal(encoded.diagnostics.paletteMode, "median-cut");
  assert.ok(encoded.diagnostics.opaquePaletteColors <= 256);
  assert.equal(encoded.metadata.frames[0].frameId, "overflow");
  assert.ok(encoded.bytes.length > 30 && encoded.bytes.length <= GIF.MAX_GIF_BYTES);
  assert.match(encoded.diagnostics.quantization, /exact nearest palette entry/);
});

test("rejects GIF and sprite-sheet over-budget projects before allocating output rasters", () => {
  const gifFrames = Array.from({ length: 5 }, (_, index) => ({
    id: "g" + index,
    name: "GIF " + index,
    durationMs: 100
  }));
  const gifProject = makeProject({
    width: 512,
    height: 512,
    frames: gifFrames,
    cels: []
  });
  assert.throws(() => GIF.encodeGIF(gifProject), /too large|Maximum total export pixels/i);

  const spriteFrames = Array.from({ length: 256 }, (_, index) => ({
    id: "s" + index,
    name: "Sheet " + index,
    durationMs: 100
  }));
  const spriteProject = makeProject({
    width: 256,
    height: 256,
    frames: spriteFrames,
    cels: []
  });
  assert.throws(() => Sprite.buildSpriteSheet(spriteProject, {
    layout: "grid",
    columns: 16,
    rows: 17
  }), /too large|pixel budget/i);
});

test("honors a deliberately lowered GIF encoded-byte ceiling", () => {
  let state = 0x12345678;
  const pixels = Array.from({ length: 64 * 64 }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return "#" + [state >>> 24, (state >>> 16) & 255, (state >>> 8) & 255]
      .map(value => (value & 255).toString(16).padStart(2, "0")).join("");
  });
  const project = makeProject({
    width: 64,
    height: 64,
    frames: [{ id: "noise", name: "Noisy frame", durationMs: 100 }],
    cels: [{ layerId: "layer-1", frameId: "noise", pixels }]
  });
  assert.throws(() => GIF.encodeGIF(project, { maxBytes: 1024 }), /Encoded GIF exceeds/);
});

test("rejects sparse frame, layer, cel and pixel arrays before composing output", () => {
  const base = makeProject({
    frames: [{ id: "f1", name: "Frame 1", durationMs: 100 }],
    cels: [{ layerId: "layer-1", frameId: "f1", pixels: ["#123456", null, null, null] }]
  });

  const sparsePixels = structuredClone(base);
  delete sparsePixels.cels[0].pixels[1];
  assert.throws(() => GIF.encodeGIF(sparsePixels), /valid HEX/);
  assert.throws(() => Sprite.buildSpriteSheet(sparsePixels), /valid HEX/);

  const sparseFrames = structuredClone(base);
  sparseFrames.frames = new Array(1);
  assert.throws(() => GIF.encodeGIF(sparseFrames), /Frame IDs/);
  assert.throws(() => Sprite.buildSpriteSheet(sparseFrames), /Frame IDs/);

  const sparseLayers = structuredClone(base);
  sparseLayers.layers = new Array(1);
  assert.throws(() => GIF.encodeGIF(sparseLayers), /Layer IDs/);
  assert.throws(() => Sprite.buildSpriteSheet(sparseLayers), /Layer IDs/);

  const sparseCels = structuredClone(base);
  sparseCels.cels = new Array(1);
  assert.throws(() => GIF.encodeGIF(sparseCels), /Every cel/);
  assert.throws(() => Sprite.buildSpriteSheet(sparseCels), /Every cel/);
});

test("validates the complete sheet structure before metadata or canvas allocation", async () => {
  const project = makeProject({
    frames: [{ id: "f1", name: "Frame 1", durationMs: 100 }],
    cels: []
  });
  const good = Sprite.buildSpriteSheet(project);
  const malformed = {
    ...good,
    rgba: new Uint8ClampedArray(4)
  };

  assert.throws(() => Sprite.buildMetadata(malformed, "broken.png"), /RGBA.*length|buffer length/i);
  let canvasFactoryCalled = false;
  await assert.rejects(Sprite.renderSpriteSheetPNG(malformed, {
    canvasFactory() {
      canvasFactoryCalled = true;
      throw new Error("Canvas should not be requested for malformed sheet data.");
    }
  }), /RGBA.*length|buffer length/i);
  assert.equal(canvasFactoryCalled, false);
});

test("rejects malformed metadata rectangles and frame identities", () => {
  const project = makeProject({
    frames: [{ id: "f1", name: "Frame 1", durationMs: 100 }],
    cels: []
  });
  const sheet = Sprite.buildSpriteSheet(project);

  const badRect = structuredClone(sheet);
  badRect.frames[0].x = badRect.width;
  assert.throws(() => Sprite.buildMetadata(badRect), /frame rectangle|outside sheet/i);

  const badId = structuredClone(sheet);
  badId.frames[0].frameId = "";
  assert.throws(() => Sprite.buildMetadata(badId), /frame ID|identity/i);
});
