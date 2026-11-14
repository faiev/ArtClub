# Agent 1 — QA engineering / release reliability

## Continuous workstream: build and maintain Art Club's regression safety net

You are not assigned a one-off audit. You own a rolling QA workstream with the phases below. Every phase is pre-authorized. Complete them in order where possible, open narrow PRs, and continue to the next phase without waiting for coordinator review.

### Phase 0 — AC-025: Audit remaining QA coverage in PR #1
PR #1: https://github.com/faiev/ArtClub/pull/1
Compare the diff against current main and PR #8. Identify exactly which frame-aware assertions are unique, duplicated by PR #10 or likely to conflict with Agent 4's bridge coverage. Produce a keep/drop recommendation. This phase is read-only: do not modify the bridge E2E file or PR #1.

### Phase 1 — AC-029: Project lifecycle regression matrix
Create an independent, maintainable QA suite for project lifecycle behavior:
- create, save, autosave, explicit no-op save, recover, rename, duplicate, switch and delete projects;
- ensure recovery slots rotate only on meaningful content changes;
- switching projects must not leak active layer/frame/selection/pixel state;
- test active layer/frame and visibility/lock state across reload;
- verify save errors and quota/storage failures do not report false success.
Use new files under tests/qa/lifecycle/ and focused fixtures under tests/fixtures/qa/. Do not edit index.html, storage implementation, agent-bridge/e2e-test.mjs or existing worker tests.

### Phase 2 — AC-030: Project format and migration compatibility suite
Build a broad fixture-driven compatibility matrix:
- current v2 valid projects at minimum/maximum dimensions and boundary metadata;
- legacy v1 migration and repeated deterministic in-memory migration;
- malformed JSON, missing references, duplicate IDs, sparse/undefined pixel slots, invalid HEX, invalid frame durations, excessive palette/layer/frame/cel counts and oversized documents;
- verify validation does not mutate inputs and migration does not overwrite source bytes;
- produce stable diagnostic expectations.
Own tests/qa/compatibility/ and tests/fixtures/qa/compatibility/. Reuse the real project model; do not fork its schema.

### Phase 3 — AC-031: Import/export round-trip acceptance matrix
As the GIF, sprite-sheet and palette modules land on main, add independent contract tests for:
- source frame order and duration metadata;
- sprite-sheet dimensions, frame rectangles, transparency and metadata correspondence;
- GIF frame timing, loop metadata and transparency policy;
- GPL/JASC-PAL/JSON color ordering, duplicates and names where supported;
- malformed/oversized imports failing before project mutation.
Do not edit the exporters or palette module. If a dependency PR is still open, document the expected contract and continue other phases; do not idle.

### Phase 4 — AC-032: Standalone Chromium regression harness
Create a separate browser QA harness, not a modification to the shared agent bridge test:
- tests/qa/browser/project-lifecycle.html
- tests/qa/browser/project-lifecycle.mjs
Exercise project creation, switching, editing, reload persistence and recovery using real Chromium/IndexedDB. Capture console errors and page errors. Include deterministic fixtures and exact pixel assertions. Agent 4 alone owns agent-bridge/e2e-test.mjs; do not touch it.
Do not edit the shared GitHub Actions workflow while Agent 3 owns it. Provide an exact local command and CI integration note.

### Phase 5 — AC-033: Release readiness tooling and evidence
Create docs/QA_MATRIX.md, docs/RELEASE_CHECKLIST.md and tools/qa-release-check.mjs. The checker must be read-only and report missing required files/scripts/test commands, stale coordination state where reliably detectable, and a clear machine-readable summary. It must not deploy, mutate projects or claim CI is green without a CI source.
Add tests for the checker.

### Phase 6 — Ongoing regression triage
For each accepted module PR, review its acceptance contract and identify missing negative/boundary tests. Add tests only in your QA-owned paths, without changing feature implementation files. Maintain a concise bug/risk ledger in docs/QA_MATRIX.md.

