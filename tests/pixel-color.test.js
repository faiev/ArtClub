"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Color = require("../js/pixel-color.js");

test("replaceColor matches exact HEX channels case-insensitively and preserves other pixels", () => {
  const pixels = ["#aabbcc", "#AABBCC", "#AABBCE", null];
  assert.deepEqual(Color.replaceColor(pixels, 4, 1, "#AABBCC", "#112233"), [
    "#112233", "#112233", "#AABBCE", null
  ]);
});

test("replaceColor supports transparent null as source or replacement", () => {
  assert.deepEqual(Color.replaceColor([null, "#FFFFFF", null], 3, 1, null, "#000000"), [
    "#000000", "#FFFFFF", "#000000"
  ]);
  assert.deepEqual(Color.replaceColor(["#FFFFFF", "#000000"], 2, 1, "#FFFFFF", null), [null, "#000000"]);
});

test("mapPalette maps several colors and leaves unmatched colors unchanged", () => {
  const pixels = ["#FF0000", "#00FF00", "#0000FF", "#FFFFFF", null];
  assert.deepEqual(Color.mapPalette(pixels, 5, 1, [
    { from: "#FF0000", to: "#000000" },
    { from: "#00FF00", to: "#808080" },
    { from: null, to: "#FFFFFF" }
  ]), ["#000000", "#808080", "#0000FF", "#FFFFFF", "#FFFFFF"]);
});

test("mapPalette can map HEX pixels to transparent null", () => {
  assert.deepEqual(Color.mapPalette(["#112233", null], 2, 1, [
    { from: "#112233", to: null }
  ]), [null, null]);
});

