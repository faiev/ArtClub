"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Transform = require("../js/pixel-transform.js");

const A = "#AA0000";
const B = "#00BB00";
const C = "#0000CC";
const D = "#DDDD00";
const E = "#EE00EE";
const F = "#00FFFF";

test("horizontal flip mirrors each row without changing dimensions", () => {
  const result = Transform.flipHorizontal([A, B, C, D, E, F], 3, 2);
  assert.deepEqual(result, { pixels: [C, B, A, F, E, D], width: 3, height: 2 });
});

test("vertical flip reverses row order and preserves transparent pixels", () => {
  const result = Transform.flipVertical([A, null, C, D, E, F], 3, 2);
  assert.deepEqual(result, { pixels: [D, E, F, A, null, C], width: 3, height: 2 });
});

test("horizontal and vertical flips compose to a 180-degree reversal", () => {
  const pixels = [A, B, C, D, E, F];
  const horizontal = Transform.flipHorizontal(pixels, 3, 2);
  const both = Transform.flipVertical(horizontal.pixels, 3, 2);
  assert.deepEqual(both, Transform.rotate180(pixels, 3, 2));
});

test("90-degree clockwise rotation swaps non-square dimensions and preserves exact pixels", () => {
  assert.deepEqual(Transform.rotate90([A, B, C, D, E, F], 3, 2), {
    pixels: [D, A, E, B, F, C], width: 2, height: 3
  });
});

test("180-degree rotation preserves dimensions and reverses row-major order", () => {
  assert.deepEqual(Transform.rotate180([A, B, C, D, E, F], 3, 2), {
    pixels: [F, E, D, C, B, A], width: 3, height: 2
  });
});

test("270-degree clockwise rotation swaps dimensions and uses exact inverse orientation", () => {
  assert.deepEqual(Transform.rotate270([A, B, C, D, E, F], 3, 2), {
    pixels: [C, F, B, E, A, D], width: 2, height: 3
  });
  const roundTrip = Transform.rotate270(Transform.rotate90([A, B, C, D, E, F], 3, 2).pixels, 2, 3);
  assert.deepEqual(roundTrip, { pixels: [A, B, C, D, E, F], width: 3, height: 2 });
});

test("rotations preserve transparency and never blend source colors", () => {
  const result = Transform.rotate90([A, null, C, D], 2, 2);
  assert.deepEqual(result.pixels, [C, A, D, null]);
  assert.ok(result.pixels.every(pixel => pixel === null || [A, C, D].includes(pixel)));
});

test("crop copies the requested in-bounds rectangle with row-major order", () => {
  const result = Transform.crop([A, B, C, D, E, F], 3, 2, 1, 0, 2, 2);
  assert.deepEqual(result, { pixels: [B, C, E, F], width: 2, height: 2 });
});

test("crop can return a single transparent pixel without losing dimensions", () => {
  assert.deepEqual(Transform.crop([A, null, C, D], 2, 2, 1, 0, 1, 1), {
    pixels: [null], width: 1, height: 1
  });
});

test("crop rejects negative origins, overflow and malformed extents", () => {
  const pixels = [A, B, C, D];
  assert.throws(() => Transform.crop(pixels, 2, 2, -1, 0, 1, 1), /non-negative/);
  assert.throws(() => Transform.crop(pixels, 2, 2, 1, 1, 2, 1), /fully inside/);
  assert.throws(() => Transform.crop(pixels, 2, 2, 0, 0, 0, 1), /crop width/);
});

test("pad adds transparent margins on all sides and returns new dimensions", () => {
  assert.deepEqual(Transform.pad([A, B, C, D], 2, 2, 1, 1, 1, 0), {
    pixels: [null, null, null, null, null, A, B, null, null, C, D, null],
    width: 4,
    height: 3
  });
});

