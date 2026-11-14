# Status — Agent 1 QA / release reliability

## Active priority
- **Current focus:** Production UI integration QA preparation — UI-01 workstation shell.
- **State:** Smoke-test plan prepared; waiting for the coordinator's UI-01 implementation candidate before browser execution.
- **Coordination source:** `main`; PR #7 merged.
- **Main SHA at this status update:** `0d9baa8a3fc3b8aa25b9b859b7ff118899751ce6`.
- **Production UI ownership:** Coordinator is sole writer of `index.html` and production UI wiring. Agent 1 has not modified those files.

## Current PRs

### AC-033 — Release readiness tooling and QA matrix
- **PR:** [#57 — Read-only QA release readiness tooling](https://github.com/faiev/ArtClub/pull/57) (open draft; GitHub reports mergeable).
- **Branch/head:** `agent/qa-release-tooling` / `ab93ef23ce319064ec135d61936b84641fe73416`.
- **Base:** `main` at `e88b6401634e7dd029284fbd4452248eb72a72af`; current main has since advanced one commit, but GitHub still reports the PR mergeable.
- **Comparison:** 32 commits ahead / 1 behind current main at last comparison.
- **Files:** `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js`.
- **Checker:** read-only required-file/script/workflow/checklist checks, nested-test discovery, coordination freshness where local Git refs allow, human and JSON output. `releaseReady` remains false; release and CI states remain unverified. It does not query GitHub, deploy or mutate files/projects.
- **UI-01 prep:** QA matrix contains a 12-flow smoke plan and release gate for 1440×900 and 1280×800. Covers open/orientation, draw/erase, selection, layers, timeline/frames, playback, save/reload/recovery, import/export, keyboard/focus, compact layout and non-mutating error/denial states. This is a prepared plan only.
- **Exact-head CI:** run #508 / [43614995961](https://github.com/faiev/ArtClub/actions/runs/43614995961) succeeded on exact parent head `ab93ef23ce319064ec135d61936b84641fe73416`; both `test` and `browser-e2e` jobs passed (root Node/model/editor tests, Chromium editor E2E, GIF browser verification and MCP E2E).
- **Evidence limitation:** workflow still runs `node --test tests/*.test.js`, which does not discover nested `tests/qa/**` tests. The green run does not prove the focused release-checker test ran. Local focused test unavailable because this environment cannot clone/download the repository.

### AC-087 — Reproducible QA suite discovery / local runner
- **PR:** [#66 — Add reproducible QA suite runner and manifest](https://github.com/faiev/ArtClub/pull/66) (open draft; GitHub reports mergeable).
- **Branch/head:** `agent/qa-suite-runner` / `b579ce3c60ce70be294a80dbdd2be9a86c944075`.
- **Parent:** PR #57 / `agent/qa-release-tooling` at `ab93ef23ce319064ec135d61936b84641fe73416`; 27 commits ahead / 0 behind the parent branch.
- **Incremental child files:** `tools/run-qa.mjs`, `tests/qa/runner/run-qa.test.mjs`, plus the release-checker/test updates that require the runner.
- **Runner behavior:** explicit sorted manifest for browser, compatibility, import/export, lifecycle, release, renderer and runner suites; named/all/file selection; path/symlink confinement to `tests/qa/**`; argument-array child spawning with `shell:false`; stdout/stderr and child exit codes; stable JSON and human summaries; missing manifest files = `not-run` with exit 2; intentional browser opt-out = `skipped`. No installation, repository writes, deployment or implicit test discovery.
- **Exact-head CI:** run #505 / [43614894739](https://github.com/faiev/ArtClub/actions/runs/43614894739) succeeded on exact child head `b579ce3c60ce70be294a80dbdd2be9a86c944075`. Both jobs passed: standard root Node/model/editor test command and bridge syntax; Chromium editor E2E, GIF browser verification and MCP client E2E.
- **Critical evidence boundary:** run #505 did **not** execute `tests/qa/runner/run-qa.test.mjs`; the current workflow's root-only `node --test tests/*.test.js` glob does not include that nested `.test.mjs`. The focused command `node --test tests/qa/runner/run-qa.test.mjs` has not been executed locally because repository clone/download is unavailable. No focused runner-test pass is claimed.

### Phase 6 renderer QA triage
- **PR:** [#61 — Canvas renderer boundary contract tests](https://github.com/faiev/ArtClub/pull/61), open draft at last review.
- **Scope:** QA-owned checks for invalid frame/revision tokens before mutation and malformed pointer bounds; documents the mutable `parseColor()` cache issue as a TODO for the renderer owner. No renderer implementation changed.
- **Verification:** focused nested test unexecuted locally; not covered by root-only test glob.

## Earlier submitted QA phases
- **AC-025:** Read-only PR #1 audit complete; unique/duplicate frame-aware assertions and keep/drop guidance handed to Agent 4. No shared bridge E2E edits.
- **AC-029 PR #25:** Lifecycle/recovery/quota regression suite and fixtures; open draft, stale and requiring current-main revalidation. Focused tests unexecuted locally.
- **AC-030 PR #32:** v2 boundary, v1 migration, malformed-input and non-mutation matrix; open draft, stale and requiring current-main revalidation. Sparse cel array holes remain a known project-model validation gap; no model edits.
- **AC-031 PR #36:** GIF acceptance contracts plus pending sprite-sheet and palette contracts; open draft, stale and requiring current-main revalidation. Sprite-sheet PR #3 and palette PR #16 remained unmerged at last review.
- **AC-032 PR #42:** Standalone Chromium/IndexedDB lifecycle harness; open draft and requiring current-main revalidation. Harness has not been executed and is not invoked by the shared workflow.

## UI-01 smoke test handoff
- The smoke matrix is included in the AC-033 parent branch's `docs/QA_MATRIX.md` and `docs/RELEASE_CHECKLIST.md`; it is not yet on `main` while PR #57 is open.
- Board state at last refresh: UI-00 is awaiting Agent 5's AC-091 prototype; UI-01 workstation shell is queued for coordinator implementation.
- No separate UI-01 implementation PR was found in the open-PR search.
- **Execution state:** pending. Once the coordinator supplies an approved candidate, run UI01-01…UI01-12 at desktop 1440×900 and compact 1280×800 in Chromium; record exact SHA, browser/DPR, screenshots, exact-pixel/state assertions, page/console errors and blocked cases.
- After merge, inspect GitHub Pages publication before any user-visible release claim.

## Next 3–5 actions
1. Wait for the coordinator's UI-01 implementation PR/candidate; then execute the documented 12-flow Chromium smoke matrix and record evidence against its exact SHA.
2. Keep PR #66 stacked on PR #57; after the parent is accepted/merged, retarget the child to current `main` and re-check CI. Do not merge or self-accept either PR.
3. Arrange explicit workflow-owner integration for nested QA discovery after Agent 3 releases the workflow lock; Agent 1 must not edit the shared workflow.
4. Run the focused QA runner and other nested suites when a local repository checkout is available; distinguish those runs from root CI.
5. After PR #3 / #16 land on `main`, convert sprite-sheet and palette contracts into executable tests.

## Ownership and blockers
- Owned: `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `tools/run-qa.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, and this Agent 1 status file.
- Do not edit `index.html`, production UI/CSS, storage/model, exporter implementation, `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, or another agent's tests.
- Agent 4 owns shared bridge E2E. Agent 3 retains the workflow lock for AC-027.
- **Verification blocker:** GitHub clone/download is unavailable in this environment. Exact-head standard CI for PRs #57/#66 passed, but nested QA suites and the standalone lifecycle runner have not executed. Do not call them green based on the root workflow.
- **Product priority:** UI-01 smoke coverage is prepared; execution awaits the coordinator's candidate. Do not start AC-088 or expand feature backlog before the first production UI integration.
- **Last updated:** 2026-11-14 — AC-033/AC-087 branches synced; exact-head CI #508/#505 passed; UI-01 smoke plan ready.