test("mapPalette rejects duplicate sources, sparse entries and malformed mappings", () => {
  assert.throws(() => Color.mapPalette(["#000000"], 1, 1, [
    { from: "#000000", to: "#FFFFFF" }, { from: "#000000", to: null }
  ]), /duplicate source/);
  const sparse = new Array(1);
  assert.throws(() => Color.mapPalette(["#000000"], 1, 1, sparse), /sparse/);
  assert.throws(() => Color.mapPalette(["#000000"], 1, 1, [{ from: "red", to: "#FFFFFF" }]), /#RRGGBB/);
  assert.throws(() => Color.mapPalette(["#000000"], 1, 1, [{ from: "#000000" }]), /mapping to/);
});

test("horizontal gradient interpolates channels with deterministic half-up rounding", () => {
  assert.deepEqual(
    Color.applyGradient(["#FFFFFF", "#FFFFFF", "#FFFFFF"], 3, 1, "#000000", "#FFFFFF"),
    ["#000000", "#808080", "#FFFFFF"]
  );
});

test("vertical gradient varies by row and preserves null transparency", () => {
  assert.deepEqual(
    Color.applyGradient(["#000000", null, "#000000", "#000000"], 2, 2, "#000000", "#FFFFFF", {
      orientation: "vertical"
    }),
    ["#000000", null, "#FFFFFF", "#FFFFFF"]
  );
});

test("linear gradient projects pixel coordinates onto the supplied vector and clamps endpoints", () => {
  const result = Color.applyGradient(Array(9).fill("#101010"), 3, 3, "#000000", "#FFFFFF", {
    orientation: "linear", startX: 0, startY: 0, endX: 2, endY: 2
  });
  assert.deepEqual(result, [
    "#000000", "#404040", "#808080",
    "#404040", "#808080", "#BFBFBF",
    "#808080", "#BFBFBF", "#FFFFFF"
  ]);
});

test("linear gradient uses the default diagonal and a one-pixel canvas resolves to the start color", () => {
  assert.deepEqual(
    Color.applyGradient(["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFFFFF"], 2, 2, "#000000", "#FFFFFF", {
      orientation: "linear"
    }),
    ["#000000", "#808080", "#808080", "#FFFFFF"]
  );
  assert.deepEqual(Color.applyGradient(["#FFFFFF"], 1, 1, "#123456", "#ABCDEF", { orientation: "linear" }), ["#123456"]);
});

test("gradient applies only to non-null mask pixels and leaves caller data unchanged", () => {
  const pixels = ["#FF0000", null, "#00FF00"];
  const original = pixels.slice();
  const result = Color.applyGradient(pixels, 3, 1, "#000000", "#FFFFFF");
  assert.deepEqual(result, ["#000000", null, "#FFFFFF"]);
  assert.deepEqual(pixels, original);
  assert.notEqual(result, pixels);
});

test("gradient rejects invalid colors, orientation and out-of-canvas linear endpoints", () => {
  assert.throws(() => Color.applyGradient(["#000000"], 1, 1, "red", "#FFFFFF"), /#RRGGBB/);
  assert.throws(() => Color.applyGradient(["#000000"], 1, 1, "#000000", "#FFFFFF", { orientation: "radial" }), /orientation/);
  assert.throws(() => Color.applyGradient(["#000000"], 1, 1, "#000000", "#FFFFFF", {
    orientation: "linear", startX: -1
  }), /inside the canvas/);
  assert.throws(() => Color.applyGradient(["#000000"], 1, 1, "#000000", "#FFFFFF", {
    orientation: "linear", endY: 1
  }), /inside the canvas/);
});

test("quantizeColor uses defined nearest-level rounding and returns canonical uppercase HEX", () => {
  assert.equal(Color.quantizeColor("#804080", 2), "#FF00FF");
  assert.equal(Color.quantizeColor("#804080", 4), "#AA55AA");
  assert.equal(Color.quantizeColor("#abcdef", 256), "#ABCDEF");
});

test("posterize quantizes all opaque pixels while preserving transparency", () => {
  assert.deepEqual(Color.posterize(["#000000", "#7F7F7F", "#FFFFFF", null], 4, 1, 2), [
    "#000000", "#000000", "#FFFFFF", null
  ]);
});

test("quantization rejects invalid levels and malformed colors", () => {
  assert.throws(() => Color.quantizeColor("#000000", 1), /levels/);
  assert.throws(() => Color.posterize(["#000000"], 1, 1, 257), /levels/);
  assert.throws(() => Color.quantizeColor("#12345", 4), /#RRGGBB/);
});

test("applyColorRamp maps black/white to endpoints and midpoint ties toward the brighter stop", () => {
  assert.deepEqual(
    Color.applyColorRamp(["#000000", "#7F7F7F", "#808080", "#FFFFFF"], 4, 1, ["#000000", "#FF0000"]),
    ["#000000", "#000000", "#FF0000", "#FF0000"]
  );
});

test("applyColorRamp uses integer Rec.601 luma and preserves transparent pixels", () => {
  assert.deepEqual(
    Color.applyColorRamp(["#FF0000", "#00FF00", "#0000FF", null], 4, 1, ["#000000", "#808080", "#FFFFFF"]),
    ["#808080", "#808080", "#000000", null]
  );
});

test("applyColorRamp validates ramp size and HEX entries", () => {
  assert.throws(() => Color.applyColorRamp(["#000000"], 1, 1, ["#FFFFFF"]), /between 2/);
  assert.throws(() => Color.applyColorRamp(["#000000"], 1, 1, ["black", "#FFFFFF"]), /#RRGGBB/);
  assert.throws(() => Color.applyColorRamp(["#000000"], 1, 1, ["#000000", "#FFFFFF"].concat(Array(255).fill("#FFFFFF"))), /between 2/);
});

test("all color operations return independent buffers and never mutate input", () => {
  const pixels = ["#123456", "#ABCDEF", null];
  const original = pixels.slice();
  const outputs = [
    Color.replaceColor(pixels, 3, 1, "#123456", "#000000"),
    Color.mapPalette(pixels, 3, 1, [{ from: "#ABCDEF", to: "#FFFFFF" }]),
    Color.applyGradient(pixels, 3, 1, "#000000", "#FFFFFF"),
    Color.posterize(pixels, 3, 1, 4),
    Color.applyColorRamp(pixels, 3, 1, ["#000000", "#FFFFFF"])
  ];
  assert.deepEqual(pixels, original);
  assert.ok(outputs.every(output => output !== pixels));
});

test("color operations reject sparse/malformed buffers and invalid dimensions", () => {
  const sparse = new Array(2);
  sparse[0] = "#000000";
  assert.throws(() => Color.replaceColor(sparse, 2, 1, null, "#FFFFFF"), /sparse/);
  assert.throws(() => Color.mapPalette(["bad"], 1, 1, []), /#RRGGBB/);
  assert.throws(() => Color.posterize([null], 513, 1, 2), /width/);
});
