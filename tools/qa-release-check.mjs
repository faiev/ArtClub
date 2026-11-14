#!/usr/bin/env node
"use strict";

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const SCRIPT_PATH = fileURLToPath(import.meta.url);

const REQUIRED_FILES = [
  "README.md",
  "index.html",
  "js/project-model.js",
  "js/project-storage.js",
  "tests/project-model.test.js",
  "tests/project-storage.test.js",
  "tests/gif-export.test.js",
  "tests/gif-export.browser.mjs",
  "tests/qa/lifecycle/project-lifecycle.test.js",
  "tests/qa/lifecycle/editor-switch-contract.test.js",
  "tests/qa/compatibility/project-compatibility.test.js",
  "tests/qa/compatibility/gif-export-contract.test.js",
  "tests/qa/browser/project-lifecycle.html",
  "tests/qa/browser/project-lifecycle.mjs",
  "tests/qa/release/qa-release-check.test.js",
  "tests/qa/renderer/canvas-renderer-contract.test.js",
  "tests/qa/runner/run-qa.test.mjs",
  "tests/qa/runner/verify-qa-runner-ci.mjs",
  "tools/run-qa.mjs",
  "docs/QA_MATRIX.md",
  "docs/RELEASE_CHECKLIST.md",
  "tools/qa-release-check.mjs",
  "coordination/README.md",
  "coordination/BOARD.md",
  "coordination/BACKLOG.md",
  "coordination/DECISIONS.md",
  "coordination/assignments/agent-1.md",
  "coordination/status/agent-1.md",
  ".github/workflows/project-tests.yml",
  "agent-bridge/package.json",
  "agent-bridge/server.mjs",
  "agent-bridge/e2e-test.mjs",
  "agent-bridge/mcp-e2e-test.mjs"
];

const REQUIRED_BRIDGE_SCRIPTS = ["test:e2e", "test:mcp"];
const REQUIRED_WORKFLOW_COMMANDS = [
  "node --test tests/*.test.js",
  "node --check agent-bridge/server.mjs",
  "npx playwright install --with-deps chromium",
  "npm run test:e2e",
  "npm run test:mcp",
  "node tests/gif-export.browser.mjs"
];

const REQUIRED_QA_COMMANDS = [
  "node --test tests/qa/lifecycle/project-lifecycle.test.js",
  "node --test tests/qa/lifecycle/editor-switch-contract.test.js",
  "node --test tests/qa/compatibility/project-compatibility.test.js",
  "node --test tests/qa/compatibility/gif-export-contract.test.js",
  "node --test tests/qa/release/qa-release-check.test.js",
  "node --test tests/qa/renderer/canvas-renderer-contract.test.js",
  "node --test tests/qa/runner/run-qa.test.mjs",
  "node tools/run-qa.mjs --suite all",
  "node tests/qa/runner/verify-qa-runner-ci.mjs",
  "node tools/run-qa.mjs --suite browser --include-browser",
  "node tests/qa/browser/project-lifecycle.mjs"
];

function addCheck(checks, id, status, message, details) {
  const entry = { id, status, message };
  if (details !== undefined) entry.details = details;
  checks.push(entry);
}

function readText(root, relativePath) {
  const absolutePath = path.join(root, relativePath);
  try {
    return fs.readFileSync(absolutePath, "utf8");
  } catch {
    return null;
  }
}

function git(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
    windowsHide: true
  });
  if (result.error || result.status !== 0) return null;
  return result.stdout.trim();
}

function discoverNestedTests(root) {
  const found = [];
  const testsRoot = path.join(root, "tests");
  if (!fs.existsSync(testsRoot)) return found;

  function visit(directory) {
    let entries;
    try {
      entries = fs.readdirSync(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.isFile() && entry.name.endsWith(".test.js")) {
        const relative = path.relative(root, absolute).split(path.sep).join("/");
        if (relative.startsWith("tests/qa/")) found.push(relative);
      }
    }
  }

  visit(testsRoot);
  return found.sort();
}

