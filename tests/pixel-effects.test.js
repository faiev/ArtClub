"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Effects = require("../js/pixel-effects.js");

test("expands a point left-to-right for horizontal symmetry", () => {
  assert.deepEqual(
    Effects.expandSymmetry({ x: 1, y: 0 }, { width: 4, height: 2, mode: "horizontal" }),
    [{ x: 1, y: 0 }, { x: 2, y: 0 }]
  );
});

test("expands a stroke top-to-bottom for vertical symmetry", () => {
  assert.deepEqual(
    Effects.expandSymmetry([{ x: 0, y: 0 }, { x: 1, y: 2 }], { width: 3, height: 3, mode: "vertical" }),
    [{ x: 0, y: 0 }, { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 1, y: 0 }]
  );
});

test("expands four-way symmetry and removes center-axis duplicates", () => {
  assert.deepEqual(
    Effects.expandSymmetry({ x: 1, y: 1 }, { width: 3, height: 3, mode: "four-way" }),
    [{ x: 1, y: 1 }]
  );
  assert.deepEqual(
    Effects.expandSymmetry({ x: 0, y: 0 }, { width: 4, height: 4, mode: "four-way" }),
    [{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 0, y: 3 }, { x: 3, y: 3 }]
  );
});

test("clips out-of-bounds symmetry points and deduplicates repeated stroke points", () => {
  assert.deepEqual(
    Effects.expandSymmetry({ x: -1, y: 0 }, { width: 4, height: 2, mode: "horizontal" }),
    []
  );
  assert.deepEqual(
    Effects.expandSymmetry([{ x: 0, y: 0 }, { x: 0, y: 0 }], { width: 4, height: 2, mode: "horizontal" }),
    [{ x: 0, y: 0 }, { x: 3, y: 0 }]
  );
});

test("returns a new empty list for an empty stroke", () => {
  assert.deepEqual(Effects.expandSymmetry([], { width: 2, height: 2, mode: "four-way" }), []);
});

test("rejects invalid symmetry modes, dimensions and coordinates", () => {
  assert.throws(() => Effects.expandSymmetry({ x: 0, y: 0 }, { width: 2, height: 2, mode: "diagonal" }), /mode/);
  assert.throws(() => Effects.expandSymmetry({ x: 0, y: 0 }, { width: 0, height: 2 }), /width/);
  assert.throws(() => Effects.expandSymmetry({ x: 0.5, y: 0 }, { width: 2, height: 2 }), /safe integer/);
  assert.throws(() => Effects.expandSymmetry(null, { width: 2, height: 2 }), /point object/);
});

test("creates a four-neighbor one-pixel outline without overwriting source pixels", () => {
  const pixels = [null, null, null, null, "#123456", null, null, null, null];
  const original = pixels.slice();
  assert.deepEqual(
    Effects.generateOutline(pixels, 3, 3, { color: "#FF0000", neighbors: 4 }),
    [null, "#FF0000", null, "#FF0000", "#123456", "#FF0000", null, "#FF0000", null]
  );
  assert.deepEqual(pixels, original);
});

test("creates diagonal outline pixels in eight-neighbor mode", () => {
  const pixels = ["#FFFFFF", null, null, null, null, null, null, null, null];
  assert.deepEqual(
    Effects.generateOutline(pixels, 3, 3, { color: "#000000", neighbors: 8 }),
    ["#FFFFFF", "#000000", null, "#000000", "#000000", null, null, null, null]
  );
});

test("clips outline generation at canvas edges and preserves transparent pixels away from artwork", () => {
  assert.deepEqual(
    Effects.generateOutline(["#ABCDEF", null, null, null], 2, 2, { color: "#010203", neighbors: 8 }),
    ["#ABCDEF", "#010203", "#010203", "#010203"]
  );
  assert.deepEqual(Effects.generateOutline([null, null], 2, 1), [null, null]);
});

