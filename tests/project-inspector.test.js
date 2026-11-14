/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "tools", "project-inspector.mjs");
const FIXTURES = path.join(__dirname, "fixtures", "project-inspector");
const MAX_FILE_BYTES = 64 * 1024 * 1024;

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "project-inspector-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function copyFixture(directory, name) {
  const destination = path.join(directory, name);
  fs.copyFileSync(path.join(FIXTURES, name), destination);
  return destination;
}

function runCli(filePath, options = []) {
  return spawnSync(process.execPath, [CLI, ...options, filePath], {
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024
  });
}

test("inspects a valid v2 project and reports exact structure and pixel totals", (t) => {
  const directory = temporaryDirectory(t);
  const file = copyFixture(directory, "valid-v2.json");
  const result = runCli(file, ["--json"]);

  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.sourceFormat, "one-pixel-studio");
  assert.equal(report.sourceVersion, 2);
  assert.equal(report.normalizedVersion, 2);
  assert.equal(report.migratedInMemory, false);
  assert.equal(report.id, "project-v2-fixture");
  assert.equal(report.name, "Inspector fixture");
  assert.deepEqual(report.canvas, { width: 4, height: 3 });
  assert.equal(report.paletteSize, 3);
  assert.equal(report.layerCount, 2);
  assert.equal(report.frameCount, 2);
  assert.equal(report.activeLayer.name, "Guide");
  assert.equal(report.activeFrame.name, "Frame 2");
  assert.equal(report.celCount, 2);
  assert.equal(report.pixels.expectedPerCel, 12);
  assert.equal(report.pixels.expectedTotal, 24);
  assert.equal(report.pixels.actualTotal, 24);
  assert.equal(report.pixels.occupied, 3);
  assert.equal(report.pixels.transparent, 21);
  assert.equal(report.layers[1].visible, false);
  assert.equal(report.layers[1].locked, true);
  assert.deepEqual(report.frames.map((frame) => frame.durationMs), [100, 250]);
  assert.equal(report.totalDurationMs, 350);
});

test("renders a concise human-readable report", (t) => {
  const directory = temporaryDirectory(t);
  const file = copyFixture(directory, "valid-v2.json");
  const result = runCli(file);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Project Inspector/);
  assert.match(result.stdout, /Status: VALID/);
  assert.match(result.stdout, /Canvas: 4 × 3 pixels/);
  assert.match(result.stdout, /2 total; 1 visible, 1 hidden, 1 locked/);
  assert.match(result.stdout, /3 occupied, 21 transparent/);
  assert.match(result.stdout, /Frame 2 250 ms/);
});

test("migrates legacy input only in memory and leaves the copied source unchanged", (t) => {
  const directory = temporaryDirectory(t);
  const file = copyFixture(directory, "valid-legacy.json");
  const originalBytes = fs.readFileSync(file);

  const first = runCli(file, ["--json"]);
  const second = runCli(file, ["--json"]);

  assert.equal(first.status, 0, first.stderr);
  assert.equal(second.status, 0, second.stderr);
  const report = JSON.parse(first.stdout);
  assert.deepEqual(JSON.parse(second.stdout), report);
  assert.equal(report.sourceFormat, "legacy-single-canvas");
  assert.equal(report.sourceVersion, 1);
  assert.equal(report.normalizedFormat, "one-pixel-studio");
  assert.equal(report.normalizedVersion, 2);
  assert.equal(report.migratedInMemory, true);
  assert.equal(report.id, null);
  assert.equal(report.name, "Legacy fixture");
  assert.equal(report.layerCount, 1);
  assert.equal(report.frameCount, 1);
  assert.equal(report.celCount, 1);
  assert.equal(report.pixels.expectedTotal, 4);
  assert.equal(report.pixels.actualTotal, 4);
  assert.equal(report.pixels.occupied, 2);
  assert.equal(report.pixels.transparent, 2);
  assert.deepEqual(fs.readFileSync(file), originalBytes);
});

