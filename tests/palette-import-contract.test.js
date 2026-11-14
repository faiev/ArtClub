/* eslint-env node */
"use strict";

// These tests define the UI-04 import decision contract. The parser calls are
// production code; the preview/decision helpers below are deliberately a
// test-only reference model, not an implementation wired into the editor.

const test = require("node:test");
const assert = require("node:assert/strict");
const PaletteFormats = require("../js/palette-formats.js");

function copy(value) {
  return structuredClone(value);
}

function duplicateGroups(colors) {
  const positions = new Map();
  colors.forEach((color, index) => {
    const hex = color.hex.toUpperCase();
    if (!positions.has(hex)) positions.set(hex, []);
    positions.get(hex).push(index);
  });
  return Array.from(positions.entries())
    .filter(([, indices]) => indices.length > 1)
    .map(([hex, indices]) => ({ hex, indices }));
}

function buildPreview(input, requestedFormat) {
  const format = requestedFormat || PaletteFormats.detectFormat(input);
  const parsed = PaletteFormats.parse(input, format);
  if (!parsed.ok) {
    return {
      status: "error",
      format: format,
      palette: null,
      errors: copy(parsed.errors),
      warnings: copy(parsed.warnings || []),
      duplicates: []
    };
  }

  const warnings = format === "jasc-pal"
    ? ["JASC-PAL contains RGB values only; it cannot carry palette or color names."]
    : [];

  return {
    status: "ready",
    format: format,
    palette: copy(parsed.palette),
    errors: [],
    warnings: warnings,
    duplicates: duplicateGroups(parsed.palette.colors)
  };
}

// Test-only reference policy:
// - Merge keeps existing colors and appends only first-seen imported HEX values.
// - Every skipped imported duplicate is reported by its source index.
// - Replace preserves the imported list exactly, including duplicate entries.
// - Cancel and invalid previews return the original project object unchanged.
function decideImport(project, preview, decision) {
  if (!preview || preview.status !== "ready") {
    return {
      status: "blocked",
      project: project,
      errors: copy(preview && preview.errors ? preview.errors : [])
    };
  }

  if (decision === "cancel") {
    return { status: "cancelled", project: project, skippedDuplicates: [] };
  }

  if (decision === "replace") {
    return {
      status: "applied",
      project: { ...copy(project), palette: copy(preview.palette) },
      skippedDuplicates: []
    };
  }

  if (decision === "merge") {
    const existingColors = project.palette.colors;
    const seen = new Set(existingColors.map(color => color.hex.toUpperCase()));
    const additions = [];
    const skippedDuplicates = [];

    preview.palette.colors.forEach((color, sourceIndex) => {
      const hex = color.hex.toUpperCase();
      if (seen.has(hex)) {
        skippedDuplicates.push({ hex: hex, sourceIndex: sourceIndex });
        return;
      }
      seen.add(hex);
      additions.push(copy(color));
    });

    if (additions.length === 0) {
      return {
        status: "no-op",
        project: project,
        skippedDuplicates: skippedDuplicates
      };
    }

    return {
      status: "applied",
      project: {
        ...copy(project),
        palette: {
          ...copy(project.palette),
          colors: [...copy(existingColors), ...additions]
        }
      },
      skippedDuplicates: skippedDuplicates
    };
  }

  return {
    status: "rejected",
    project: project,
    errors: [{ code: "invalid-decision" }]
  };
}

function jsonPalette(name, colors) {
  return JSON.stringify({
    format: PaletteFormats.JSON_FORMAT,
    version: PaletteFormats.JSON_VERSION,
    name: name,
    colors: colors
  });
}

function sampleProject() {
  return {
    id: "project-contract-fixture",
    title: "Existing project",
    palette: {
      name: "Current palette",
      columns: 4,
      colors: [
        { hex: "#112233", name: "Existing blue" },
        { hex: "#445566", name: "Existing grey" }
      ]
    },
    artwork: {
      layers: [{ id: "layer-1", pixels: ["#112233", null] }],
      selectedFrame: 0
    }
  };
}

test("preview parses real JSON palette data and leaves the project and source untouched", () => {
  const source = jsonPalette("Imported", [
    { hex: "#aabbcc", name: "Mist" },
    { hex: "#112233", name: "Existing blue duplicate" }
  ]);
  const project = sampleProject();
  const projectBefore = copy(project);
  const sourceBefore = source;

  const preview = buildPreview(source);

  assert.equal(preview.status, "ready");
  assert.equal(preview.format, "json");
  assert.deepEqual(preview.palette, {
    name: "Imported",
    colors: [
      { hex: "#AABBCC", name: "Mist" },
      { hex: "#112233", name: "Existing blue duplicate" }
    ]
  });
  assert.equal(source, sourceBefore);
  assert.deepEqual(project, projectBefore);
});

test("preview reports duplicate HEX entries by normalized value and source position", () => {
  const source = jsonPalette("Duplicate import", [
    { hex: "#aabbcc", name: "First" },
    { hex: "AABBCC", name: "Second" },
    { hex: "#010203", name: "Unique" },
    { hex: "#AABBCC", name: "Third" }
  ]);

  const preview = buildPreview(source, "json");

  assert.equal(preview.status, "ready");
  assert.deepEqual(preview.duplicates, [
    { hex: "#AABBCC", indices: [0, 1, 3] }
  ]);
  assert.equal(preview.palette.colors.length, 4);
  assert.deepEqual(preview.palette.colors.map(color => color.name), [
    "First", "Second", "Unique", "Third"
  ]);
});

