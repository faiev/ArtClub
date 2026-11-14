/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const CLI = path.join(ROOT, "tools", "project-fingerprint.mjs");
const FIXTURES = path.join(__dirname, "fixtures", "project-inspector");
const MAX_FILE_BYTES = 64 * 1024 * 1024;

function temporaryDirectory(t) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "project-fingerprint-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function readFixture(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURES, name), "utf8"));
}

function writeProject(directory, name, project) {
  const file = path.join(directory, name);
  fs.writeFileSync(file, JSON.stringify(project, null, 2) + "\n");
  return file;
}

function runCli(inputPath, options = ["--json"]) {
  return spawnSync(process.execPath, [CLI, ...options, inputPath], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024
  });
}

function fingerprint(file) {
  const result = runCli(file);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, true);
  return report;
}

function renameProjectIdentity(project) {
  const renamed = JSON.parse(JSON.stringify(project));
  const layerIds = new Map();
  const frameIds = new Map();

  renamed.layers.forEach((layer, index) => {
    const nextId = "renamed-layer-" + index;
    layerIds.set(layer.id, nextId);
    layer.id = nextId;
  });
  renamed.frames.forEach((frame, index) => {
    const nextId = "renamed-frame-" + index;
    frameIds.set(frame.id, nextId);
    frame.id = nextId;
  });
  renamed.cels.forEach((cel) => {
    cel.layerId = layerIds.get(cel.layerId);
    cel.frameId = frameIds.get(cel.frameId);
  });

  renamed.id = "different-project-id";
  renamed.name = "A different project title";
  renamed.activeLayerId = renamed.layers[0].id;
  renamed.activeFrameId = renamed.frames[0].id;
  renamed.selectedColorIndex = 0;
  renamed.metadata = {
    createdAt: "2030-01-01T00:00:00.000Z",
    updatedAt: "2031-01-01T00:00:00.000Z"
  };
  return renamed;
}

test("reports an exact source-byte SHA-256 and a versioned semantic fingerprint", (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, "valid.json");
  const source = fs.readFileSync(path.join(FIXTURES, "valid-v2.json"));
  fs.writeFileSync(file, source);

  const report = fingerprint(file);
  assert.equal(report.mode, "fingerprint");
  assert.equal(report.fingerprints.sourceBytes.algorithm, "sha256");
  assert.equal(
    report.fingerprints.sourceBytes.hash,
    createHash("sha256").update(source).digest("hex")
  );
  assert.equal(report.fingerprints.semanticContent.algorithm, "sha256");
  assert.equal(report.fingerprints.semanticContent.canonicalVersion, 1);
  assert.match(report.fingerprints.semanticContent.hash, /^[a-f0-9]{64}$/);
  assert.equal(report.readOnly.inputModified, false);
  assert.equal(report.readOnly.outputWritten, false);
  assert.deepEqual(fs.readFileSync(file), source);
});

test("separates project identity from content when project and entity IDs change", (t) => {
  const directory = temporaryDirectory(t);
  const original = writeProject(directory, "original.json", readFixture("valid-v2.json"));
  const renamed = writeProject(
    directory,
    "renamed.json",
    renameProjectIdentity(readFixture("valid-v2.json"))
  );

  const first = fingerprint(original);
  const second = fingerprint(renamed);
  assert.notEqual(first.fingerprints.sourceBytes.hash, second.fingerprints.sourceBytes.hash);
  assert.equal(first.fingerprints.semanticContent.hash, second.fingerprints.semanticContent.hash);
  assert.equal(first.projectIdentity.id, "project-v2-fixture");
  assert.equal(second.projectIdentity.id, "different-project-id");
  assert.notEqual(first.projectIdentity.name, second.projectIdentity.name);
});

test("detects a one-pixel artwork change", (t) => {
  const directory = temporaryDirectory(t);
  const baseline = readFixture("valid-v2.json");
  const changed = JSON.parse(JSON.stringify(baseline));
  changed.cels[0].pixels[0] = "#ff0000";
  const left = writeProject(directory, "before.json", baseline);
  const right = writeProject(directory, "after.json", changed);

  assert.notEqual(
    fingerprint(left).fingerprints.semanticContent.hash,
    fingerprint(right).fingerprints.semanticContent.hash
  );
});

