"use strict";

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { checkReleaseReadiness } from "../../../tools/qa-release-check.mjs";

const REQUIRED_PATHS = [
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

const REQUIRED_QA_COMMANDS = [
  "node --test tests/qa/lifecycle/project-lifecycle.test.js",
  "node --test tests/qa/lifecycle/editor-switch-contract.test.js",
  "node --test tests/qa/compatibility/project-compatibility.test.js",
  "node --test tests/qa/compatibility/gif-export-contract.test.js",
  "node --test tests/qa/release/qa-release-check.test.js",
  "node tests/qa/browser/project-lifecycle.mjs"
];

const WORKFLOW = [
  "node --test tests/*.test.js",
  "node --check agent-bridge/server.mjs",
  "npx playwright install --with-deps chromium",
  "npm run test:e2e",
  "node tests/gif-export.browser.mjs",
  "npm run test:mcp"
].join("\n");

function temporaryRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "artclub-qa-release-"));
}

function writeFile(root, relativePath, content = "fixture\n") {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function populateCompleteFixture(root, recordedMainSha = null) {
  for (const relativePath of REQUIRED_PATHS) writeFile(root, relativePath);

  writeFile(root, "agent-bridge/package.json", JSON.stringify({
    name: "artclub-bridge-fixture",
    scripts: {
      start: "node server.mjs",
      "test:e2e": "node e2e-test.mjs",
      "test:mcp": "node mcp-e2e-test.mjs"
    }
  }, null, 2));

  writeFile(root, ".github/workflows/project-tests.yml", WORKFLOW);
  writeFile(root, "docs/RELEASE_CHECKLIST.md", REQUIRED_QA_COMMANDS.join("\n"));
  writeFile(root, "coordination/BOARD.md", [
    "# Board",
    "Coordination source: main"
  ].join("\n"));
  writeFile(root, "coordination/status/agent-1.md", [
    "# Agent 1 status",
    "Coordination source: main",
    recordedMainSha ? "Latest main: " + recordedMainSha : "No recorded main SHA."
  ].join("\n"));
}

function runGit(root, args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.error || result.status !== 0) {
    throw new Error(result.stderr || (result.error && result.error.message) || "git command failed");
  }
  return result.stdout.trim();
}

function snapshotPaths(root, directory = root, prefix = "") {
  const entries = fs.readdirSync(directory, { withFileTypes: true });
  const output = [];
  for (const entry of entries) {
    const relative = path.posix.join(prefix, entry.name);
    output.push(relative);
    if (entry.isDirectory()) {
      output.push(...snapshotPaths(root, path.join(directory, entry.name), relative));
    }
  }
  return output.sort();
}