test("rejects invalid outline buffers, colors, dimensions and neighbor settings", () => {
  assert.throws(() => Effects.generateOutline([null], 2, 2), /exactly width/);
  assert.throws(() => Effects.generateOutline(["rgba(0,0,0,0)"], 1, 1), /#RRGGBB/);
  assert.throws(() => Effects.generateOutline([null], 1, 1, { color: "red" }), /outline color/);
  assert.throws(() => Effects.generateOutline([null], 1, 1, { neighbors: 6 }), /neighbors/);
  assert.throws(() => Effects.generateOutline([null], 513, 1), /width/);
});

test("shades colors with rounded per-channel interpolation", () => {
  assert.equal(Effects.shadeColor("#336699", 0.5), "#99B3CC");
  assert.equal(Effects.shadeColor("#336699", -0.5), "#1A334D");
  assert.equal(Effects.shadeColor("#123456", 0), "#123456");
});

test("lightens and darkens to exact black and white endpoints", () => {
  assert.equal(Effects.lightenColor("#123456", 1), "#FFFFFF");
  assert.equal(Effects.darkenColor("#123456", 1), "#000000");
  assert.equal(Effects.lightenColor("#123456", 0), "#123456");
  assert.equal(Effects.darkenColor("#123456", 0), "#123456");
});

test("rejects invalid shading colors and amounts outside documented bounds", () => {
  assert.throws(() => Effects.shadeColor("#12345", 0.5), /#RRGGBB/);
  assert.throws(() => Effects.shadeColor("#123456", 1.01), /between -1 and 1/);
  assert.throws(() => Effects.shadeColor("#123456", NaN), /between -1 and 1/);
  assert.throws(() => Effects.lightenColor("#123456", -0.1), /between 0 and 1/);
  assert.throws(() => Effects.darkenColor("#123456", 1.1), /between 0 and 1/);
});

test("builds canonical Bayer threshold ranks for all supported matrix sizes", () => {
  assert.deepEqual(Effects.createBayerMatrix(2), [[0, 2], [3, 1]]);
  assert.deepEqual(Effects.createBayerMatrix(4), [
    [0, 8, 2, 10],
    [12, 4, 14, 6],
    [3, 11, 1, 9],
    [15, 7, 13, 5]
  ]);
  const matrix8 = Effects.createBayerMatrix(8);
  assert.equal(matrix8.length, 8);
  assert.ok(matrix8.every(row => row.length === 8));
  assert.deepEqual(matrix8.flat().sort((a, b) => a - b), Array.from({ length: 64 }, (_, i) => i));
  assert.throws(() => Effects.createBayerMatrix(3), /matrixSize/);
});

test("ordered dithering produces the exact checker threshold pattern for 2×2", () => {
  const colors = Effects.orderedDither(Array(4).fill(0.5), 2, 2, {
    colorA: "#000000", colorB: "#FFFFFF", matrixSize: 2
  });
  assert.deepEqual(colors, ["#FFFFFF", "#000000", "#000000", "#FFFFFF"]);
});

test("ordered dithering returns exact checker patterns for 4×4 and 8×8 matrices", () => {
  for (const size of [4, 8]) {
    const colors = Effects.orderedDither(Array(size * size).fill(0.5), size, size, {
      colorA: "#111111", colorB: "#EEEEEE", matrixSize: size
    });
    const expected = Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => (x + y) % 2 === 0 ? "#EEEEEE" : "#111111")
    ).flat();
    assert.deepEqual(colors, expected);
    assert.deepEqual(
      Effects.orderedDither(Array(size * size).fill(0.5), size, size, {
        colorA: "#111111", colorB: "#EEEEEE", matrixSize: size
      }),
      colors
    );
  }
});

test("ordered dithering preserves transparency and applies strict threshold equality", () => {
  const matrix = Effects.createBayerMatrix(2);
  const thresholdAtOrigin = (matrix[0][0] + 0.5) / 4;
  const thresholdAtColumnOne = (matrix[0][1] + 0.5) / 4;
  assert.deepEqual(
    Effects.orderedDither([thresholdAtOrigin, thresholdAtColumnOne + 0.001, null, 1], 2, 2, {
      colorA: "#000000", colorB: "#FFFFFF", matrixSize: 2
    }),
    ["#000000", "#FFFFFF", null, "#FFFFFF"]
  );
});

