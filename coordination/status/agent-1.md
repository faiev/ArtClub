# Status — Agent 1 QA / release reliability

## Active workstream
- **Current phase:** Ongoing regression triage (Phase 6 of the authorized Agent 1 workstream)
- **State:** IN_PROGRESS
- **Coordination source:** `main` (PR #7 merged).
- **Latest main before this status commit:** `f638b30c71a80bbbaeb86759e7d476a274500085`.

## Submitted QA phases

### AC-025 — Read-only PR #1 QA coverage audit
- **State:** REVIEW / handoff submitted.
- Compared PR #1, current main and PR #8; documented unique/duplicate assertions, frame-selection conflict and keep/drop integration sequence.
- Read-only; no edits to shared bridge E2E, PR #1 or PR #8.

### AC-029 — Project lifecycle regression matrix
- **PR:** [#25 — Project lifecycle QA regression matrix](https://github.com/faiev/ArtClub/pull/25) (open draft; stale/unmergeable at last check).
- **Branch/head:** `agent/qa-lifecycle` / `c0a7fea2193d37f868818de4b715857cb1575a53`.
- **Coverage:** project isolation/reload/switch, rename/duplicate/delete, active layer/frame, visibility/lock/cels, no-op/real-save recovery rotation, quota transaction aborts, static selection-reset contract.
- **Verification:** Focused commands documented but not executed locally. GitHub clone/download is unavailable; root-only `node --test tests/*.test.js` does not discover nested QA tests. No CI pass is claimed.

### AC-030 — Project format and migration compatibility
- **PR:** [#32 — Project format and migration QA matrix](https://github.com/faiev/ArtClub/pull/32) (open draft; stale/unmergeable at last check).
- **Branch/head:** `agent/qa-compatibility` / `a7c4b367e7759fdc33075960025b14c5592367ff`.
- **Coverage:** v2 boundaries, v1 logical migration/source preservation, malformed JSON/version/format/references/IDs, HEX/duration/index/metadata/cel checks, count and size limits, non-mutation.
- **Known gap:** Sparse cel array holes are a TODO because current model validation uses `Array.prototype.some()`, which skips holes. Explicit undefined slots are rejected. No model code changed.
- **Verification:** Focused command not executed locally; nested tests are not found by the existing root-only test glob.

### AC-031 — Import/export acceptance matrix (partial)
- **PR:** [#36 — Import/export QA acceptance contracts](https://github.com/faiev/ArtClub/pull/36) (open draft; stale/unmergeable at last check).
- **Branch/head:** `agent/qa-import-export` / `ff8cd4d02d080152737fd4ba1082262350658030`.
- **Coverage:** merged GIF module frame order/timing/loop/transparency/hidden layers/Blob/source immutability/invalid and over-budget cases.
- **Pending:** Sprite-sheet PR #3 and palette PR #16 remain open/unmerged. Expected acceptance contracts are documented; no tests depend on unmerged branches.
- **Verification:** Focused command not executed locally; no CI pass claimed for the nested QA file.

### AC-032 — Standalone Chromium / IndexedDB lifecycle harness
- **PR:** [#42 — Standalone Chromium project lifecycle harness](https://github.com/faiev/ArtClub/pull/42) (open draft; stale/unmergeable at last check).
- **Branch/head:** `agent/qa-browser` / `ba14048036d83e6ed34f8f240be4657aad35d6dd`.
- **Coverage designed:** real Chromium and IndexedDB; Alpha/Beta creation, layer/frame/cel separation, Project Library Open switching, reload persistence, Recover A after autosaved B; page and console error capture.
- **Run command:** `cd agent-bridge && npm install --ignore-scripts && npx playwright install chromium && cd .. && node tests/qa/browser/project-lifecycle.mjs`.
- **Verification:** Not executed here. Existing workflow does not invoke this runner; no browser pass is claimed.

### AC-033 — Release readiness tooling and evidence
- **PR:** [#57 — Read-only QA release readiness tooling](https://github.com/faiev/ArtClub/pull/57) (open draft; head `f946ff827c850950eee4e0dfc5c88108487d03bf`, base `719e97f1ac30a7ac80495485cd4d914f5f7fb93b`; 18 ahead / 0 behind at submission).
- **Files:** `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js`.
- **Checker:** read-only local required-file/script/workflow/checklist checks; nested QA discovery warning; main-source and local Git freshness checks where refs are present; text/JSON output.
- **Safety:** does not query GitHub, run tests, deploy or modify repository/project data. `ci.status` and `releaseStatus` remain `unverified`; `releaseReady` always false. `ok` means only no hard local structural failures.
- **Verification:** Focused command `node --test tests/qa/release/qa-release-check.test.js` not executed locally. Root-only workflow glob does not discover the nested test. No CI pass claimed.

### Ongoing renderer triage — merged PR #6
- **PR:** [#61 — Add Canvas renderer boundary contract tests](https://github.com/faiev/ArtClub/pull/61) (open draft; branch synced to main at submission).
- **Branch/head:** `agent/qa-renderer-contract` / `796bbd3af4f80fda43ea2a795f9c58381f941788`.
- **Base:** `f638b30c71a80bbbaeb86759e7d476a274500085`; 2 ahead / 0 behind at submission.
- **File:** `tests/qa/renderer/canvas-renderer-contract.test.js`.
- **Coverage:** invalid frame/revision tokens fail before resize/surface mutation; malformed pointer bounds return null. Adds a TODO regression for a mutable-color-cache issue in public `parseColor()`.
- **Finding:** `rgba()` returns its internal cached array from public `parseColor`; a caller can mutate it and corrupt future renders of that color. Renderer implementation remains untouched; suggested defensive-copy fix handed to Agent 2.
- **Verification:** Focused command `node --test tests/qa/renderer/canvas-renderer-contract.test.js` not executed locally; nested QA tests are not included by the root-only glob. The TODO is an expected known gap, not a passing fix.

## Next 3–5 actions
1. Update the QA risk ledger in the AC-033 QA matrix with the renderer cache-mutation finding and the new boundary-test path.
2. Continue read-only contract review of merged modules for additional negative/boundary gaps; add QA-only tests on dedicated branches.
3. Once PR #3 sprite-sheet exporter merges, add executable decoded-PNG raster/metadata contracts; once PR #16 palette tooling merges, add GPL/JASC-PAL/JSON round-trip contracts.
4. Ask the workflow owner/coordinator to wire nested QA suites and the standalone lifecycle runner; Agent 1 must not edit the workflow.
5. Reassess the sparse cel-hole validator gap after the project-model owner addresses it; retain the explicit regression.

## Ownership / blockers
- Owned: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.
- Do not edit `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, `index.html`, storage/model implementation, exporter implementation or another worker's tests.
- Agent 4 owns shared bridge E2E; Agent 3 owns workflow changes for sprite-sheet CI while AC-027/039 lock remains active.
- **Verification blocker:** GitHub repository clone/download is unavailable in this environment. No unexecuted nested tests or standalone browser harness may be described as passing.
- **Next handoff:** Keep PR #57 and #61 in draft for coordinator review; continue Phase 6 on dedicated branches. Do not merge own PRs or self-accept work.
- **Last updated:** 2026-11-14 — renderer QA boundary PR #61 submitted; Phase 6 continues.