test("rejects malformed JSON with a machine-readable parse diagnostic", (t) => {
  const directory = temporaryDirectory(t);
  const file = copyFixture(directory, "malformed-json.json");
  const result = runCli(file, ["--json"]);

  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.error.code, "JSON_PARSE_ERROR");
  assert.match(report.error.message, /Invalid JSON/);
});

test("rejects invalid cels, missing references and over-limit documents", (t) => {
  const directory = temporaryDirectory(t);
  const cases = [
    ["invalid-cels.json", /width|pixels/i],
    ["missing-references.json", /reference|existing layer/i],
    ["over-limit.json", /256 frames/i]
  ];

  for (const [fixture, messagePattern] of cases) {
    const file = copyFixture(directory, fixture);
    const result = runCli(file, ["--json"]);
    assert.notEqual(result.status, 0, fixture + " should fail");
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false, fixture);
    assert.equal(report.error.code, "INVALID_PROJECT", fixture);
    assert.match(report.error.message, messagePattern, fixture);
  }
});

test("rejects files above the size limit before attempting JSON parsing", (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, "too-large.json");
  fs.writeFileSync(file, "");
  fs.truncateSync(file, MAX_FILE_BYTES + 1);

  const result = runCli(file, ["--json"]);
  assert.notEqual(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.error.code, "FILE_TOO_LARGE");
  assert.match(report.error.message, /64 MiB/);
});

test("returns a nonzero usage error when no project path is supplied", () => {
  const result = spawnSync(process.execPath, [CLI, "--json"], { encoding: "utf8" });
  assert.equal(result.status, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.error.code, "INVALID_ARGUMENT");
});

test("shows help without requiring a project path", () => {
  const result = spawnSync(process.execPath, [CLI, "--help"], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Usage:/);
  assert.match(result.stdout, /64 MiB/);
});


