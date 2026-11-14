# Status — Agent 1 QA / release reliability

## Active workstream
- **Current phase:** AC-033 — Release readiness tooling and evidence
- **State:** IN_PROGRESS
- **Coordination source:** `main` (PR #7 merged).
- **Latest main before this status commit:** `a5c1a008a12e919a1b8a74f0dde58920d944acbc`.
- **Current phase branch:** Creating a dedicated branch from main after this status update.

## Completed / submitted phases

### AC-025 — Read-only PR #1 QA coverage audit
- **State:** REVIEW / handoff submitted.
- Compared PR #1, current main and PR #8; documented unique/duplicate assertions, frame-selection conflict and keep/drop integration sequence.
- Read-only; no edits to the shared bridge E2E file, PR #1 or PR #8.

### AC-029 — Project lifecycle regression matrix
- **PR:** [#25 — Project lifecycle QA regression matrix](https://github.com/faiev/ArtClub/pull/25) (open draft).
- **Branch/head:** `agent/qa-lifecycle` / `c0a7fea2193d37f868818de4b715857cb1575a53`.
- **Coverage:** project isolation/reload/switch, rename/duplicate/delete, active layer/frame, visibility/lock/cels, no-op/real-save recovery rotation, quota transaction aborts, static selection-reset contract.
- **Verification:** Focused commands documented but not executed locally. GitHub clone/download is unavailable; root-only `node --test tests/*.test.js` does not discover nested QA tests. No CI pass is claimed.

### AC-030 — Project format and migration compatibility
- **PR:** [#32 — Project format and migration QA matrix](https://github.com/faiev/ArtClub/pull/32) (open draft).
- **Branch/head:** `agent/qa-compatibility` / `a7c4b367e7759fdc33075960025b14c5592367ff`.
- **Coverage:** v2 boundaries, v1 logical migration/source preservation, malformed JSON/version/format/references/IDs, HEX/duration/index/metadata/cel checks, count and size limits, non-mutation.
- **Known gap:** Sparse cel array holes are a TODO because current model validation uses `Array.prototype.some()`, which skips holes. Explicit undefined slots are rejected. No model code changed.
- **Verification:** Focused command not executed locally; nested tests are not found by the existing root-only test glob.

### AC-031 — Import/export acceptance matrix (partial)
- **PR:** [#36 — Import/export QA acceptance contracts](https://github.com/faiev/ArtClub/pull/36) (open draft).
- **Branch/head:** `agent/qa-import-export` / `ff8cd4d02d080152737fd4ba1082262350658030`.
- **Coverage:** merged GIF module frame order/timing/loop/transparency/hidden layers/Blob/source immutability/invalid and over-budget cases.
- **Pending:** Sprite-sheet PR #3 and palette PR #16 remain open/unmerged. Expected acceptance contracts are documented; no tests depend on unmerged branches.
- **Verification:** Focused command not executed locally; no CI pass claimed for the nested QA file.

### AC-032 — Standalone Chromium / IndexedDB lifecycle harness
- **PR:** [#42 — Standalone Chromium project lifecycle harness](https://github.com/faiev/ArtClub/pull/42) (open draft; GitHub reported mergeable).
- **Branch/head:** `agent/qa-browser` / `ba14048036d83e6ed34f8f240be4657aad35d6dd`.
- **Base:** `a5c1a008a12e919a1b8a74f0dde58920d944acbc`; 6 commits ahead / 0 behind at submission.
- **Files:** `tests/qa/browser/project-lifecycle.html`, `tests/qa/browser/project-lifecycle.mjs`, `tests/qa/browser/README.md`.
- **Coverage designed:** real Chromium and IndexedDB; Alpha/Beta creation, layer/frame/cel separation, Project Library Open switching, reload persistence, Recover A after autosaved B; page and console error capture.
- **Run command:** `cd agent-bridge && npm install --ignore-scripts && npx playwright install chromium && cd .. && node tests/qa/browser/project-lifecycle.mjs`.
- **Verification:** Not executed in this environment. Existing browser-e2e workflow does not yet invoke this standalone runner; no pass is claimed. Workflow is outside Agent 1 ownership.

## Current phase — AC-033
Create `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, read-only `tools/qa-release-check.mjs` and focused checker tests. Checker must report required files/scripts/commands, stale coordination state only when locally detectable, and a machine-readable summary. It must not mutate repository/project data, deploy, contact services or claim CI green without a verifiable CI source.

## Next 3–5 authorized actions
1. Complete AC-033 docs, read-only checker and tests; cover missing files/scripts, nested-test discovery gap, stale-board detectability and explicit unverified CI state.
2. Once PR #3 merges, add executable sprite-sheet PNG decoded-raster/metadata contracts; once PR #16 merges, add GPL/JASC-PAL/JSON round-trip contracts.
3. Continue regression triage for accepted modules and maintain the QA risk ledger in `docs/QA_MATRIX.md`.
4. Ask coordinator/workflow owner to integrate nested QA unit tests and the standalone browser runner; Agent 1 must not edit the workflow directly.

## Ownership / blockers
- Owned: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.
- Do not edit `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, `index.html`, storage/model implementation, exporter implementation or another worker's tests.
- Agent 4 owns shared bridge E2E; Agent 3 owns workflow changes for sprite-sheet CI while AC-027/039 lock remains active.
- **Verification blocker:** GitHub repository download/clone is unavailable in this environment. No unexecuted nested tests/browser harness may be described as passing.
- **Next handoff:** Submit AC-033 as a narrow PR on a separate branch; never merge own PRs or self-accept work.
- **Last updated:** 2026-11-14 — AC-032 PR #42 submitted; AC-033 started.
