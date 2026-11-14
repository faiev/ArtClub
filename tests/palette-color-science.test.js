/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const ColorScience = require("../js/palette-color-science.js");

function closeTo(actual, expected, epsilon) {
  assert.ok(Math.abs(actual - expected) <= (epsilon || 1e-10), actual + " is not within tolerance of " + expected);
}

test("HEX and RGB convert exactly in both directions", () => {
  assert.deepEqual(ColorScience.hexToRgb("#00aBcD"), { r: 0, g: 171, b: 205 });
  assert.equal(ColorScience.rgbToHex(0, 171, 205), "#00ABCD");
  assert.equal(ColorScience.rgbToHex(255, 255, 255), "#FFFFFF");
  assert.equal(ColorScience.rgbToHex(0, 0, 0), "#000000");
});

test("RGB channel rounding uses nearest integer with half ties rounded upward", () => {
  assert.equal(ColorScience.rgbToHex(12.5, 12.49, 254.5), "#0D0CFF");
});

test("RGB-to-HSL returns known red, green, blue and grayscale values", () => {
  assert.deepEqual(ColorScience.rgbToHsl(255, 0, 0), { h: 0, s: 1, l: 0.5 });
  assert.deepEqual(ColorScience.rgbToHsl(0, 255, 0), { h: 120, s: 1, l: 0.5 });
  assert.deepEqual(ColorScience.rgbToHsl(0, 0, 255), { h: 240, s: 1, l: 0.5 });
  const gray = ColorScience.rgbToHsl(128, 128, 128);
  assert.equal(gray.h, 0);
  assert.equal(gray.s, 0);
  closeTo(gray.l, 128 / 255);
});

test("HSL-to-RGB returns exact primary colors and mid-gray", () => {
  assert.deepEqual(ColorScience.hslToRgb(0, 1, 0.5), { r: 255, g: 0, b: 0 });
  assert.deepEqual(ColorScience.hslToRgb(120, 1, 0.5), { r: 0, g: 255, b: 0 });
  assert.deepEqual(ColorScience.hslToRgb(240, 1, 0.5), { r: 0, g: 0, b: 255 });
  assert.deepEqual(ColorScience.hslToRgb(0, 0, 0.5), { r: 128, g: 128, b: 128 });
});

test("RGB-to-HSV returns known primaries and grayscale values", () => {
  assert.deepEqual(ColorScience.rgbToHsv(255, 0, 0), { h: 0, s: 1, v: 1 });
  assert.deepEqual(ColorScience.rgbToHsv(0, 255, 0), { h: 120, s: 1, v: 1 });
  assert.deepEqual(ColorScience.rgbToHsv(0, 0, 255), { h: 240, s: 1, v: 1 });
  const gray = ColorScience.rgbToHsv(128, 128, 128);
  assert.equal(gray.h, 0);
  assert.equal(gray.s, 0);
  closeTo(gray.v, 128 / 255);
});

test("HSV-to-RGB returns exact primaries and half-value blue", () => {
  assert.deepEqual(ColorScience.hsvToRgb(0, 1, 1), { r: 255, g: 0, b: 0 });
  assert.deepEqual(ColorScience.hsvToRgb(120, 1, 1), { r: 0, g: 255, b: 0 });
  assert.deepEqual(ColorScience.hsvToRgb(240, 1, 1), { r: 0, g: 0, b: 255 });
  assert.deepEqual(ColorScience.hsvToRgb(240, 1, 0.5), { r: 0, g: 0, b: 128 });
});

test("hue wraps deterministically at 360 degrees and for negative values", () => {
  assert.equal(ColorScience.normalizeHue(360), 0);
  assert.equal(ColorScience.normalizeHue(720), 0);
  assert.equal(ColorScience.normalizeHue(-120), 240);
  assert.equal(ColorScience.normalizeHue(420), 60);
  assert.deepEqual(ColorScience.hslToRgb(360, 1, 0.5), { r: 255, g: 0, b: 0 });
  assert.deepEqual(ColorScience.hsvToRgb(-120, 1, 1), { r: 0, g: 0, b: 255 });
});