test("ordered dithering supports an integer matrix origin for stable cropped previews", () => {
  const withoutOffset = Effects.orderedDither([0.5], 1, 1, {
    colorA: "#000000", colorB: "#FFFFFF", matrixSize: 2
  });
  const withOffset = Effects.orderedDither([0.5], 1, 1, {
    colorA: "#000000", colorB: "#FFFFFF", matrixSize: 2, originX: 1
  });
  assert.notDeepEqual(withoutOffset, withOffset);
  assert.throws(() => Effects.orderedDither([0.5], 1, 1, {
    colorA: "#000000", colorB: "#FFFFFF", originX: 0.5
  }), /safe integers/);
});

test("ordered dithering rejects invalid tone buffers, ramp colors, matrix sizes and dimensions", () => {
  assert.throws(() => Effects.orderedDither([0], 2, 1, { colorA: "#000000", colorB: "#FFFFFF" }), /exactly width/);
  assert.throws(() => Effects.orderedDither([1.1], 1, 1, { colorA: "#000000", colorB: "#FFFFFF" }), /between 0 and 1/);
  assert.throws(() => Effects.orderedDither([0], 1, 1, { colorA: "black", colorB: "#FFFFFF" }), /colorA/);
  assert.throws(() => Effects.orderedDither([0], 1, 1, { colorA: "#000000", colorB: "#FFFFFF", matrixSize: 16 }), /matrixSize/);
  assert.throws(() => Effects.orderedDither([0], 513, 1, { colorA: "#000000", colorB: "#FFFFFF" }), /width/);
});

test("maximum supported canvas dimensions remain bounded and valid", () => {
  const pixels = Array(Effects.MAX_PIXELS).fill(null);
  assert.equal(Effects.generateOutline(pixels, 512, 512).length, Effects.MAX_PIXELS);
  assert.equal(Effects.orderedDither(Array(Effects.MAX_PIXELS).fill(0), 512, 512, {
    colorA: "#000000", colorB: "#FFFFFF", matrixSize: 8
  }).length, Effects.MAX_PIXELS);
});

test("pure operations leave caller-owned point, pixel and tone arrays unchanged", () => {
  const points = [{ x: 0, y: 0 }];
  const pixels = ["#123456", null, null, null];
  const tones = [0.25, 0.5, null, 1];
  const originalPoints = structuredClone(points);
  const originalPixels = pixels.slice();
  const originalTones = tones.slice();

  Effects.expandSymmetry(points, { width: 2, height: 2, mode: "four-way" });
  Effects.generateOutline(pixels, 2, 2);
  Effects.orderedDither(tones, 2, 2, { colorA: "#000000", colorB: "#FFFFFF" });

  assert.deepEqual(points, originalPoints);
  assert.deepEqual(pixels, originalPixels);
  assert.deepEqual(tones, originalTones);
});

test("rejects sparse stroke point arrays without mutating the caller's array", () => {
  const points = new Array(2);
  points[0] = { x: 1, y: 1 };
  const original = points.slice();

  assert.throws(
    () => Effects.expandSymmetry(points, { width: 3, height: 3, mode: "horizontal" }),
    /point 1 must be an own array entry/
  );
  assert.deepEqual(points, original);
  assert.equal(Object.prototype.hasOwnProperty.call(points, 1), false);
});

test("rejects explicit undefined stroke points without mutating the caller's array", () => {
  const points = [{ x: 0, y: 0 }, undefined];
  const original = points.slice();

  assert.throws(
    () => Effects.expandSymmetry(points, { width: 3, height: 3, mode: "horizontal" }),
    /point 1 must contain safe integer/
  );
  assert.deepEqual(points, original);
});
