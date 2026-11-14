/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const Distance = require("../js/palette-distance.js");

const SHARMA_REFERENCE_PAIRS = "50.0000 2.6772 -79.7751 50.0000 0.0000 -82.7485 2.0425\n50.0000 3.1571 -77.2803 50.0000 0.0000 -82.7485 2.8615\n50.0000 2.8361 -74.0200 50.0000 0.0000 -82.7485 3.4412\n50.0000 -1.3802 -84.2814 50.0000 0.0000 -82.7485 1.0000\n50.0000 -1.1848 -84.8006 50.0000 0.0000 -82.7485 1.0000\n50.0000 -0.9009 -85.5211 50.0000 0.0000 -82.7485 1.0000\n50.0000 0.0000 0.0000 50.0000 -1.0000 2.0000 2.3669\n50.0000 -1.0000 2.0000 50.0000 0.0000 0.0000 2.3669\n50.0000 2.4900 -0.0010 50.0000 -2.4900 0.0009 7.1792\n50.0000 2.4900 -0.0010 50.0000 -2.4900 0.0010 7.1792\n50.0000 2.4900 -0.0010 50.0000 -2.4900 0.0011 7.2195\n50.0000 2.4900 -0.0010 50.0000 -2.4900 0.0012 7.2195\n50.0000 -0.0010 2.4900 50.0000 0.0009 -2.4900 4.8045\n50.0000 -0.0010 2.4900 50.0000 0.0010 -2.4900 4.8045\n50.0000 -0.0010 2.4900 50.0000 0.0011 -2.4900 4.7461\n50.0000 2.5000 0.0000 50.0000 0.0000 -2.5000 4.3065\n50.0000 2.5000 0.0000 73.0000 25.0000 -18.0000 27.1492\n50.0000 2.5000 0.0000 61.0000 -5.0000 29.0000 22.8977\n50.0000 2.5000 0.0000 56.0000 -27.0000 -3.0000 31.9030\n50.0000 2.5000 0.0000 58.0000 24.0000 15.0000 19.4535\n50.0000 2.5000 0.0000 50.0000 3.1736 0.5854 1.0000\n50.0000 2.5000 0.0000 50.0000 3.2972 0.0000 1.0000\n50.0000 2.5000 0.0000 50.0000 1.8634 0.5757 1.0000\n50.0000 2.5000 0.0000 50.0000 3.2592 0.3350 1.0000\n60.2574 -34.0099 36.2677 60.4626 -34.1751 39.4387 1.2644\n63.0109 -31.0961 -5.8663 62.8187 -29.7946 -4.0864 1.2630\n61.2901 3.7196 -5.3901 61.4292 2.2480 -4.9620 1.8731\n35.0831 -44.1164 3.7933 35.0232 -40.0716 1.5901 1.8645\n22.7233 20.0904 -46.6940 23.0331 14.9730 -42.5619 2.0373\n36.4612 47.8580 18.3852 36.2715 50.5065 21.2231 1.4146\n90.8027 -2.0831 1.4410 91.1528 -1.6435 0.0447 1.4441\n90.9257 -0.5406 -0.9208 88.6381 -0.8985 -0.7239 1.5381\n6.7747 -0.2908 -2.4247 5.8714 -0.0985 -2.2286 0.6377\n2.0776 0.0795 -1.1350 0.9033 -0.0636 -0.5514 0.9082";

function closeTo(actual, expected, tolerance) {
  assert.ok(Math.abs(actual - expected) <= (tolerance || 0.0001), actual + " differs from " + expected);
}

test("CIEDE2000 matches all 34 published Sharma-Wu-Dalal reference pairs", () => {
  const rows = SHARMA_REFERENCE_PAIRS.trim().split(/\r?\n/);
  assert.equal(rows.length, 34);
  rows.forEach((row, index) => {
    const [l1, a1, b1, l2, a2, b2, expected] = row.trim().split(/\s+/).map(Number);
    const actual = Distance.ciede2000([l1, a1, b1], [l2, a2, b2]);
    closeTo(actual, expected, 0.0001);
    assert.ok(actual >= 0, "pair " + (index + 1) + " must not produce negative distance");
  });
});

