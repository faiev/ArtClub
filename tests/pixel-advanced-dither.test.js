"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Advanced = require("../js/pixel-advanced-dither.js");

const K = "#000000";
const W = "#FFFFFF";
const R = "#FF0000";
const G = "#00FF00";
const B = "#0000FF";
const O = "#123456";

test("Floyd-Steinberg selects the closest palette entry for a one-pixel source", () => {
  assert.deepEqual(
    Advanced.floydSteinberg(["#101010"], 1, 1, [K, W]).pixels,
    [K]
  );
  assert.deepEqual(
    Advanced.floydSteinberg(["#F0F0F0"], 1, 1, [K, W]).pixels,
    [W]
  );
});

test("nearest-palette ties resolve to the earliest supplied palette color", () => {
  const result = Advanced.floydSteinberg(["#800000"], 1, 1, [K, R]);
  assert.deepEqual(result.pixels, [K]);
});

test("left-to-right, right-to-left and serpentine scan modes are explicit and repeatable", () => {
  const pixels = [
    "#707070", "#909090", "#707070",
    "#909090", "#707070", "#909090",
    "#707070", "#909090", "#707070"
  ];
  for (const scanDirection of ["left-to-right", "right-to-left", "serpentine"]) {
    const first = Advanced.floydSteinberg(pixels, 3, 3, [K, W], { scanDirection });
    const second = Advanced.floydSteinberg(pixels, 3, 3, [K, W], { scanDirection });
    assert.deepEqual(first, second);
    assert.equal(first.scanDirection, scanDirection);
    assert.ok(first.pixels.every(color => color === K || color === W));
  }
});

test("serpentine mode alternates row direction and does not mutate the source", () => {
  const pixels = Array(16).fill("#808080");
  const original = pixels.slice();
  const result = Advanced.floydSteinberg(pixels, 4, 4, [K, W], { scanDirection: "serpentine" });
  assert.deepEqual(pixels, original);
  assert.notEqual(result.pixels, pixels);
});

test("preserve alpha mode keeps transparent pixels and blocks diffusion through them", () => {
  const pixels = ["#808080", null, "#808080", "#808080", null, "#808080"];
  const result = Advanced.floydSteinberg(pixels, 3, 2, [K, W], { alphaMode: "preserve" });
  assert.deepEqual(result.pixels.filter((_, i) => pixels[i] === null), [null, null]);
  assert.ok(result.pixels.every(color => color === null || color === K || color === W));
  assert.equal(result.alphaMode, "preserve");
});

test("composite alpha mode converts transparent pixels to the configured background before dithering", () => {
  const result = Advanced.floydSteinberg([null, "#808080"], 2, 1, [K, W], {
    alphaMode: "composite",
    backgroundColor: R
  });
  assert.ok(result.pixels.every(color => color === K || color === W));
  assert.equal(result.alphaMode, "composite");
});

test("weighted Rec.601 color distance can choose a different palette entry than Euclidean RGB", () => {
  const pixels = ["#FFFF00"];
  const palette = [R, G];
  assert.deepEqual(
    Advanced.floydSteinberg(pixels, 1, 1, palette, { distanceMetric: "euclidean-rgb" }).pixels,
    [R]
  );
  assert.deepEqual(
    Advanced.floydSteinberg(pixels, 1, 1, palette, { distanceMetric: "weighted-rec601" }).pixels,
    [G]
  );
});

