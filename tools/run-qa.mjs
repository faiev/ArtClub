#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

/**
 * Only explicitly listed files under tests/qa are eligible for execution.
 * Keep suite names and file paths sorted so human and JSON output is stable.
 */
export const SUITE_MANIFEST = Object.freeze([
  Object.freeze({
    name: "browser",
    kind: "browser",
    files: Object.freeze([
      Object.freeze({
        path: "tests/qa/browser/project-lifecycle.mjs",
        runner: "node-script"
      })
    ])
  }),
  Object.freeze({
    name: "compatibility",
    kind: "node-test",
    files: Object.freeze([
      Object.freeze({
        path: "tests/qa/compatibility/project-compatibility.test.js",
        runner: "node-test"
      })
    ])
  }),
  Object.freeze({
    name: "import-export",
    kind: "node-test",
    files: Object.freeze([
      Object.freeze({
        path: "tests/qa/compatibility/gif-export-contract.test.js",
        runner: "node-test"
      })
    ])
  }),
  Object.freeze({
    name: "lifecycle",
    kind: "node-test",
    files: Object.freeze([
      Object.freeze({
        path: "tests/qa/lifecycle/editor-switch-contract.test.js",
        runner: "node-test"
      }),
      Object.freeze({
        path: "tests/qa/lifecycle/project-lifecycle.test.js",
        runner: "node-test"
      })
    ])
  }),
  Object.freeze({
    name: "release",
    kind: "node-test",
    files: Object.freeze([
      Object.freeze({
        path: "tests/qa/release/qa-release-check.test.js",
        runner: "node-test"
      })
    ])
  }),
  Object.freeze({
    name: "renderer",
    kind: "node-test",
    files: Object.freeze([
      Object.freeze({
        path: "tests/qa/renderer/canvas-renderer-contract.test.js",
        runner: "node-test"
      })
    ])
  }),
  Object.freeze({
    name: "runner",
    kind: "node-test",
    files: Object.freeze([
      Object.freeze({
        path: "tests/qa/runner/run-qa.test.mjs",
        runner: "node-test"
      })
    ])
  })
]);

const SUITES_BY_NAME = new Map(SUITE_MANIFEST.map(suite => [suite.name, suite]));
const QA_PREFIX = "tests/qa/";

function isInside(directory, candidate) {
  const relative = path.relative(directory, candidate);
  return relative === "" ||
    (!relative.startsWith(".." + path.sep) &&
      relative !== ".." &&
      !path.isAbsolute(relative));
}

function resolveQaPath(root, relativePath) {
  if (typeof relativePath !== "string" || !relativePath.trim()) {
    throw new Error("QA file path must be a non-empty relative path.");
  }
  if (relativePath.includes("\\") || relativePath.includes("\0")) {
    throw new Error("QA file paths must use forward slashes and contain no NUL bytes.");
  }
  if (path.posix.isAbsolute(relativePath) ||
      /^[A-Za-z]:/.test(relativePath) ||
      relativePath.split("/").some(part => part === ".." || part === ".")) {
    throw new Error("QA file path must not be absolute or traverse parent directories.");
  }
  if (!relativePath.startsWith(QA_PREFIX)) {
    throw new Error("QA files must be inside tests/qa/.");
  }

  const absoluteRoot = path.resolve(root);
  const qaRoot = path.resolve(absoluteRoot, "tests", "qa");
  const absolutePath = path.resolve(absoluteRoot, ...relativePath.split("/"));
  if (!isInside(qaRoot, absolutePath) || absolutePath === qaRoot) {
    throw new Error("QA file path escapes tests/qa/.");
  }

  if (fs.existsSync(absolutePath)) {
    const realRoot = fs.realpathSync(absoluteRoot);
    const realQaRoot = fs.realpathSync(qaRoot);
    if (!isInside(realRoot, realQaRoot)) {
      throw new Error("tests/qa/ resolves outside the repository root.");
    }
    const realFile = fs.realpathSync(absolutePath);
    if (!isInside(realQaRoot, realFile) || realFile === realQaRoot) {
      throw new Error("QA file resolves outside tests/qa/.");
    }
    if (!fs.statSync(realFile).isFile()) {
      throw new Error("QA manifest entries must resolve to regular files.");
    }
  }

  return absolutePath;
}

