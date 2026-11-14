# Agent 6 — Editing safety / safe mutation engineering

## Continuous workstream: make every pixel-edit operation fail closed and preserve project integrity

You own the pure-JavaScript editing safety subsystem. The work is larger than fixing one sparse array. Complete these phases in order and keep moving after PRs are open.

### Phase 0 — AC-015: Correct and harden the existing layer guard
PR #14: https://github.com/faiev/ArtClub/pull/14
- Replace cel.pixels.some() validation with indexed own-slot validation.
- Reject sparse holes and explicit undefined; accept only explicit null or valid #RRGGBB.
- Add regressions for delete cel.pixels[index], undefined, malformed color and project immutability.
- Sync latest main without force-push and rerun full Node/Chromium/MCP CI.

### Phase 1 — AC-055: Expand the edit-target safety contract
Extend js/layer-edit-guard.js with clear structured decisions for:
- active versus non-active layer/frame;
- hidden, locked, zero-opacity or malformed metadata;
- missing/duplicate layer, frame and cel IDs;
- absent cel versus invalid cel (never silently create on an edit path);
- stale project/frame/composite revision;
- selection bounds and canvas-size limits.
Keep denials machine-readable and non-mutating. Add exhaustive decision-table tests.

### Phase 2 — AC-056: Build pure safe-edit transaction helpers
Create js/safe-edit-operations.js and tests. Provide immutable helpers for:
- clear active cel/selection;
- apply validated pixel patches;
- replace/import a cel only after complete validation;
- apply symmetry/outline/fill result buffers with dimension and revision checks;
- reject hidden/locked/non-active targets before changing any pixel.
The helper must never mutate caller-owned project state and must return a complete new state or a structured denial. No partial writes on failure.

### Phase 3 — AC-057: Adversarial mutation-path audit
Inspect current editor mutation paths and write docs/SAFE_EDIT_PATH_AUDIT.md. Cover toolbar Clear, image import, eraser/brush, selection paste, bucket/fill, frame switch, layer switch, undo/redo and Agent API batch changes. Identify which paths currently enforce visibility/lock/revision checks and which bypass them. Do not edit index.html or Agent API/bridge; record proposed integration points for the coordinator.

### Phase 4 — AC-058: Safety browser harness
Build tests/layer-safety.browser.html and tests/layer-safety.browser.mjs around the pure guard/transaction APIs. Verify denied operations do not alter pixels, saved project state or exports; test hidden/locked, stale-revision, missing-cel and invalid-input cases. This is an isolated harness, not live editor integration.

### Phase 5 — AC-059: Import staging and recovery semantics
Create a pure staging module for image/project import validation. Parse/validate the entire candidate before exposing a commit object; preserve current project if any validation fails; produce explicit warning/diagnostic lists; enforce byte/dimension/pixel ceilings; never mutate the live project or storage. Add rollback/immutability tests and docs.

### Phase 6 — AC-060: Integration-ready safety contract
Create docs/SAFE_EDIT_INTEGRATION.md mapping each public edit API to guard/transaction calls, required revision tokens, denied-operation UI feedback and browser tests. Include a checklist for future wiring into Clear, image import, selection paste, pixel effects and Agent API. Wait for explicit file locks before editing shared UI/API files.

## Ownership
- js/layer-edit-guard.js
- tests/layer-edit-guard.test.js
- js/safe-edit-operations.js and tests/safe-edit-operations.test.js
- js/import-staging.js and its tests
- tests/layer-safety.browser.*
- docs/layer-edit-safety.md, docs/SAFE_EDIT_PATH_AUDIT.md, docs/SAFE_EDIT_INTEGRATION.md

Do not modify index.html, project model/storage, Agent API, bridge, exporter, renderer or another agent's tests. No app integration is authorized here.

## Working rules
All phases are pre-authorized. Fix PR #14, then continue to the next independent module even while it is awaiting review. Use separate branches/PRs for distinct phases. Never stop at "waiting for coordinator".

## Handoff
Update only coordination/status/agent-6.md with phase IDs, branches/PRs, exact tests, risks and next 3–5 actions. Do not merge or self-accept.

