/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Formats = require("../js/palette-formats.js");

const fixtureRoot = path.join(__dirname, "fixtures", "palettes");

function fixture(relativePath) {
  return fs.readFileSync(path.join(fixtureRoot, relativePath), "utf8");
}

function hexes(palette) {
  return palette.colors.map(color => color.hex);
}

function seededRandom(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function makeSeededPalette(seed, count) {
  const random = seededRandom(seed);
  const colors = [];
  for (let index = 0; index < count; index += 1) {
    const channel = () => Math.floor(random() * 256).toString(16).padStart(2, "0");
    const hex = "#" + channel() + channel() + channel();
    colors.push({ hex: hex.toUpperCase(), name: "Seed " + seed + " color " + index });
  }
  return { name: "Seeded palette " + seed, columns: count % 16, colors };
}

test("GPL fixture corpus covers comments, names, ordering and normalized RGB", () => {
  const parsed = Formats.parseGPL(fixture("gpl/gpl-comments-names.gpl"));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.palette.name, "Warm study");
  assert.equal(parsed.palette.columns, 3);
  assert.deepEqual(hexes(parsed.palette), ["#FF2010", "#DC6028", "#B4783C"]);
  assert.deepEqual(parsed.palette.colors.map(color => color.name), ["Ember", "Clay", "Sand"]);
});

test("GPL legacy fixture without Name/Columns remains readable", () => {
  const parsed = Formats.parseGPL(fixture("gpl/gpl-legacy-layout.gpl"));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.palette.name, "Untitled palette");
  assert.equal(parsed.palette.columns, undefined);
  assert.deepEqual(hexes(parsed.palette), ["#0010FF", "#FF0001", "#112233"]);
});

test("GPL BOM and CRLF fixture is detected and parsed", () => {
  const input = fixture("gpl/gpl-bom-crlf.gpl");
  assert.equal(Formats.detectFormat(input), "gpl");
  const parsed = Formats.parse(input);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.palette.name, "BOM fixture");
  assert.deepEqual(hexes(parsed.palette), ["#0C2238", "#C8D2DC"]);
});

test("JASC-PAL fixture covers CRLF and trailing blank lines", () => {
  const input = fixture("pal/jasc-basic-crlf.pal");
  assert.equal(Formats.detectFormat(input), "jasc-pal");
  const parsed = Formats.parse(input);
  assert.equal(parsed.ok, true);
  assert.deepEqual(hexes(parsed.palette), ["#FF0000", "#00FF00", "#0000FF"]);
});

test("JASC-PAL malformed fixtures report expected diagnostic codes", () => {
  const cases = [
    ["pal/jasc-truncated.pal", "truncated-palette"],
    ["pal/jasc-extra-row.pal", "unexpected-content"],
    ["pal/jasc-channel-out-of-range.pal", "channel-out-of-range"],
    ["pal/jasc-invalid-count-zero.pal", "invalid-count"]
  ];
  cases.forEach(([pathName, expectedCode]) => {
    const parsed = Formats.parseJASCPAL(fixture(pathName));
    assert.equal(parsed.ok, false, pathName);
    assert.ok(parsed.errors.some(error => error.code === expectedCode), pathName + ": " + JSON.stringify(parsed.errors));
  });
});

test("JSON fixture preserves order, names and duplicate entries while normalizing HEX", () => {
  const parsed = Formats.parseJSON(fixture("json/json-names-duplicates.json"));
  assert.equal(parsed.ok, true);
  assert.equal(parsed.palette.name, "Fixture duplicate set");
  assert.deepEqual(hexes(parsed.palette), ["#AABBCC", "#12AB34", "#AABBCC", "#12AB34"]);
  assert.deepEqual(parsed.palette.colors.map(color => color.name), ["Fog", "Leaf", "Fog duplicate", "Leaf duplicate"]);
});

test("JSON malformed fixtures reject unknown properties, versions and HEX values", () => {
  const cases = [
    ["json/json-unknown-field.json", "unsupported-property"],
    ["json/json-unsupported-version.json", "unsupported-version"],
    ["json/json-invalid-hex.json", "invalid-hex"]
  ];
  cases.forEach(([pathName, expectedCode]) => {
    const parsed = Formats.parseJSON(fixture(pathName));
    assert.equal(parsed.ok, false, pathName);
    assert.ok(parsed.errors.some(error => error.code === expectedCode), pathName + ": " + JSON.stringify(parsed.errors));
  });
});

