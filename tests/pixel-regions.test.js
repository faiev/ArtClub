"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Regions = require("../js/pixel-regions.js");

const coords = points => points.map(point => [point.x, point.y]);

test("selects the four-connected region in deterministic row-major output order", () => {
  const pixels = [
    "#FF0000", "#FF0000", null,
    "#FF0000", null, "#FF0000",
    null, null, "#FF0000"
  ];
  const result = Regions.selectRegion(pixels, 3, 3, 0, 0);
  assert.equal(result.color, "#FF0000");
  assert.deepEqual(coords(result.points), [[0, 0], [1, 0], [0, 1]]);
  assert.deepEqual(result.bounds, { x: 0, y: 0, width: 2, height: 2 });
  assert.equal(result.iterations, 3);
});

test("eight-connectivity includes diagonal pixels while four-connectivity does not", () => {
  const pixels = ["#123456", null, null, "#123456"];
  assert.deepEqual(coords(Regions.selectRegion(pixels, 2, 2, 0, 0).points), [[0, 0]]);
  assert.deepEqual(
    coords(Regions.selectRegion(pixels, 2, 2, 0, 0, { connectivity: 8 }).points),
    [[0, 0], [1, 1]]
  );
});

test("selects transparent regions without treating null as missing data", () => {
  const pixels = [null, null, "#FFFFFF", null, "#FFFFFF", null];
  const result = Regions.selectRegion(pixels, 3, 2, 0, 0, { connectivity: 4 });
  assert.equal(result.color, null);
  assert.deepEqual(coords(result.points), [[0, 0], [1, 0], [0, 1]]);
});

test("matches exact HEX color values case-insensitively but does not match neighboring colors", () => {
  const pixels = ["#abcdef", "#ABCDEF", "#ABCDEE"];
  const result = Regions.selectRegion(pixels, 3, 1, 0, 0);
  assert.deepEqual(coords(result.points), [[0, 0], [1, 0]]);
  assert.equal(result.color, "#abcdef");
});

test("extracts the four-connected region border in stable row-major order", () => {
  const pixels = [
    null, null, null, null, null,
    null, "#00AA00", "#00AA00", "#00AA00", null,
    null, "#00AA00", "#00AA00", "#00AA00", null,
    null, "#00AA00", "#00AA00", "#00AA00", null,
    null, null, null, null, null
  ];
  const border = Regions.extractRegionBorder(pixels, 5, 5, 1, 1);
  assert.equal(border.regionSize, 9);
  assert.deepEqual(coords(border.points), [
    [1, 1], [2, 1], [3, 1],
    [1, 2], [3, 2],
    [1, 3], [2, 3], [3, 3]
  ]);
  assert.deepEqual(border.bounds, { x: 1, y: 1, width: 3, height: 3 });
});

test("eight-connected border treats diagonal neighbors as part of the selected region", () => {
  const pixels = ["#111111", null, null, "#111111"];
  const border4 = Regions.extractRegionBorder(pixels, 2, 2, 0, 0, { connectivity: 4 });
  const border8 = Regions.extractRegionBorder(pixels, 2, 2, 0, 0, { connectivity: 8 });
  assert.deepEqual(coords(border4.points), [[0, 0]]);
  assert.deepEqual(coords(border8.points), [[0, 0], [1, 1]]);
});

test("marks every selected pixel as border when its region reaches the canvas edge", () => {
  const border = Regions.extractRegionBorder(["#010203", "#010203", "#010203"], 3, 1, 1, 0);
  assert.deepEqual(coords(border.points), [[0, 0], [1, 0], [2, 0]]);
});

test("flood fill returns a new buffer and replaces only the selected connected region", () => {
  const pixels = ["#FF0000", "#FF0000", "#0000FF", "#FF0000", "#0000FF", "#0000FF"];
  const original = pixels.slice();
  const result = Regions.floodFill(pixels, 3, 2, 0, 0, "#00FF00");
  assert.deepEqual(result.pixels, ["#00FF00", "#00FF00", "#0000FF", "#00FF00", "#0000FF", "#0000FF"]);
  assert.equal(result.changed, 3);
  assert.deepEqual(coords(result.points), [[0, 0], [1, 0], [0, 1]]);
  assert.notEqual(result.pixels, pixels);
  assert.deepEqual(pixels, original);
});

test("flood fill supports diagonal connectivity when explicitly requested", () => {
  const pixels = ["#111111", null, null, "#111111"];
  const result = Regions.floodFill(pixels, 2, 2, 0, 0, "#222222", { connectivity: 8 });
  assert.deepEqual(result.pixels, ["#222222", null, null, "#222222"]);
  assert.equal(result.changed, 2);
});

test("flood fill can replace a transparent region with a HEX color or make it transparent", () => {
  const pixels = [null, null, "#FFFFFF", null];
  const filled = Regions.floodFill(pixels, 2, 2, 0, 0, "#ABCDEF");
  assert.deepEqual(filled.pixels, ["#ABCDEF", "#ABCDEF", "#FFFFFF", "#ABCDEF"]);
  const cleared = Regions.floodFill(["#ABCDEF", "#ABCDEF"], 2, 1, 0, 0, null);
  assert.deepEqual(cleared.pixels, [null, null]);
});