function inspectCoordination(root, checks) {
  const board = readText(root, "coordination/BOARD.md");
  const status = readText(root, "coordination/status/agent-1.md");

  if (!board) {
    addCheck(checks, "coordination-board", "fail", "coordination/BOARD.md is missing.");
  } else if (/coordination source:\s*main/i.test(board)) {
    addCheck(checks, "coordination-source", "pass", "Coordinator board identifies main as the coordination source.");
  } else if (/coordination\/orchestration-v2/i.test(board)) {
    addCheck(checks, "coordination-source", "fail", "Board still points to the bootstrap coordination branch.");
  } else {
    addCheck(checks, "coordination-source", "warn", "Could not confirm that the board's coordination source is main.");
  }

  if (!status) {
    addCheck(checks, "agent-1-status", "fail", "coordination/status/agent-1.md is missing.");
    return;
  }
  if (/coordination source:\s*main/i.test(status)) {
    addCheck(checks, "agent-1-status-source", "pass", "Agent 1 status identifies main as its coordination source.");
  } else {
    addCheck(checks, "agent-1-status-source", "warn", "Agent 1 status does not explicitly identify main as its coordination source.");
  }

  // Compare status freshness only when it contains an explicit 40-character
  // main SHA and a local origin/main ref exists. Never infer freshness from
  // dates or prose-only references.
  const recordedMain = status.match(/(?:latest main|main base|base commit)\D{0,32}([0-9a-f]{40})/i);
  const localOriginMain = git(root, ["rev-parse", "refs/remotes/origin/main"]);
  if (!recordedMain) {
    addCheck(checks, "coordination-freshness", "skipped", "Status has no machine-readable main SHA; staleness cannot be determined safely.");
  } else if (!localOriginMain) {
    addCheck(checks, "coordination-freshness", "skipped", "Local refs/remotes/origin/main is unavailable; fetch refs before checking status freshness.");
  } else if (recordedMain[1] === localOriginMain) {
    addCheck(checks, "coordination-freshness", "pass", "Agent 1 status records the current local origin/main SHA.", { sha: localOriginMain });
  } else {
    const ancestor = spawnSync("git", ["merge-base", "--is-ancestor", recordedMain[1], localOriginMain], {
      cwd: root,
      stdio: "ignore",
      windowsHide: true
    });
    if (ancestor.status === 0) {
      const changedPaths = git(root, ["diff", "--name-only", recordedMain[1] + "..." + localOriginMain]);
      const changesAfterRecordedMain = changedPaths ? changedPaths.split(/\\r?\\n/).filter(Boolean) : [];
      const onlyOwnStatusUpdate = changesAfterRecordedMain.length > 0 &&
        changesAfterRecordedMain.every(file => file === "coordination/status/agent-1.md");
      if (onlyOwnStatusUpdate) {
        addCheck(checks, "coordination-freshness", "pass", "Recorded main is the parent of the status update; only Agent 1's status file changed afterward.", {
          recordedMain: recordedMain[1],
          localOriginMain
        });
      } else {
        addCheck(checks, "coordination-freshness", "warn", "Agent 1 status records an older main commit with additional repository changes since then.", {
          recordedMain: recordedMain[1],
          localOriginMain,
          changesAfterRecordedMain
        });
      }
    } else {
      addCheck(checks, "coordination-freshness", "warn", "Agent 1 status SHA is not an ancestor of local origin/main; refs may be stale or histories may differ.", {
        recordedMain: recordedMain[1],
        localOriginMain
      });
    }
  }

  const branch = git(root, ["branch", "--show-current"]);
  const head = git(root, ["rev-parse", "HEAD"]);
  const originMain = git(root, ["rev-parse", "refs/remotes/origin/main"]);
  if (!head) {
    addCheck(checks, "git-checkout", "skipped", "Checkout is not a readable Git working tree.");
  } else {
    addCheck(checks, "git-checkout", "pass", "Read local branch and HEAD.", { branch: branch || "(detached HEAD)", head });
    if (branch === "main" && originMain && head !== originMain) {
      addCheck(checks, "local-main-freshness", "warn", "Local main differs from local origin/main.", { head, originMain });
    } else if (branch === "main" && originMain) {
      addCheck(checks, "local-main-freshness", "pass", "Local main matches local origin/main.", { head });
    } else {
      addCheck(checks, "local-main-freshness", "skipped", "Checkout is not main or local origin/main is unavailable.");
    }
  }
}

