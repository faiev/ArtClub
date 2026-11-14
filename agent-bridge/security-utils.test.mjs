import assert from "node:assert/strict";
import test from "node:test";

import {
  BridgeInputError,
  parseProjectJson,
  sanitizeToolErrorMessage,
  validateAppUrl
} from "./security-utils.mjs";

test("editor URL policy accepts HTTPS and loopback-only HTTP", () => {
  assert.equal(validateAppUrl("https://example.com/artclub"), "https://example.com/artclub");
  assert.equal(validateAppUrl("http://localhost:8080/"), "http://localhost:8080/");
  assert.equal(validateAppUrl("http://127.0.0.1:8080/"), "http://127.0.0.1:8080/");
  assert.equal(validateAppUrl("http://[::1]:8080/"), "http://[::1]:8080/");
});

test("editor URL policy fails closed for unsupported schemes and non-loopback HTTP", () => {
  for (const value of [
    "file:///etc/passwd",
    "data:text/html,hello",
    "javascript:alert(1)",
    "ftp://example.com/file",
    "http://example.com/",
    "http://127.0.0.1.evil.example/",
    "http://localhost.example/"
  ]) {
    assert.throws(() => validateAppUrl(value), Error, value);
  }
  assert.throws(() => validateAppUrl("https://user:secret@example.com/"), /embedded credentials/);
  assert.throws(() => validateAppUrl("not a URL"), /valid absolute URL/);
  assert.throws(() => validateAppUrl(""), /valid absolute URL/);
});

test("project JSON parser accepts only object roots", () => {
  const project = { format: "one-pixel-studio", version: 2 };
  assert.deepEqual(parseProjectJson(JSON.stringify(project)), project);
});

test("project JSON parser gives stable codes for malformed text and invalid roots", () => {
  assert.throws(
    () => parseProjectJson("{bad"),
    error => error instanceof BridgeInputError && error.code === "INVALID_PROJECT_JSON"
  );
  for (const value of ["null", "[]", "false", "42", "\"text\""]) {
    assert.throws(
      () => parseProjectJson(value),
      error => error instanceof BridgeInputError && error.code === "INVALID_PROJECT_SHAPE",
      value
    );
  }
  assert.throws(
    () => parseProjectJson(null),
    error => error instanceof BridgeInputError && error.code === "INVALID_PROJECT_JSON"
  );
});

test("tool error messages strip terminal controls and redact paths and URLs", () => {
  const output = sanitizeToolErrorMessage(
    "failure \u001b[31m/home/test-user/.artclub-agent-browser/profile\u001b[0m at https://private.example/path"
  );
  assert.equal(output.includes("\u001b"), false);
  assert.equal(output.includes("/home/test-user"), false);
  assert.equal(output.includes("private.example"), false);
  assert.equal(output.includes("[local path]"), true);
  assert.equal(output.includes("[URL]"), true);
});

test("tool error messages redact UNC network paths and mounted-volume paths", () => {
  const output = sanitizeToolErrorMessage(
    "failed at \\\\build-host\\users\\private\\profile and /Volumes/PrivateDisk/Users/alice/project"
  );
  assert.equal(output.includes("build-host"), false);
  assert.equal(output.includes("PrivateDisk"), false);
  assert.equal(output.includes("[local path]"), true);
});

test("tool error messages are whitespace-normalized, non-empty and bounded", () => {
  assert.equal(sanitizeToolErrorMessage("\u0000  \n  "), "The operation failed.");
  assert.equal(sanitizeToolErrorMessage("  line\n  break  "), "line break");
  assert.equal(sanitizeToolErrorMessage("x".repeat(2_000)).length, 1_200);
  assert.equal(sanitizeToolErrorMessage(null), "Unknown error.");
});
