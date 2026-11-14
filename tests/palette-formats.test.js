/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const PaletteFormats = require("../js/palette-formats.js");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "palette-formats.js"), "utf8");
const samplePalette = {
  name: "Workshop palette",
  columns: 4,
  colors: [
    { hex: "#123456", name: "Deep blue" },
    { hex: "#AABBCC", name: "Mist" },
    { hex: "#123456", name: "Deep blue duplicate" }
  ]
};

function assertLineError(result, code, line) {
  assert.equal(result.ok, false);
  assert.ok(result.errors.some(error => error.code === code && error.line === line), JSON.stringify(result.errors));
}

test("GPL export/import round-trips palette name, column count, color names, order and duplicates", () => {
  const fixture = PaletteFormats.exportGPL(samplePalette);
  const parsed = PaletteFormats.parseGPL(fixture);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.palette, samplePalette);
  assert.match(fixture, /^GIMP Palette\nName: Workshop palette\nColumns: 4\n/);
});

test("GPL parser accepts the legacy header layout, comments and unnamed colors", () => {
  const fixture = "GIMP Palette\n# old-style file\n0 16 255\n255 0 1 accent\n";
  const parsed = PaletteFormats.parseGPL(fixture);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.palette, {
    name: "Untitled palette",
    colors: [{ hex: "#0010FF" }, { hex: "#FF0001", name: "accent" }]
  });
});

test("GPL parser reports malformed channels and color rows with source line numbers", () => {
  assertLineError(PaletteFormats.parseGPL("GIMP Palette\nName: Test\nColumns: 0\n256 0 0 red\n"), "channel-out-of-range", 4);
  assertLineError(PaletteFormats.parseGPL("GIMP Palette\nName: Test\nnot a color\n"), "invalid-color-line", 3);
  assertLineError(PaletteFormats.parseGPL("GIMP Palette\nName: Test\n-1 0 0\n"), "channel-out-of-range", 3);
});

test("GPL parser validates metadata and requires at least one color", () => {
  assertLineError(PaletteFormats.parseGPL("GIMP Palette\nName: \n0 0 0\n"), "empty-name", 2);
  assertLineError(PaletteFormats.parseGPL("GIMP Palette\nName: Test\nColumns: 256\n0 0 0\n"), "invalid-columns", 3);
  assertLineError(PaletteFormats.parseGPL("GIMP Palette\nName: Empty\nColumns: 0\n"), "empty-palette", 4);
});

test("JASC-PAL export/import round-trips RGB order and duplicate colors", () => {
  const fixture = PaletteFormats.exportJASCPAL(samplePalette);
  const parsed = PaletteFormats.parseJASCPAL(fixture);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.palette.colors, [
    { hex: "#123456" }, { hex: "#AABBCC" }, { hex: "#123456" }
  ]);
  assert.match(fixture, /^JASC-PAL\r\n0100\r\n3\r\n/);
});

test("JASC-PAL parser rejects unsupported headers and versions", () => {
  assertLineError(PaletteFormats.parseJASCPAL("JASC\n0100\n1\n0 0 0\n"), "invalid-header", 1);
  assertLineError(PaletteFormats.parseJASCPAL("JASC-PAL\n0200\n1\n0 0 0\n"), "unsupported-version", 2);
});

test("JASC-PAL parser rejects truncated, extra, malformed and out-of-range rows", () => {
  assertLineError(PaletteFormats.parseJASCPAL("JASC-PAL\n0100\n2\n0 0 0\n"), "truncated-palette", 5);
  assertLineError(PaletteFormats.parseJASCPAL("JASC-PAL\n0100\n1\n0 0 0\n255 255 255\n"), "unexpected-content", 5);
  assertLineError(PaletteFormats.parseJASCPAL("JASC-PAL\n0100\n1\n0 0\n"), "invalid-color-line", 4);
  assertLineError(PaletteFormats.parseJASCPAL("JASC-PAL\n0100\n1\n0 256 0\n"), "channel-out-of-range", 4);
  assertLineError(PaletteFormats.parseJASCPAL("JASC-PAL\n0100\n1\n0 1.5 0\n"), "invalid-color-line", 4);
});

test("JASC-PAL count is bounded and never silently accepts zero", () => {
  assertLineError(PaletteFormats.parseJASCPAL("JASC-PAL\n0100\n4097\n"), "invalid-count", 3);
  assertLineError(PaletteFormats.parseJASCPAL("JASC-PAL\n0100\n0\n"), "invalid-count", 3);
  assert.throws(() => PaletteFormats.exportJASCPAL({ colors: Array(4097).fill("#000000") }), /4096 color limit/);
});

test("JSON export/import round-trips palette name, color names, order and duplicates", () => {
  const fixture = PaletteFormats.exportJSON(samplePalette);
  const parsed = PaletteFormats.parseJSON(fixture);
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.palette, {
    name: "Workshop palette",
    colors: samplePalette.colors
  });
  assert.match(fixture, /"format": "one-pixel-studio-palette"/);
  assert.match(fixture, /"version": 1/);
});

test("JSON parser rejects malformed syntax with a line-numbered diagnostic", () => {
  const parsed = PaletteFormats.parseJSON('{\n  "format": "one-pixel-studio-palette",\n  "colors": [\n    }\n');
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0].code, "invalid-json");
  assert.ok(parsed.errors[0].line >= 3);
});

