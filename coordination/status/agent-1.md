# Status — Agent 1 QA / release reliability

## Current snapshot
- **Role:** QA engineering / release reliability.
- **Coordination source:** `main`.
- **Main SHA observed before this status commit:** `ae39adb5e419589b81f19333d392d386334abb1a`.
- **This session's repository changes:** QA-owned tooling and docs on feature branches PR #91/#93, plus this status file on main. No production editor/UI, project model/storage, exporter, bridge or workflow files were changed.
- **Local execution blocker:** `git ls-remote https://github.com/faiev/ArtClub.git refs/heads/main` still fails with `Could not resolve host: github.com`. GitHub API access works, but this shell cannot clone/download the repository or launch Chromium. The focused nested test commands and 12-flow browser smoke remain unexecuted locally.

## AC-033 — Release readiness tooling / QA matrix
- **Current PR:** [#91 — Refresh QA release readiness tooling on current main](https://github.com/faiev/ArtClub/pull/91), open/draft; branch `agent/qa-release-tooling-refresh`.
- **Head:** `b15babfff34e631163d804db32450e7f3cd255ff`.
- **Incremental scope:** `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js` only.
- **Current comparison:** 7 commits ahead / 2 behind `main` at the last comparison; the diff remains those four paths. GitHub currently reports the PR not mergeable because coordination commits advanced `main`. The branch was refreshed by non-force merge commits; no shared history was rewritten.
- **Exact-head CI:** Actions [run #43633092085](https://github.com/faiev/ArtClub/actions/runs/43633092085) — both `test` and `browser-e2e` jobs passed.
- **Evidence boundary:** the standard Node job uses `node --test tests/*.test.js`; it does not run nested `tests/qa/release/qa-release-check.test.js`. No focused checker-test pass is claimed.

## AC-087 — Reproducible QA suite discovery / runner
- **Current PR:** [#93 — Add reproducible QA suite runner on refreshed main](https://github.com/faiev/ArtClub/pull/93), open/draft; branch `agent/qa-suite-runner-refresh`, stacked on PR #91.
- **Head:** `df5ed11986b0a99b744d31749882bc32e7955e2d`.
- **Current parent comparison:** 9 commits ahead / 0 behind `agent/qa-release-tooling-refresh`; the current diff is limited to six QA-owned paths: `tools/run-qa.mjs`, `tests/qa/runner/run-qa.test.mjs`, `tools/qa-release-check.mjs`, `tests/qa/release/qa-release-check.test.js`, `docs/QA_MATRIX.md`, and `docs/RELEASE_CHECKLIST.md`.
- **Runner source contract:** explicit sorted manifest; only listed `tests/qa/**` paths; `process.execPath` + argument arrays + `shell:false`; path/realpath confinement; child stdout/stderr/exit-code reporting; stable JSON; missing manifest paths are `not-run`; an existing browser suite without opt-in is `skipped`; no install, repository mutation or deploy.
- **Documentation fix:** corrected a source/documentation mismatch discovered during review: AC-087's release checker requires the runner test and commands, while the inherited release checklist omitted them. PR #93 now adds the exact three commands to `docs/RELEASE_CHECKLIST.md` and explains `not-run` vs `skipped` and exit-code semantics in `docs/QA_MATRIX.md`.
- **Exact-head standard CI:** Actions [run #43633121814](https://github.com/faiev/ArtClub/actions/runs/43633121814) — Node job passed; browser-e2e was still running at the latest check. The Node job is still the root-only `node --test tests/*.test.js` command and does **not** execute `tests/qa/runner/run-qa.test.mjs` or `node tools/run-qa.mjs --suite all`.
- **Focused test status:** `node --test tests/qa/release/qa-release-check.test.js`, `node --test tests/qa/runner/run-qa.test.mjs`, and the actual `node tools/run-qa.mjs --suite all --json` command have not been executed by me. No focused runner/CLI pass is claimed.
- **Workflow lock request:** Agent 3 explicitly released AC-027's workflow ownership in their status. I requested a separate bounded Agent 1 lock for only the three AC-087 Node checks in [PR #93 comment](https://github.com/faiev/ArtClub/pull/93#issuecomment-6882981880). No Coordinator approval/reply has been received, and Agent 1 has **not** edited `.github/workflows/project-tests.yml`.
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
1. Obtain the Coordinator's bounded workflow lock (or a suitable approved CI mechanism), then add focused Node execution for the AC-087 runner and checker and assert the real `--suite all --json` report semantics.
2. Verify Actions run #43633121814 completes both jobs on PR #93 head `df5ed11986b0a99b744d31749882bc32e7955e2d`; keep standard CI separate from focused nested-suite evidence.
3. After Agent 2 PR #90 is merged, refresh PR #61 against latest main, remove the cache-test TODO only after the public behavior is on main, and run `node --test tests/qa/renderer/canvas-renderer-contract.test.js` on its exact head.
4. Reconcile PR #91 with current main before coordinator review/merge; preserve the four-file scope and non-force merge history.
5. Execute UI01-01…UI01-12 in real Chromium at 1440×900 and 1280×800 when a browser-enabled checkout is available; keep the gate NOT RUN until completed.

## Ownership, exclusions and blockers
- **Owned:** `tests/qa/**`, `tests/fixtures/qa/**`, `tools/qa-release-check.mjs`, `tools/run-qa.mjs`, `docs/QA_MATRIX.md`, `docs/RELEASE_CHECKLIST.md`, and this status file.
- **Excluded:** `index.html`, production UI/CSS, storage/model implementation, exporter implementation, `agent-bridge/e2e-test.mjs`, `.github/workflows/project-tests.yml` without a separate Coordinator lock, and all other agents' tests/status/assignments.
- Agent 3's AC-027 workflow lock is released; the Agent 1 limited lock request remains pending. Agent 4 owns shared bridge E2E while PR #8 is reconciled.
- **Blocker:** local DNS prevents cloning/downloading GitHub and running Node/Chromium. Continue source/API/Actions review, but never describe focused tests or manual flows as passing without their actual execution.
- **Last updated:** 2026-11-15 — AC-033/AC-087 replacement PRs refreshed; exact standard CI recorded; renderer fix CI verified but unmerged; manual UI-01 smoke remains NOT RUN.