export function checkReleaseReadiness(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  const checks = [];

  for (const relativePath of REQUIRED_FILES) {
    let isFile = false;
    try {
      isFile = fs.statSync(path.join(root, relativePath)).isFile();
    } catch {
      isFile = false;
    }
    addCheck(
      checks,
      "required-file:" + relativePath,
      isFile ? "pass" : "fail",
      isFile ? "Required file exists: " + relativePath : "Required file is missing or is not a regular file: " + relativePath
    );
  }

  const packageText = readText(root, "agent-bridge/package.json");
  let bridgePackage = null;
  if (packageText) {
    try {
      bridgePackage = JSON.parse(packageText);
      addCheck(checks, "bridge-package-json", "pass", "agent-bridge/package.json parses as JSON.");
    } catch (error) {
      addCheck(checks, "bridge-package-json", "fail", "agent-bridge/package.json is invalid JSON.", error.message);
    }
  } else {
    addCheck(checks, "bridge-package-json", "fail", "Cannot inspect bridge scripts because agent-bridge/package.json is missing.");
  }

  for (const script of REQUIRED_BRIDGE_SCRIPTS) {
    const present = Boolean(bridgePackage && bridgePackage.scripts && typeof bridgePackage.scripts[script] === "string");
    addCheck(
      checks,
      "bridge-script:" + script,
      present ? "pass" : "fail",
      present ? "Bridge script exists: " + script : "Required bridge script is missing: " + script
    );
  }

  const checklist = readText(root, "docs/RELEASE_CHECKLIST.md");
  if (!checklist) {
    addCheck(checks, "release-checklist-readable", "fail", "Release checklist is missing or unreadable.");
  } else {
    addCheck(checks, "release-checklist-readable", "pass", "Release checklist is readable.");
    for (const command of REQUIRED_QA_COMMANDS) {
      const present = checklist.includes(command);
      addCheck(
        checks,
        "qa-command:" + command,
        present ? "pass" : "fail",
        present ? "Release checklist documents QA command: " + command : "Release checklist is missing QA command: " + command
      );
    }
  }

  const workflow = readText(root, ".github/workflows/project-tests.yml");
  if (!workflow) {
    addCheck(checks, "workflow-readable", "fail", "Project test workflow is missing or unreadable.");
  } else {
    addCheck(checks, "workflow-readable", "pass", "Project test workflow is readable.");
    for (const command of REQUIRED_WORKFLOW_COMMANDS) {
      const present = workflow.includes(command);
      addCheck(
        checks,
        "workflow-command:" + command,
        present ? "pass" : "fail",
        present ? "Workflow contains required command: " + command : "Workflow is missing required command: " + command
      );
    }
  }

  const nestedTests = discoverNestedTests(root);
  if (nestedTests.length && workflow && workflow.includes("node --test tests/*.test.js")) {
    const directlyInvoked = nestedTests.filter(testPath => workflow.includes(testPath));
    const omitted = nestedTests.filter(testPath => !directlyInvoked.includes(testPath));
    if (omitted.length) {
      addCheck(
        checks,
        "nested-qa-tests-discovery",
        "warn",
        "The top-level tests/*.test.js glob does not discover nested QA tests; these files are not explicitly invoked by the workflow.",
        omitted
      );
    } else {
      addCheck(checks, "nested-qa-tests-discovery", "pass", "All discovered nested QA tests are explicitly invoked by the workflow.");
    }
  } else if (nestedTests.length) {
    addCheck(checks, "nested-qa-tests-discovery", "warn", "Nested QA tests exist, but the workflow's test discovery command could not be verified.", nestedTests);
  } else {
    addCheck(checks, "nested-qa-tests-discovery", "skipped", "No nested QA *.test.js files were found.");
  }

  if (workflow && fs.existsSync(path.join(root, "tests/qa/browser/project-lifecycle.mjs"))) {
    if (workflow.includes("node tests/qa/browser/project-lifecycle.mjs")) {
      addCheck(checks, "lifecycle-browser-ci", "pass", "Workflow invokes the standalone lifecycle browser harness.");
    } else {
      addCheck(checks, "lifecycle-browser-ci", "warn", "Standalone lifecycle browser harness exists but is not invoked by the workflow.");
    }
  } else {
    addCheck(checks, "lifecycle-browser-ci", "skipped", "Lifecycle browser runner or workflow is not available locally.");
  }

  inspectCoordination(root, checks);

  const counts = { pass: 0, fail: 0, warn: 0, skipped: 0 };
  for (const check of checks) counts[check.status] += 1;
  const failures = counts.fail;
  return {
    schemaVersion: 1,
    root,
    generatedAt: new Date().toISOString(),
    ok: failures === 0,
    localCheckStatus: failures === 0 ? "pass" : "fail",
    releaseReady: false,
    releaseStatus: "unverified",
    counts,
    checks,
    ci: {
      status: "unverified",
      verified: false,
      runUrl: null,
      testedSha: null,
      note: "This local read-only checker does not query GitHub Actions. Verify a workflow run URL and exact tested SHA separately."
    }
  };
}