test("accepts a UTF-8 BOM before an otherwise valid JSON project", (t) => {
  const directory = temporaryDirectory(t);
  const source = fs.readFileSync(path.join(FIXTURES, "valid-v2.json"), "utf8");
  const file = path.join(directory, "bom-project.json");
  fs.writeFileSync(file, "\uFEFF" + source, "utf8");

  const result = runCli(file, ["--json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.id, "project-v2-fixture");
  assert.equal(report.name, "Inspector fixture");
});


function runBatch(paths, options = []) {
  return spawnSync(process.execPath, [CLI, "--batch", ...options, "--json", ...paths], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
}

test("batch mode inspects directory files in stable path order without recursing by default", (t) => {
  const directory = temporaryDirectory(t);
  const root = path.join(directory, "input");
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested, { recursive: true });
  copyFixture(root, "valid-v2.json");
  copyFixture(root, "valid-legacy.json");
  copyFixture(nested, "valid-v2.json");

  const result = runBatch([root]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.mode, "batch");
  assert.equal(report.ok, true);
  assert.equal(report.fileCount, 2);
  assert.equal(report.successCount, 2);
  assert.equal(report.failureCount, 0);
  assert.deepEqual(report.results.map((entry) => path.basename(entry.file)), [
    "valid-legacy.json",
    "valid-v2.json"
  ]);
});

test("recursive batch mode includes nested projects and preserves legacy source bytes", (t) => {
  const directory = temporaryDirectory(t);
  const root = path.join(directory, "input");
  const nested = path.join(root, "nested");
  fs.mkdirSync(nested, { recursive: true });
  const nestedLegacy = copyFixture(nested, "valid-legacy.json");
  const originalBytes = fs.readFileSync(nestedLegacy);
  copyFixture(root, "valid-v2.json");

  const result = runBatch([root], ["--recursive"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.fileCount, 2);
  assert.equal(report.successCount, 2);
  assert.ok(report.results.some((entry) => entry.migratedInMemory === true));
  assert.deepEqual(fs.readFileSync(nestedLegacy), originalBytes);
});

test("batch mode reports missing and malformed files individually and continues", (t) => {
  const directory = temporaryDirectory(t);
  const valid = copyFixture(directory, "valid-v2.json");
  const malformed = copyFixture(directory, "malformed-json.json");
  const missing = path.join(directory, "missing.json");

  const result = runBatch([valid, missing, malformed]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.fileCount, 2);
  assert.equal(report.successCount, 1);
  assert.equal(report.failureCount, 2);
  assert.ok(report.results.some((entry) => entry.ok && entry.name === "Inspector fixture"));
  assert.ok(report.results.some((entry) => !entry.ok && entry.error.code === "JSON_PARSE_ERROR"));
  assert.ok(report.discoveryErrors.some((entry) => entry.path === missing && entry.code === "PATH_ACCESS_ERROR"));
});

test("batch mode de-duplicates repeated file paths and reports a warning", (t) => {
  const directory = temporaryDirectory(t);
  const file = copyFixture(directory, "valid-v2.json");

  const result = runBatch([file, file]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.fileCount, 1);
  assert.equal(report.successCount, 1);
  assert.equal(report.warnings.length, 1);
  assert.equal(report.warnings[0].code, "DUPLICATE_PATH");
});

test("batch mode does not follow directory symlinks", (t) => {
  if (process.platform === "win32") {
    t.skip("directory symlink creation requires elevated Windows permissions");
    return;
  }
  const directory = temporaryDirectory(t);
  const root = path.join(directory, "input");
  const outside = path.join(directory, "outside");
  fs.mkdirSync(root);
  fs.mkdirSync(outside);
  copyFixture(outside, "valid-v2.json");
  fs.symlinkSync(outside, path.join(root, "linked"), "dir");

  const result = runBatch([root], ["--recursive"]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.fileCount, 0);
  assert.ok(report.discoveryErrors.some((entry) => entry.code === "SYMLINK_NOT_FOLLOWED"));
});

test("batch mode rejects a file set above its count limit without partially inspecting it", (t) => {
  const directory = temporaryDirectory(t);
  const root = path.join(directory, "many");
  fs.mkdirSync(root);
  for (let index = 0; index < 501; index += 1) {
    fs.writeFileSync(path.join(root, String(index).padStart(4, "0") + ".json"), "{}");
  }

  const result = runBatch([root]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.results.length, 0);
  assert.ok(report.discoveryErrors.some((entry) => entry.code === "BATCH_FILE_LIMIT"));
});

test("batch mode enforces its aggregate byte budget before reading the next file", (t) => {
  const directory = temporaryDirectory(t);
  const project = fs.readFileSync(path.join(FIXTURES, "valid-v2.json"));
  const firstSize = 16 * 1024 * 1024;
  const secondSize = 20 * 1024 * 1024;
  fs.writeFileSync(path.join(directory, "a-project.json"), Buffer.concat([
    project,
    Buffer.alloc(firstSize - project.length, 0x20)
  ]));
  fs.writeFileSync(path.join(directory, "b-project.json"), Buffer.concat([
    project,
    Buffer.alloc(secondSize - project.length, 0x20)
  ]));

  const result = runBatch([directory]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.successCount, 1);
  assert.equal(report.failureCount, 1);
  assert.equal(report.bytesRead, firstSize);
  assert.equal(report.results[1].error.code, "BATCH_TOTAL_SIZE_LIMIT");
});

test("batch mode reports unreadable files without aborting other inputs", (t) => {
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    t.skip("permission checks are not meaningful when running as root");
    return;
  }
  const directory = temporaryDirectory(t);
  const valid = copyFixture(directory, "valid-v2.json");
  const unreadable = copyFixture(directory, "valid-legacy.json");
  fs.chmodSync(unreadable, 0);

  const result = runBatch([unreadable, valid]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.successCount, 1);
  assert.ok(report.results.some((entry) => !entry.ok && entry.error.code === "FILE_READ_ERROR"));
});


function runCompare(leftPath, rightPath, options = ["--json"]) {
  return spawnSync(process.execPath, [CLI, "--compare", ...options, leftPath, rightPath], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
}

function writeProject(directory, filename, project) {
  const file = path.join(directory, filename);
  fs.writeFileSync(file, JSON.stringify(project));
  return file;
}

test("compare mode reports identical v2 documents with stable source-ID matching", (t) => {
  const directory = temporaryDirectory(t);
  const left = copyFixture(directory, "valid-v2.json");
  const right = path.join(directory, "right.json");
  fs.copyFileSync(left, right);

  const result = runCompare(left, right);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "compare");
  assert.equal(report.identical, true);
  assert.equal(report.totalChanges, 0);
  assert.equal(report.changes.layers.matchBy, "source-id");
  assert.equal(report.changes.frames.matchBy, "source-id");
  assert.equal(report.changes.cels.matchBy, "layerId+frameId");
});

test("compare mode reports canvas, palette, project, metadata, layer, frame and pixel changes", (t) => {
  const directory = temporaryDirectory(t);
  const left = copyFixture(directory, "valid-v2.json");
  const changed = JSON.parse(fs.readFileSync(left, "utf8"));
  changed.name = "Changed artwork";
  changed.canvas.width = 6;
  changed.canvas.height = 2;
  changed.palette[2] = "#00ff00";
  changed.layers[1].visible = true;
  changed.frames[1].durationMs = 500;
  changed.cels[0].pixels[0] = "#ff0000";
  changed.metadata.updatedAt = "2026-11-14T00:00:00.000Z";
  const right = writeProject(directory, "changed.json", changed);

  const result = runCompare(left, right);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.identical, false);
  assert.ok(report.changes.canvas.fields.some((field) => field.field === "width"));
  assert.ok(report.changes.palette.entries.some((entry) => entry.index === 2 && entry.kind === "changed"));
  assert.ok(report.changes.project.some((field) => field.field === "name"));
  assert.ok(report.changes.metadata.some((field) => field.field === "updatedAt"));
  assert.equal(report.changes.layers.modified.length, 1);
  assert.equal(report.changes.frames.modified.length, 1);
  assert.equal(report.changes.cels.pixelIndexChanges, 1);
  assert.equal(report.changes.cels.modified[0].pixelChanges.samples[0].index, 0);
});

test("compare mode never matches different v2 IDs merely because names are equal", (t) => {
  const directory = temporaryDirectory(t);
  const left = copyFixture(directory, "valid-v2.json");
  const changed = JSON.parse(fs.readFileSync(left, "utf8"));
  changed.layers[1].id = "layer-guide-new-id";
  changed.cels[1].layerId = "layer-guide-new-id";
  changed.activeLayerId = "layer-guide-new-id";
  const right = writeProject(directory, "renumbered-layer.json", changed);

  const result = runCompare(left, right);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.changes.layers.matchBy, "source-id");
  assert.ok(report.changes.layers.removed.some((layer) => layer.id === "layer-guide"));
  assert.ok(report.changes.layers.added.some((layer) => layer.id === "layer-guide-new-id"));
  assert.ok(report.changes.cels.removed.some((cel) => cel.reason === "layer-removed"));
  assert.ok(report.changes.cels.added.some((cel) => cel.reason === "layer-added"));
});

