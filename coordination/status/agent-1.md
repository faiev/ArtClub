# Status — Agent 1 QA / release reliability

## Active workstream
- **Current phase:** AC-032 — Standalone Chromium / IndexedDB lifecycle harness
- **State:** IN_PROGRESS
- **Coordination source:** `main` (PR #7 merged).
- **Latest main before this status commit:** `e92c3d9a3df78d04441bf07a1bd736225717c2e1`.
- **Current phase branch:** Creating a dedicated branch from the new main head after this status update.

## Completed / submitted phases

### AC-025 — Read-only PR #1 QA coverage audit
- **State:** REVIEW / handoff submitted.
- Compared PR #1, current main and PR #8; supplied keep/drop and integration ordering recommendations.
- Read-only; no edits to the shared E2E file, PR #1 or PR #8.

### AC-029 — Project lifecycle regression matrix
- **PR:** [#25 — Add project lifecycle QA regression matrix](https://github.com/faiev/ArtClub/pull/25) (open, draft, unmerged).
- **Branch/head:** `agent/qa-lifecycle` at `c0a7fea2193d37f868818de4b715857cb1575a53`.
- **Files:** `tests/fixtures/qa/lifecycle-fixtures.js`, `tests/qa/lifecycle/project-lifecycle.test.js`, `tests/qa/lifecycle/editor-switch-contract.test.js`.
- **Coverage:** project record isolation/reload/switch, rename/duplicate/delete, active layer/frame and visibility/lock/cel preservation, no-op vs meaningful-save recovery rotation, Recover semantics, quota-abort atomicity and static editor selection-reset contract.
- **Verification:** Focused commands documented but not executed locally. This environment cannot clone/download GitHub. Current workflow's `node --test tests/*.test.js` does not discover nested QA tests; no CI pass is claimed for them.
- **Limits:** Storage tests use a transactional IndexedDB test double; selection-reset check is static, not browser behavior.

### AC-030 — Project format and migration compatibility
- **PR:** [#32 — Add project format and migration QA matrix](https://github.com/faiev/ArtClub/pull/32) (open, draft, unmerged).
- **Branch/head:** `agent/qa-compatibility` at `a7c4b367e7759fdc33075960025b14c5592367ff`.
- **Base:** `cc7663ef1aa32ca3e9c18cc275aa2867c5ad68aa`; branch compared 7 ahead / 0 behind when submitted.
- **Files:** `tests/fixtures/qa/compatibility-fixtures.js`, `tests/qa/compatibility/project-compatibility.test.js`.
- **Coverage:** v2 min/max boundaries; legacy v1 logical migration determinism and source-byte preservation; malformed JSON/version/format; missing references; duplicate layer/frame IDs and cel pairs; invalid HEX/durations/metadata/indexes/cel lengths; palette/layer/frame/cel limits; input non-mutation.
- **Known gap:** Sparse array holes are a TODO because the current model uses `Array.prototype.some()`, which skips holes. Explicit undefined slots are asserted rejected. No production model code changed.
- **Verification:** Focused command unexecuted locally; workflow glob does not discover nested test. No CI pass claimed.

### AC-031 — Import/export acceptance matrix (partial)
- **PR:** [#36 — Add import export QA acceptance contracts](https://github.com/faiev/ArtClub/pull/36) (open, draft, unmerged).
- **Branch/head:** `agent/qa-import-export` at `ff8cd4d02d080152737fd4ba1082262350658030`.
- **Files:** `tests/qa/compatibility/gif-export-contract.test.js`, `tests/qa/compatibility/IMPORT_EXPORT_CONTRACTS.md`.
- **GIF coverage:** order, original/effective duration metadata, infinite/finite/one-shot loop policy, transparency count, hidden layer defaults/explicit selection, Blob contract, source immutability, malformed and oversized failure.
- **Pending modules:** Sprite-sheet PR #3 and palette PR #16 remain open/unmerged. Their expected QA contract is documented without depending on their branches. Executable tests will be added after their modules land on main.
- **Verification:** Focused command unexecuted locally; nested path not discovered by root-only workflow glob. No test pass claimed.

## Current phase — AC-032
Build the independent Playwright Chromium / real IndexedDB lifecycle runner in `tests/qa/browser/project-lifecycle.html` and `tests/qa/browser/project-lifecycle.mjs`. Cover create, edit, autosave, project switch, reload and recovery with exact pixels, console/page-error capture and deterministic fixtures. Do not touch bridge E2E or shared workflow.

## Next 3–5 authorized actions
1. Complete AC-032 standalone Chromium/IndexedDB lifecycle harness and local command/CI integration note.
2. Complete AC-033 QA matrix, release checklist, read-only QA release checker and checker tests.
3. Once PR #3 merges, add executable sprite-sheet raster/metadata contracts; once PR #16 merges, add GPL/JASC-PAL/JSON parser/exporter round-trip contracts.
4. Maintain a QA risk/bug ledger and add negative/boundary coverage for subsequent accepted modules.

## Ownership / blockers
- Owned paths: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.
- Do not edit `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, `index.html`, storage/model implementation, exporter implementation or other agents' tests.
- Agent 4 owns the shared bridge E2E. Workflow remains outside Agent 1's ownership.
- **Verification blocker:** This environment cannot clone/download the GitHub repository. Standard workflow's top-level glob also omits nested QA tests. Do not claim nested QA tests passed until their exact commands are executed and CI/test-runner integration is confirmed.
- **Next handoff:** Complete AC-032 on its own branch; submit a narrow PR and continue to AC-033.
- **Last updated:** 2026-11-14 — AC-031 partial PR #36 submitted; AC-032 started.
