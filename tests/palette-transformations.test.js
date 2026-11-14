/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Transform = require("../js/palette-transformations.js");

function palette() {
  return {
    name: "Workshop",
    source: "imported",
    columns: 3,
    colors: [
      { hex: "#aa0000", name: "Red", tags: ["warm"] },
      "#00AA00",
      { hex: "#AA0000", name: "Red alternate", note: { keep: true } },
      "#0000FF"
    ]
  };
}

test("reorder creates a new palette in the requested order and preserves color metadata", () => {
  const input = palette();
  const before = JSON.stringify(input);
  const result = Transform.reorderPalette(input, [3, 1, 0, 2]);
  assert.deepEqual(result.palette.colors.map(c => typeof c === "string" ? c : c.hex), ["#0000FF", "#00AA00", "#AA0000", "#AA0000"]);
  assert.equal(result.palette.colors[2].name, "Red");
  assert.equal(result.palette.colors[2].tags[0], "warm");
  assert.equal(result.report.movedEntries, 3);
  assert.equal(JSON.stringify(input), before);
  assert.notEqual(result.palette, input);
});

test("reorder rejects duplicate, missing and out-of-range indices", () => {
  const input = palette();
  assert.throws(() => Transform.reorderPalette(input, [0, 1, 1, 3]), /permutation/);
  assert.throws(() => Transform.reorderPalette(input, [0, 1, 2]), /every palette index/);
  assert.throws(() => Transform.reorderPalette(input, [0, 1, 2, 4]), /permutation/);
});

test("rename changes only the palette name and preserves palette metadata", () => {
  const input = palette();
  const result = Transform.renamePalette(input, "  Night study  ");
  assert.equal(result.palette.name, "Night study");
  assert.equal(result.palette.source, "imported");
  assert.equal(result.palette.columns, 3);
  assert.equal(result.report.previousName, "Workshop");
  assert.equal(input.name, "Workshop");
});

test("rename validates the supplied name", () => {
  assert.throws(() => Transform.renamePalette(palette(), "  "), /New palette name/);
  assert.throws(() => Transform.renamePalette(palette(), "x".repeat(257)), /New palette name/);
});

test("merge preserves color order, duplicate colors and per-color metadata", () => {
  const first = palette();
  const second = { name: "Second", colors: [{ hex: "#00aa00", name: "Green copy" }, "#FFFFFF"] };
  const result = Transform.mergePalettes([first, second]);
  assert.equal(result.palette.name, "Workshop + Second");
  assert.equal(result.palette.colors.length, 6);
  assert.deepEqual(result.palette.colors.map(c => typeof c === "string" ? c : c.hex), [
    "#AA0000", "#00AA00", "#AA0000", "#0000FF", "#00AA00", "#FFFFFF"
  ]);
  assert.equal(result.palette.colors[0].name, "Red");
  assert.equal(result.palette.colors[4].name, "Green copy");
  assert.equal(result.report.duplicateHexCount, 2);
  assert.equal(result.report.discardedMetadata.length, 2);
  assert.deepEqual(result.report.discardedMetadata.map(item => item.field), ["source", "columns"]);
});

test("merge accepts an explicit output name and rejects invalid inputs and overflow", () => {
  assert.equal(Transform.mergePalettes([palette(), { colors: ["#FFFFFF"] }], { name: "Combined" }).palette.name, "Combined");
  assert.throws(() => Transform.mergePalettes([palette()]), /at least two/);
  assert.throws(() => Transform.mergePalettes([palette(), { colors: ["bad"] }]), /six-digit HEX/);
  const large = { colors: Array(2049).fill("#000000") };
  assert.throws(() => Transform.mergePalettes([large, large]), /exceeds the 4096/);
});

test("split partitions every source entry exactly once and retains per-color metadata", () => {
  const input = palette();
  const result = Transform.splitPalette(input, [[0, 2], [1, 3]]);
  assert.equal(result.palettes.length, 2);
  assert.deepEqual(result.palettes.map(item => item.colors.length), [2, 2]);
  assert.equal(result.palettes[0].name, "Workshop 1");
  assert.equal(result.palettes[0].colors[1].name, "Red alternate");
  assert.equal(result.palettes[0].source, "imported");
  assert.equal(result.report.discardedMetadata.length, 0);
  assert.equal(input.colors.length, 4);
});