## Your ownership
- tests/qa/**
- tests/fixtures/qa/**
- tools/qa-release-check.mjs
- docs/QA_MATRIX.md
- docs/RELEASE_CHECKLIST.md

Do not edit agent-bridge/e2e-test.mjs, .github/workflows/project-tests.yml, index.html, storage/model implementation, exporter implementation or another worker's tests.

## Working rules
- This queue is authorized end-to-end. Do not ask the coordinator for a new task after Phase 0 or after any PR.
- Open one PR per coherent phase/group. After the PR is open, immediately move to the next phase on a new branch.
- If an implementation dependency is not merged, write contract fixtures/spec tests where possible, then work on another phase.
- Keep the next 3–5 items in your status file.
- Report exact commands, counts, runtime version and tested SHA. Never call unit-test-double coverage a browser test.

## Required handoff
Maintain coordination/status/agent-1.md with phase completion, branches/PRs, current-head CI, next queue and actual blockers. You do not merge PRs or self-accept work.

## Coordinator-added extension — AC-087: QA suite discovery and local runner

After the existing AC-033 release checker and ongoing regression-triage work, build a reproducible runner for the QA-owned nested suites that are not discovered by the current root-only `node --test tests/*.test.js` command.

### Deliverable
- Add `tools/run-qa.mjs` and focused tests under `tests/qa/runner/`.
- Maintain an explicit, sorted suite manifest for lifecycle, compatibility, import/export and browser QA suites. Discover files only within `tests/qa/**`; do not silently sweep unrelated tests.
- Support selecting one named suite or all suites, human-readable output and stable JSON summary.
- Spawn Node's built-in test runner with argument arrays (no shell interpolation), preserve exit codes, capture per-suite output and report skipped/not-run suites explicitly.
- Validate paths against the repository root and reject unknown suite names or paths escaping the QA directory.
- Document separate Node and real-browser commands. The runner must not install dependencies, change files, launch deployments or claim that an unexecuted browser suite passed.
- Add fixtures/stub child-process tests for argument safety, missing files, failing suites, deterministic ordering, JSON schema and exit behavior.

**Allowed files:** `tools/run-qa.mjs`, `tests/qa/runner/**`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.

Do not edit the shared workflow, root test script, feature modules, index.html, storage/model code or another worker's tests. If workflow-level discovery is eventually needed, prepare the exact command and ask the coordinator for a separate workflow lock after Agent 3 releases it.


## Coordinator-added review — UI-01 production shell / PR #84

This is a focused QA review alongside AC-087, not a replacement for the assigned QA runner work.

- Review the current head of [PR #84](https://github.com/faiev/ArtClub/pull/84) after fetching the latest main and PR metadata. The previous candidate head was `af2717daea892331b77482bc3e3c85fbbc1fabce`; it passed exact-head Actions run #43621240342 (Node/editor + Chromium/GIF/MCP).
- Execute the prepared 12-flow UI-01 smoke plan against that exact PR head where the browser harness allows. Record a pass/fail/blocked matrix with browser, viewport, tested SHA, and specific reproduction steps; do not infer all 12 pass from the repository's existing E2E pass.
- Prioritize drawing/erase/fill/pick/shape, selection and clear denial safety, layer/frame CRUD, playback/onion skin, save/reload/recovery, project/image import, PNG/SVG/JSON export, keyboard focus and responsive layout.
- Report whether any existing capability is hidden, unreachable, clipped, mislabeled or behaviorally changed by the shell.
- Provide screenshots at 1440×900 and 1280×800 if your available browser tooling supports them; otherwise explicitly state the screenshot limitation.

**Boundaries:** review only. Do not modify `index.html`, `agent-bridge/e2e-test.mjs`, Agent 4's MCP E2E, or `.github/workflows/project-tests.yml`. If fixes or additional coverage are required, report exact files and let the coordinator assign the single-writer change.

Update `coordination/status/agent-1.md` with exact head, browser evidence, results for all 12 flows, and the remaining blockers.