import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { EventEmitter } from "node:events";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  SUITE_MANIFEST,
  formatHumanReport,
  parseArgs,
  runQASuites
} from "../../../tools/run-qa.mjs";

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "artclub qa runner-"));
}

function put(root, relativePath, content = "// QA fixture\n") {
  const target = path.resolve(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
}

function treeSnapshot(directory, prefix = "") {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...treeSnapshot(absolute, relative));
    else if (entry.isFile()) {
      output.push(relative + "\0" + fs.readFileSync(absolute).toString("base64"));
    }
  }
  return output.sort();
}

function stubSpawn(responses) {
  const calls = [];
  let index = 0;
  const spawnImpl = (command, args, options) => {
    calls.push({ command, args: args.slice(), options: { ...options } });
    const response = responses[index++] || { exitCode: 0 };
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    queueMicrotask(() => {
      if (response.stdout) child.stdout.emit("data", Buffer.from(response.stdout));
      if (response.stderr) child.stderr.emit("data", Buffer.from(response.stderr));
      child.emit("close", response.exitCode ?? 0, response.signal ?? null);
    });
    return child;
  };
  spawnImpl.calls = calls;
  return spawnImpl;
}

function findSuite(report, name) {
  const suite = report.suites.find(item => item.name === name);
  assert.ok(suite, "expected suite " + name);
  return suite;
}

test("CLI parser accepts supported selection flags and rejects malformed arguments", () => {
  const options = parseArgs([
    "--suite", "lifecycle",
    "--file", "tests/qa/lifecycle/project-lifecycle.test.js",
    "--root", "/tmp/repo with spaces",
    "--json",
    "--include-browser"
  ]);
  assert.equal(options.suite, "lifecycle");
  assert.equal(options.file, "tests/qa/lifecycle/project-lifecycle.test.js");
  assert.equal(options.root, "/tmp/repo with spaces");
  assert.equal(options.json, true);
  assert.equal(options.includeBrowser, true);

  assert.throws(() => parseArgs(["--suite"]), /requires a suite name/);
  assert.throws(() => parseArgs(["--file"]), /requires a repository-relative QA path/);
  assert.throws(() => parseArgs(["--root"]), /requires a directory path/);
  assert.throws(() => parseArgs(["--unexpected"]), /Unknown argument/);
  assert.throws(() => parseArgs(["--suite", "unknown"]), /Unknown QA suite/);
  assert.throws(() => parseArgs(["--file", "../../package.json"]), /traverse parent directories/);
});

test("manifest is explicit, sorted, unique and confined to tests/qa", () => {
  const names = SUITE_MANIFEST.map(suite => suite.name);
  assert.deepEqual(names, names.slice().sort());
  const paths = SUITE_MANIFEST.flatMap(suite => suite.files.map(file => file.path));
  assert.equal(new Set(paths).size, paths.length);
  for (const suite of SUITE_MANIFEST) {
    const suitePaths = suite.files.map(file => file.path);
    assert.deepEqual(suitePaths, suitePaths.slice().sort(),
      "files within each suite should be sorted");
  }
  for (const filePath of paths) {
    assert.ok(filePath.startsWith("tests/qa/"), filePath);
    assert.equal(filePath.includes(".."), false, filePath);
  }
  for (const required of ["browser", "compatibility", "import-export", "lifecycle"]) {
    assert.ok(names.includes(required));
  }
});