test("CIEDE2000 is symmetric and identical Lab values have zero distance", () => {
  const first = [50, 2.6772, -79.7751];
  const second = [50, 0, -82.7485];
  closeTo(Distance.ciede2000(first, second), Distance.ciede2000(second, first), 1e-12);
  assert.equal(Distance.ciede2000(first, first), 0);
});

test("neutral and near-neutral colors remain finite at hue wrap boundaries", () => {
  assert.equal(Distance.ciede2000([50, 0, 0], [50, 0, 0]), 0);
  const nearNeutral = Distance.ciede2000([50, 0.0001, -0.0001], [50, -0.0001, 0.0001]);
  assert.ok(Number.isFinite(nearNeutral));
  assert.ok(nearNeutral >= 0);
});

test("HEX to Lab uses D65 sRGB conversion and returns known red and white coordinates", () => {
  const red = Distance.hexToLab("#FF0000");
  closeTo(red.l, 53.24079414130722, 1e-8);
  closeTo(red.a, 80.09245959641109, 1e-8);
  closeTo(red.b, 67.20319651585301, 1e-8);
  assert.equal(Distance.hexToLab("#FFFFFF").l, 100);
  assert.equal(Distance.hexToLab("#000000").l, 0);
});

test("CIEDE2000 HEX convenience distance compares identical colors as zero", () => {
  assert.equal(Distance.deltaE00Hex("#123456", "#123456"), 0);
  assert.ok(Distance.deltaE00Hex("#FF0000", "#00FF00") > 0);
});

test("CIE76 Lab and HEX distances are deterministic and symmetric", () => {
  assert.equal(Distance.deltaE76Lab([50, 0, 0], [50, 0, 0]), 0);
  closeTo(
    Distance.deltaE76Lab([50, 2, -3], [52, 5, -7]),
    Distance.deltaE76Lab([52, 5, -7], [50, 2, -3]),
    1e-12
  );
  assert.ok(Distance.deltaE76Hex("#000000", "#FFFFFF") > 0);
});

test("CIEDE2000 parametric weighting factors are opt-in and affect a pair with lightness difference", () => {
  const first = [60.2574, -34.0099, 36.2677];
  const second = [60.4626, -34.1751, 39.4387];
  const unweighted = Distance.ciede2000(first, second);
  const weighted = Distance.ciede2000(first, second, { kL: 2, kC: 1, kH: 1 });
  assert.notEqual(weighted, unweighted);
  assert.throws(() => Distance.ciede2000(first, second, { kL: 0 }), /greater than 0/);
  assert.throws(() => Distance.ciede2000(first, second, { kH: 11 }), /at most 10/);
});

test("squared RGB remains the default nearest-color metric", () => {
  const result = Distance.findNearestColor("#000000", ["#030004", "#FFFFFF"]);
  assert.equal(result.ok, true);
  assert.equal(result.metric, "rgb-squared");
  assert.equal(result.index, 0);
  assert.equal(result.distance, 25);
  assert.equal(result.distanceSquared, 25);
  assert.deepEqual(result.diagnostics, []);
});

test("legacy RGB Euclidean is available as an explicit alias and CIE76 is opt-in", () => {
  const rgb = Distance.findNearestColor("#000000", ["#030004"], { metric: "rgb-euclidean" });
  assert.equal(rgb.metric, "rgb-euclidean");
  assert.equal(rgb.distance, 5);
  const cie76 = Distance.findNearestColor("#000000", ["#FFFFFF"], { metric: "cie76" });
  assert.equal(cie76.metric, "cie76");
  assert.ok(cie76.distance > 0);
});