test("split accepts explicit names and rejects incomplete or repeated partitions", () => {
  const result = Transform.splitPalette(palette(), [[0], [1, 2, 3]], { names: ["Warm", "Cool"] });
  assert.deepEqual(result.palettes.map(item => item.name), ["Warm", "Cool"]);
  assert.throws(() => Transform.splitPalette(palette(), [[0], [1, 2]]), /every palette index/);
  assert.throws(() => Transform.splitPalette(palette(), [[0, 1], [1, 2, 3]]), /partition/);
  assert.throws(() => Transform.splitPalette(palette(), [[0, 1, 2, 3], [0]]), /partition/);
});

test("remove duplicates keep-first policy preserves the first entry and reports discarded metadata", () => {
  const input = palette();
  const before = JSON.stringify(input);
  const result = Transform.removeDuplicateColors(input, { keep: "first" });
  assert.deepEqual(result.palette.colors.map(entry => typeof entry === "string" ? entry : entry.hex), ["#AA0000", "#00AA00", "#0000FF"]);
  assert.equal(result.palette.colors[0].name, "Red");
  assert.equal(result.report.removedCount, 1);
  assert.equal(result.report.removedEntries[0].index, 2);
  assert.equal(result.report.removedEntries[0].entry.name, "Red alternate");
  assert.equal(result.report.discardedMetadata[0].entry.note.keep, true);
  assert.equal(JSON.stringify(input), before);
});

test("remove duplicates keep-last policy retains last-entry metadata without reordering other entries", () => {
  const result = Transform.removeDuplicateColors(palette(), { keep: "last" });
  assert.deepEqual(result.palette.colors.map(entry => typeof entry === "string" ? entry : entry.hex), ["#00AA00", "#AA0000", "#0000FF"]);
  assert.equal(result.palette.colors[1].name, "Red alternate");
  assert.equal(result.report.removedEntries[0].index, 0);
});

test("remove duplicates defaults to keep-first and rejects unknown policies", () => {
  assert.equal(Transform.removeDuplicateColors(palette()).palette.colors.length, 3);
  assert.throws(() => Transform.removeDuplicateColors(palette(), { keep: "random" }), /first or last/);
});

test("replaceColor updates matching HEX values case-insensitively and preserves names and order", () => {
  const input = palette();
  const before = JSON.stringify(input);
  const result = Transform.replaceColor(input, "#aa0000", "#112233");
  assert.deepEqual(result.report.matchedIndices, [0, 2]);
  assert.equal(result.report.matchedEntries, 2);
  assert.equal(result.palette.colors[0].hex, "#112233");
  assert.equal(result.palette.colors[0].name, "Red");
  assert.equal(result.palette.colors[2].name, "Red alternate");
  assert.equal(result.palette.colors[1], "#00AA00");
  assert.equal(JSON.stringify(input), before);
});

test("replaceColor reports no matches and explicit same-color no-op", () => {
  const noMatch = Transform.replaceColor(palette(), "#123456", "#654321");
  assert.equal(noMatch.report.matchedEntries, 0);
  const noOp = Transform.replaceColor(palette(), "#AA0000", "#aa0000");
  assert.equal(noOp.report.isNoOp, true);
  assert.equal(noOp.report.matchedEntries, 2);
});

test("replaceColorInBuffers estimates and returns new buffers without mutation", () => {
  const buffers = [
    { id: "cel-a", frameId: "f1", pixels: ["#AA0000", null, "#00FF00"] },
    { id: "cel-b", pixels: ["#aa0000", "#000000"] }
  ];
  const before = JSON.stringify(buffers);
  const result = Transform.replaceColorInBuffers(buffers, "#aa0000", "#112233");
  assert.equal(result.report.matchedPixels, 2);
  assert.equal(result.report.changedPixels, 2);
  assert.deepEqual(result.buffers[0].pixels, ["#112233", null, "#00FF00"]);
  assert.deepEqual(result.buffers[1].pixels, ["#112233", "#000000"]);
  assert.equal(result.report.impactsByBuffer[0].id, "cel-a");
  assert.equal(JSON.stringify(buffers), before);
  assert.notEqual(result.buffers[0], buffers[0]);
});