test("merge keeps existing colors, appends new imported colors once, and reports skipped duplicates", () => {
  const project = sampleProject();
  const projectBefore = copy(project);
  const source = jsonPalette("Incoming", [
    { hex: "#112233", name: "Incoming duplicate of existing" },
    { hex: "#778899", name: "New color" },
    { hex: "#778899", name: "Duplicate inside import" },
    { hex: "#ABCDEF", name: "Another new color" }
  ]);
  const preview = buildPreview(source, "json");
  const previewBefore = copy(preview);

  const result = decideImport(project, preview, "merge");

  assert.equal(result.status, "applied");
  assert.notStrictEqual(result.project, project);
  assert.deepEqual(result.project.palette.colors, [
    { hex: "#112233", name: "Existing blue" },
    { hex: "#445566", name: "Existing grey" },
    { hex: "#778899", name: "New color" },
    { hex: "#ABCDEF", name: "Another new color" }
  ]);
  assert.deepEqual(result.skippedDuplicates, [
    { hex: "#112233", sourceIndex: 0 },
    { hex: "#778899", sourceIndex: 2 }
  ]);
  assert.deepEqual(project, projectBefore);
  assert.deepEqual(preview, previewBefore);
  assert.deepEqual(result.project.artwork, project.artwork);
});

test("replace adopts the parsed order and duplicate entries without silently deduplicating", () => {
  const project = sampleProject();
  const projectBefore = copy(project);
  const preview = buildPreview(jsonPalette("Replacement", [
    { hex: "#00AA00", name: "Green" },
    { hex: "#00AA00", name: "Green duplicate" },
    { hex: "#0000AA", name: "Blue" }
  ]), "json");

  const result = decideImport(project, preview, "replace");

  assert.equal(result.status, "applied");
  assert.deepEqual(result.project.palette, preview.palette);
  assert.equal(result.project.palette.colors.length, 3);
  assert.deepEqual(result.project.palette.colors.map(color => color.name), [
    "Green", "Green duplicate", "Blue"
  ]);
  assert.deepEqual(project, projectBefore);
  assert.deepEqual(project.palette.name, "Current palette");
});

test("cancel returns the exact original project and performs no merge or replacement", () => {
  const project = sampleProject();
  const projectBefore = copy(project);
  const preview = buildPreview(jsonPalette("Incoming", [
    { hex: "#FFFFFF", name: "White" }
  ]), "json");

  const result = decideImport(project, preview, "cancel");

  assert.equal(result.status, "cancelled");
  assert.strictEqual(result.project, project);
  assert.deepEqual(project, projectBefore);
});

test("merge with only duplicate colors is an explicit no-op", () => {
  const project = sampleProject();
  const projectBefore = copy(project);
  const preview = buildPreview(jsonPalette("All duplicates", [
    { hex: "#112233", name: "Duplicate one" },
    { hex: "#445566", name: "Duplicate two" }
  ]), "json");

  const result = decideImport(project, preview, "merge");

  assert.equal(result.status, "no-op");
  assert.strictEqual(result.project, project);
  assert.equal(result.skippedDuplicates.length, 2);
  assert.deepEqual(project, projectBefore);
});

test("invalid parser output blocks merge and replace and preserves line diagnostics", () => {
  const project = sampleProject();
  const projectBefore = copy(project);
  const malformed = buildPreview("JASC-PAL\n0100\n2\n0 0 0\n", "jasc-pal");

  assert.equal(malformed.status, "error");
  assert.equal(malformed.palette, null);
  assert.ok(malformed.errors.some(error =>
    error.code === "truncated-palette" && error.line === 5
  ));

  for (const decision of ["merge", "replace"]) {
    const result = decideImport(project, malformed, decision);
    assert.equal(result.status, "blocked");
    assert.strictEqual(result.project, project);
    assert.deepEqual(result.errors, malformed.errors);
    assert.deepEqual(project, projectBefore);
  }
});

test("JASC-PAL preview discloses that palette and color names are unavailable", () => {
  const source = "JASC-PAL\n0100\n2\n17 34 51\n68 85 102\n";
  const preview = buildPreview(source, "jasc-pal");

  assert.equal(preview.status, "ready");
  assert.equal(preview.palette.name, "Untitled palette");
  assert.deepEqual(preview.palette.colors, [
    { hex: "#112233" },
    { hex: "#445566" }
  ]);
  assert.deepEqual(preview.warnings, [
    "JASC-PAL contains RGB values only; it cannot carry palette or color names."
  ]);
});

test("unknown format and malformed JSON remain explicit errors, never empty palettes", () => {
  const unknown = buildPreview("not a palette", null);
  const malformedJson = buildPreview("{\"format\":", "json");

  assert.equal(unknown.status, "error");
  assert.equal(unknown.palette, null);
  assert.equal(unknown.errors[0].code, "unknown-format");

  assert.equal(malformedJson.status, "error");
  assert.equal(malformedJson.palette, null);
  assert.equal(malformedJson.errors[0].code, "invalid-json");
  assert.ok(Number.isInteger(malformedJson.errors[0].line));
});