test("CIEDE2000 nearest-color matching is explicit opt-in", () => {
  const result = Distance.findNearestColor("#FF0000", ["#EF0000", "#00FF00"], { metric: "ciede2000" });
  assert.equal(result.metric, "ciede2000");
  assert.equal(result.index, 0);
  assert.ok(result.distance > 0);
});

test("nearest-color matching uses first palette index for equal-distance ties", () => {
  const rgb = Distance.findNearestColor("#010000", ["#000000", "#020000"]);
  assert.equal(rgb.index, 0);
  assert.equal(rgb.tieCount, 1);
  assert.equal(rgb.diagnostics[0].code, "equal-distance-tie");
  const perceptual = Distance.findNearestColor("#000000", ["#FFFFFF", "#FFFFFF"], { metric: "ciede2000" });
  assert.equal(perceptual.index, 0);
  assert.equal(perceptual.tieCount, 1);
});

test("transparent target returns an explicit structured non-match diagnostic", () => {
  const result = Distance.findNearestColor(null, ["#000000", "#FFFFFF"]);
  assert.equal(result.ok, false);
  assert.equal(result.match, null);
  assert.equal(result.color, null);
  assert.equal(result.diagnostics[0].code, "transparent-target");
});

test("mapToPalette preserves null transparency and returns deterministic match diagnostics", () => {
  const result = Distance.mapToPalette(["#000000", null, "#EEEEEE"], ["#000000", "#FFFFFF"], { metric: "ciede2000" });
  assert.deepEqual(result.pixels, ["#000000", null, "#FFFFFF"]);
  assert.equal(result.report.metric, "ciede2000");
  assert.equal(result.report.totalPixelCount, 3);
  assert.equal(result.report.transparentPixelCount, 1);
  assert.equal(result.report.mappedPixelCount, 2);
  assert.equal(result.report.exactMatchCount, 1);
  assert.equal(result.report.changedPixelCount, 1);
});

test("mapToPalette defaults to squared RGB and leaves its input unchanged", () => {
  const pixels = ["#000000", null, "#010000"];
  const before = JSON.stringify(pixels);
  const result = Distance.mapToPalette(pixels, ["#000000", "#FFFFFF"]);
  assert.equal(result.report.metric, "rgb-squared");
  assert.equal(JSON.stringify(pixels), before);
});

test("invalid metrics, Lab values, palette sizes and sparse pixel arrays are rejected", () => {
  assert.throws(() => Distance.ciede2000([101, 0, 0], [50, 0, 0]), /L\* must be between 0 and 100/);
  assert.throws(() => Distance.ciede2000([50, 0], [50, 0, 0]), /must be \[L\*, a\*, b\*\]/);
  assert.throws(() => Distance.ciede2000([50, 0, 0], [50, 0, 0], { kC: NaN }), /finite number/);
  assert.throws(() => Distance.findNearestColor("#000000", ["#FFFFFF"], { metric: "unknown" }), /Metric must be/);
  assert.throws(() => Distance.findNearestColor("#000000", []), /Palette must contain/);
  const sparse = ["#000000", null];
  delete sparse[1];
  assert.throws(() => Distance.mapToPalette(sparse, ["#000000"]), /sparse or missing/);
});

test("mapToPalette supports an empty pixel array without division by zero", () => {
  const result = Distance.mapToPalette([], ["#000000"]);
  assert.deepEqual(result.pixels, []);
  assert.equal(result.report.meanDistance, null);
  assert.equal(result.report.maxDistance, null);
});

test("mapToPalette rejects over-budget work before reading pixels or allocating outputs", () => {
  const oversized = new Proxy(new Array(16385), {
    get(target, property, receiver) {
      if (property === "length") return Reflect.get(target, property, receiver);
      if (typeof property === "string" && /^\\d+$/.test(property)) {
        throw new Error("pixel entries must not be read before budget validation");
      }
      return Reflect.get(target, property, receiver);
    },
    getOwnPropertyDescriptor(target, property) {
      if (typeof property === "string" && /^\\d+$/.test(property)) {
        throw new Error("pixel entries must not be inspected before budget validation");
      }
      return Reflect.getOwnPropertyDescriptor(target, property);
    }
  });
  const palette = new Array(256).fill("#000000");
  assert.throws(
    () => Distance.mapToPalette(oversized, palette),
    /exceeding the comparison budget/
  );
});