test("compare mode distinguishes a missing cel from a present transparent pixel", (t) => {
  const directory = temporaryDirectory(t);
  const left = copyFixture(directory, "valid-v2.json");
  const original = JSON.parse(fs.readFileSync(left, "utf8"));
  const transparent = JSON.parse(JSON.stringify(original));
  transparent.cels[1].pixels[10] = null;
  const transparentFile = writeProject(directory, "transparent.json", transparent);

  const transparentResult = runCompare(left, transparentFile);
  assert.equal(transparentResult.status, 0, transparentResult.stderr);
  const transparentReport = JSON.parse(transparentResult.stdout);
  assert.equal(transparentReport.changes.cels.removed.length, 0);
  assert.equal(transparentReport.changes.cels.modified[0].pixelChanges.changedCount, 1);
  assert.deepEqual(transparentReport.changes.cels.modified[0].pixelChanges.samples[0].before, {
    state: "pixel",
    value: "#ff0000"
  });
  assert.deepEqual(transparentReport.changes.cels.modified[0].pixelChanges.samples[0].after, {
    state: "pixel",
    value: null
  });

  const missingCel = JSON.parse(JSON.stringify(original));
  missingCel.cels.splice(1, 1);
  const missingFile = writeProject(directory, "missing-cel.json", missingCel);
  const missingResult = runCompare(left, missingFile);
  assert.equal(missingResult.status, 0, missingResult.stderr);
  const missingReport = JSON.parse(missingResult.stdout);
  assert.equal(missingReport.changes.cels.removed[0].reason, "cel-missing");
  assert.equal(missingReport.changes.cels.removed[0].pixelCount, 12);
  assert.equal(missingReport.changes.cels.modified.length, 0);
});