## Coordinator-added extension — AC-092: Adversarial and property-based safe-edit conformance

After AC-060, add a bounded, deterministic adversarial test layer over the guard, immutable transaction and import-staging APIs.

### Deliverable
- Add seeded property-style tests in Agent 6-owned test paths; do not put these under Agent 1's `tests/qa/**`.
- Generate valid and invalid projects with bounded dimensions, dense/sparse pixel arrays, duplicate/missing IDs, invalid cels, hidden/locked/zero-opacity targets and stale revisions.
- Assert every denied operation leaves the complete source project, pixel buffers, own-slot shape and derived raster unchanged.
- Assert every accepted operation returns a detached valid state, preserves unrelated frames/layers, and is deterministic for the same seed/input.
- Exercise composed sequences: stage import → validate target → apply immutable transaction; clear selection → patch; replace cel → reject stale follow-up. Verify failure at every stage produces no partial commit.
- Add minimization/replay output: a failing seed and compact case description must reproduce the failure without logging enormous buffers.
- Keep iterations and allocations strictly bounded; use only seeded generators and no new runtime dependency.
- Document remaining assumptions and a reproducible command.

**Allowed files:** Agent 6's safe-edit modules and tests, `tests/layer-safety.browser.*`, safety documentation. Do not edit Agent 1 QA paths, index.html, project model/storage, Agent API/bridge, renderer, exporters, shared workflow or another agent's tests.


## Coordinator restart directive — 2026-11-15
Reconcile #29 and #40 against current main. Execute the dedicated #40 real-browser harness on exact head or report exact command/environment blocker as blocked, not passed. Read-only review coordinator UI-02 Clear/import/paste against guard/transactions and persistence contract. Help Agent 4 isolate #82's safe-edit failures without editing Agent 4 files. No index.html/model/storage/API/bridge/workflow edits.

## Coordinator override — D-028 active UI-02 safety assignment (2026-11-15)

This section supersedes the older broad AC-055–060/AC-092 continuation queue during the UI-02 release. Do not create new safety-module feature branches. Your active role is read-only specialist review plus completion of your already-owned AC-058 harness.

### Objective
Provide independent safety review of coordinator-owned UI-02A Clear and subsequent import/paste slices, and close the dedicated real-browser acceptance gap in your existing AC-058 PR #40.

### Scope
- Read-only review of coordinator-owned `index.html` and UI-02 PR diffs/comments.
- Existing Agent 6-owned `tests/layer-safety.browser.*` and `docs/layer-edit-safety.md` on the existing AC-058 branch only.
- This agent's own status file only.

### Exclusions
Do not edit production UI, project model/storage, Agent API/bridge, exporter, renderer, Agent 1 QA paths, `.github/workflows/**`, or coordinator-owned UI-02 browser tests. Do not create a new feature branch or start AC-093/other isolated modules.

### Deliverables
1. Re-review the latest exact head of PR #96 and subsequent UI-02 slices for fail-closed target checks, immutable candidate handling, denial semantics, undo/history behavior, persistence/recovery safety and async import/paste races.
2. Keep findings concrete: file/line, triggering sequence, expected behavior, actual behavior, severity and a deterministic reproduction/test proposal.
3. Execute `node tests/layer-safety.browser.mjs` on the exact AC-058 head in a real Chromium environment. If blocked, report the exact environment error and do not claim a pass.
4. Update PR #40 and this status with exact tested SHA, command, browser version, run URL and unresolved gates.

### Acceptance / tests
- No denied or stale operation may partially mutate source pixels, project JSON, history, persisted project or recovery data.
- Async work already in flight when a safe edit begins must be explicitly ordered or rejected with visible feedback; it must not silently overwrite or disappear.
- Standard editor E2E is not a substitute for the dedicated AC-058 runner.

### Dependency and submission
- PR #96 is coordinator-owned; Agent 6 reviews only and must not push to that branch.
- UI-02B/C depend on UI-02A acceptance and are not to be implemented in parallel.
- Keep AC-058 on its existing branch; do not create another branch. Do not merge or self-accept.