function printHelp() {
  process.stdout.write(
    "Art Club QA release checker\n\n" +
    "Usage: node tools/qa-release-check.mjs [--json] [--root PATH] [--help]\n\n" +
    "Read-only local checks for required files, scripts, workflow commands, nested QA test discovery and coordination freshness where local Git refs allow it. CI is always reported as unverified.\n"
  );
}

function printText(report) {
  const glyph = { pass: "PASS", fail: "FAIL", warn: "WARN", skipped: "SKIP" };
  process.stdout.write("Art Club QA release check\n");
  process.stdout.write("Root: " + report.root + "\n");
  for (const check of report.checks) {
    process.stdout.write("[" + glyph[check.status] + "] " + check.message + "\n");
  }
  process.stdout.write(
    "\nSummary: " +
    report.counts.pass + " pass, " +
    report.counts.fail + " fail, " +
    report.counts.warn + " warn, " +
    report.counts.skipped + " skipped\n"
  );
  process.stdout.write("Local structural checks: " + (report.ok ? "PASS" : "FAIL") + "\n");
  process.stdout.write("Release readiness: UNVERIFIED (this tool cannot approve or deploy)\n");
  process.stdout.write("CI: UNVERIFIED (checker does not query GitHub Actions)\n");
}

function parseArgs(argv) {
  const options = { json: false, root: process.cwd(), help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--json") options.json = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else if (argument === "--root") {
      index += 1;
      if (!argv[index]) throw new Error("--root requires a directory path.");
      options.root = argv[index];
    } else {
      throw new Error("Unknown argument: " + argument);
    }
  }
  return options;
}

const isDirectExecution = process.argv[1] &&
  pathToFileURL(path.resolve(process.argv[1])).href === pathToFileURL(SCRIPT_PATH).href;

if (isDirectExecution) {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      printHelp();
    } else {
      const report = checkReleaseReadiness({ root: options.root });
      if (options.json) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
      else printText(report);
      if (!report.ok) process.exitCode = 1;
    }
  } catch (error) {
    process.stderr.write("qa-release-check: " + error.message + "\n");
    process.exitCode = 2;
  }
}