test("Floyd-Steinberg validates palette size, uniqueness, sparse entries and HEX colors", () => {
  assert.throws(() => Advanced.floydSteinberg([K], 1, 1, [K]), /between 2/);
  assert.throws(() => Advanced.floydSteinberg([K], 1, 1, [K, K]), /unique/);
  assert.throws(() => Advanced.floydSteinberg([K], 1, 1, ["red", W]), /#RRGGBB/);
  const sparse = new Array(2);
  sparse[0] = K;
  assert.throws(() => Advanced.floydSteinberg([K], 1, 1, sparse), /sparse/);
  assert.throws(() => Advanced.floydSteinberg([K], 1, 1, Array(65).fill(W)), /between 2 and 64/);
});

test("Floyd-Steinberg rejects invalid scan direction, alpha policy, metric and missing composite color", () => {
  assert.throws(() => Advanced.floydSteinberg([K], 1, 1, [K, W], { scanDirection: "diagonal" }), /scanDirection/);
  assert.throws(() => Advanced.floydSteinberg([K], 1, 1, [K, W], { alphaMode: "blend" }), /alphaMode/);
  assert.throws(() => Advanced.floydSteinberg([K], 1, 1, [K, W], { distanceMetric: "lab" }), /distanceMetric/);
  assert.throws(() => Advanced.floydSteinberg([null], 1, 1, [K, W], { alphaMode: "composite" }), /backgroundColor/);
});

test("all-transparent preserve mode returns a transparent copy without processing colors", () => {
  const pixels = [null, null, null, null];
  const result = Advanced.floydSteinberg(pixels, 2, 2, [K, W]);
  assert.deepEqual(result.pixels, pixels);
  assert.notEqual(result.pixels, pixels);
});

test("Floyd-Steinberg rejects malformed and sparse source buffers before processing", () => {
  const sparse = new Array(2);
  sparse[0] = K;
  assert.throws(() => Advanced.floydSteinberg(sparse, 2, 1, [K, W]), /sparse/);
  assert.throws(() => Advanced.floydSteinberg(["bad"], 1, 1, [K, W]), /#RRGGBB/);
  assert.throws(() => Advanced.floydSteinberg([K], 0, 1, [K, W]), /width/);
});

test("outer one-pixel outline surrounds a 3-by-3 opaque square and preserves artwork", () => {
  const pixels = [
    null, null, null, null, null,
    null, O, O, O, null,
    null, O, O, O, null,
    null, O, O, O, null,
    null, null, null, null, null
  ];
  const expected = [
    null, null, null, null, null,
    null, O, O, O, null,
    null, O, O, O, null,
    null, O, O, O, null,
    null, null, null, null, null
  ];
  const result = Advanced.outlinePixels(pixels, 5, 5, { color: R, mode: "outer", thickness: 1 });
  assert.deepEqual(result, [
    null, R, R, R, null,
    R, O, O, O, R,
    R, O, O, O, R,
    R, O, O, O, R,
    null, R, R, R, null
  ]);
  assert.deepEqual(pixels, expected);
});

test("inner outline replaces only the perimeter of an interior opaque square", () => {
  const pixels = [
    null, null, null, null, null,
    null, O, O, O, null,
    null, O, O, O, null,
    null, O, O, O, null,
    null, null, null, null, null
  ];
  assert.deepEqual(Advanced.outlinePixels(pixels, 5, 5, { color: R, mode: "inner" }), [
    null, null, null, null, null,
    null, R, R, R, null,
    null, R, O, R, null,
    null, R, R, R, null,
    null, null, null, null, null
  ]);
});

test("both outline mode combines inner and outer rings", () => {
  const pixels = [
    null, null, null, null, null,
    null, O, O, O, null,
    null, O, O, O, null,
    null, O, O, O, null,
    null, null, null, null, null
  ];
  const result = Advanced.outlinePixels(pixels, 5, 5, { color: R, mode: "both" });
  assert.equal(result[12], O);
  assert.equal(result[6], R);
  assert.equal(result[1], R);
  assert.equal(result[0], null);
});

test("outline thickness extends outward by bounded Manhattan distance", () => {
  const pixels = Array(25).fill(null);
  pixels[12] = O;
  const result = Advanced.outlinePixels(pixels, 5, 5, { color: R, thickness: 2, mode: "outer", connectivity: 4 });
  assert.equal(result.filter(x => x === R).length, 12);
  assert.deepEqual(result.map((v, i) => v === R ? i : -1).filter(i => i >= 0), [
    2, 6, 7, 8, 10, 11, 13, 14, 16, 17, 18, 22
  ]);
});

test("eight-connected outer outline includes diagonal neighbors at thickness one", () => {
  const pixels = [null, null, null, null, O, null, null, null, null];
  const result = Advanced.outlinePixels(pixels, 3, 3, { color: R, mode: "outer", connectivity: 8 });
  assert.deepEqual(result, [R, R, R, R, O, R, R, R, R]);
});

test("outline treats canvas edges as transparent for inner boundary extraction", () => {
  const pixels = Array(9).fill(O);
  assert.deepEqual(Advanced.outlinePixels(pixels, 3, 3, { color: R, mode: "inner", thickness: 1 }), [
    R, R, R,
    R, O, R,
    R, R, R
  ]);
});

test("empty artwork yields no outer or inner outline pixels", () => {
  const pixels = Array(9).fill(null);
  assert.deepEqual(Advanced.outlinePixels(pixels, 3, 3, { color: R, mode: "outer" }), pixels);
  assert.deepEqual(Advanced.outlinePixels(pixels, 3, 3, { color: R, mode: "both" }), pixels);
});

test("outline validates thickness, mode, connectivity and color", () => {
  const pixels = [O];
  assert.throws(() => Advanced.outlinePixels(pixels, 1, 1, { thickness: 0 }), /thickness/);
  assert.throws(() => Advanced.outlinePixels(pixels, 1, 1, { thickness: 33 }), /thickness/);
  assert.throws(() => Advanced.outlinePixels(pixels, 1, 1, { mode: "center" }), /mode/);
  assert.throws(() => Advanced.outlinePixels(pixels, 1, 1, { connectivity: 6 }), /connectivity/);
  assert.throws(() => Advanced.outlinePixels(pixels, 1, 1, { color: "red" }), /#RRGGBB/);
});

test("all advanced operations preserve source data and allocate complete outputs", () => {
  const pixels = [O, null, "#ABCDEF", null];
  const original = pixels.slice();
  const dithered = Advanced.floydSteinberg(pixels, 2, 2, [K, W]);
  const outlined = Advanced.outlinePixels(pixels, 2, 2, { color: R, mode: "both" });
  assert.notEqual(dithered.pixels, pixels);
  assert.notEqual(outlined, pixels);
  assert.deepEqual(pixels, original);
});

test("maximum canvas remains bounded for error diffusion and outline distance queues", () => {
  const pixels = Array(Advanced.MAX_PIXELS).fill(null);
  const dithered = Advanced.floydSteinberg(pixels, 512, 512, [K, W]);
  assert.equal(dithered.pixels.length, Advanced.MAX_PIXELS);
  const outlined = Advanced.outlinePixels(pixels, 512, 512, { thickness: 32 });
  assert.equal(outlined.length, Advanced.MAX_PIXELS);
});