test("all-suite execution follows the sorted manifest and records the opt-in browser skip", async () => {
  const root = makeRoot();
  try {
    for (const suite of SUITE_MANIFEST) {
      for (const entry of suite.files) put(root, entry.path);
    }
    const nodeFileCount = SUITE_MANIFEST
      .filter(suite => suite.kind === "node-test")
      .reduce((count, suite) => count + suite.files.length, 0);
    const spawnImpl = stubSpawn(Array.from({ length: nodeFileCount }, () => ({ exitCode: 0 })));
    const report = await runQASuites({ root, suite: "all", spawnImpl });

    assert.deepEqual(report.selectedSuites, SUITE_MANIFEST.map(suite => suite.name));
    assert.deepEqual(report.notRunSuites, []);
    assert.equal(report.exitCode, 0);
    assert.deepEqual(
      report.suites.map(suite => suite.name),
      SUITE_MANIFEST.map(suite => suite.name)
    );
    assert.equal(findSuite(report, "browser").status, "skipped");
    assert.equal(findSuite(report, "browser").files[0].status, "skipped");
    assert.equal(report.summary.suites.skipped, 1);
    assert.equal(spawnImpl.calls.length, nodeFileCount);
    const invokedPaths = spawnImpl.calls.map(call => call.args[1]);
    const expectedPaths = SUITE_MANIFEST
      .filter(suite => suite.kind === "node-test")
      .flatMap(suite => suite.files.map(entry => path.resolve(root, entry.path)));
    assert.deepEqual(invokedPaths, expectedPaths,
      "execution order should be deterministic and follow the sorted manifest");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("named Node suite selection uses argument arrays and reports unselected suites", async () => {
  const root = makeRoot();
  try {
    const lifecycleFiles = SUITE_MANIFEST.find(suite => suite.name === "lifecycle").files;
    for (const entry of lifecycleFiles) put(root, entry.path);
    const spawnImpl = stubSpawn([
      { exitCode: 0, stdout: "first test output\n" },
      { exitCode: 0, stderr: "second diagnostic\n" }
    ]);

    const report = await runQASuites({
      root,
      suite: "lifecycle",
      spawnImpl
    });

    assert.equal(report.exitCode, 0);
    assert.deepEqual(report.selectedSuites, ["lifecycle"]);
    assert.ok(report.notRunSuites.some(item => item.name === "browser"));
    assert.ok(report.notRunSuites.every(item => item.reason === "not selected"));
    const suite = findSuite(report, "lifecycle");
    assert.equal(suite.status, "passed");
    assert.deepEqual(
      suite.files.map(file => file.path),
      lifecycleFiles.map(file => file.path),
      "manifest order should be retained"
    );
    assert.equal(suite.files[0].stdout, "first test output\n");
    assert.equal(suite.files[1].stderr, "second diagnostic\n");
    assert.equal(spawnImpl.calls.length, 2);
    for (const call of spawnImpl.calls) {
      assert.equal(call.command, process.execPath);
      assert.equal(call.args.length, 2);
      assert.equal(call.args[0], "--test");
      assert.ok(path.isAbsolute(call.args[1]));
      assert.ok(call.args[1].includes("artclub qa runner-"),
        "a checkout path containing spaces must remain one argument");
      assert.equal(call.options.cwd, root);
      assert.equal(call.options.shell, false);
      assert.deepEqual(call.options.stdio, ["ignore", "pipe", "pipe"]);
    }
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("missing manifest files are explicitly marked not-run and never spawned", async () => {
  const root = makeRoot();
  try {
    const lifecycle = SUITE_MANIFEST.find(suite => suite.name === "lifecycle");
    put(root, lifecycle.files[0].path);
    const spawnImpl = stubSpawn([{ exitCode: 0 }]);
    const report = await runQASuites({ root, suite: "lifecycle", spawnImpl });
    const suite = findSuite(report, "lifecycle");

    assert.equal(report.exitCode, 2,
      "an absent manifest file must prevent a clean suite exit");
    assert.equal(suite.exitCode, 2);
    assert.equal(suite.status, "partial");
    assert.equal(suite.files[0].status, "passed");
    assert.equal(suite.files[1].status, "not-run");
    assert.match(suite.files[1].reason, /not present/);
    assert.equal(spawnImpl.calls.length, 1);
    assert.equal(report.summary.files.notRun, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("test failures preserve their child exit code and capture both output streams", async () => {
  const root = makeRoot();
  try {
    const renderer = SUITE_MANIFEST.find(suite => suite.name === "lifecycle");
    for (const entry of renderer.files) put(root, entry.path);
    const spawnImpl = stubSpawn([
      { exitCode: 7, stdout: "failed output\n", stderr: "assertion failed\n" },
      { exitCode: 0, stdout: "follow-up test ran\n" }
    ]);
    const report = await runQASuites({ root, suite: "lifecycle", spawnImpl });
    const suite = findSuite(report, "lifecycle");

    assert.equal(report.exitCode, 7);
    assert.equal(suite.status, "failed");
    assert.equal(suite.files[0].exitCode, 7);
    assert.equal(suite.files[0].stdout, "failed output\n");
    assert.equal(suite.files[0].stderr, "assertion failed\n");
    assert.equal(suite.files[1].status, "passed",
      "the remaining files in the selected suite should still run");
    assert.equal(spawnImpl.calls.length, 2);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("a selected suite with no present manifest files is explicitly not-run with code 2", async () => {
  const root = makeRoot();
  try {
    const spawnImpl = stubSpawn([]);
    const report = await runQASuites({ root, suite: "compatibility", spawnImpl });
    const suite = findSuite(report, "compatibility");
    assert.equal(suite.status, "not-run");
    assert.equal(suite.files[0].status, "not-run");
    assert.equal(report.summary.suites.notRun, 1);
    assert.equal(report.exitCode, 2);
    assert.equal(spawnImpl.calls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("browser suites are skipped by default and run only with explicit opt-in", async () => {
  const root = makeRoot();
  try {
    const browser = SUITE_MANIFEST.find(suite => suite.name === "browser");
    put(root, browser.files[0].path);
    const skippedSpawn = stubSpawn([]);
    const skipped = await runQASuites({ root, suite: "browser", spawnImpl: skippedSpawn });
    assert.equal(skipped.exitCode, 2);
    assert.equal(findSuite(skipped, "browser").status, "skipped");
    assert.equal(findSuite(skipped, "browser").files[0].status, "skipped");
    assert.equal(skippedSpawn.calls.length, 0);

    const includedSpawn = stubSpawn([{ exitCode: 0, stdout: "Chromium passed\n" }]);
    const included = await runQASuites({
      root,
      suite: "browser",
      includeBrowser: true,
      spawnImpl: includedSpawn
    });
    assert.equal(included.exitCode, 0);
    assert.equal(findSuite(included, "browser").status, "passed");
    assert.deepEqual(includedSpawn.calls[0].args, [
      path.resolve(root, browser.files[0].path)
    ], "browser script should run as a separate Node command, not through node --test");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("file selection narrows to one manifest entry and reports siblings as not-run", async () => {
  const root = makeRoot();
  try {
    const lifecycle = SUITE_MANIFEST.find(suite => suite.name === "lifecycle");
    put(root, lifecycle.files[0].path);
    put(root, lifecycle.files[1].path);
    const spawnImpl = stubSpawn([{ exitCode: 0 }]);
    const report = await runQASuites({
      root,
      file: lifecycle.files[1].path,
      spawnImpl
    });
    const suite = findSuite(report, "lifecycle");

    assert.deepEqual(report.selectedSuites, ["lifecycle"]);
    assert.equal(suite.files[0].status, "not-run");
    assert.equal(suite.files[1].status, "passed");
    assert.equal(spawnImpl.calls.length, 1);
    assert.deepEqual(spawnImpl.calls[0].args, [
      "--test",
      path.resolve(root, lifecycle.files[1].path)
    ]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects unknown suites, unknown files and paths escaping tests/qa", async () => {
  const root = makeRoot();
  try {
    const spawnImpl = stubSpawn([]);
    await assert.rejects(
      runQASuites({ root, suite: "not-a-suite", spawnImpl }),
      /Unknown QA suite/
    );
    await assert.rejects(
      runQASuites({ root, file: "../../package.json", spawnImpl }),
      /must not be absolute or traverse/
    );
    await assert.rejects(
      runQASuites({ root, file: "tests/project-model.test.js", spawnImpl }),
      /inside tests\/qa/
    );
    await assert.rejects(
      runQASuites({ root, file: "tests/qa/not-in-manifest.test.js", spawnImpl }),
      /not present in the explicit suite manifest/
    );
    assert.equal(spawnImpl.calls.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects a symlink inside tests/qa that resolves outside the QA root", async t => {
  const root = makeRoot();
  try {
    const lifecycle = SUITE_MANIFEST.find(suite => suite.name === "lifecycle");
    const outside = put(root, "outside.test.js");
    const link = path.resolve(root, lifecycle.files[0].path);
    fs.mkdirSync(path.dirname(link), { recursive: true });
    try {
      fs.symlinkSync(outside, link);
    } catch (error) {
      if (error.code === "EPERM" || error.code === "ENOSYS") {
        t.skip("Symlink creation is not permitted in this environment.");
        return;
      }
      throw error;
    }

    await assert.rejects(
      runQASuites({ root, suite: "lifecycle", spawnImpl: stubSpawn([]) }),
      /resolves outside tests\/qa/
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("returns a stable JSON-ready summary and human output without mutating files", async () => {
  const root = makeRoot();
  try {
    const lifecycle = SUITE_MANIFEST.find(suite => suite.name === "lifecycle");
    put(root, lifecycle.files[0].path);
    const before = treeSnapshot(root);
    const report1 = await runQASuites({
      root,
      suite: "lifecycle",
      spawnImpl: stubSpawn([{ exitCode: 0, stdout: "ok\n" }])
    });
    const report2 = await runQASuites({
      root,
      suite: "lifecycle",
      spawnImpl: stubSpawn([{ exitCode: 0, stdout: "ok\n" }])
    });
    assert.deepEqual(report1, report2,
      "the report shape and field ordering should be deterministic for the same execution results");
    assert.equal(report1.schemaVersion, 1);
    assert.ok(Array.isArray(report1.suites));
    assert.ok(Array.isArray(report1.notRunSuites));
    const jsonRoundTrip = JSON.parse(JSON.stringify(report1));
    assert.deepEqual(jsonRoundTrip, report1);
    assert.ok(Number.isInteger(report1.summary.files.executed));
    assert.ok(Number.isInteger(report1.summary.files.notRun));
    assert.ok(Number.isInteger(report1.summary.suites.passed));
    assert.ok(Number.isInteger(report1.summary.suites.failed));
    assert.deepEqual(
      Object.keys(report1).sort(),
      ["exitCode", "notRunSuites", "root", "schemaVersion", "selectedSuites", "suites", "summary"].sort()
    );
    assert.deepEqual(
      Object.keys(report1.summary).sort(),
      ["files", "suites"].sort()
    );
    assert.deepEqual(
      Object.keys(report1.suites[0].files[0]).sort(),
      ["exitCode", "path", "reason", "runner", "signal", "status", "stderr", "stdout"].sort()
    );
    assert.deepEqual(treeSnapshot(root), before, "runner must not create, change or remove files");

    const human = formatHumanReport(report1);
    assert.match(human, /Art Club QA suite runner/);
    assert.match(human, /PARTIAL/);
    assert.match(human, /NOT-RUN/);
    assert.doesNotMatch(human, /\\[SKIPPED\\]/,
      "a missing manifest file must not be mislabeled as an intentional skip");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI executes a real built-in test run and emits stable machine-readable JSON", () => {
  const root = makeRoot();
  try {
    const lifecycle = SUITE_MANIFEST.find(suite => suite.name === "lifecycle");
    for (const entry of lifecycle.files) {
      put(root, entry.path,
        'const test = require("node:test"); test("runner fixture passes", () => {});\n');
    }
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tools/run-qa.mjs");
    const result = spawnSync(process.execPath, [
      script, "--suite", "lifecycle", "--root", root, "--json"
    ], { encoding: "utf8" });

    assert.equal(result.status, 0, result.stderr);
    const report = JSON.parse(result.stdout);
    const suite = findSuite(report, "lifecycle");
    assert.equal(suite.status, "passed");
    assert.equal(suite.files[0].status, "passed");
    assert.equal(suite.files[1].status, "passed");
    assert.equal(report.exitCode, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("CLI preserves a failing built-in Node test exit code and JSON failure detail", () => {
  const root = makeRoot();
  try {
    const lifecycle = SUITE_MANIFEST.find(suite => suite.name === "lifecycle");
    const target = lifecycle.files[0].path;
    put(root, target, [
      'const test = require("node:test");',
      'test("intentional failing QA fixture", () => { throw new Error("expected fixture failure"); });'
    ].join("\n"));

    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tools/run-qa.mjs");
    const result = spawnSync(process.execPath, [
      script, "--suite", "lifecycle", "--file", target, "--root", root, "--json"
    ], { encoding: "utf8" });

    assert.notEqual(result.status, 0);
    const report = JSON.parse(result.stdout);
    const suite = findSuite(report, "lifecycle");
    assert.equal(report.exitCode, 1);
    assert.equal(suite.files[0].status, "failed");
    assert.equal(suite.files[0].exitCode, 1);
    assert.match(suite.files[0].stderr + suite.files[0].stdout, /expected fixture failure/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
test("CLI returns non-zero when no selected files can run and prints actual help text", () => {
  const root = makeRoot();
  try {
    const browser = SUITE_MANIFEST.find(suite => suite.name === "browser");
    put(root, browser.files[0].path);
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tools/run-qa.mjs");
    const skipped = spawnSync(process.execPath, [
      script, "--suite", "browser", "--root", root, "--json"
    ], { encoding: "utf8" });
    assert.equal(skipped.status, 2);
    const report = JSON.parse(skipped.stdout);
    assert.equal(report.exitCode, 2);
    assert.equal(findSuite(report, "browser").status, "skipped");

    const help = spawnSync(process.execPath, [script, "--help"], { encoding: "utf8" });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Usage: node tools\/run-qa\.mjs/);
    assert.match(help.stdout, /--include-browser/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI rejects unknown suites with a usage failure code", () => {
  const root = makeRoot();
  try {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tools/run-qa.mjs");
    const result = spawnSync(process.execPath, [
      script, "--suite", "shell;echo unsafe", "--root", root
    ], { encoding: "utf8" });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown QA suite/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CI verifier distinguishes absent manifest files from existing browser skips", () => {
  const root = makeRoot();
  const manifest = [
    { name: "browser", files: [{ path: "tests/qa/browser/browser.mjs", runner: "node-script" }] },
    { name: "compatibility", files: [{ path: "tests/qa/compatibility/compatibility.test.js", runner: "node-test" }] },
    { name: "release", files: [{ path: "tests/qa/release/release.test.js", runner: "node-test" }] },
    { name: "runner", files: [{ path: "tests/qa/runner/runner.test.mjs", runner: "node-test" }] }
  ];
  try {
    put(root, "tests/qa/release/release.test.js");
    put(root, "tests/qa/runner/runner.test.mjs");
    const report = {
      schemaVersion: 1,
      selectedSuites: ["browser", "compatibility", "release", "runner"],
      notRunSuites: [],
      suites: [
        { name: "browser", status: "not-run", files: [{ path: "tests/qa/browser/browser.mjs", status: "not-run", exitCode: null }] },
        { name: "compatibility", status: "not-run", files: [{ path: "tests/qa/compatibility/compatibility.test.js", status: "not-run", exitCode: null }] },
        { name: "release", status: "passed", files: [{ path: "tests/qa/release/release.test.js", status: "passed", exitCode: 0 }] },
        { name: "runner", status: "passed", files: [{ path: "tests/qa/runner/runner.test.mjs", status: "passed", exitCode: 0 }] }
      ],
      summary: { files: { executed: 2, passed: 2, failed: 0, skipped: 0, notRun: 2 } },
      exitCode: 2
    };
    const absent = validateAllSuitesReport(report, { root, manifest });
    assert.equal(absent.ok, true, absent.errors.join('; '));
    assert.deepEqual(absent.counts, { executed: 2, passed: 2, failed: 0, skipped: 0, notRun: 2 });
    assert.equal(absent.expectedExitCode, 2);

    const incorrectAbsentState = structuredClone(report);
    incorrectAbsentState.suites[0].files[0].status = "skipped";
    const rejected = validateAllSuitesReport(incorrectAbsentState, { root, manifest });
    assert.equal(rejected.ok, false);
    assert.ok(rejected.errors.some(error => error.includes('absent manifest entry must be not-run')));

    put(root, "tests/qa/browser/browser.mjs");
    const browserPresent = structuredClone(report);
    browserPresent.suites[0].status = "skipped";
    browserPresent.suites[0].files[0].status = "skipped";
    browserPresent.summary.files.skipped = 1;
    browserPresent.summary.files.notRun = 1;
    const skipped = validateAllSuitesReport(browserPresent, { root, manifest });
    assert.equal(skipped.ok, true, skipped.errors.join('; '));
    assert.equal(skipped.counts.skipped, 1);
    assert.equal(skipped.counts.notRun, 1);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
