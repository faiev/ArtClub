# Agent 9 — Project diagnostics / developer tooling

## Continuous workstream: make project inspection a full read-only diagnostics toolkit

You own the offline project inspector and comparison tools. The first CLI is not the finish line.

### Phase 0 — AC-018: Refresh and revalidate project inspector
PR #12: https://github.com/faiev/ArtClub/pull/12
Sync with latest main, preserve read-only behavior and source immutability tests, then rerun complete Node 24, Chromium and MCP CI on the updated head.

### Phase 1 — AC-074: Batch project inspection
Extend tools/project-inspector.mjs with bounded batch mode:
- inspect a set of explicit files and optional directory inputs;
- predictable ordering and safe file-count/byte limits;
- no following symlinks by default;
- per-file errors without aborting the entire batch;
- human and JSON summary outputs;
- never write or repair input files.
Test directories, unreadable/missing files, huge file sets and duplicate paths.

### Phase 2 — AC-075: Structural project diff
Add read-only compare mode between two project documents:
- normalize legacy in memory using the actual project model;
- report changes to canvas, palette, layers, frames, cels and metadata;
- identify pixel-index deltas without printing enormous full buffers;
- distinguish missing cel vs transparent pixel vs removed frame/layer;
- stable JSON schema and concise human output.
Never infer that different IDs are logically the same object without explicit matching rules.

### Phase 3 — AC-076: Deep diagnostics and risk scoring
Add explicit diagnostic checks for malformed/sparse pixel arrays, duplicate identifiers, invalid references, invalid dimensions, unsupported versions, missing active targets, excessive document size and suspicious unused/duplicate palette entries. Keep model validation authoritative and label additional diagnostics separately from schema-invalid errors. No automatic correction.

### Phase 4 — AC-077: Deterministic migration preview
Add a preview mode that shows the normalized legacy output and a structured migration report without writing to disk. Include source hash/byte count, transformed field list and warnings; do not expose synthetic IDs as if they existed in source.

### Phase 5 — AC-078: CI and artifact report mode
Provide stable machine-readable output suitable for CI artifacts: project summary, diagnostics, severity, paths, counts and exit code policy. Add an optional SARIF-compatible report only if it can be done without a dependency or schema confusion. Never claim a check passed if it was skipped.

### Phase 6 — AC-079: CLI documentation and integration pack
Create docs/PROJECT_DIAGNOSTICS.md covering single-file, batch, compare and migration preview; include examples, safety limits and output schemas. Add fixtures for each diagnostic and test source-file immutability.

## Ownership
- tools/project-inspector.mjs
- tests/project-inspector.test.js and tests/fixtures/project-inspector/**
- any separate inspector libraries under tools/ and tests/
- docs/project-inspector.md and docs/PROJECT_DIAGNOSTICS.md

Do not modify project-model.js, storage, editor UI, Agent API, bridge or another agent's tests.

## Working rules
All phases are authorized. While PR #12 is waiting for review or refreshed CI, begin batch/diff design/tests in an independent branch. Keep inspection read-only and bounded. Do not add auto-repair.

## Handoff
Update only coordination/status/agent-9.md with active phase, branches/PRs, exact test evidence, output schema changes and next 3–5 tasks. Do not merge or self-accept.