function manifestEntries(root = null) {
  const previousNames = [];
  const seenPaths = new Set();

  for (const suite of SUITE_MANIFEST) {
    previousNames.push(suite.name);
    if (!Array.isArray(suite.files) || suite.files.length === 0) {
      throw new Error("Suite " + suite.name + " must contain at least one manifest entry.");
    }

    const paths = suite.files.map(file => file.path);
    const sortedPaths = paths.slice().sort();
    if (paths.some((filePath, index) => filePath !== sortedPaths[index])) {
      throw new Error("Files in suite " + suite.name + " must be sorted by path.");
    }

    for (const entry of suite.files) {
      if (seenPaths.has(entry.path)) {
        throw new Error("Duplicate QA manifest path: " + entry.path);
      }
      seenPaths.add(entry.path);
      if (entry.runner === "node-test" && !/\.test\.(?:js|mjs)$/.test(entry.path)) {
        throw new Error("Node test entries must use a .test.js or .test.mjs path.");
      }
      if (entry.runner === "node-script" && !entry.path.endsWith(".mjs")) {
        throw new Error("Browser script entries must use an .mjs path.");
      }
      if (root) resolveQaPath(root, entry.path);
    }
  }

  const sortedNames = previousNames.slice().sort();
  if (previousNames.some((name, index) => name !== sortedNames[index])) {
    throw new Error("QA suite manifest must be sorted by suite name.");
  }

  return SUITE_MANIFEST;
}

export function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    suite: "all",
    file: null,
    includeBrowser: false,
    json: false,
    help: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--suite") {
      index += 1;
      if (!argv[index]) throw new Error("--suite requires a suite name.");
      options.suite = argv[index];
    } else if (argument === "--file") {
      index += 1;
      if (!argv[index]) throw new Error("--file requires a repository-relative QA path.");
      options.file = argv[index];
    } else if (argument === "--root") {
      index += 1;
      if (!argv[index]) throw new Error("--root requires a directory path.");
      options.root = argv[index];
    } else if (argument === "--include-browser") {
      options.includeBrowser = true;
    } else if (argument === "--json") {
      options.json = true;
    } else if (argument === "--help" || argument === "-h") {
      options.help = true;
    } else {
      throw new Error("Unknown argument: " + argument);
    }
  }

  if (options.suite !== "all" && !SUITES_BY_NAME.has(options.suite)) {
    throw new Error("Unknown QA suite: " + options.suite);
  }
  if (options.file) resolveQaPath(options.root, options.file);

  return options;
}

function collectChild(spawnImpl, command, args, spawnOptions) {
  return new Promise(resolve => {
    let child;
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = result => {
      if (settled) return;
      settled = true;
      resolve({ ...result, stdout, stderr });
    };

    try {
      child = spawnImpl(command, args, spawnOptions);
    } catch (error) {
      finish({
        status: "failed",
        exitCode: 1,
        signal: null,
        error: error.message
      });
      return;
    }

    if (child.stdout && typeof child.stdout.on === "function") {
      child.stdout.on("data", chunk => { stdout += chunk.toString(); });
    }
    if (child.stderr && typeof child.stderr.on === "function") {
      child.stderr.on("data", chunk => { stderr += chunk.toString(); });
    }

    child.once("error", error => {
      finish({
        status: "failed",
        exitCode: 1,
        signal: null,
        error: error.message
      });
    });
    child.once("close", (code, signal) => {
      const exitCode = Number.isInteger(code) ? code : (signal ? 1 : 0);
      finish({
        status: exitCode === 0 ? "passed" : "failed",
        exitCode,
        signal: signal || null,
        error: null
      });
    });
  });
}