test("GPL and JSON fixture round trips preserve palette metadata and duplicate order", () => {
  const gpl = Formats.parseGPL(fixture("gpl/gpl-comments-names.gpl"));
  assert.equal(gpl.ok, true);
  const gplRoundTrip = Formats.parseGPL(Formats.exportGPL(gpl.palette));
  assert.equal(gplRoundTrip.ok, true);
  assert.deepEqual(gplRoundTrip.palette, gpl.palette);

  const json = Formats.parseJSON(fixture("json/json-names-duplicates.json"));
  assert.equal(json.ok, true);
  const jsonRoundTrip = Formats.parseJSON(Formats.exportJSON(json.palette));
  assert.equal(jsonRoundTrip.ok, true);
  assert.deepEqual(jsonRoundTrip.palette, json.palette);
});

test("JASC-PAL round trip intentionally loses names but preserves RGB, order and duplicates", () => {
  const input = Formats.parseJSON(fixture("json/json-names-duplicates.json"));
  const palRoundTrip = Formats.parseJASCPAL(Formats.exportJASCPAL(input.palette));
  assert.equal(palRoundTrip.ok, true);
  assert.deepEqual(hexes(palRoundTrip.palette), hexes(input.palette));
  assert.equal(palRoundTrip.palette.name, "Untitled palette");
  assert.ok(palRoundTrip.palette.colors.every(color => color.name === undefined));
});

test("all three export formats preserve duplicate colors and order", () => {
  const input = {
    name: "Duplicate order",
    colors: [
      { hex: "#010203", name: "First" },
      { hex: "#AABBCC", name: "Middle" },
      { hex: "#010203", name: "Second first-color occurrence" }
    ]
  };
  assert.deepEqual(hexes(Formats.parseGPL(Formats.exportGPL(input)).palette), ["#010203", "#AABBCC", "#010203"]);
  assert.deepEqual(hexes(Formats.parseJASCPAL(Formats.exportJASCPAL(input)).palette), ["#010203", "#AABBCC", "#010203"]);
  assert.deepEqual(hexes(Formats.parseJSON(Formats.exportJSON(input)).palette), ["#010203", "#AABBCC", "#010203"]);
});

test("seeded property-style cases round-trip deterministic random palettes", () => {
  const seeds = [1, 17, 7331, 0xC0FFEE, 0xDEADBEEF];
  seeds.forEach(seed => {
    const count = 1 + (seed % 31);
    const first = makeSeededPalette(seed, count);
    const second = makeSeededPalette(seed, count);
    assert.deepEqual(first, second, "seed must reproduce identical palette data");

    const gpl = Formats.parseGPL(Formats.exportGPL(first));
    const pal = Formats.parseJASCPAL(Formats.exportJASCPAL(first));
    const json = Formats.parseJSON(Formats.exportJSON(first));
    assert.equal(gpl.ok, true);
    assert.equal(pal.ok, true);
    assert.equal(json.ok, true);
    assert.deepEqual(hexes(gpl.palette), hexes(first));
    assert.deepEqual(hexes(pal.palette), hexes(first));
    assert.deepEqual(hexes(json.palette), hexes(first));
    assert.deepEqual(gpl.palette.colors.map(color => color.name), first.colors.map(color => color.name));
    assert.deepEqual(json.palette.colors.map(color => color.name), first.colors.map(color => color.name));
  });
});

test("seeded property-style parser inputs remain bounded and deterministic", () => {
  const random = seededRandom(0x5EED1234);
  for (let iteration = 0; iteration < 64; iteration += 1) {
    const count = 1 + Math.floor(random() * 16);
    const palette = makeSeededPalette(iteration + 101, count);
    const input = Formats.exportJSON(palette);
    const first = Formats.parseJSON(input);
    const second = Formats.parseJSON(input);
    assert.deepEqual(first, second);
    assert.equal(first.ok, true);
  }
});

test("maximum supported 4096-color JASC-PAL palette parses without reordering", () => {
  const colors = Array.from({ length: Formats.MAX_JASC_COLORS }, (_, index) => ({
    hex: "#" + (index % 0x1000000).toString(16).padStart(6, "0").toUpperCase()
  }));
  const input = Formats.exportJASCPAL({ name: "Maximum", colors });
  const parsed = Formats.parseJASCPAL(input);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.palette.colors.length, Formats.MAX_JASC_COLORS);
  assert.deepEqual(hexes(parsed.palette).slice(0, 4), hexes({ colors }).slice(0, 4));
  assert.deepEqual(hexes(parsed.palette).slice(-4), hexes({ colors }).slice(-4));
});

test("generated oversized text is rejected at the 1 MiB boundary", () => {
  const oversized = "GIMP Palette\n" + "#".repeat(Formats.MAX_FILE_BYTES);
  const parsed = Formats.parseGPL(oversized);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.errors[0].code, "file-too-large");
});

test("format detection remains strict for unknown text", () => {
  assert.equal(Formats.detectFormat("not a palette"), null);
  assert.equal(Formats.parse("not a palette").errors[0].code, "unknown-format");
});