test("compare mode reports removed frames and layers separately from their cels", (t) => {
  const directory = temporaryDirectory(t);
  const left = copyFixture(directory, "valid-v2.json");
  const original = JSON.parse(fs.readFileSync(left, "utf8"));

  const withoutFrame = JSON.parse(JSON.stringify(original));
  withoutFrame.frames = withoutFrame.frames.filter((frame) => frame.id !== "frame-b");
  withoutFrame.cels = withoutFrame.cels.filter((cel) => cel.frameId !== "frame-b");
  withoutFrame.activeFrameId = "frame-a";
  const frameFile = writeProject(directory, "without-frame.json", withoutFrame);
  const frameReport = JSON.parse(runCompare(left, frameFile).stdout);
  assert.ok(frameReport.changes.frames.removed.some((frame) => frame.id === "frame-b"));
  assert.ok(frameReport.changes.cels.removed.some((cel) => cel.reason === "frame-removed"));

  const withoutLayer = JSON.parse(JSON.stringify(original));
  withoutLayer.layers = withoutLayer.layers.filter((layer) => layer.id !== "layer-guide");
  withoutLayer.cels = withoutLayer.cels.filter((cel) => cel.layerId !== "layer-guide");
  withoutLayer.activeLayerId = "layer-base";
  const layerFile = writeProject(directory, "without-layer.json", withoutLayer);
  const layerReport = JSON.parse(runCompare(left, layerFile).stdout);
  assert.ok(layerReport.changes.layers.removed.some((layer) => layer.id === "layer-guide"));
  assert.ok(layerReport.changes.cels.removed.some((cel) => cel.reason === "layer-removed"));
});

test("legacy-to-legacy comparison uses position and ignores synthetic IDs without writing inputs", (t) => {
  const directory = temporaryDirectory(t);
  const left = copyFixture(directory, "valid-legacy.json");
  const originalBytes = fs.readFileSync(left);
  const changed = JSON.parse(fs.readFileSync(left, "utf8"));
  changed.pixels[0] = null;
  const right = writeProject(directory, "legacy-changed.json", changed);

  const result = runCompare(left, right);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.left.migratedInMemory, true);
  assert.equal(report.left.projectId, null);
  assert.equal(report.changes.layers.matchBy, "position");
  assert.equal(report.changes.frames.matchBy, "position");
  assert.equal(report.changes.cels.matchBy, "position");
  assert.equal(report.changes.cels.pixelIndexChanges, 1);
  assert.deepEqual(fs.readFileSync(left), originalBytes);
});