function summarizeSuite(name, kind, results) {
  const executed = results.filter(file => file.status === "passed" || file.status === "failed");
  const failures = results.filter(file => file.status === "failed");
  const skipped = results.filter(file => file.status === "skipped");
  const notRun = results.filter(file => file.status === "not-run");

  let status;
  if (executed.length === 0 && notRun.length > 0) status = "not-run";
  else if (executed.length === 0 && skipped.length > 0) status = "skipped";
  else if (executed.length === 0) status = "not-run";
  else if (failures.length > 0) status = "failed";
  else if (skipped.length > 0 || notRun.length > 0) status = "partial";
  else status = "passed";

  const exitCode = failures.length
    ? (failures.find(file => file.exitCode !== 0)?.exitCode || 1)
    : 0;

  return {
    name,
    kind,
    status,
    exitCode,
    files: results,
    counts: {
      executed: executed.length,
      passed: results.filter(file => file.status === "passed").length,
      failed: failures.length,
      skipped: skipped.length,
      notRun: notRun.length
    }
  };
}

export async function runQASuites(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const suiteName = options.suite || "all";
  const filePath = options.file || null;
  const includeBrowser = Boolean(options.includeBrowser);
  const spawnImpl = options.spawnImpl || spawn;

  manifestEntries(root);

  if (suiteName !== "all" && !SUITES_BY_NAME.has(suiteName)) {
    throw new Error("Unknown QA suite: " + suiteName);
  }

  let fileOwner = null;
  if (filePath) {
    resolveQaPath(root, filePath);
    for (const suite of SUITE_MANIFEST) {
      const entry = suite.files.find(file => file.path === filePath);
      if (entry) fileOwner = suite;
    }
    if (!fileOwner) {
      throw new Error("QA file is not present in the explicit suite manifest: " + filePath);
    }
    if (suiteName !== "all" && suiteName !== fileOwner.name) {
      throw new Error("--file does not belong to the selected suite.");
    }
  }

  const selectedSuites = suiteName === "all"
    ? SUITE_MANIFEST.slice()
    : [SUITES_BY_NAME.get(suiteName)];
  if (fileOwner && suiteName === "all") {
    // A file-only invocation narrows the run to its owning suite.
    selectedSuites.splice(0, selectedSuites.length, fileOwner);
  }

  const selectedNames = selectedSuites.map(suite => suite.name);
  const notRunSuites = SUITE_MANIFEST
    .filter(suite => !selectedNames.includes(suite.name))
    .map(suite => ({ name: suite.name, reason: "not selected" }));

  const suiteResults = [];
  for (const suite of selectedSuites) {
    const fileResults = [];
    for (const entry of suite.files) {
      if (filePath && entry.path !== filePath) {
        fileResults.push({
          path: entry.path,
          runner: entry.runner,
          status: "not-run",
          exitCode: null,
          signal: null,
          reason: "not selected by --file",
          stdout: "",
          stderr: ""
        });
        continue;
      }

      const absolutePath = resolveQaPath(root, entry.path);
      if (!fs.existsSync(absolutePath)) {
        fileResults.push({
          path: entry.path,
          runner: entry.runner,
          status: "not-run",
          exitCode: null,
          signal: null,
          reason: "manifest file is not present in this checkout",
          stdout: "",
          stderr: ""
        });
        continue;
      }

      if (entry.runner === "node-script" && !includeBrowser) {
        fileResults.push({
          path: entry.path,
          runner: entry.runner,
          status: "skipped",
          exitCode: null,
          signal: null,
          reason: "real-browser suite requires --include-browser",
          stdout: "",
          stderr: ""
        });
        continue;
      }

      const args = entry.runner === "node-test"
        ? ["--test", absolutePath]
        : [absolutePath];
      const spawned = await collectChild(
        spawnImpl,
        process.execPath,
        args,
        {
          cwd: root,
          shell: false,
          windowsHide: true,
          stdio: ["ignore", "pipe", "pipe"]
        }
      );
      fileResults.push({
        path: entry.path,
        runner: entry.runner,
        status: spawned.status,
        exitCode: spawned.exitCode,
        signal: spawned.signal,
        reason: spawned.error,
        stdout: spawned.stdout,
        stderr: spawned.stderr
      });
    }
    suiteResults.push(summarizeSuite(suite.name, suite.kind, fileResults));
  }

  const suiteCounts = {
    passed: suiteResults.filter(suite => suite.status === "passed").length,
    failed: suiteResults.filter(suite => suite.status === "failed").length,
    partial: suiteResults.filter(suite => suite.status === "partial").length,
    skipped: suiteResults.filter(suite => suite.status === "skipped").length,
    notRun: notRunSuites.length + suiteResults.filter(suite => suite.status === "not-run").length
  };
  const fileCounts = { executed: 0, passed: 0, failed: 0, skipped: 0, notRun: 0 };
  for (const suite of suiteResults) {
    for (const [key, value] of Object.entries(suite.counts)) {
      fileCounts[key] += value;
    }
  }

  const failingFile = suiteResults.flatMap(suite => suite.files)
    .find(file => file.status === "failed");
  const exitCode = failingFile
    ? (failingFile.exitCode || 1)
    : (fileCounts.executed === 0 ? 2 : 0);

  return {
    schemaVersion: 1,
    root,
    selectedSuites: selectedNames,
    notRunSuites,
    suites: suiteResults,
    summary: {
      suites: suiteCounts,
      files: fileCounts
    },
    exitCode
  };
}

