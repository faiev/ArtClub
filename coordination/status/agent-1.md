# Status — Agent 1 QA / release reliability

## Active workstream
- **Current phase:** Ongoing regression triage (Phase 6 of the authorized Agent 1 workstream)
- **State:** IN_PROGRESS
- **Coordination source:** `main` (PR #7 merged).
- **Latest main before this status commit:** `719e97f1ac30a7ac80495485cd4d914f5f7fb93b`.

## Completed / submitted phases

### AC-025 — Read-only PR #1 QA coverage audit
- **State:** REVIEW / handoff submitted.
- Compared PR #1, current main and PR #8; documented unique/duplicate assertions, frame-selection conflict and keep/drop integration sequence.
- Read-only; no edits to shared bridge E2E, PR #1 or PR #8.

### AC-029 — Project lifecycle regression matrix
- **PR:** [#25 — Project lifecycle QA regression matrix](https://github.com/faiev/ArtClub/pull/25) (open draft; GitHub reported unmergeable at last check).
- **Branch/head:** `agent/qa-lifecycle` / `c0a7fea2193d37f868818de4b715857cb1575a53`.
- **Coverage:** project isolation/reload/switch, rename/duplicate/delete, active layer/frame, visibility/lock/cels, no-op/real-save recovery rotation, quota transaction aborts, static selection-reset contract.
- **Verification:** Focused commands documented but not executed locally. GitHub clone/download is unavailable; root-only `node --test tests/*.test.js` does not discover nested QA tests. No CI pass is claimed.

### AC-030 — Project format and migration compatibility
- **PR:** [#32 — Project format and migration QA matrix](https://github.com/faiev/ArtClub/pull/32) (open draft; GitHub reported unmergeable at last check).
- **Branch/head:** `agent/qa-compatibility` / `a7c4b367e7759fdc33075960025b14c5592367ff`.
- **Coverage:** v2 boundaries, v1 logical migration/source preservation, malformed JSON/version/format/references/IDs, HEX/duration/index/metadata/cel checks, count and size limits, non-mutation.
- **Known gap:** Sparse cel array holes are a TODO because current model validation uses `Array.prototype.some()`, which skips holes. Explicit undefined slots are rejected. No model code changed.
- **Verification:** Focused command not executed locally; nested tests are not found by the existing root-only test glob.

### AC-031 — Import/export acceptance matrix (partial)
- **PR:** [#36 — Import/export QA acceptance contracts](https://github.com/faiev/ArtClub/pull/36) (open draft; GitHub reported unmergeable at last check).
- **Branch/head:** `agent/qa-import-export` / `ff8cd4d02d080152737fd4ba1082262350658030`.
- **Coverage:** merged GIF module frame order/timing/loop/transparency/hidden layers/Blob/source immutability/invalid and over-budget cases.
- **Pending:** Sprite-sheet PR #3 and palette PR #16 remain open/unmerged. Expected acceptance contracts are documented; no tests depend on unmerged branches.
- **Verification:** Focused command not executed locally; no CI pass claimed for the nested QA file.

### AC-032 — Standalone Chromium / IndexedDB lifecycle harness
- **PR:** [#42 — Standalone Chromium project lifecycle harness](https://github.com/faiev/ArtClub/pull/42) (open draft; GitHub reported unmergeable at last check after main advanced).
- **Branch/head:** `agent/qa-browser` / `ba14048036d83e6ed34f8f240be4657aad35d6dd`.
- **Files:** `tests/qa/browser/project-lifecycle.html`, `tests/qa/browser/project-lifecycle.mjs`, `tests/qa/browser/README.md`.
- **Coverage designed:** real Chromium and IndexedDB; Alpha/Beta creation, layer/frame/cel separation, Project Library Open switching, reload persistence, Recover A after autosaved B; page and console error capture.
- **Run command:** `cd agent-bridge && npm install --ignore-scripts && npx playwright install chromium && cd .. && node tests/qa/browser/project-lifecycle.mjs`.
- **Verification:** Not executed in this environment. Existing browser-e2e workflow does not invoke this standalone runner; no browser pass is claimed. Workflow is outside Agent 1 ownership.

### AC-033 — Release readiness tooling and evidence
- **PR:** [#57 — Read-only QA release readiness tooling](https://github.com/faiev/ArtClub/pull/57) (open draft; GitHub reported mergeable at last check).
- **Branch/head:** `agent/qa-release-tooling` / `f946ff827c850950eee4e0dfc5c88108487d03bf`.
- **Base:** `719e97f1ac30a7ac80495485cd4d914f5f7fb93b`; compare reported 18 commits ahead / 0 behind at submission.
- **Files:** `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js`.
- **Checker:** read-only local required-file/script/workflow/checklist checks; nested QA discovery warning; main-source and local Git freshness checks where refs are present; text/JSON output; CLI exit status for structural failures.
- **Safety:** does not query GitHub, run tests, deploy or modify repository/project data. `ci.status` and `releaseStatus` remain `unverified`; `releaseReady` always false. `ok` means only no hard local structural failures.
- **Focused test:** `node --test tests/qa/release/qa-release-check.test.js`; **not executed locally** because the repository cannot be cloned/downloaded here. The existing workflow's root-only glob does not discover this test. No CI pass is claimed for the nested test.

## Ongoing regression triage
- The assignment authorizes continued review of accepted module PRs and additional negative/boundary tests in QA-owned paths.
- Next target: review the merged Canvas 2D renderer module from PR #6 for missing negative/boundary coverage, without editing renderer implementation or Agent 2's tests.
- Continue updating the bug/risk ledger in `docs/QA_MATRIX.md`.

## Next 3–5 actions
1. Triage the merged renderer's public contract and add QA-owned negative/boundary tests only where coverage is missing.
2. When PR #3 sprite-sheet exporter merges, add executable decoded-PNG raster/metadata contracts; when PR #16 palette tooling merges, add GPL/JASC-PAL/JSON round-trip contracts.
3. Ask workflow owner/coordinator to wire nested QA suites and the standalone lifecycle runner; Agent 1 must not edit the workflow.
4. Reassess sparse cel-hole validation gap after the project-model owner addresses it; retain the explicit regression.
5. Keep CI claims tied to exact commit SHAs and named job logs.

## Ownership / blockers
- Owned: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.
- Do not edit `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, `index.html`, storage/model implementation, exporter implementation or another worker's tests.
- Agent 4 owns shared bridge E2E; Agent 3 owns workflow changes for sprite-sheet CI while AC-027/039 lock remains active.
- **Verification blocker:** GitHub repository clone/download is unavailable in this environment. No unexecuted nested tests or standalone browser harness may be described as passing.
- **Next handoff:** Keep PR #57 draft for coordinator review; continue Phase 6 on a separate branch. Do not merge own PRs or self-accept work.
- **Last updated:** 2026-11-14 — AC-033 PR #57 submitted; ongoing regression triage started.