test("mapToPalette supports a lower caller budget but cannot raise the hard ceiling", () => {
  assert.throws(
    () => Distance.mapToPalette(["#000000", "#FFFFFF"], ["#000000", "#FFFFFF"], { maxComparisons: 3 }),
    /exceeding the comparison budget of 3/
  );
  assert.throws(
    () => Distance.mapToPalette([], ["#000000"], { maxComparisons: Distance.LIMITS.maxComparisons + 1 }),
    /maxComparisons must be an integer/
  );
  assert.equal(Distance.LIMITS.maxComparisons, 4194304);
});

test("mapToPalette bounds per-pixel details while preserving every mapped pixel", () => {
  const pixels = new Array(1200).fill("#111111");
  const result = Distance.mapToPalette(pixels, ["#000000", "#FFFFFF"]);
  assert.equal(result.pixels.length, pixels.length);
  assert.equal(result.matches.length, Distance.LIMITS.defaultMaxDetails);
  assert.equal(result.matches[999].pixelIndex, 999);
  assert.equal(result.report.detailRecordCount, 1000);
  assert.equal(result.report.detailsTruncated, true);
  assert.equal(result.diagnostics.length, 1);
  assert.equal(result.diagnostics[0].code, "match-details-truncated");
});

test("mapToPalette can disable per-pixel details without changing metric results", () => {
  const pixels = ["#000000", null, "#123456", "#FFFFFF"];
  const full = Distance.mapToPalette(pixels, ["#000000", "#FFFFFF"], { metric: "ciede2000" });
  const summary = Distance.mapToPalette(pixels, ["#000000", "#FFFFFF"], {
    metric: "ciede2000",
    includeMatches: false
  });
  assert.deepEqual(summary.pixels, full.pixels);
  assert.equal(summary.matches, null);
  assert.deepEqual(summary.diagnostics, []);
  assert.equal(summary.report.detailRecordCount, 0);
  assert.equal(summary.report.detailsEnabled, false);
  assert.equal(summary.report.comparisonCount, 8);
});

test("mapToPalette validates detail limits and keeps small-call match ordering stable", () => {
  assert.throws(
    () => Distance.mapToPalette(["#000000"], ["#000000"], { maxDetails: 10001 }),
    /maxDetails must be an integer/
  );
  const result = Distance.mapToPalette(["#000000", null, "#FFFFFF"], ["#000000", "#FFFFFF"]);
  assert.equal(result.matches.length, 3);
  assert.equal(result.matches[0].pixelIndex, 0);
  assert.equal(result.matches[1], null);
  assert.equal(result.matches[2].pixelIndex, 2);
  assert.equal(result.report.detailsTruncated, false);
});

test("browser global exposes CIEDE2000 and opt-in nearest-color APIs", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "palette-distance.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.globalThis.ArtClubPaletteDistance.ciede2000, "function");
  assert.equal(typeof context.globalThis.ArtClubPaletteDistance.findNearestColor, "function");
});

test("seeded Lab pairs remain deterministic and non-negative", () => {
  let state = 0x0C1E2000;
  function random() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  }
  for (let index = 0; index < 100; index += 1) {
    const a = [random() * 100, random() * 256 - 128, random() * 256 - 128];
    const b = [random() * 100, random() * 256 - 128, random() * 256 - 128];
    const first = Distance.ciede2000(a, b);
    const second = Distance.ciede2000(a, b);
    assert.equal(first, second);
    assert.ok(first >= 0);
  }
});