export function formatHumanReport(report) {
  const lines = ["Art Club QA suite runner", "Root: " + report.root];
  for (const suite of report.suites) {
    lines.push("[" + suite.status.toUpperCase() + "] " + suite.name);
    for (const file of suite.files) {
      const suffix = file.exitCode === null ? "" : " (exit " + file.exitCode + ")";
      lines.push("  [" + file.status.toUpperCase() + "] " + file.path + suffix);
      if (file.reason) lines.push("    " + file.reason);
      if (file.stdout.trim()) lines.push(file.stdout.trimEnd());
      if (file.stderr.trim()) lines.push(file.stderr.trimEnd());
    }
  }
  for (const suite of report.notRunSuites) {
    lines.push("[NOT-RUN] " + suite.name + " — " + suite.reason);
  }
  const counts = report.summary.files;
  lines.push(
    "Files: " + counts.passed + " passed, " + counts.failed + " failed, " +
    counts.skipped + " skipped, " + counts.notRun + " not run"
  );
  lines.push("Exit code: " + report.exitCode);
  return lines.join("\n") + "\n";
}

export function helpText() {
  return "Art Club QA suite runner\n\n" +
    "Usage: node tools/run-qa.mjs [--suite NAME|all] [--file tests/qa/PATH] [--include-browser] [--json] [--root PATH]\n\n" +
    "Suites: " + SUITE_MANIFEST.map(suite => suite.name).join(", ") + "\n" +
    "Node suites use the built-in node --test runner. Browser suites are skipped unless --include-browser is explicit.\n" +
    "The runner only uses its explicit manifest under tests/qa; it never installs dependencies or edits files.\n";
}

export async function main(argv, dependencies = {}) {
  const options = parseArgs(argv);
  if (options.help) {
    (dependencies.write || (value => process.stdout.write(value)))(helpText());
    return 0;
  }
  const report = await runQASuites({
    ...options,
    spawnImpl: dependencies.spawnImpl || spawn
  });
  const output = options.json ? JSON.stringify(report, null, 2) + "\n" : formatHumanReport(report);
  (dependencies.write || (value => process.stdout.write(value)))(output);
  return report.exitCode;
}

const isDirectExecution = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href;

if (isDirectExecution) {
  try {
    const exitCode = await main(process.argv.slice(2));
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write("run-qa: " + error.message + "\n");
    process.exitCode = 2;
  }
}
