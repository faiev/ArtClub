# Status — Agent 1 QA / release reliability

## Current snapshot
- **Role:** QA engineering / release reliability.
- **Coordination source:** `main`.
- **Main SHA observed immediately before this status update:** `0c525c763731d044bd700f3920e95943e35c543e`.
- **No application code changed in this session.** This update is limited to Agent 1's own status file.
- **Local execution blocker:** `git ls-remote https://github.com/faiev/ArtClub.git refs/heads/main` fails with `Could not resolve host: github.com`. GitHub connector/API access works, but this shell cannot clone/download the repository or launch a local Chromium smoke session.

## Current QA workstreams

### AC-087 — Reproducible QA suite discovery / runner
- **PR:** [#66 — Add reproducible QA suite runner and manifest](https://github.com/faiev/ArtClub/pull/66), open/draft.
- **Branch/head:** `agent/qa-suite-runner` / `b579ce3c60ce70be294a80dbdd2be9a86c944075`.
- **Parent:** [PR #57 — AC-033 release readiness tooling](https://github.com/faiev/ArtClub/pull/57), open/draft; `agent/qa-release-tooling` / `ab93ef23ce319064ec135d61936b84641fe73416`.
- **Current comparison against main `0c525c763731d044bd700f3920e95943e35c543e`:** #57 is 32 commits ahead / 151 behind; #66 is 59 ahead / 151 behind. #66 remains stacked on #57; do not merge or retarget the child ahead of its parent.
- **Incremental #66 files:** `tools/run-qa.mjs`, `tests/qa/runner/run-qa.test.mjs`, and the release-checker/test updates in `tools/qa-release-check.mjs` and `tests/qa/release/qa-release-check.test.js`.
- **Source review:** Explicit sorted suite manifest; argument-array child spawning through `process.execPath` with `shell:false`; path/realpath confinement for existing targets; explicit missing-file `not-run` and browser-opt-out `skipped` states; per-file stdout/stderr and exit-code reporting. No confirmed source-level blocker found in this read-only pass.
- **Exact-head CI:** [Run #43614894739](https://github.com/faiev/ArtClub/actions/runs/43614894739) completed successfully on #66 head; both `test` and `browser-e2e` jobs passed.
- **Critical limitation:** The `test` job runs `node --test tests/*.test.js`, which does not include nested `tests/qa/runner/run-qa.test.mjs`. The browser job covers the existing editor E2E, GIF verification and MCP test, not the runner. Neither `node --test tests/qa/runner/run-qa.test.mjs` nor `node tools/run-qa.mjs --suite all` has been executed by me. No focused test or runner pass is claimed.
- **Coordinator handoff:** Posted source review and execution/branch caveats to [PR #66 discussion](https://github.com/faiev/ArtClub/pull/66#issuecomment-6882632108). Coordinator previously requested precisely these missing execution commands/evidence.

### AC-033 — Release readiness tooling / QA matrix
- **PR:** #57 remains open/draft and is the parent of #66.
- **Head:** `ab93ef23ce319064ec135d61936b84641fe73416`.
- **Exact-head CI:** [Run #43614995961](https://github.com/faiev/ArtClub/actions/runs/43614995961) passed both workflow jobs.
- The root-only test glob does not prove nested release-checker QA tests ran. Focused local execution remains outstanding for the same repository-access reason.

### Earlier QA deliverables / open PR inventory
- **AC-029:** [PR #25](https://github.com/faiev/ArtClub/pull/25), open/draft; lifecycle suite.
- **AC-030:** [PR #32](https://github.com/faiev/ArtClub/pull/32), open/draft; project format/migration matrix.
- **AC-031:** [PR #36](https://github.com/faiev/ArtClub/pull/36), open/draft; import/export acceptance contracts.
- **AC-032:** [PR #42](https://github.com/faiev/ArtClub/pull/42), open/draft; standalone Chromium/IndexedDB lifecycle harness.
- **Renderer boundary triage:** [PR #61](https://github.com/faiev/ArtClub/pull/61), open/draft; QA-owned Canvas renderer contract assertions.
- **AC-025:** PR #1 remains open/stale and non-mergeable. The read-only audit was handed to Agent 4; do not edit `agent-bridge/e2e-test.mjs`.
- These nested QA suites/harnesses still require execution on a current checkout and exact-head validation. Standard root CI is not evidence for tests excluded by its glob.

### Phase 6 — Renderer boundary regression triage
- **PR:** [#61 — Canvas renderer boundary contract tests](https://github.com/faiev/ArtClub/pull/61), open/draft; only `tests/qa/renderer/canvas-renderer-contract.test.js` is in scope.
- **Head:** `21c7b412df53182df5a3923ae738531022ca471c`. Branch compares as 4 commits ahead / 181 behind current `main`; GitHub currently reports it not mergeable.
- **Read-only verification:** current main's `js/canvas-renderer.js` blob `96eaa69872d6090e89c0e773483c5f8211e6b9b4` confirms `rgba(color)` caches a mutable channel array in `COLORS`, returns that same array, and exports the function publicly as `parseColor`. A caller can mutate shared cache state and corrupt subsequent renders.
- **Handoff:** Posted the concrete cache-mutation explanation and a performance-conscious fix direction (keep cached internal `rgba()`; export a defensive-copy wrapper) to [PR #61](https://github.com/faiev/ArtClub/pull/61#issuecomment-6882677914) for Agent 2. Agent 1 has not changed renderer implementation.
- **Test limitation:** the regression test for this finding is still `todo`; the nested QA file is not run by root-only CI and has not been executed locally because the shell cannot resolve GitHub. Sync the branch non-force and run the focused test before acceptance.

## UI-01 production workstation shell — post-release QA
- **PR #84:** merged successfully as `e22ddb35ebf802b3b719e74a7329effceab28747`.
- **Merged candidate head:** `dee2e96ff2c3cf9b1927570d4248d95114f113c6`.
- **Pre-merge exact-head CI:** [Run #43624220195](https://github.com/faiev/ArtClub/actions/runs/43624220195) passed Node and Chromium/GIF/MCP jobs.
- **Post-merge CI:** [Run #43624328658](https://github.com/faiev/ArtClub/actions/runs/43624328658) passed both workflow jobs on merge commit `e22ddb35ebf802b3b719e74a7329effceab28747`.
- **GitHub Pages:** deployment [Run #43624328006](https://github.com/faiev/ArtClub/actions/runs/43624328006) completed successfully on the merge commit and reported [https://faiev.github.io/ArtClub/](https://faiev.github.io/ArtClub/).
- **Manual smoke gate:** UI01-01…UI01-12 remain **NOT RUN**. No Chromium executable/browser session or local checkout is available here. CI's existing editor E2E does not substitute for the specified 12-flow smoke matrix, pixel/state assertions and screenshots at 1440×900 and 1280×800. Published-page rendered appearance has not been independently inspected.
- **Read-only source audit of merged `index.html` on main blob `4645281c1aad8580529e7feb99cd299a88543913`:**
  1. **P1:** `.project-name:focus` retains the low-contrast 2px `rgba(66,107,132,.15)` outline; the generic `input:focus-visible` rule does not override the more-specific project-name rule.
  2. **P1:** selected tool/palette/frame states are visual-only: `setTool()` toggles `.active`, `renderPalette()` toggles `.selected`, and `renderTimeline()` toggles the active frame class without `aria-pressed`, `aria-current` or an equivalent programmatic selected state.
  3. **P2:** layer lock button uses platform-dependent `🔒` / `◇` text and only a title rather than an explicit action accessible name.
  4. **P2:** `meta[name="theme-color"]` remains light `#f2f0e9` against the dark `#15191b` application shell.
  5. **P2:** essential technical readouts such as section kickers, selection status and statistic labels remain at 8px, below the 9–10px design-system guidance.
- Source inspection found the expected controls/handlers for drawing tools, selection, layers, frames, playback/onion skin, save/recovery, project/image import and PNG/SVG/JSON export, plus responsive breakpoints. This is not runtime evidence for any flow.
- **Handoff:** Posted the release/CI distinction, NOT RUN smoke status and source findings to [PR #84 discussion](https://github.com/faiev/ArtClub/pull/84#issuecomment-6882632489). Follow-up production fixes require the authorized UI owner; Agent 1 does not edit `index.html`.

## Next 3–5 actions
1. On an available current checkout, run `node --test tests/qa/runner/run-qa.test.mjs` and `node tools/run-qa.mjs --suite all --json`; verify the expected missing-file/browser-skip statuses and record exact output/Node version/head SHA.
2. Reconcile PR #57 with current `main` using the repository's non-force policy, then sync stacked PR #66 to the refreshed parent; rerun focused tests and exact-head CI after synchronization.
3. Execute UI01-01…UI01-12 in real Chromium at 1440×900 and 1280×800, including pixel/state checks, console/page errors and screenshots; keep the matrix NOT RUN until actually executed.
4. Reconcile PR #61 with current main, coordinate Agent 2's `parseColor` cache fix, then run the focused renderer QA contract on the exact refreshed head.
5. Re-review the UI-01 accessibility issues after the authorized production owner submits fixes; continue negative/boundary-test triage for PRs #25/#32/#36/#42 in Agent 1-owned QA paths only.

## Ownership, exclusions and blockers
- **Owned:** `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `tools/run-qa.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, and this status file.
- **Excluded:** `index.html`, production UI/CSS, storage/model implementation, exporter implementation, `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml`, and any other worker's tests/status/assignment.
- Agent 3 owns the shared workflow lock for AC-027; Agent 4 owns shared bridge E2E while PR #8 is reconciled.
- **Blocker:** Local network DNS prevents cloning/downloading GitHub, which blocks focused Node execution and real Chromium/manual smoke testing in this session. Continue source/CI review through GitHub API; do not describe unrun tests as passing.
- **Last updated:** 2026-11-15 — current main/PR state verified, AC-087 source review recorded, PR #84 merge and Pages deployment verified, UI-01 manual smoke remains NOT RUN.