test("distinguishes a missing cel from a present fully transparent cel", (t) => {
  const directory = temporaryDirectory(t);
  const withCel = readFixture("valid-v2.json");
  withCel.cels[1].pixels = Array(withCel.canvas.width * withCel.canvas.height).fill(null);
  const withoutCel = JSON.parse(JSON.stringify(withCel));
  withoutCel.cels.pop();

  const present = writeProject(directory, "present.json", withCel);
  const missing = writeProject(directory, "missing.json", withoutCel);
  assert.notEqual(
    fingerprint(present).fingerprints.semanticContent.hash,
    fingerprint(missing).fingerprints.semanticContent.hash
  );
});

test("treats frame ordering as part of semantic artwork content", (t) => {
  const directory = temporaryDirectory(t);
  const original = readFixture("valid-v2.json");
  const reordered = JSON.parse(JSON.stringify(original));
  reordered.frames.reverse();
  const first = writeProject(directory, "ordered.json", original);
  const second = writeProject(directory, "reordered.json", reordered);

  assert.notEqual(
    fingerprint(first).fingerprints.semanticContent.hash,
    fingerprint(second).fingerprints.semanticContent.hash
  );
});

test("normalizes legacy projects without exposing migration-generated IDs", (t) => {
  const directory = temporaryDirectory(t);
  const legacy = readFixture("valid-legacy.json");
  const legacyFile = writeProject(directory, "legacy.json", legacy);
  const legacyReport = fingerprint(legacyFile);
  const repeatedReport = fingerprint(legacyFile);

  assert.equal(legacyReport.projectIdentity.id, null);
  assert.equal(legacyReport.projectIdentity.sourceIdAvailable, false);
  assert.match(legacyReport.projectIdentity.note, /migration-generated IDs are not reported/);
  assert.equal(
    legacyReport.fingerprints.semanticContent.hash,
    repeatedReport.fingerprints.semanticContent.hash
  );

  const layerId = "source-v2-layer";
  const frameId = "source-v2-frame";
  const equivalentV2 = {
    format: "one-pixel-studio",
    version: 2,
    id: "new-v2-project-id",
    name: "Different title",
    canvas: { width: legacy.w, height: legacy.h, background: null },
    palette: legacy.palette.slice(),
    selectedColorIndex: 0,
    layers: [{ id: layerId, name: "Layer 1", visible: true, locked: false, opacity: 1 }],
    frames: [{ id: frameId, name: "Frame 1", durationMs: 100 }],
    cels: [{ layerId, frameId, pixels: legacy.pixels.slice() }],
    activeLayerId: layerId,
    activeFrameId: frameId,
    metadata: { createdAt: "2040-01-01T00:00:00.000Z" }
  };
  const v2File = writeProject(directory, "equivalent-v2.json", equivalentV2);
  assert.equal(
    fingerprint(v2File).fingerprints.semanticContent.hash,
    legacyReport.fingerprints.semanticContent.hash
  );
});

test("rejects unsupported project versions with a stable machine-readable error", (t) => {
  const directory = temporaryDirectory(t);
  const unsupported = readFixture("valid-v2.json");
  unsupported.version = 3;
  const file = writeProject(directory, "future-version.json", unsupported);
  const result = runCli(file);

  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.error.code, "UNSUPPORTED_VERSION");
});

test("rejects malformed JSON and invalid UTF-8 without producing a fingerprint", (t) => {
  const directory = temporaryDirectory(t);
  const malformed = path.join(directory, "malformed.json");
  const invalidUtf8 = path.join(directory, "invalid-utf8.json");
  fs.writeFileSync(malformed, "{not json");
  fs.writeFileSync(invalidUtf8, Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0x22, 0xff, 0x22, 0x7d]));

  const malformedResult = runCli(malformed);
  assert.equal(malformedResult.status, 1);
  assert.equal(JSON.parse(malformedResult.stdout).error.code, "JSON_PARSE_ERROR");

  const utf8Result = runCli(invalidUtf8);
  assert.equal(utf8Result.status, 1);
  assert.equal(JSON.parse(utf8Result.stdout).error.code, "INVALID_UTF8");
});