test("mixed legacy and v2 comparison does not infer cross-format entity identity", (t) => {
  const directory = temporaryDirectory(t);
  const left = copyFixture(directory, "valid-legacy.json");
  const right = copyFixture(directory, "valid-v2.json");
  const result = runCompare(left, right);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.changes.layers.matchBy, "none-across-source-formats");
  assert.equal(report.changes.frames.matchBy, "none-across-source-formats");
  assert.equal(report.changes.cels.matchBy, "none-across-source-formats");
  assert.equal(report.changes.layers.removed[0].id, null);
  assert.ok(report.changes.layers.added.length > 0);
});

test("compare mode caps pixel-index samples without returning full pixel arrays", (t) => {
  const directory = temporaryDirectory(t);
  const base = JSON.parse(fs.readFileSync(path.join(FIXTURES, "valid-v2.json"), "utf8"));
  base.canvas.width = 512;
  base.canvas.height = 512;
  base.cels.forEach((cel) => { cel.pixels = Array(512 * 512).fill(null); });
  const changed = JSON.parse(JSON.stringify(base));
  for (let index = 0; index < 150; index += 1) changed.cels[0].pixels[index] = "#ff0000";
  const left = writeProject(directory, "large-before.json", base);
  const right = writeProject(directory, "large-after.json", changed);

  const result = runCompare(left, right);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.changes.cels.pixelIndexChanges, 150);
  assert.equal(report.changes.cels.modified[0].pixelChanges.samples.length, 100);
  assert.equal(report.changes.cels.modified[0].pixelChanges.truncated, true);
  assert.equal(report.results, undefined);
  assert.ok(result.stdout.length < 100000);
});

test("compare mode emits concise human output and rejects the wrong number of paths", (t) => {
  const directory = temporaryDirectory(t);
  const left = copyFixture(directory, "valid-v2.json");
  const right = path.join(directory, "same.json");
  fs.copyFileSync(left, right);

  const human = runCompare(left, right, []);
  assert.equal(human.status, 0, human.stderr);
  assert.match(human.stdout, /Project Inspector — Compare/);
  assert.match(human.stdout, /Status: IDENTICAL/);

  const invalid = spawnSync(process.execPath, [CLI, "--compare", left, "--json"], { encoding: "utf8" });
  assert.equal(invalid.status, 2);
  const report = JSON.parse(invalid.stdout);
  assert.equal(report.error.code, "INVALID_ARGUMENT");
});


test("mixed legacy/v2 cel differences are labelled unmatchable, not falsely removed by ID", (t) => {
  const directory = temporaryDirectory(t);
  const legacy = copyFixture(directory, "valid-legacy.json");
  const v2 = copyFixture(directory, "valid-v2.json");

  const legacyFirst = runCompare(legacy, v2);
  const legacyFirstReport = JSON.parse(legacyFirst.stdout);
  assert.equal(legacyFirstReport.ok, true);
  assert.ok(legacyFirstReport.changes.cels.added.every((cel) =>
    cel.reason === "source-identifiers-not-comparable"));
  assert.ok(legacyFirstReport.changes.cels.removed.every((cel) =>
    cel.reason === "source-identifiers-not-comparable"));

  const v2First = runCompare(v2, legacy);
  const v2FirstReport = JSON.parse(v2First.stdout);
  assert.equal(v2FirstReport.ok, true);
  assert.ok(v2FirstReport.changes.cels.added.every((cel) =>
    cel.reason === "source-identifiers-not-comparable"));
  assert.ok(v2FirstReport.changes.cels.removed.every((cel) =>
    cel.reason === "source-identifiers-not-comparable"));
});


