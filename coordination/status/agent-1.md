## UI-02A QA follow-up — 2026-11-15

- **Active assignment:** UI-02A QA-only review of the coordinator's PR #96; no production edits and no new branch created.
- **Reviewed branch/head:** `coordinator/ui-02a-safe-clear` / `0e0633bcadc8fbf3cfcc0de797136a1e4ffa6e29`.
- **Lock/visibility regression coverage:** confirmed in `tests/ui02-safe-clear.browser.mjs`. The Chromium flow exercises Agent API lock and visibility transitions, checks that toolbar and selection Clear controls disable, and verifies a locked selection-clear denial leaves pixels unchanged. The production UI and Agent API lock/visibility handlers all refresh selection controls via `renderSelectionTools()`. The Node test covers locked, hidden and zero-opacity safe-edit denial and source-project immutability.
- **Exact-head CI:** [UI-02 browser run #43636239861](https://github.com/faiev/ArtClub/actions/runs/43636239861) failed at browser test line 139, after the lock/visibility assertions, because the race probe assumes `window.ArtClubStorage.prototype.saveProject`; the loaded global is an API object, not a constructor. [Project test run #43636239803](https://github.com/faiev/ArtClub/actions/runs/43636239803) succeeded. This does not establish that the safe-edit persistence race is fixed.
- **Review handoff:** posted the source/test review and exact failure details on [PR #96 comment #6883568281](https://github.com/faiev/ArtClub/pull/96#issuecomment-6883568281). PR remains draft. Agent 6 owns the stale-target/autosave persistence race review; Agent 1 did not edit production, storage, bridge or workflow files.
- **Evidence limitation:** I inspected GitHub source and Actions logs through the repository connector. I did not run Node or Chromium locally; the prior local DNS limitation remains. The CI run reached and passed the lock/visibility assertions before failing later in the same browser script.

### Current UI-02 next actions
1. Recheck PR #96 after the Coordinator corrects the browser race-probe instrumentation; verify the new exact-head run and retain lock/visibility assertions.
2. Add or confirm an explicit browser-level hidden-layer mutation-denial immutability assertion if the Coordinator requests a test-only follow-up or provides a QA branch/target.
3. Review UI-02B import denial/immutability cases when the Coordinator opens that production slice; remain within `tests/qa/ui02/**`.
4. Continue exact-head review of each UI-02 slice; do not claim a pass from source inspection or an unrelated workflow.

# Status — Agent 1 QA / release reliability

## Current snapshot
- **Role:** QA engineering / release reliability.
- **Coordination source:** `main`.
- **Main SHA observed before this status commit:** `cdfab1598052a7a7226c9b753174758d2b6f3f35`.
- **This session's repository changes:** QA-owned tooling and docs on feature branches PR #91/#93, plus this status file on main. No production editor/UI, project model/storage, exporter, bridge or workflow files were changed.
- **Local execution blocker:** `git ls-remote https://github.com/faiev/ArtClub.git refs/heads/main` still fails with `Could not resolve host: github.com`. GitHub API access works, but this shell cannot clone/download the repository or launch Chromium. The focused nested test commands and 12-flow browser smoke remain unexecuted locally.

## AC-033 — Release readiness tooling / QA matrix
- **Current PR:** [#91 — Refresh QA release readiness tooling on current main](https://github.com/faiev/ArtClub/pull/91), open/draft; branch `agent/qa-release-tooling-refresh`.
- **Head:** `b15babfff34e631163d804db32450e7f3cd255ff`.
- **Incremental scope:** `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js` only.
- **Current comparison:** 7 commits ahead / 2 behind `main` at the last comparison; the diff remains those four paths. GitHub currently reports the PR not mergeable because coordination commits advanced `main`. The branch was refreshed by non-force merge commits; no shared history was rewritten.
- **Exact-head CI:** Actions [run #43633092085](https://github.com/faiev/ArtClub/actions/runs/43633092085) — both `test` and `browser-e2e` jobs passed. The focused nested release-checker test was not invoked by the standard root-only Node glob.
- **Evidence boundary:** the standard Node job uses `node --test tests/*.test.js`; it does not run nested `tests/qa/release/qa-release-check.test.js`. No focused checker-test pass is claimed.

## AC-087 — Reproducible QA suite discovery / runner
- **Current PR:** [#93 — Add reproducible QA suite runner on refreshed main](https://github.com/faiev/ArtClub/pull/93), open/draft; branch `agent/qa-suite-runner-refresh`, stacked on PR #91.
- **Head:** `0c8d7275565c5cf472439a94521344be77560f2b`.
- **Current parent comparison:** 21 commits ahead / 0 behind `agent/qa-release-tooling-refresh`; the current diff is limited to seven QA-owned paths: `tools/run-qa.mjs`, `tests/qa/runner/run-qa.test.mjs`, `tests/qa/runner/verify-qa-runner-ci.mjs`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js`, `docs/QA_MATRIX.md`, and `docs/RELEASE_CHECKLIST.md`.
- **Runner source contract:** explicit sorted manifest; only listed `tests/qa/**` paths; `process.execPath` + argument arrays + `shell:false`; path/realpath confinement; child stdout/stderr/exit-code reporting; stable JSON; missing manifest paths are `not-run`; an existing browser suite without opt-in is `skipped`; no install, repository mutation or deploy. Added `verify-qa-runner-ci.mjs` to invoke the real all-suite CLI and validate its JSON/report, required release/runner suite success, manifest presence and the actual child exit code.
- **Documentation fix:** corrected a source/documentation mismatch discovered during review: AC-087's release checker requires the runner test and commands, while the inherited release checklist omitted them. PR #93 adds the exact commands, documents `not-run` vs `skipped`, and requires the CI verifier path/command. Its unit test also checks absent-file `not-run` separately from an existing non-opted-in browser `skipped`.
- **Exact-head standard CI:** Actions [run #43634444127](https://github.com/faiev/ArtClub/actions/runs/43634444127) — both `test` and `browser-e2e` jobs completed successfully on head `0c8d7275565c5cf472439a94521344be77560f2b`. The Node job is still the root-only `node --test tests/*.test.js` command and does **not** execute `tests/qa/runner/run-qa.test.mjs`, `verify-qa-runner-ci.mjs` or the nested release-checker test.
- **Focused test status:** `node --test tests/qa/release/qa-release-check.test.js`, `node --test tests/qa/runner/run-qa.test.mjs`, and `node tests/qa/runner/verify-qa-runner-ci.mjs` have not been executed by me. The verifier's source and unit-test contract were reviewed, but no focused runner/CLI pass is claimed because this shell cannot clone/materialize the GitHub sources or resolve `github.com`.
- **Workflow lock request:** Agent 3 explicitly released AC-027's workflow ownership. I requested a separate bounded Agent 1 lock for the three AC-087 focused Node commands in [PR #93 comment](https://github.com/faiev/ArtClub/pull/93#issuecomment-6882981880), then clarified the single all-suite verifier command in [follow-up comment](https://github.com/faiev/ArtClub/pull/93#issuecomment-6883347814). No Coordinator approval/reply has been received; Agent 1 has **not** edited `.github/workflows/project-tests.yml`.
- Historical PRs #57/#66 remain open and untouched; #91/#93 are their current-main replacements. I have asked the Coordinator to review the replacement chain and decide whether the historical PRs should be closed as superseded.

## Renderer boundary regression triage — PR #61 / Agent 2 PR #90
- **Agent 1 QA PR:** [#61 — Canvas renderer boundary contract tests](https://github.com/faiev/ArtClub/pull/61), open/draft and stale; head `21c7b412df53182df5a3923ae738531022ca471c`. It adds QA-owned contract assertions for invalid frame/revision tokens and malformed pointer bounds; its public `parseColor()` cache mutation test remains TODO.
- **Defect confirmed on main:** `js/canvas-renderer.js` blob `96eaa69872d6090e89c0e773483c5f8211e6b9b4` still returns the mutable channel array from its private `COLORS` cache through public `parseColor`; the fix is not yet merged.
- **Agent 2 fix PR:** [#90 — Defensive public parseColor API](https://github.com/faiev/ArtClub/pull/90), open and ready for review, head `2ab42f27be2661976fd182d284e65e53e3bd3cb7`. It retains cached internal `rgba()` and exposes a defensive-copy wrapper.
- **Exact-head CI:** Actions [run #43632737343](https://github.com/faiev/ArtClub/actions/runs/43632737343) passed both Node and browser-e2e jobs. The Node log confirms the new public `parseColor()` defensive-copy test ran: 242 passed / 0 failed.
- **Handoff:** I posted the confirmed QA finding and the passing PR #90 validation to [PR #61](https://github.com/faiev/ArtClub/pull/61#issuecomment-6882992822). Keep PR #61's TODO assertion until PR #90 is merged; after that, re-sync PR #61 and run its focused nested test. Agent 1 did not change renderer implementation.

## UI-01 production workstation shell — post-release QA
- **PR #84:** merged as `e22ddb35ebf802b3b719e74a7329effceab28747`.
- **CI:** pre-merge run #43624220195 and post-merge run #43624328658 both passed the standard Node and browser/GIF/MCP jobs.
- **GitHub Pages:** deploy run [#43624328006](https://github.com/faiev/ArtClub/actions/runs/43624328006) succeeded on the merge commit and reported [https://faiev.github.io/ArtClub/](https://faiev.github.io/ArtClub/).
- **Manual smoke gate:** UI01-01…UI01-12 remain **NOT RUN**. No local Chromium/browser or working repository checkout; standard E2E does not substitute for the 12-flow matrix and requested 1440×900 / 1280×800 screenshots. Rendered published-page appearance was not independently inspected.
- **Source-level findings remain on the handoff:** P1 low-contrast `.project-name:focus`; P1 missing programmatic selected state for active tool/palette/frame; P2 emoji-only layer lock action; P2 light `theme-color` metadata against dark shell; P2 8px technical readouts. These were reported on [PR #84](https://github.com/faiev/ArtClub/pull/84#issuecomment-6882632489). Agent 1 did not modify production UI.

## Earlier QA deliverables
- AC-029 [PR #25](https://github.com/faiev/ArtClub/pull/25), AC-030 [PR #32](https://github.com/faiev/ArtClub/pull/32), AC-031 [PR #36](https://github.com/faiev/ArtClub/pull/36), AC-032 [PR #42](https://github.com/faiev/ArtClub/pull/42), and historical AC-033/AC-087 PRs #57/#66 remain open. Their nested suite/harness evidence still needs current-head focused execution; standard root CI does not validate nested files.
- AC-025 PR #1 remains stale/overlapping. The read-only audit was handed to Agent 4; no shared bridge E2E edits.

## Next 3–5 actions
1. Obtain the Coordinator's bounded workflow lock (or a suitable approved CI mechanism), then run the AC-087 release test, runner test and `verify-qa-runner-ci.mjs` on the exact current head.
2. After a Coordinator-approved workflow lock (or another authorized CI path), add only the focused release/runner/verifier commands to the Node job and run them against PR #93's exact head; keep standard CI separate from focused nested-suite evidence.
3. After Agent 2 PR #90 is merged, refresh PR #61 against latest main, remove the cache-test TODO only after the public behavior is on main, and run `node --test tests/qa/renderer/canvas-renderer-contract.test.js` on its exact head.
4. Reconcile PR #91 with current main before coordinator review/merge; preserve the four-file scope and non-force merge history.
5. Execute UI01-01…UI01-12 in real Chromium at 1440×900 and 1280×800 when a browser-enabled checkout is available; keep the gate NOT RUN until completed.

## Ownership, exclusions and blockers
- **Owned:** `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `tools/run-qa.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, and this status file.
- **Excluded:** `index.html`, production UI/CSS, storage/model implementation, exporter implementation, `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml` without a separate Coordinator lock, and all other agents' tests/status/assignments.
- Agent 3's AC-027 workflow lock is released; the Agent 1 limited lock request remains pending. Agent 4 owns shared bridge E2E while PR #8 is reconciled.
- **Blocker:** local DNS prevents cloning/downloading GitHub and running Node/Chromium. Continue source/API/Actions review, but never describe focused tests or manual flows as passing without their actual execution.
- **Last updated:** 2026-11-15 — AC-087 CI verifier and unit coverage added; exact-head standard CI run #43634444127 passed both jobs; nested focused runner/checker execution remains unverified; renderer fix CI verified but unmerged; manual UI-01 smoke remains NOT RUN.