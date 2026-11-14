# Agent 7 — Branch hygiene inventory — 2026-11-15

## Assignment and scope

- **Assignment:** Read-only tile-workstream branch/PR dependency inventory under `Ten-agent branch hygiene assignments — 2026-11-15` in `coordination/BOARD.md`.
- **Authorized scope:** PRs #13, #28, #58, #65, #67, #79, #81 and all tile-related refs.
- **Current main:** `84a9d83a059f41f3b3d4e7f1f2e02bcfb67cbbfa` (verified from `GET /repos/faiev/ArtClub/git/ref/heads/main`).
- **Common merge base:** `5679e45095c13b792093da1fff3c62c641f25c8b` for all seven open tile PR heads.
- **Observed PR base metadata:** all seven target `main`; their recorded base SHA is `1e45961d57cf3422b63c549461000b205e285685`, not current main. Direct comparison against current main shows each is **42 commits behind**.
- **Files changed by this assignment:** `coordination/status/agent-7.md` only.
- **Production/module/fixture/test/PR/branch/workflow changes:** none.

## Branch and PR dependency table

Ahead/behind counts below are GitHub compare results against current main SHA `84a9d83a059f41f3b3d4e7f1f2e02bcfb67cbbfa`. The ahead count is the complete commit count unique to the branch since the common merge base; it may include branch sync commits, so it is not presented as a count of feature-only commits.