function runDiagnostics(filePath, options = ["--json"]) {
  return spawnSync(process.execPath, [CLI, "--diagnostics", ...options, filePath], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
}
function writeDiagnosticProject(directory, filename, project) {
  const file = path.join(directory, filename);
  fs.writeFileSync(file, JSON.stringify(project));
  return file;
}

test("deep diagnostics preserve model validation as a separate authoritative result", (t) => {
  const directory = temporaryDirectory(t);
  const valid = copyFixture(directory, "valid-v2.json");
  const project = JSON.parse(fs.readFileSync(valid, "utf8"));
  project.layers[1].id = project.layers[0].id;
  project.frames[1].id = project.frames[0].id;
  project.cels[1].layerId = "missing-layer";
  project.cels[1].frameId = "missing-frame";
  project.activeLayerId = "missing-active-layer";
  project.activeFrameId = "missing-active-frame";
  const invalid = writeDiagnosticProject(directory, "invalid-structure.json", project);

  const result = runDiagnostics(invalid);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.mode, "diagnostics");
  assert.equal(report.schema.checked, true);
  assert.equal(report.schema.valid, false);
  assert.ok(report.schema.errors.length > 0);
  const codes = new Set(report.diagnostics.map((item) => item.code));
  assert.ok(codes.has("LAYER_ID_DUPLICATE"));
  assert.ok(codes.has("FRAME_ID_DUPLICATE"));
  assert.ok(codes.has("CEL_LAYER_REFERENCE_INVALID"));
  assert.ok(codes.has("CEL_FRAME_REFERENCE_INVALID"));
  assert.ok(codes.has("ACTIVE_LAYER_MISSING"));
  assert.ok(codes.has("ACTIVE_FRAME_MISSING"));
  assert.ok(report.risk.score > 0);
  assert.ok(["high", "critical"].includes(report.risk.level));
  assert.ok(report.diagnostics.every((item) => item.source === "supplemental"));
});

test("deep diagnostics flags unsupported versions and invalid canvas dimensions", (t) => {
  const directory = temporaryDirectory(t);
  const source = copyFixture(directory, "valid-v2.json");
  const project = JSON.parse(fs.readFileSync(source, "utf8"));
  project.version = 99;
  project.canvas.width = 0;
  project.canvas.height = 900;
  const file = writeDiagnosticProject(directory, "unsupported-dimensions.json", project);

  const result = runDiagnostics(file);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const codes = new Set(report.diagnostics.map((item) => item.code));
  assert.ok(codes.has("UNSUPPORTED_VERSION"));
  assert.ok(codes.has("CANVAS_WIDTH_INVALID"));
  assert.ok(codes.has("CANVAS_HEIGHT_INVALID"));
  assert.equal(report.schema.valid, false);
  assert.ok(report.schema.errors.some((message) => /Unsupported project version/.test(message)));
});

test("deep diagnostics flags shortened cel pixel arrays without inferring missing transparency", (t) => {
  const directory = temporaryDirectory(t);
  const source = copyFixture(directory, "valid-v2.json");
  const project = JSON.parse(fs.readFileSync(source, "utf8"));
  project.cels[0].pixels.pop();
  const file = writeDiagnosticProject(directory, "short-pixels.json", project);

  const result = runDiagnostics(file);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const shortArray = report.diagnostics.find((item) => item.code === "PIXEL_ARRAY_SHORT");
  assert.ok(shortArray);
  assert.deepEqual(shortArray.details, { expected: 12, actual: 11 });
  assert.ok(report.schema.errors.some((message) => /exactly width/.test(message)));
});

test("deep diagnostics finds duplicate cel pairs and non-array/invalid pixel values", (t) => {
  const directory = temporaryDirectory(t);
  const source = copyFixture(directory, "valid-v2.json");
  const project = JSON.parse(fs.readFileSync(source, "utf8"));
  project.cels[1].layerId = project.cels[0].layerId;
  project.cels[1].frameId = project.cels[0].frameId;
  project.cels[0].pixels[0] = "#GGGGGG";
  project.cels[1].pixels = "not-an-array";
  const file = writeDiagnosticProject(directory, "malformed-cels.json", project);

  const result = runDiagnostics(file);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  const codes = new Set(report.diagnostics.map((item) => item.code));
  assert.ok(codes.has("CEL_PAIR_DUPLICATE"));
  assert.ok(codes.has("PIXEL_COLOR_INVALID"));
  assert.ok(codes.has("PIXEL_ARRAY_NOT_ARRAY"));
});