test("flood fill returns an independent copy and zero changed pixels when replacement already matches", () => {
  const pixels = ["#AABBCC", "#aabbcc"];
  const result = Regions.floodFill(pixels, 2, 1, 0, 0, "#AABBCC");
  assert.deepEqual(result.pixels, pixels);
  assert.notEqual(result.pixels, pixels);
  assert.equal(result.changed, 0);
});

test("iteration limits reject large regions atomically without returning partial buffers", () => {
  const pixels = Array(100).fill("#123456");
  assert.throws(
    () => Regions.floodFill(pixels, 10, 10, 0, 0, "#FFFFFF", { maxIterations: 5 }),
    /maxIterations/
  );
  assert.deepEqual(pixels, Array(100).fill("#123456"));
});

test("cancellation callback aborts region selection and fill without mutating input", () => {
  const pixels = Array(100).fill("#123456");
  let calls = 0;
  const options = { shouldCancel: () => { calls += 1; return calls > 4; } };
  assert.throws(() => Regions.selectRegion(pixels, 10, 10, 0, 0, options), error => error.name === "AbortError");
  assert.deepEqual(pixels, Array(100).fill("#123456"));

  calls = 0;
  assert.throws(() => Regions.floodFill(pixels, 10, 10, 0, 0, "#FFFFFF", options), error => error.name === "AbortError");
  assert.deepEqual(pixels, Array(100).fill("#123456"));
});

test("rejects malformed dimensions, out-of-bounds seeds and invalid connectivity", () => {
  assert.throws(() => Regions.selectRegion(["#000000"], 0, 1, 0, 0), /width/);
  assert.throws(() => Regions.selectRegion(["#000000"], 1, 1, -1, 0), /inside the canvas/);
  assert.throws(() => Regions.selectRegion(["#000000"], 1, 1, 0.5, 0), /safe integer/);
  assert.throws(() => Regions.selectRegion(["#000000"], 1, 1, 0, 0, { connectivity: 6 }), /connectivity/);
});

test("rejects sparse buffers, wrong lengths and malformed HEX entries", () => {
  const sparse = new Array(4);
  sparse[0] = "#000000";
  assert.throws(() => Regions.selectRegion(sparse, 2, 2, 0, 0), /sparse buffers/);
  assert.throws(() => Regions.selectRegion(["#000000"], 2, 2, 0, 0), /exactly width/);
  assert.throws(() => Regions.floodFill(["red"], 1, 1, 0, 0, "#FFFFFF"), /#RRGGBB/);
  assert.throws(() => Regions.floodFill([null], 1, 1, 0, 0, "transparent"), /replacementColor/);
});

test("only exact color tolerance zero is accepted and malformed limits/callbacks are rejected", () => {
  assert.throws(() => Regions.selectRegion(["#000000"], 1, 1, 0, 0, { tolerance: 1 }), /exact color matching/);
  assert.throws(() => Regions.selectRegion(["#000000"], 1, 1, 0, 0, { tolerance: -1 }), /exact color matching/);
  assert.throws(() => Regions.selectRegion(["#000000"], 1, 1, 0, 0, { maxIterations: 0 }), /maxIterations/);
  assert.throws(() => Regions.selectRegion(["#000000"], 1, 1, 0, 0, { maxIterations: 300000 }), /maxIterations/);
  assert.throws(() => Regions.selectRegion(["#000000"], 1, 1, 0, 0, { shouldCancel: true }), /shouldCancel/);
});

test("region operations never mutate source buffers and selection results are independently allocated", () => {
  const pixels = ["#000000", "#000000", null, "#FFFFFF"];
  const original = pixels.slice();
  const selection = Regions.selectRegion(pixels, 2, 2, 0, 0);
  const border = Regions.extractRegionBorder(pixels, 2, 2, 0, 0);
  const fill = Regions.floodFill(pixels, 2, 2, 0, 0, "#FFFFFF");
  selection.points[0].x = 99;
  assert.deepEqual(pixels, original);
  assert.deepEqual(border.points, [{ x: 0, y: 0 }, { x: 1, y: 0 }]);
  assert.deepEqual(fill.pixels, ["#FFFFFF", "#FFFFFF", null, "#FFFFFF"]);
});

test("all-transparent maximum canvas selection is bounded and returns complete row-major region", () => {
  const pixels = Array(Regions.MAX_PIXELS).fill(null);
  const region = Regions.selectRegion(pixels, 512, 512, 511, 511, { maxIterations: Regions.MAX_PIXELS });
  assert.equal(region.points.length, Regions.MAX_PIXELS);
  assert.deepEqual(region.bounds, { x: 0, y: 0, width: 512, height: 512 });
  assert.deepEqual(region.points[0], { x: 0, y: 0 });
  assert.deepEqual(region.points.at(-1), { x: 511, y: 511 });
});