| Work | PR / branch | Exact head | Ahead / behind | Changed files | Exact-head CI | Dependencies / recommendation |
|---|---|---|---:|---|---|---|
| AC-016 tile preview | [#13](https://github.com/faiev/ArtClub/pull/13) / `agent/tile-preview` | `06942a6b8f4bc3e7419a332743614feb8e95a8c3` | 15 / 42 | 3: `docs/tile-preview.md`, `js/tile-preview.js`, `tests/tile-preview.test.js` | [Run #43631494537](https://github.com/faiev/ArtClub/actions/runs/43631494537) — test + browser-e2e success | No direct module/PR dependant found. **Retain parked**; standalone preview utility, not UI integration. |
| AC-061 tile transforms | [#28](https://github.com/faiev/ArtClub/pull/28) / `agent/tile-transform` | `7dfecf3c4cbd4864d40bbc3fbcac754e4dfffca1` | 11 / 42 | 3: `docs/tile-transform.md`, `js/tile-transform.js`, `tests/tile-transform.test.js` | [Run #43631502215](https://github.com/faiev/ArtClub/actions/runs/43631502215) — test + browser-e2e success | No direct module/PR dependant found. **Retain parked**; isolated transform utility. |
| AC-062 tile map | [#58](https://github.com/faiev/ArtClub/pull/58) / `agent/tile-map` | `f06a145a6ce2f527592f9d9cc2abe4a457b76fd6` | 7 / 42 | 3: `docs/tile-map.md`, `js/tile-map.js`, `tests/tile-map.test.js` | [Run #43631509922](https://github.com/faiev/ArtClub/actions/runs/43631509922) — test + browser-e2e success | AC-093 uses a compatible row-major map shape but does not import this module; contract-level relationship only. **Retain parked**. |
| AC-063 seam diagnostics | [#65](https://github.com/faiev/ArtClub/pull/65) / `agent/tile-seam-diagnostics` | `07912cd53676d8e48bea438c17e787719d33da18` | 8 / 42 | 3: `docs/tile-seam-diagnostics.md`, `js/tile-seam-diagnostics.js`, `tests/tile-seam-diagnostics.test.js` | [Run #43631552998](https://github.com/faiev/ArtClub/actions/runs/43631552998) — test + browser-e2e success | No direct module/PR dependant found. **Retain parked**; diagnostics are standalone/read-only. |
| AC-064 atlas planner | [#67](https://github.com/faiev/ArtClub/pull/67) / `agent/tile-atlas-planner` | `de0b6305185a8a0727e28d39aaac771f0b176176` | 8 / 42 | 3: `docs/tile-atlas-planner.md`, `js/tile-atlas-planner.js`, `tests/tile-atlas-planner.test.js` | [Run #43631564684](https://github.com/faiev/ArtClub/actions/runs/43631564684) — test + browser-e2e success | Planner emits metadata only; exporter integration is not present. **Retain parked**. |
| AC-065 fixtures | [#79](https://github.com/faiev/ArtClub/pull/79) / `agent/tile-workflow-fixtures` | `198ee8ee73e6b35d56a6642831bce5a51755a11a` | 10 / 42 | 10: `docs/tile-workflow-fixtures.md`, seven files under `tests/fixtures/tiles/`, `tests/run-tile-examples.js`, `tests/tile-workflow-fixtures.test.js` | [Run #43631572828](https://github.com/faiev/ArtClub/actions/runs/43631572828) — test + browser-e2e success | Runner uses Node built-ins and its own fixture helpers; no direct imports from the other tile modules. **Retain parked** as reusable validation corpus. |
| AC-093 autotile resolver | [#81](https://github.com/faiev/ArtClub/pull/81) / `agent/autotile-rule-resolver` | `6bd29f29de0fa92ed1c3ab6affcf7cc8f4d00541` | 10 / 42 | 7: `docs/autotile.md`, `js/autotile.js`, `tests/autotile.test.js`, four files under `tests/fixtures/tiles/autotile/` | [Run #43631601024](https://github.com/faiev/ArtClub/actions/runs/43631601024) — test + browser-e2e success | Resolver validates a detached row-major map contract; source inspection found no import of `js/tile-map.js`. **Retain parked**; no direct code dependency. |

### Related merged tile branch

| PR / branch | Exact branch head | Merge commit | Reachability / diff | Recommendation |
|---|---|---|---|---|
| [#80](https://github.com/faiev/ArtClub/pull/80) / `agent/tile-workflow-integration` | `8c2dcb8a845b7ff778c76a7233bc7f970294b20e` | `187fbd0247c80ed5d5ba72ab019bc8d7bec2a86c` | PR changed only `docs/TILE_WORKFLOW_INTEGRATION.md`. Comparing merge commit to current main gives **0 behind / 120 ahead**, proving the merge commit is reachable from main. | **Candidate branch for deletion only after Coordinator review**; do not delete in this assignment. The merged contract is documentation, not shipped UI integration. |

## Dependency and disposition findings

1. The seven open PRs are all based on the same merge-base commit `5679e45095c13b792093da1fff3c62c641f25c8b`; current-main comparisons report 42 commits behind. Their PR base is `main`, but the PR API's recorded base SHA remains `1e45961d57cf3422b63c549461000b205e285685`.
2. The seven PR diffs have distinct, non-overlapping file sets. No direct downstream PR dependency or cross-module import was found in the inspected tile sources. AC-093 and AC-062 share a compatible map-data contract, but AC-093 does not import AC-062's module.
3. All seven PRs remain open and draft. GitHub's raw PR endpoint currently returns `mergeable: null` / `mergeable_state: unknown` for all seven; this is **not** evidence of either a clean merge or a conflict. Coordinator must refresh mergeability after branch sync before considering integration.
4. Exact-head workflow runs were retrieved for each supplied head. Both `test` and `browser-e2e` jobs completed successfully on all seven runs; browser job steps included Chromium editor E2E, animated GIF browser verification and MCP client integration. These CI results validate the listed old heads, not current-main compatibility after the 42-commit divergence.
5. No tile production integration is evidenced. PR #80 is a merged documentation contract only. Under the current UI-02 release gate, the seven independent tile PRs should remain parked rather than be closed or deleted. No branch deletion is recommended for any open PR branch.

## Commands / API reads executed

No shell commands, local tests, or local builds were run. Read-only GitHub API operations performed:

- `GET /repos/faiev/ArtClub/git/ref/heads/main`
- `GET /repos/faiev/ArtClub/branches?per_page=100&page=1` and `page=2` (filtered results for tile/autotile refs)
- `GET /repos/faiev/ArtClub/pulls/{13,28,58,65,67,79,80,81}`
- `GET /repos/faiev/ArtClub/compare/84a9d83a059f41f3b3d4e7f1f2e02bcfb67cbbfa...{tile-head}` for each seven open heads
- `GET /repos/faiev/ArtClub/compare/187fbd0247c80ed5d5ba72ab019bc8d7bec2a86c...84a9d83a059f41f3b3d4e7f1f2e02bcfb67cbbfa` for PR #80 merge reachability
- PR changed-filename, review-submission and review-thread reads for #13/#28/#58/#65/#67/#79/#81
- Exact-head workflow-run and job reads for run IDs `43631494537`, `43631502215`, `43631509922`, `43631552998`, `43631564684`, `43631572828`, `43631601024`
- Source reads: `tests/run-tile-examples.js` at `agent/tile-workflow-fixtures`, `js/autotile.js` at `agent/autotile-rule-resolver`, and `docs/TILE_WORKFLOW_INTEGRATION.md` at `agent/tile-workflow-integration`

## Blockers and next actions

- **Blocker:** 42-commit divergence from current main means successful historical exact-head CI does not establish current-main integration readiness.
- **Blocker:** GitHub mergeability is unknown for all seven open PRs until recalculated.
- **Release constraint:** Tile feature expansion remains parked while UI-02 is the active release gate.
- **Coordinator action:** Decide whether to sync any parked branch for future integration, retain it as-is, or close/archive it after dependency and reachability review. PR #80's branch may be considered for deletion only after Coordinator review of the proven merge reachability.
- **Agent 7 action:** No further changes unless the Coordinator requests a specific read-only follow-up. No module, production, test, branch, PR, workflow, or shared-file change is authorized.

## Prior assignment record — UI-02A cel/tile invariant review

A previous Coordinator-requested review of PR #96 found no tile-specific cel mutation issue: Safe Clear and selection Clear replace pixels only in the selected cel; image import targets the captured active project/layer/frame. The persisted project model did not define a tile-map structure, so future integrated tile-map compatibility could not be certified. That review was source/diff inspection only; no local tests were run. Its separate P1 cross-tab stale-write and P2 post-persist recovery rollback findings remained outside Agent 7's tile scope.
