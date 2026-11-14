# Status — Agent 1 QA / release reliability

## Active phase
- **Phase:** AC-087 — Reproducible QA suite discovery and local runner
- **State:** IN_PROGRESS
- **Coordination source:** `main`; PR #7 merged.
- **Latest main before this status update:** `60bce73c63be92f3f483b30ec694c28d3cd9de24`.
- **AC-087 branch:** `agent/qa-suite-runner`, stacked on the refreshed AC-033 branch `agent/qa-release-tooling`; parent dependency is PR #57.

## Submitted phases and current PRs

### AC-025 — Read-only PR #1 QA coverage audit
- **State:** REVIEW / handoff submitted.
- Compared PR #1, main and PR #8; documented unique/duplicate assertions, frame-selection conflict and safe keep/drop integration sequence.
- Read-only; no shared bridge E2E edits.

### AC-029 — Project lifecycle regression matrix
- **PR:** [#25](https://github.com/faiev/ArtClub/pull/25), open draft, stale/unmergeable at last check.
- **Branch/head:** `agent/qa-lifecycle` / `c0a7fea2193d37f868818de4b715857cb1575a53`.
- **Coverage:** project isolation/reload/switch, rename/duplicate/delete, active layer/frame, visibility/lock/cels, recovery rotation, quota transaction abort, static selection-reset contract.
- **Verification:** Focused tests unexecuted locally; nested path not discovered by root-only glob. No CI pass claimed.

### AC-030 — Project format and migration compatibility
- **PR:** [#32](https://github.com/faiev/ArtClub/pull/32), open draft, stale/unmergeable at last check.
- **Branch/head:** `agent/qa-compatibility` / `a7c4b367e7759fdc33075960025b14c5592367ff`.
- **Coverage:** v2 boundaries, v1 logical migration/source preservation, malformed JSON/version/format/references/IDs, HEX/duration/index/metadata/cel validation, count/size limits, non-mutation.
- **Known gap:** Sparse cel array holes are a TODO due to `Array.prototype.some()` skipping holes. Explicit undefined entries are asserted rejected. No model change.
- **Verification:** Focused tests unexecuted; nested path not discovered by root-only glob.

### AC-031 — Import/export acceptance matrix
- **PR:** [#36](https://github.com/faiev/ArtClub/pull/36), open draft, stale/unmergeable at last check.
- **Branch/head:** `agent/qa-import-export` / `ff8cd4d02d080152737fd4ba1082262350658030`.
- **Coverage:** merged GIF contract tests for order/timing/loop/transparency/layers/Blob/immutability/malformed/oversized behavior. Sprite-sheet PR #3 and palette PR #16 remain open/unmerged; contracts are documented, not yet executable against those modules.
- **Verification:** Focused tests unexecuted; no CI pass claimed.

### AC-032 — Standalone Chromium / IndexedDB lifecycle harness
- **PR:** [#42](https://github.com/faiev/ArtClub/pull/42), open draft; branch requires fresh-main revalidation.
- **Branch/head:** `agent/qa-browser` / `ba14048036d83e6ed34f8f240be4657aad35d6dd`.
- **Coverage designed:** real Chromium/IndexedDB; Alpha/Beta project creation, layer/frame/cel isolation, Project Library Open switching, reload persistence, Recover after autosave.
- **Run:** `cd agent-bridge && npm install --ignore-scripts && npx playwright install chromium && cd .. && node tests/qa/browser/project-lifecycle.mjs`.
- **Verification:** Not executed here; workflow does not invoke the runner. No browser pass claimed.

### AC-033 — Release readiness tooling
- **PR:** [#57](https://github.com/faiev/ArtClub/pull/57), open draft, GitHub reports mergeable.
- **Branch/head:** `agent/qa-release-tooling` / `736df393b3221eeb6717d656e073f12698cb6651`.
- **Base:** `60bce73c63be92f3f483b30ec694c28d3cd9de24`; 25 ahead / 0 behind.
- **Files:** `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js`.
- **Checker:** read-only local required path/script/workflow/checklist checks, nested-test discovery and local coordination freshness where refs allow, text/JSON output. CI/release status always unverified; releaseReady always false.
- **Renderer ledger:** QA matrix and checker now include the renderer contract test path and `parseColor()` mutable-cache risk; dependent on PR #61 file landing.
- **Verification:** `node --test tests/qa/release/qa-release-check.test.js` unexecuted locally; nested QA not in root-only test glob.

### Phase 6 renderer triage
- **PR:** [#61](https://github.com/faiev/ArtClub/pull/61), open draft, GitHub reports mergeable.
- **Branch/head:** `agent/qa-renderer-contract` / `dc7ed66c058e39886dc9223661dce52ee67373b4`.
- **Base:** `60bce73c63be92f3f483b30ec694c28d3cd9de24`; 3 ahead / 0 behind.
- **File:** `tests/qa/renderer/canvas-renderer-contract.test.js`.
- **Coverage:** invalid frame/revision type pre-mutation guards, malformed pointer-bound hit testing, TODO expected-failure for mutable `parseColor()` cache exposure. Renderer implementation unchanged.
- **Verification:** Focused test unexecuted; nested path not discovered by root workflow.

## AC-087 — Active deliverable
Build `tools/run-qa.mjs` and focused tests under `tests/qa/runner/`. Use an explicit sorted manifest for lifecycle, compatibility, import/export and browser QA suites; use safe argument-array child-process spawning; provide named/all-suite selection, human and stable JSON output, per-suite output/exit status, skipped and not-run entries, root-confined path checks, and fixtures/stub child-process tests. Browser runs must be clearly separated and never reported passed if skipped. No dependencies installation, file mutation, deployment, root scripts or workflow edits.

- **Allowed paths:** `tools/run-qa.mjs`, `tests/qa/runner/**`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.
- **Dependency:** PR #57 (AC-033) is open; this phase is stacked on `agent/qa-release-tooling`, not independent of it.
- **Current branch:** `agent/qa-suite-runner`, to be created from current AC-033 PR head.

## Next 3–5 actions
1. Complete AC-087 runner/manifest and tests for deterministic ordering, child argument safety, missing/failing suites, JSON schema/exit behavior and path traversal rejection.
2. Add exact Node-only and optional real-browser runner commands to the QA matrix/release checklist.
3. Submit AC-087 as a stacked PR against `agent/qa-release-tooling`; preserve PR #57 as the dependency and do not duplicate its diff.
4. Continue AC-031 sprite-sheet and palette contracts when PR #3 / PR #16 land on main.
5. Ask for no workflow edit; prepare the coordinator’s exact future command only if needed.

## Ownership and blockers
- Owned paths: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `tools/run-qa.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`.
- Do not edit `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, `index.html`, production modules or another worker's tests.
- Agent 4 owns shared bridge E2E; Agent 3 retains workflow lock for AC-027.
- **Verification blocker:** GitHub clone/download is unavailable; tests are not run locally. The runner's own tests must use stub child processes and explicitly report execution state. Do not claim any unexecuted QA suite passed.
- **Last updated:** 2026-11-14 — PR #57 and PR #61 synced; AC-087 started.
