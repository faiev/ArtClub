# Status — Agent 1 QA / release reliability

## Active workstream
- **Current phase:** AC-031 — Import/export round-trip acceptance matrix
- **State:** IN_PROGRESS
- **Coordination source:** `main` (PR #7 merged).
- **Latest main before this status commit:** `cc7663ef1aa32ca3e9c18cc275aa2867c5ad68aa`.

## Completed / submitted phases

### AC-025 — Read-only PR #1 QA coverage audit
- **State:** REVIEW / handoff submitted.
- Compared PR #1, current main and PR #8; supplied keep/drop and integration ordering recommendations.
- Read-only; no edits to the shared E2E file, PR #1 or PR #8.

### AC-029 — Project lifecycle regression matrix
- **PR:** [#25 — Add project lifecycle QA regression matrix](https://github.com/faiev/ArtClub/pull/25) (open, draft, unmerged).
- **Branch/head:** `agent/qa-lifecycle` at `c0a7fea2193d37f868818de4b715857cb1575a53`.
- **Files:** `tests/fixtures/qa/lifecycle-fixtures.js`, `tests/qa/lifecycle/project-lifecycle.test.js`, `tests/qa/lifecycle/editor-switch-contract.test.js`.
- **Coverage:** project record isolation/reload/switch, rename/duplicate/delete, active layer/frame and visibility/lock/cel preservation, no-op versus meaningful-save recovery rotation, Recover semantics, quota abort atomicity, and static selection-reset contract.
- **Verification:** Focused commands were documented but not executed locally. GitHub clone/raw downloads are unavailable in this environment. Current workflow's `node --test tests/*.test.js` does not discover nested `tests/qa/lifecycle/*.test.js`; no CI pass is claimed for these tests.
- **Limits:** Storage tests use a transactional IndexedDB test double; selection-reset guard is static source inspection, not browser behavior. AC-032 will add the separate real-Chromium harness.

### AC-030 — Project format and migration compatibility
- **PR:** [#32 — Add project format and migration QA matrix](https://github.com/faiev/ArtClub/pull/32) (open, draft, unmerged).
- **Branch/head:** `agent/qa-compatibility` at `a7c4b367e7759fdc33075960025b14c5592367ff`.
- **Base:** `cc7663ef1aa32ca3e9c18cc275aa2867c5ad68aa`; branch compared 7 ahead / 0 behind when submitted.
- **Files:** `tests/fixtures/qa/compatibility-fixtures.js`, `tests/qa/compatibility/project-compatibility.test.js`.
- **Coverage:** v2 min/max boundaries; legacy v1 logical migration determinism and source-byte preservation; malformed JSON/version/format; missing references; duplicate layer/frame IDs and cel pairs; invalid HEX/durations/metadata/indexes/cel lengths; palette/layer/frame/cel limits; input non-mutation.
- **Known gap:** Sparse array holes are marked as a TODO because current `project-model.js` uses `Array.prototype.some()`, which skips holes. Explicit undefined slots are asserted rejected. Production model code was not changed.
- **Verification:** Focused command is documented but unexecuted locally. The nested test directory is not discovered by current workflow's root-only glob. No CI pass is claimed for this suite.

## Current phase — AC-031
- GIF exporter PR #11 is merged; its module is available on main and can receive independent QA contract tests.
- Sprite-sheet exporter PR #3 and palette-format PR #16 remain open/unmerged; do not bind tests to their unmerged branches. Record expected acceptance contracts and continue to AC-032 while these dependencies remain pending.

## Next 3–5 authorized actions
1. **AC-031:** Add QA-owned GIF timing/loop/transparency/immutability contract tests using the merged module; document pending sprite-sheet and palette contract coverage until their modules land on main.
2. **AC-032:** Build standalone Chromium/IndexedDB lifecycle harness under `tests/qa/browser/`; do not touch shared bridge E2E or workflow.
3. **AC-033:** Add `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, read-only `tools/qa-release-check.mjs` and checker tests.
4. **Ongoing triage:** Review accepted module contracts and add missing negative/boundary cases only under QA-owned paths.

## Ownership / blockers
- Owned paths: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.
- Do not edit `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, `index.html`, storage/model implementation, exporter implementation or other agents' tests.
- Agent 4 owns shared bridge E2E. Workflow remains outside Agent 1's ownership even though PR #11 merged.
- **Verification blocker:** This environment cannot clone/download the repository from GitHub, and the standard workflow does not discover nested QA tests. No tests in PR #25 or #32 are claimed as executed.
- **Next handoff:** Complete merged-GIF QA contract in a separate PR, then continue AC-032 independent browser harness.
- **Last updated:** 2026-11-14 — AC-030 PR #32 submitted; AC-031 started.
