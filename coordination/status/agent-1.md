# Status — Agent 1 QA / release reliability

## Active priority
- **Current focus:** Production UI integration QA preparation — UI-01 workstation shell smoke coverage.
- **State:** TEST PLAN PREPARED; waiting for the coordinator's UI-01 implementation candidate before browser execution.
- **Coordination source:** `main`; PR #7 merged.
- **Main SHA at this status update:** `2c84284ec0416348e8a0170eda8170a3d2279d85`.
- **Production UI ownership:** Coordinator is sole writer of `index.html` and production UI wiring. Agent 1 has not modified those files.

## Current Agent 1 deliverables

### AC-087 — QA suite discovery / local runner
- **PR:** [#66 — Add reproducible QA suite runner and manifest](https://github.com/faiev/ArtClub/pull/66) (open draft; GitHub reported mergeable at last check).
- **Branch/head:** `agent/qa-suite-runner` / `3720adaa14e7ddda16d4677fe0136a0d56dc8285`.
- **Parent:** PR #57 / `agent/qa-release-tooling` at `250f0edfebd278dc6c5e68489a897ff6cc0acab9`; child comparison 25 ahead / 0 behind.
- **Files in the AC-087 child diff:** `tools/run-qa.mjs`, `tests/qa/runner/run-qa.test.mjs`, plus AC-033 checker/test updates that require the runner. The QA matrix and release checklist are inherited from parent PR #57.
- **Behavior:** explicit sorted manifest; lifecycle/compatibility/import-export/browser/release/renderer/runner suites; named/all/file selection; path/symlink confinement to `tests/qa/**`; child processes spawned with argument arrays and `shell:false`; stdout/stderr and child exit codes recorded; missing manifest files = `not-run` and nonzero exit 2; intentional browser opt-out = `skipped`; stable JSON/human output. No install, repository writes, deployment or CI claims.
- **Exact evidence:** Parent PR #57 run #464 ([run #43614324854](https://github.com/faiev/ArtClub/actions/runs/43614324854)) succeeded on exact parent head `250f0ed...`; both existing `test` and `browser-e2e` jobs passed. This run did **not** include the child runner implementation.
- **Current-head evidence:** No workflow run was available for child head `3720adaa...` at last check. Earlier run #429 passed the standard workflow on older child head `98b07b8...`, but that workflow uses `node --test tests/*.test.js` and does not discover the nested `tests/qa/runner/run-qa.test.mjs`.
- **Local verification:** `node --test tests/qa/runner/run-qa.test.mjs` has not been executed locally because this environment cannot clone/download the repository. No runner-test pass is claimed.
- **Dependency:** Keep #66 stacked on #57. Do not merge the child ahead of its parent.

### AC-033 — Release readiness tooling and production UI QA matrix
- **PR:** [#57 — Read-only QA release readiness tooling](https://github.com/faiev/ArtClub/pull/57) (open draft; GitHub reported mergeable at last check).
- **Branch/head:** `agent/qa-release-tooling` / `250f0edfebd278dc6c5e68489a897ff6cc0acab9`.
- **Base:** `main` at `b2735dec1a7d36fb5e8dafa4c1ccc43131e71f07` when synchronized; main has since advanced. GitHub still reported the PR mergeable at last check.
- **Files:** `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js`.
- **Checker:** read-only required-file/script/workflow/checklist checks, nested-test discovery and local coordination freshness when refs allow. `ci.status` and `releaseStatus` remain unverified; `releaseReady` is always false.
- **Exact-head CI:** run #464 / [43614324854](https://github.com/faiev/ArtClub/actions/runs/43614324854) passed both existing jobs on exact parent head `250f0ed...`. The root-only Node glob does not discover nested QA suites.
- **Local focused checker test:** `node --test tests/qa/release/qa-release-check.test.js` not run locally; do not claim a pass.

### UI-01 workstation-shell smoke coverage — prepared
- Added a 12-flow QA matrix to the AC-033 `docs/QA_MATRIX.md` and a matching release gate to `docs/RELEASE_CHECKLIST.md`.
- Covers 1440×900 desktop and 1280×800 compact layouts; orientation, draw/erase, selection, layer/frame targeting, playback, save/reload/recovery, import/export, keyboard/focus, and non-mutating denial/error states.
- The matrix requires exact pixel/state checks, console/page-error capture, screenshots and exact tested SHA.
- **Execution state:** pending. The board says UI-00 awaits Agent 5's AC-091 prototype and UI-01 is queued for coordinator implementation. No UI-01 candidate was found in the open PR search. These docs are a test plan, not evidence that the UI exists or passes.

## Earlier submitted QA phases

- **AC-025:** Read-only PR #1 audit complete; unique/duplicate frame-aware assertions and safe keep/drop advice handed to Agent 4. No shared bridge E2E edits.
- **AC-029 PR #25:** Lifecycle/recovery/quota regression suite and test fixtures; open draft, stale and requiring current-main revalidation. Focused tests unexecuted locally.
- **AC-030 PR #32:** v2 boundary, v1 migration, malformed input and non-mutation matrix; open draft, stale and requiring current-main revalidation. Sparse cel array holes remain a known model-validation gap; no model changes.
- **AC-031 PR #36:** GIF acceptance contracts plus pending sprite-sheet and palette format contracts; open draft, stale and requiring current-main revalidation. PR #3 and PR #16 modules were not merged at last review.
- **AC-032 PR #42:** Standalone Chromium/IndexedDB lifecycle harness; open draft, stale and requiring current-main revalidation. Runner has not been executed; current workflow does not invoke it.
- **Renderer triage PR #61:** Boundary test suite for renderer frame/revision token validation and malformed pointer bounds; documents TODO for mutable `parseColor()` cache exposure. Open draft, requires current-main revalidation; no renderer implementation changed and focused nested test not executed.

## Next 3–5 actions
1. When the coordinator opens the UI-01 implementation PR/candidate, execute UI01-01…UI01-12 in Chromium at 1440×900 and 1280×800; record exact head, browser/DPR, screenshots, pixel/state assertions and console/page errors.
2. Keep PR #66 stacked on PR #57; after parent review/merge, retarget the child to current `main` and re-check exact-head CI. Do not merge or self-accept either PR.
3. Run the focused runner suite when a local repository checkout is available; require an explicit workflow-owner integration for nested QA discovery after Agent 3 releases the workflow lock. Agent 1 must not edit the workflow.
4. After PR #3 / PR #16 land on `main`, turn the documented sprite-sheet and palette acceptance contracts into executable QA tests.
5. After the UI integration is merged and Pages deployment succeeds, inspect the published editor directly before reporting any user-visible release.

## Ownership and blockers
- Owned: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `tools/run-qa.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, and this Agent 1 status file.
- Do not edit `index.html`, production CSS/UI, storage/model, exporter implementation, `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, or other agents' tests.
- Agent 4 owns shared bridge E2E. Agent 3 retains the workflow lock for AC-027.
- **Verification blocker:** GitHub clone/download is unavailable in this environment; nested QA test commands and the standalone lifecycle browser runner remain unexecuted locally. Do not describe root workflow success as execution of nested QA suites.
- **Product priority:** UI-01 smoke plan is ready, but no implementation candidate is available yet. Do not start AC-088 or expand feature backlog ahead of coordinator-led production UI integration.
- **Last updated:** 2026-11-14 — AC-087 PR #66 synced to parent; UI-01 smoke matrix prepared; awaiting coordinator UI candidate.