test("JSON parser validates format, version, color shape and HEX values", () => {
  assertLineError(PaletteFormats.parseJSON(JSON.stringify({ format: "other", version: 1, name: "Bad", colors: [{ hex: "#000000" }] })), "invalid-format", 1);
  assertLineError(PaletteFormats.parseJSON(JSON.stringify({ format: PaletteFormats.JSON_FORMAT, version: 2, name: "Bad", colors: [{ hex: "#000000" }] })), "unsupported-version", 1);
  assertLineError(PaletteFormats.parseJSON(JSON.stringify({ format: PaletteFormats.JSON_FORMAT, version: 1, name: "Bad", colors: [{ hex: "#12GG00" }] })), "invalid-hex", 1);
  assertLineError(PaletteFormats.parseJSON(JSON.stringify({ format: PaletteFormats.JSON_FORMAT, version: 1, name: "Bad", colors: [] })), "invalid-count", 1);
});

test("JSON parser rejects unknown schema fields instead of silently dropping them", () => {
  const fixture = JSON.stringify({
    format: PaletteFormats.JSON_FORMAT,
    version: 1,
    name: "Bad extension",
    extra: true,
    colors: [{ hex: "#000000", alpha: 0 }]
  });
  const parsed = PaletteFormats.parseJSON(fixture);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors.filter(error => error.code === "unsupported-property").length, 2);
});

test("JSON parser normalizes shorthand and lowercase HEX to uppercase #RRGGBB", () => {
  const parsed = PaletteFormats.parseJSON(JSON.stringify({
    format: PaletteFormats.JSON_FORMAT,
    version: 1,
    name: "Normalized",
    colors: [{ hex: "abc" }, { hex: "#00aAfF" }]
  }));
  assert.equal(parsed.ok, true);
  assert.deepEqual(parsed.palette.colors, [{ hex: "#AABBCC" }, { hex: "#00AAFF" }]);
});

test("unified parser detects all formats and reports unknown input", () => {
  assert.equal(PaletteFormats.parse(PaletteFormats.exportGPL(samplePalette)).palette.name, samplePalette.name);
  assert.deepEqual(PaletteFormats.parse(PaletteFormats.exportJASCPAL(samplePalette)).palette.colors.map(c => c.hex), samplePalette.colors.map(c => c.hex));
  assert.equal(PaletteFormats.parse(PaletteFormats.exportJSON(samplePalette)).ok, true);
  assert.equal(PaletteFormats.parse("unrecognized").errors[0].code, "unknown-format");
  assert.equal(PaletteFormats.detectFormat(PaletteFormats.exportJASCPAL(samplePalette)), "jasc-pal");
});

test("palette normalization rejects sparse holes in object and array-shorthand inputs", () => {
  const sparseColors = ["#000000", , "#FFFFFF"];
  assert.throws(
    () => PaletteFormats.normalizePalette({ name: "Sparse object", colors: sparseColors }),
    /sparse palette arrays are not allowed/
  );
  assert.throws(
    () => PaletteFormats.exportGPL(sparseColors),
    /sparse palette arrays are not allowed/
  );
  assert.throws(
    () => PaletteFormats.exportJSON(sparseColors),
    /sparse palette arrays are not allowed/
  );
});

test("palette normalization rejects explicit undefined entries in object and array-shorthand inputs", () => {
  const undefinedColors = ["#000000", undefined, "#FFFFFF"];
  assert.throws(
    () => PaletteFormats.normalizePalette({ name: "Undefined object", colors: undefinedColors }),
    /must not be undefined/
  );
  assert.throws(
    () => PaletteFormats.exportGPL(undefinedColors),
    /must not be undefined/
  );
  assert.throws(
    () => PaletteFormats.exportJASCPAL(undefinedColors),
    /must not be undefined/
  );
});

test("export validation rejects malformed colors and multiline names", () => {
  assert.throws(() => PaletteFormats.exportGPL({ name: "Bad\nName", colors: ["#000000"] }), /Palette name/);
  assert.throws(() => PaletteFormats.exportJSON({ name: "Bad", colors: ["not-hex"] }), /valid 3- or 6-digit HEX/);
  assert.throws(() => PaletteFormats.export("x", "invalid"), /Choose an export format/);
});

test("all parsers enforce the 1 MiB file limit", () => {
  const oversized = "GIMP Palette\n" + "#".repeat(PaletteFormats.MAX_FILE_BYTES);
  assertLineError(PaletteFormats.parseGPL(oversized), "file-too-large", 1);
  assertLineError(PaletteFormats.parseJASCPAL(oversized), "file-too-large", 1);
  assertLineError(PaletteFormats.parseJSON(oversized), "file-too-large", 1);
});

test("module exposes a browser global without requiring CommonJS", () => {
  const context = { globalThis: {} };
  vm.runInNewContext(source, context);
  assert.equal(typeof context.globalThis.ArtClubPaletteFormats.parseGPL, "function");
  assert.equal(context.globalThis.ArtClubPaletteFormats.parseGPL("GIMP Palette\n0 0 0\n").ok, true);
});
