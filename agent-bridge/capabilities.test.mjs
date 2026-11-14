import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  assertCompatibleClientProtocolVersion,
  createCapabilities,
  ProtocolCompatibilityError
} from "./capabilities.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));

test("default capability document matches the checked-in v1 fixture", () => {
  const fixture = JSON.parse(
    fs.readFileSync(path.join(HERE, "fixtures", "capabilities-v1.json"), "utf8")
  );
  assert.deepEqual(createCapabilities(), fixture);
});

test("tool catalog classifies every exposed tool exactly once", () => {
  const document = createCapabilities();
  const catalogNames = document.tools.catalog.map(tool => tool.name);
  const groups = [
    document.tools.read_only,
    document.tools.document_mutating,
    document.tools.session_mutating,
    document.tools.storage_mutating
  ];
  const grouped = groups.flat();

  assert.equal(document.tools.total, catalogNames.length);
  assert.equal(new Set(catalogNames).size, catalogNames.length);
  assert.equal(new Set(grouped).size, grouped.length);
  assert.deepEqual(new Set(catalogNames), new Set(grouped));
  assert.equal(
    document.tools.catalog.filter(tool => tool.requires_expected_revision).length,
    document.tools.revision_required.length
  );
  assert.ok(document.tools.catalog.find(tool =>
    tool.name === "artclub_save" && tool.access === "storage_mutation" &&
    tool.requires_expected_revision === false
  ));
  assert.ok(document.tools.catalog.find(tool =>
    tool.name === "artclub_draw_pixel" && tool.access === "document_mutation" &&
    tool.requires_expected_revision === true
  ));
});

test("effective runtime limits and deadlines are reflected in capabilities", () => {
  const document = createCapabilities({
    bridgeVersion: "0.6.1",
    maxToolInputBytes: 1_048_576,
    maxToolOutputBytes: 2_097_152,
    maxPendingOperations: 12,
    defaultToolDeadlineMs: 45_000,
    maxToolDeadlineMs: 60_000,
    toolDeadlinesMs: {
      artclub_get_status: 10_000,
      artclub_import_project: 90_000
    }
  });
  assert.equal(document.bridge.version, "0.6.1");
  assert.equal(document.limits.max_tool_input_bytes, 1_048_576);
  assert.equal(document.limits.max_tool_output_bytes, 2_097_152);
  assert.equal(document.limits.max_pending_operations, 12);
  assert.equal(document.execution.default_deadline_ms, 45_000);
  assert.equal(document.execution.maximum_deadline_ms, 60_000);
  assert.equal(document.execution.per_tool_deadline_ms.artclub_import_project, 60_000);
});

test("unsupported protocol versions receive a stable actionable compatibility error", () => {
  assert.doesNotThrow(() => assertCompatibleClientProtocolVersion(undefined));
  assert.doesNotThrow(() => assertCompatibleClientProtocolVersion(1));
  for (const version of [0, 2, -1, 1.5, "1", null]) {
    assert.throws(
      () => assertCompatibleClientProtocolVersion(version),
      error => error instanceof ProtocolCompatibilityError &&
        error.code === "PROTOCOL_VERSION_UNSUPPORTED" &&
        /supports protocol version 1/.test(error.message) &&
        /Update the client/.test(error.message)
    );
  }
});

test("revision conflict and cancellation semantics are explicit and machine-readable", () => {
  const document = createCapabilities();
  assert.equal(document.revision_policy.field, "expected_revision");
  assert.equal(document.revision_policy.conflict.behavior, "reject_without_replay");
  assert.equal(document.revision_policy.conflict.error_code, "STALE_REVISION");
  assert.equal(document.execution.cancellation.supported, true);
  assert.equal(document.execution.cancellation.outcome_may_be_uncertain, true);
  assert.deepEqual(
    document.execution.cancellation.error_codes,
    ["OPERATION_CANCELLED", "OPERATION_TIMEOUT", "QUEUE_FULL"]
  );
});

test("unavailable exports and diagnostics are reported as unavailable", () => {
  const document = createCapabilities();
  assert.deepEqual(document.exports.sprite_sheet, false);
  assert.deepEqual(document.exports.gif, false);
  assert.deepEqual(document.exports.palette_formats, false);
  assert.equal(document.diagnostics.available, false);
  assert.equal(document.diagnostics.bridge_doctor, false);
});