test("pad supports explicit HEX fill while preserving existing null pixels", () => {
  assert.deepEqual(Transform.pad([A, null], 2, 1, 1, 0, 0, 1, "#123abc"), {
    pixels: ["#123ABC", A, null, "#123ABC", "#123ABC", "#123ABC"],
    width: 3,
    height: 2
  });
});

test("zero padding returns a fresh copy with original dimensions", () => {
  const pixels = [A, null, B, C];
  const result = Transform.pad(pixels, 2, 2, 0, 0, 0, 0);
  assert.deepEqual(result, { pixels, width: 2, height: 2 });
  assert.notEqual(result.pixels, pixels);
});

test("pad rejects negative counts, invalid fill colors and output dimensions over limit", () => {
  const pixels = [A];
  assert.throws(() => Transform.pad(pixels, 1, 1, -1, 0, 0, 0), /left padding/);
  assert.throws(() => Transform.pad(pixels, 1, 1, 0, 0, 0, 0, "red"), /fillColor/);
  assert.throws(() => Transform.pad(Array(512).fill(A), 512, 1, 1, 0, 0, 0), /padded canvas width/);
});

test("nearest-neighbor upscaling duplicates source cells without interpolation", () => {
  const result = Transform.scaleNearest([A, B, C, D], 2, 2, 4, 4);
  assert.deepEqual(result, {
    pixels: [A, A, B, B, A, A, B, B, C, C, D, D, C, C, D, D],
    width: 4,
    height: 4
  });
});

test("nearest-neighbor downscaling uses deterministic pixel-center source selection", () => {
  const source = Array.from({ length: 16 }, (_, i) => "#" + String(i + 1).padStart(6, "0"));
  assert.deepEqual(Transform.scaleNearest(source, 4, 4, 2, 2), {
    pixels: [source[5], source[7], source[13], source[15]], width: 2, height: 2
  });
});

test("nearest-neighbor scaling preserves nulls and does not create new colors", () => {
  const pixels = [A, null, C, D];
  const result = Transform.scaleNearest(pixels, 2, 2, 3, 3);
  assert.ok(result.pixels.includes(null));
  assert.ok(result.pixels.every(pixel => [A, null, C, D].includes(pixel)));
});

test("nearest-neighbor rejects invalid output dimensions and malformed source buffers", () => {
  assert.throws(() => Transform.scaleNearest([A], 1, 1, 0, 1), /scaled canvas width/);
  assert.throws(() => Transform.scaleNearest([A], 1, 1, 513, 1), /scaled canvas width/);
  assert.throws(() => Transform.flipHorizontal(["red"], 1, 1), /#RRGGBB/);
  const sparse = new Array(2);
  sparse[1] = A;
  assert.throws(() => Transform.flipVertical(sparse, 2, 1), /sparse/);
});

test("all transforms return independent buffers and preserve caller-owned source arrays", () => {
  const pixels = [A, B, null, C, D, E];
  const original = pixels.slice();
  const outputs = [
    Transform.flipHorizontal(pixels, 3, 2),
    Transform.flipVertical(pixels, 3, 2),
    Transform.rotate90(pixels, 3, 2),
    Transform.rotate180(pixels, 3, 2),
    Transform.rotate270(pixels, 3, 2),
    Transform.crop(pixels, 3, 2, 0, 0, 2, 2),
    Transform.pad(pixels, 3, 2, 1, 1, 1, 1),
    Transform.scaleNearest(pixels, 3, 2, 6, 4)
  ];
  assert.deepEqual(pixels, original);
  assert.ok(outputs.every(output => output.pixels !== pixels));
});

test("maximum supported canvas can be flipped and nearest-neighbor scaled without exceeding bounds", () => {
  const pixels = Array(Transform.MAX_PIXELS).fill(null);
  assert.equal(Transform.flipHorizontal(pixels, 512, 512).pixels.length, Transform.MAX_PIXELS);
  assert.equal(Transform.scaleNearest(pixels, 512, 512, 512, 512).pixels.length, Transform.MAX_PIXELS);
});