test("replaceColorInBuffers validates dense pixels and unique buffer references", () => {
  const sparse = [{ pixels: ["#000000", "#FFFFFF"] }];
  delete sparse[0].pixels[0];
  assert.throws(() => Transform.replaceColorInBuffers(sparse, "#000000", "#111111"), /sparse or missing/);
  const repeated = { pixels: ["#000000"] };
  assert.throws(() => Transform.replaceColorInBuffers([repeated, repeated], "#000000", "#111111"), /more than once/);
  assert.throws(() => Transform.replaceColorInBuffers([{ pixels: ["not-hex"] }], "#000000", "#111111"), /six-digit HEX/);
});

test("harmony suggestions generate complementary, analogous and triadic colors", () => {
  const complementary = Transform.harmonySuggestions("#FF0000", "complementary");
  assert.deepEqual(complementary.suggestions, ["#00FFFF"]);
  const analogous = Transform.harmonySuggestions("#FF0000", "analogous");
  assert.deepEqual(analogous.suggestions, ["#FF0080", "#FF8000"]);
  const triadic = Transform.harmonySuggestions("#FF0000", "triadic");
  assert.deepEqual(triadic.suggestions, ["#00FF00", "#0000FF"]);
});

test("monochrome suggestions produce bounded lightness variations and remove base duplicates", () => {
  const result = Transform.harmonySuggestions("#808080", "monochrome", { lightnessSteps: [0, 0.25, 0.5, 0.75, 1] });
  assert.deepEqual(result.suggestions, ["#000000", "#404040", "#BFBFBF", "#FFFFFF"]);
  assert.equal(result.report.generatedCount, 4);
});

test("harmony validates requested type and monochrome values", () => {
  assert.throws(() => Transform.harmonySuggestions("#FF0000", "square"), /Harmony type/);
  assert.throws(() => Transform.harmonySuggestions("#FF0000", "monochrome", { lightnessSteps: [0.5] }), /2–16/);
  assert.throws(() => Transform.harmonySuggestions("#FF0000", "monochrome", { lightnessSteps: [0, 2] }), /between 0 and 1/);
});

test("two-color ramps include exact endpoints and deterministic intermediate colors", () => {
  assert.deepEqual(Transform.buildRampFromTwoColors("#000000", "#FFFFFF", 5), [
    "#000000", "#404040", "#808080", "#BFBFBF", "#FFFFFF"
  ]);
  assert.deepEqual(Transform.buildRampFromTwoColors("#123456", "#123456", 3), ["#123456", "#123456", "#123456"]);
});

test("ramp generation is bounded and rejects invalid HEX or step counts", () => {
  assert.throws(() => Transform.buildRampFromTwoColors("red", "#FFFFFF", 3), /six-digit HEX/);
  assert.throws(() => Transform.buildRampFromTwoColors("#000000", "#FFFFFF", 1), /2 to 64/);
  assert.throws(() => Transform.buildRampFromTwoColors("#000000", "#FFFFFF", 65), /2 to 64/);
});

test("operations reject malformed palette shapes and invalid metadata before transforming", () => {
  assert.throws(() => Transform.renamePalette({ colors: ["red"] }, "Valid"), /six-digit HEX/);
  assert.throws(() => Transform.reorderPalette({ colors: [] }, []), /1–4096/);
  const circular = { colors: ["#000000"] };
  circular.extra = circular;
  assert.throws(() => Transform.renamePalette(circular, "New"), /circular references/);
});

test("transformations accept frozen input and preserve it byte-for-byte", () => {
  const input = palette();
  input.colors.forEach(entry => { if (entry && typeof entry === "object") Object.freeze(entry.tags || {}), Object.freeze(entry); });
  Object.freeze(input.colors);
  Object.freeze(input);
  const before = JSON.stringify(input);
  Transform.reorderPalette(input, [3, 2, 1, 0]);
  Transform.removeDuplicateColors(input, { keep: "last" });
  Transform.replaceColor(input, "#AA0000", "#111111");
  assert.equal(JSON.stringify(input), before);
});

test("module exposes a browser global without CommonJS", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const vm = require("node:vm");
  const source = fs.readFileSync(path.join(__dirname, "..", "js", "palette-transformations.js"), "utf8");
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.globalThis.ArtClubPaletteTransformations.mergePalettes, "function");
  assert.equal(typeof context.globalThis.ArtClubPaletteTransformations.harmonySuggestions, "function");
});