test("HSL and HSV round-trip representative colors within one channel value", () => {
  const fixtures = [
    { r: 12, g: 88, b: 201 },
    { r: 255, g: 180, b: 0 },
    { r: 31, g: 190, b: 92 },
    { r: 128, g: 128, b: 128 }
  ];
  fixtures.forEach(rgb => {
    const hsl = ColorScience.rgbToHsl(rgb.r, rgb.g, rgb.b);
    const fromHsl = ColorScience.hslToRgb(hsl.h, hsl.s, hsl.l);
    const hsv = ColorScience.rgbToHsv(rgb.r, rgb.g, rgb.b);
    const fromHsv = ColorScience.hsvToRgb(hsv.h, hsv.s, hsv.v);
    ["r", "g", "b"].forEach(key => {
      assert.ok(Math.abs(fromHsl[key] - rgb[key]) <= 1);
      assert.ok(Math.abs(fromHsv[key] - rgb[key]) <= 1);
    });
  });
});

test("WCAG relative luminance returns the black and white reference values", () => {
  assert.equal(ColorScience.relativeLuminance("#000000"), 0);
  assert.equal(ColorScience.relativeLuminance("#FFFFFF"), 1);
});

test("WCAG contrast ratio is symmetric and black against white is 21:1", () => {
  assert.equal(ColorScience.contrastRatio("#000000", "#FFFFFF"), 21);
  assert.equal(ColorScience.contrastRatio("#FFFFFF", "#000000"), 21);
  closeTo(ColorScience.contrastRatio("#777777", "#FFFFFF"), 4.478089453577214, 1e-12);
  assert.equal(ColorScience.contrastRatio("#111111", "#111111"), 1);
});

test("interpolation preserves endpoints and applies documented midpoint rounding", () => {
  assert.equal(ColorScience.interpolateHex("#FF0000", "#0000FF", 0), "#FF0000");
  assert.equal(ColorScience.interpolateHex("#FF0000", "#0000FF", 1), "#0000FF");
  assert.equal(ColorScience.interpolateHex("#FF0000", "#0000FF", 0.5), "#800080");
});

test("color ramps include both endpoints and remain deterministic", () => {
  assert.deepEqual(ColorScience.createColorRamp("#000000", "#FFFFFF", 5), [
    "#000000", "#404040", "#808080", "#BFBFBF", "#FFFFFF"
  ]);
  assert.deepEqual(ColorScience.createColorRamp("#123456", "#123456", 3), ["#123456", "#123456", "#123456"]);
});

test("light and dark ramps include the base color and stay within bounded shade steps", () => {
  const ramps = ColorScience.createLightDarkRamps("#808080", 4, 0.75);
  assert.equal(ramps.base, "#808080");
  assert.equal(ramps.dark.length, 4);
  assert.equal(ramps.light.length, 4);
  assert.equal(ramps.dark[3], "#808080");
  assert.equal(ramps.light[0], "#808080");
  assert.equal(ramps.dark[0], "#202020");
  assert.equal(ramps.light[3], "#DFDFDF");
});

test("ramp steps and shade mix are bounded and validated", () => {
  assert.throws(() => ColorScience.createColorRamp("#000000", "#FFFFFF", 1), /2 to 64/);
  assert.throws(() => ColorScience.createColorRamp("#000000", "#FFFFFF", 65), /2 to 64/);
  assert.throws(() => ColorScience.createLightDarkRamps("#808080", 3, 1.1), /between 0 and 1/);
  assert.throws(() => ColorScience.createLightDarkRamps("#808080", 3, -0.1), /between 0 and 1/);
});

test("invalid color, channel, hue and normalized component values are rejected", () => {
  assert.throws(() => ColorScience.hexToRgb("red"), /six-digit HEX/);
  assert.throws(() => ColorScience.rgbToHex(-1, 0, 0), /between 0 and 255/);
  assert.throws(() => ColorScience.rgbToHsl(256, 0, 0), /between 0 and 255/);
  assert.throws(() => ColorScience.hslToRgb(NaN, 1, 0.5), /finite number/);
  assert.throws(() => ColorScience.hslToRgb(0, 1.1, 0.5), /between 0 and 1/);
  assert.throws(() => ColorScience.hsvToRgb(0, 1, -0.1), /between 0 and 1/);
  assert.throws(() => ColorScience.interpolateHex("#000000", "#FFFFFF", 2), /between 0 and 1/);
});

test("module exposes a browser global without CommonJS", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "palette-color-science.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.globalThis.ArtClubPaletteColorScience.rgbToHsl, "function");
  assert.equal(typeof context.globalThis.ArtClubPaletteColorScience.contrastRatio, "function");
});