test("deep diagnostics treats explicit null pixels as transparency, not sparse holes", (t) => {
  const directory = temporaryDirectory(t);
  const source = copyFixture(directory, "valid-v2.json");
  const project = JSON.parse(fs.readFileSync(source, "utf8"));
  project.cels[0].pixels[0] = null;
  const file = writeDiagnosticProject(directory, "transparent.json", project);

  const result = runDiagnostics(file);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.schema.valid, true);
  assert.ok(!report.diagnostics.some((item) => item.code === "PIXEL_ARRAY_HOLE"));
  assert.ok(!report.diagnostics.some((item) => item.code === "PIXEL_ARRAY_SHORT"));
});

test("deep diagnostics reports duplicate and unused palette entries as supplemental warnings", (t) => {
  const directory = temporaryDirectory(t);
  const source = copyFixture(directory, "valid-v2.json");
  const project = JSON.parse(fs.readFileSync(source, "utf8"));
  project.palette.push(project.palette[0].toUpperCase());
  project.palette.push("#abcdef");
  project.cels[0].pixels[0] = "#aabbcc";
  const file = writeDiagnosticProject(directory, "suspicious-palette.json", project);

  const result = runDiagnostics(file);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.schema.valid, true);
  const codes = new Set(report.diagnostics.map((item) => item.code));
  assert.ok(codes.has("PALETTE_COLOR_DUPLICATE"));
  assert.ok(codes.has("PALETTE_ENTRY_UNUSED"));
  assert.ok(codes.has("PIXEL_COLOR_NOT_IN_PALETTE"));
  assert.ok(report.diagnostics.every((item) => item.source === "supplemental"));
  assert.equal(report.risk.level, "moderate");
});

test("deep diagnostics handles legacy projects without presenting generated IDs as source IDs", (t) => {
  const directory = temporaryDirectory(t);
  const file = copyFixture(directory, "valid-legacy.json");
  const original = fs.readFileSync(file);
  const result = runDiagnostics(file);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.sourceFormat, "legacy-single-canvas");
  assert.equal(report.sourceVersion, 1);
  assert.equal(report.schema.valid, true);
  assert.deepEqual(fs.readFileSync(file), original);
  assert.equal(report.policy.inputModified, false);
});

test("deep diagnostics returns a structured size-limit finding without parsing an oversized file", (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, "oversized.json");
  fs.writeFileSync(file, "{}");
  fs.truncateSync(file, MAX_FILE_BYTES + 1);

  const result = runDiagnostics(file);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.schema.checked, false);
  assert.equal(report.schema.valid, null);
  assert.equal(report.diagnostics[0].code, "DOCUMENT_BYTE_LIMIT");
  assert.equal(report.diagnostics[0].details.fileSizeBytes, MAX_FILE_BYTES + 1);
});

test("deep diagnostics produces structured output for malformed JSON and respects command exclusivity", (t) => {
  const directory = temporaryDirectory(t);
  const file = copyFixture(directory, "malformed-json.json");
  const result = runDiagnostics(file);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.schema.checked, false);
  assert.equal(report.diagnostics[0].code, "JSON_PARSE_ERROR");

  const invalid = spawnSync(process.execPath, [CLI, "--diagnostics", "--compare", file, file], {
    encoding: "utf8"
  });
  assert.equal(invalid.status, 2);
  const invalidReport = JSON.parse(invalid.stdout);
  assert.equal(invalidReport.error.code, "INVALID_ARGUMENT");
});

test("deep diagnostics renders a concise human report", (t) => {
  const directory = temporaryDirectory(t);
  const file = copyFixture(directory, "valid-v2.json");
  const result = runDiagnostics(file, []);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Project Inspector — Deep Diagnostics/);
  assert.match(result.stdout, /Model validation: VALID/);
  assert.match(result.stdout, /Risk score: 0\/100 \(low\)/);
});
