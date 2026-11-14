/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Accessibility = require("../js/palette-accessibility.js");

function closeTo(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= (tolerance || 1e-8), actual + " differs from " + expected);
}

test("contrast analysis reports WCAG black/white 21:1 and pair pass flags", () => {
  const report = Accessibility.analyzeContrastPairs(["#000000", "#FFFFFF"]);
  assert.equal(report.pairCount, 1);
  assert.equal(report.pairs[0].ratio, 21);
  assert.equal(report.pairs[0].passesNormalText, true);
  assert.equal(report.pairs[0].passesLargeText, true);
  assert.equal(report.pairs[0].passesNonText, true);
});

test("contrast flags distinguish normal text from large text thresholds", () => {
  const report = Accessibility.analyzeContrastPairs(["#777777", "#FFFFFF"]);
  closeTo(report.pairs[0].ratio, 4.478089453577214, 1e-12);
  assert.equal(report.pairs[0].passesNormalText, false);
  assert.equal(report.pairs[0].passesLargeText, true);
  assert.equal(report.pairs[0].passesNonText, true);
});

test("background contrast checks are generated for each palette entry/background pair", () => {
  const report = Accessibility.analyzeContrastPairs(["#000000", "#777777"], {
    backgrounds: ["#FFFFFF", "#000000"]
  });
  assert.equal(report.backgroundChecks.length, 4);
  assert.equal(report.backgroundChecks[0].ratio, 21);
  assert.equal(report.backgroundChecks[1].ratio, 1);
  assert.equal(report.summary.backgroundNormalTextFailCount, 2);
});

test("contrast audit accepts customized valid thresholds and rejects invalid thresholds", () => {
  assert.equal(Accessibility.analyzeContrastPairs(["#000000", "#FFFFFF"], { textThreshold: 7 }).pairs[0].passesNormalText, true);
  assert.throws(() => Accessibility.analyzeContrastPairs(["#000000"], { textThreshold: 0.9 }), /between 1 and 21/);
  assert.throws(() => Accessibility.analyzeContrastPairs(["#000000"], { backgrounds: ["bad"] }), /six-digit HEX/);
});

test("RGB to Lab matches known D65 reference values for red", () => {
  const lab = Accessibility.rgbToLab("#FF0000");
  closeTo(lab.l, 53.24079414130722, 1e-8);
  closeTo(lab.a, 80.09245959641109, 1e-8);
  closeTo(lab.b, 67.20319651585301, 1e-8);
});

test("CIE76 distance is symmetric and reports identical colors as zero", () => {
  assert.equal(Accessibility.deltaE76("#123456", "#123456"), 0);
  closeTo(Accessibility.deltaE76("#FF0000", "#00FF00"), Accessibility.deltaE76("#00FF00", "#FF0000"));
});

test("near-duplicate detection reports close colors and keeps deterministic sorted order", () => {
  const report = Accessibility.findNearDuplicateColors(["#202020", "#212121", "#FFFFFF"], { threshold: 3 });
  assert.equal(report.metric, "CIE76");
  assert.equal(report.nearDuplicatePairCount, 1);
  assert.deepEqual([report.pairs[0].firstIndex, report.pairs[0].secondIndex], [0, 1]);
  assert.ok(report.pairs[0].deltaE76 < 3);
});

test("near-duplicate detection includes exact duplicates and case-normalized values", () => {
  const report = Accessibility.findNearDuplicateColors(["#abcdef", "#ABCDEF", "#000000"]);
  assert.equal(report.exactDuplicatePairCount, 1);
  assert.equal(report.pairs[0].exactDuplicate, true);
  assert.equal(report.pairs[0].deltaE76, 0);
});

test("near-duplicate detection enforces a bounded positive threshold", () => {
  assert.throws(() => Accessibility.findNearDuplicateColors(["#000000"], { threshold: 0 }), /greater than 0/);
  assert.throws(() => Accessibility.findNearDuplicateColors(["#000000"], { threshold: 101 }), /at most 100/);
});

test("normal color vision preview returns normalized original colors", () => {
  assert.deepEqual(Accessibility.simulatePalette(["#aa0000", "#00FF00"], "normal"), ["#AA0000", "#00FF00"]);
});

test("protanopia, deuteranopia and tritanopia transforms are deterministic and bounded", () => {
  const color = "#FF0000";
  const outputs = ["protanopia", "deuteranopia", "tritanopia"].map(type => Accessibility.simulateColorVision(color, type));
  outputs.forEach(value => {
    assert.match(value, /^#[0-9A-F]{6}$/);
  });
  assert.deepEqual(outputs, ["protanopia", "deuteranopia", "tritanopia"].map(type => Accessibility.simulateColorVision(color, type)));
  assert.notEqual(outputs[0], color);
  assert.notEqual(outputs[1], color);
  assert.notEqual(outputs[2], color);
});

test("achromatopsia preview produces a grayscale value", () => {
  const color = Accessibility.simulateColorVision("#FF0000", "achromatopsia");
  assert.match(color, /^#([0-9A-F]{2})\1\1$/);
});

test("color vision transforms preserve black and white endpoints", () => {
  ["protanopia", "deuteranopia", "tritanopia", "achromatopsia"].forEach(type => {
    assert.equal(Accessibility.simulateColorVision("#000000", type), "#000000");
    assert.equal(Accessibility.simulateColorVision("#FFFFFF", type), "#FFFFFF");
  });
});

test("unknown simulation types and malformed palettes are rejected", () => {
  assert.throws(() => Accessibility.simulateColorVision("#000000", "ultraviolet"), /Simulation type/);
  assert.throws(() => Accessibility.simulatePalette([], "normal"), /1–256/);
  assert.throws(() => Accessibility.simulatePalette(["not-hex"], "normal"), /six-digit HEX/);
});

test("complete palette audit returns contrast, near-duplicate and all preview transforms", () => {
  const report = Accessibility.auditPaletteAccessibility(["#000000", "#FFFFFF", "#202020", "#212121"], {
    backgrounds: ["#FFFFFF"]
  });
  assert.equal(report.contrast.pairCount, 6);
  assert.equal(report.nearDuplicates.nearDuplicatePairCount >= 1, true);
  assert.deepEqual(Object.keys(report.colorVisionPreviews), [
    "normal", "protanopia", "deuteranopia", "tritanopia", "achromatopsia"
  ]);
  assert.equal(report.colorVisionPreviews.normal[0], "#000000");
  assert.equal(report.limitations.length, 3);
});

test("palette and background inputs must be dense bounded arrays", () => {
  const sparse = ["#000000", "#FFFFFF"];
  delete sparse[1];
  assert.throws(() => Accessibility.analyzeContrastPairs(sparse), /sparse or missing/);
  assert.throws(() => Accessibility.analyzeContrastPairs(["#000000"], { backgrounds: Array(17).fill("#FFFFFF") }), /at most 16/);
});

test("module exposes a browser global without CommonJS", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "palette-accessibility.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.globalThis.ArtClubPaletteAccessibility.auditPaletteAccessibility, "function");
});