test("reports missing required files and bridge scripts as failures", () => {
  const root = temporaryRoot();
  try {
    const report = checkReleaseReadiness({ root });
    assert.equal(report.ok, false);
    assert.ok(report.counts.fail > 0);
    assert.ok(report.checks.some(check =>
      check.id === "required-file:docs/QA_MATRIX.md" && check.status === "fail"
    ));
    assert.ok(report.checks.some(check =>
      check.id === "bridge-script:test:e2e" && check.status === "fail"
    ));
    assert.equal(report.ci.status, "unverified");
    assert.equal(report.ci.verified, false);
    assert.equal(report.releaseReady, false);
    assert.equal(report.releaseStatus, "unverified");
    assert.equal(report.ci.runUrl, null);
    assert.equal(report.ci.testedSha, null);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("reports a missing bridge test script even when the package file exists", () => {
  const root = temporaryRoot();
  try {
    populateCompleteFixture(root);
    writeFile(root, "agent-bridge/package.json", JSON.stringify({
      name: "artclub-bridge-fixture",
      scripts: { "test:e2e": "node e2e-test.mjs" }
    }));
    const report = checkReleaseReadiness({ root });
    assert.equal(report.checks.find(check => check.id === "bridge-script:test:e2e").status, "pass");
    assert.equal(report.checks.find(check => check.id === "bridge-script:test:mcp").status, "fail");
    assert.equal(report.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("reports a missing documented QA command as a failure", () => {
  const root = temporaryRoot();
  try {
    populateCompleteFixture(root);
    writeFile(root, "docs/RELEASE_CHECKLIST.md", "node --test tests/project-model.test.js\\n");
    const report = checkReleaseReadiness({ root });
    assert.equal(
      report.checks.find(check => check.id.startsWith("qa-command:node --test tests/qa/release/qa-release-check.test.js")).status,
      "fail"
    );
    assert.equal(report.ok, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("complete local fixture passes required-file checks but warns about nested QA and CI integration", () => {
  const root = temporaryRoot();
  try {
    populateCompleteFixture(root);
    const before = snapshotPaths(root);
    const report = checkReleaseReadiness({ root });
    const after = snapshotPaths(root);

    assert.equal(report.ok, true);
    assert.ok(report.counts.pass > 0);
    assert.ok(report.counts.warn >= 2);
    assert.deepEqual(after, before, "the checker must not create or remove files");
    assert.equal(report.ci.status, "unverified");
    assert.equal(report.ci.verified, false);

    const nested = report.checks.find(check => check.id === "nested-qa-tests-discovery");
    assert.equal(nested.status, "warn");
    assert.ok(nested.details.includes("tests/qa/release/qa-release-check.test.js"));
    const browser = report.checks.find(check => check.id === "lifecycle-browser-ci");
    assert.equal(browser.status, "warn");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("reports coordination freshness only when local Git refs allow a comparison", t => {
  const root = temporaryRoot();
  try {
    const version = spawnSync("git", ["--version"], { encoding: "utf8" });
    if (version.error || version.status !== 0) {
      t.skip("Git executable is unavailable in this environment.");
      return;
    }

    populateCompleteFixture(root);
    runGit(root, ["init", "-b", "main"]);
    runGit(root, ["config", "user.name", "QA Fixture"]);
    runGit(root, ["config", "user.email", "qa-fixture@example.invalid"]);
    runGit(root, ["add", "."]);
    runGit(root, ["commit", "-m", "Initial coordination state"]);
    const recordedSha = runGit(root, ["rev-parse", "HEAD"]);

    // Advance main and origin/main. The Agent 1 status still records the
    // prior SHA, which is now provably an ancestor of the local tracking ref.
    writeFile(root, "README.md", "newer main state\n");
    runGit(root, ["add", "README.md"]);
    runGit(root, ["commit", "-m", "Advance main"]);
    runGit(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
    writeFile(root, "coordination/status/agent-1.md", [
      "# Agent 1 status",
      "Coordination source: main",
      "Latest main: " + recordedSha
    ].join("\n"));

    const report = checkReleaseReadiness({ root });
    const freshness = report.checks.find(check => check.id === "coordination-freshness");
    assert.equal(freshness.status, "warn");
    assert.equal(freshness.details.recordedMain, recordedSha);
    assert.equal(
      freshness.details.localOriginMain,
      runGit(root, ["rev-parse", "refs/remotes/origin/main"])
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI emits machine-readable JSON and a non-zero exit code for a failed check", () => {
  const root = temporaryRoot();
  try {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tools/qa-release-check.mjs");
    const result = spawnSync(process.execPath, [script, "--json", "--root", root], {
      encoding: "utf8"
    });
    assert.equal(result.status, 1);
    const report = JSON.parse(result.stdout);
    assert.equal(report.ok, false);
    assert.equal(report.ci.status, "unverified");
    assert.ok(Array.isArray(report.checks));
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("CLI help exits successfully without inspecting or changing the repository", () => {
  const root = temporaryRoot();
  try {
    const script = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../tools/qa-release-check.mjs");
    const before = snapshotPaths(root);
    const result = spawnSync(process.execPath, [script, "--help", "--root", root], {
      encoding: "utf8"
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /Usage:/);
    assert.deepEqual(snapshotPaths(root), before);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
