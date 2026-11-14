"use strict";

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SUITE_MANIFEST } from "../../../tools/run-qa.mjs";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPOSITORY_ROOT = path.resolve(path.dirname(SCRIPT_PATH), "../../..");

function sameArray(first, second) {
  return Array.isArray(first) && Array.isArray(second) &&
    first.length === second.length && first.every((value, index) => value === second[index]);
}

/** Validate a complete --suite all JSON report against the manifest and checkout. */
export function validateAllSuitesReport(report, options = {}) {
  const root = path.resolve(options.root || REPOSITORY_ROOT);
  const manifest = options.manifest || SUITE_MANIFEST;
  const errors = [];
  const selectedNames = manifest.map(suite => suite.name);
  const suiteRecords = new Map((report && Array.isArray(report.suites) ? report.suites : [])
    .map(suite => [suite.name, suite]));
  const counts = { executed: 0, passed: 0, failed: 0, skipped: 0, notRun: 0 };
  let firstFailureExitCode = null;

  if (!report || typeof report !== "object") {
    return { ok: false, errors: ["runner did not produce a JSON report"], counts, expectedExitCode: 2 };
  }
  if (report.schemaVersion !== 1) errors.push("expected report schemaVersion 1");
  if (!sameArray(report.selectedSuites, selectedNames)) {
    errors.push("selectedSuites do not match the complete manifest order");
  }
  if (!Array.isArray(report.notRunSuites) || report.notRunSuites.length !== 0) {
    errors.push("--suite all must not report any suite as unselected");
  }

  for (const suite of manifest) {
    const record = suiteRecords.get(suite.name);
    if (!record || !Array.isArray(record.files)) {
      errors.push("missing suite record: " + suite.name);
      continue;
    }
    if (record.files.length !== suite.files.length) {
      errors.push("file count mismatch for suite: " + suite.name);
      continue;
    }
    for (const entry of suite.files) {
      const file = record.files.find(item => item.path === entry.path);
      if (!file) {
        errors.push("missing file record: " + entry.path);
        continue;
      }
      const exists = fs.existsSync(path.resolve(root, entry.path));
      if (!exists) {
        if (file.status !== "not-run") {
          errors.push("absent manifest entry must be not-run: " + entry.path);
        } else {
          counts.notRun += 1;
        }
        continue;
      }
      if (entry.runner === "node-script") {
        if (file.status !== "skipped") {
          errors.push("browser script must be skipped without --include-browser: " + entry.path);
        } else {
          counts.skipped += 1;
        }
        continue;
      }
      if (file.status === "passed" && file.exitCode === 0) {
        counts.executed += 1;
        counts.passed += 1;
      } else {
        counts.failed += 1;
        if (firstFailureExitCode === null) {
          firstFailureExitCode = Number.isInteger(file.exitCode) && file.exitCode !== 0 ? file.exitCode : 1;
        }
        errors.push("present Node suite did not pass: " + entry.path + " (" + file.status + ")");
      }
    }
    if ((suite.name === "release" || suite.name === "runner") && record.status !== "passed") {
      errors.push("required verifier suite did not pass: " + suite.name);
    }
  }

  const expectedExitCode = firstFailureExitCode !== null
    ? firstFailureExitCode
    : (counts.notRun > 0 || counts.executed === 0 ? 2 : 0);
  if (report.exitCode !== expectedExitCode) {
    errors.push("runner exitCode did not match manifest/report state; expected " + expectedExitCode);
  }
  if (report.summary && report.summary.files) {
    for (const key of ["executed", "passed", "failed", "skipped", "notRun"]) {
      if (report.summary.files[key] !== counts[key]) {
        errors.push("file summary count mismatch: " + key);
      }
    }
  } else {
    errors.push("missing report.summary.files");
  }
  return {
    ok: errors.length === 0,
    errors,
    counts,
    expectedExitCode,
    complete: counts.notRun === 0 && counts.skipped === 0 && counts.failed === 0
  };
}

export function runVerifier(options = {}) {
  const root = path.resolve(options.root || REPOSITORY_ROOT);
  const runnerPath = path.join(root, "tools", "run-qa.mjs");
  const child = spawnSync(process.execPath, [runnerPath, "--suite", "all", "--json", "--root", root], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    windowsHide: true,
    maxBuffer: 16 * 1024 * 1024
  });
  if (child.error) throw child.error;
  let report;
  try {
    report = JSON.parse(child.stdout);
  } catch (error) {
    throw new Error("run-qa did not emit valid JSON: " + error.message + "\n" + (child.stderr || ""));
  }
  const verification = validateAllSuitesReport(report, { root });
  if (child.status !== report.exitCode) {
    verification.ok = false;
    verification.errors.push("child process exit status did not match report.exitCode");
  }
  const output = { verification, report };
  return { output, exitCode: verification.ok ? 0 : 1 };
}

const isDirectExecution = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href;

if (isDirectExecution) {
  try {
    const result = runVerifier();
    process.stdout.write(JSON.stringify(result.output, null, 2) + "\n");
    if (!result.output.verification.ok) process.stderr.write("QA runner CI verification failed.\n");
    process.exitCode = result.exitCode;
  } catch (error) {
    process.stderr.write("verify-qa-runner-ci: " + error.message + "\n");
    process.exitCode = 1;
  }
}