"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { validateAllSuitesReport } from "./verify-qa-runner-ci.mjs";

function fixtureReport(root, manifest) {
  const suites = manifest.map(suite => ({
    name: suite.name,
    kind: suite.kind,
    status: "passed",
    files: suite.files.map(entry => {
      const target = path.join(root, entry.path);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, "fixture\n");
      return {
        path: entry.path,
        runner: entry.runner,
        status: entry.runner === "node-script" ? "skipped" : "passed",
        exitCode: entry.runner === "node-script" ? null : 0
      };
    })
  }));
  const counts = suites.flatMap(suite => suite.files).reduce((result, file) => {
    if (file.status === "passed") {
      result.executed += 1;
      result.passed += 1;
    } else {
      result.skipped += 1;
    }
    return result;
  }, { executed: 0, passed: 0, failed: 0, skipped: 0, notRun: 0 });
  return {
    schemaVersion: 1,
    selectedSuites: manifest.map(suite => suite.name),
    notRunSuites: [],
    suites,
    summary: { files: counts },
    exitCode: 0
  };
}

test("rejects duplicate suite records instead of silently overwriting them", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qa-report-"));
  const manifest = [{ name: "runner", kind: "node-test", files: [
    { path: "tests/qa/runner/example.test.mjs", runner: "node-test" }
  ] }];
  try {
    const report = fixtureReport(root, manifest);
    report.suites.push(structuredClone(report.suites[0]));
    const result = validateAllSuitesReport(report, { root, manifest });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.includes("duplicate suite record")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects unexpected suite and file records", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qa-report-"));
  const manifest = [{ name: "runner", kind: "node-test", files: [
    { path: "tests/qa/runner/example.test.mjs", runner: "node-test" }
  ] }];
  try {
    const report = fixtureReport(root, manifest);
    report.suites.push({
      name: "unexpected", kind: "node-test", status: "passed", files: []
    });
    report.suites[0].files.push({
      path: "tests/qa/runner/unexpected.test.mjs",
      runner: "node-test", status: "passed", exitCode: 0
    });
    const result = validateAllSuitesReport(report, { root, manifest });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.includes("unexpected suite record")));
    assert.ok(result.errors.some(error => error.includes("unexpected file record")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects duplicate file records within a suite", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "qa-report-"));
  const manifest = [{ name: "runner", kind: "node-test", files: [
    { path: "tests/qa/runner/example.test.mjs", runner: "node-test" }
  ] }];
  try {
    const report = fixtureReport(root, manifest);
    report.suites[0].files.push(structuredClone(report.suites[0].files[0]));
    const result = validateAllSuitesReport(report, { root, manifest });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some(error => error.includes("duplicate file record")));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