test("accepts a missing optional canvas background as transparent", (t) => {
  const directory = temporaryDirectory(t);
  const project = readFixture("valid-v2.json");
  delete project.canvas.background;
  const file = writeProject(directory, "no-background-field.json", project);
  const report = fingerprint(file);

  assert.equal(report.ok, true);
  assert.equal(report.fingerprints.semanticContent.canonicalVersion, 1);
});

test("batch mode is deterministic and reports byte and semantic duplicate groups", (t) => {
  const directory = temporaryDirectory(t);
  const original = readFixture("valid-v2.json");
  const exactCopy = JSON.parse(JSON.stringify(original));
  const semanticCopy = renameProjectIdentity(original);

  const first = writeProject(directory, "a-original.json", original);
  const second = writeProject(directory, "z-exact-copy.json", exactCopy);
  const third = writeProject(directory, "m-semantic-copy.json", semanticCopy);
  const before = [first, second, third].map((file) => fs.readFileSync(file));

  const result = runCli(directory, ["--batch", "--recursive", "--json"]);
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(result.stdout);
  assert.deepEqual(
    report.files.map((item) => path.basename(item.file)),
    ["a-original.json", "m-semantic-copy.json", "z-exact-copy.json"]
  );
  assert.equal(report.summary.fingerprintedFiles, 3);
  assert.equal(report.summary.byteIdenticalGroups, 1);
  assert.equal(report.summary.semanticDuplicateGroups, 1);
  assert.equal(report.duplicateGroups.byteIdentical[0].paths.length, 2);
  assert.equal(report.duplicateGroups.semanticContentEquivalent[0].paths.length, 3);
  assert.deepEqual([first, second, third].map((file) => fs.readFileSync(file)), before);
});

test("batch mode rejects file-count overflow without fingerprinting a partial set", (t) => {
  const directory = temporaryDirectory(t);
  for (let index = 0; index < 501; index += 1) {
    fs.writeFileSync(path.join(directory, "project-" + String(index).padStart(3, "0") + ".json"), "{}");
  }

  const result = runCli(directory, ["--batch", "--recursive", "--json"]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.discoveredFiles, 500);
  assert.equal(report.summary.fingerprintedFiles, 0);
  assert.equal(report.summary.failedFiles, 0);
  assert.ok(report.discoveryErrors.some((item) => item.code === "BATCH_FILE_LIMIT"));
});

test("batch mode refuses to follow symbolic links", (t) => {
  const directory = temporaryDirectory(t);
  const scanDirectory = path.join(directory, "scan");
  fs.mkdirSync(scanDirectory);
  const target = writeProject(directory, "outside.json", readFixture("valid-v2.json"));
  fs.symlinkSync(target, path.join(scanDirectory, "linked-project.json"));

  const result = runCli(scanDirectory, ["--batch", "--recursive", "--json"]);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.summary.fingerprintedFiles, 0);
  assert.ok(report.discoveryErrors.some((item) => item.code === "SYMLINK_NOT_FOLLOWED"));
});

test("rejects oversized files before parsing and preserves their bytes", (t) => {
  const directory = temporaryDirectory(t);
  const file = path.join(directory, "oversized.json");
  fs.writeFileSync(file, "{}");
  fs.truncateSync(file, MAX_FILE_BYTES + 1);
  const originalSize = fs.statSync(file).size;

  const result = runCli(file);
  assert.equal(result.status, 1);
  const report = JSON.parse(result.stdout);
  assert.equal(report.ok, false);
  assert.equal(report.error.code, "FILE_TOO_LARGE");
  assert.equal(fs.statSync(file).size, originalSize);
});

test("human output gives both fingerprints and keeps the tool read-only", (t) => {
  const directory = temporaryDirectory(t);
  const file = writeProject(directory, "human.json", readFixture("valid-v2.json"));
  const result = runCli(file, []);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Project Fingerprint/);
  assert.match(result.stdout, /Source-byte SHA-256:/);
  assert.match(result.stdout, /Semantic fingerprint v1:/);
  assert.match(result.stdout, /Source modified: no/);
});
