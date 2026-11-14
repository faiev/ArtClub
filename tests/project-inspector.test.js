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
