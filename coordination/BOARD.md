# Art Club coordination board

Coordinator snapshot: 2026-11-14  
Coordination source: `main`  
Main snapshot used for this reconciliation: `0b131a963baabc5a83c5a9d6e570671abcda9f44`  
Repository: `faiev/ArtClub`

> This board is the live index. It reconciles worker-owned status files with the current open PR inventory. An open PR is not automatically ready to merge; stacked dependencies, exact-head CI and explicit ownership still apply.

## Operating model

Ten continuous workstreams are active. Agents continue through their authorized queue without waiting for a previous PR to merge. The coordinator appends new phases to assignments; workers update only their own status files. A PR is a checkpoint, not an end-of-work signal.

GitHub coordination files do not wake inactive ChatGPT chats or run them in the background. To start an idle agent, the user must resume that chat and tell it to fetch the updated assignment/status from `main`.

## Ten-agent status and next work

| Agent | Role | Current evidence / status | Next authorized phase | New extension |
|---|---|---|---|---|
| 1 | QA / release reliability | AC-029–033 submitted as PRs #25, #32, #36, #42, #57. Ongoing renderer boundary QA is PR #61. PR #1 remains stale/overlapping. Nested QA tests and standalone lifecycle runner are not yet executed locally; do not claim those as passing. | Continue AC-033 / regression triage: review renderer boundary finding, port/track missing negative tests, coordinate QA suite discovery. | **AC-087** QA suite runner |
| 2 | Rendering / performance / navigation | AC-028/#18, AC-034/#34, AC-035/#43 and AC-036/#52 submitted. AC-028 real Chromium assertions passed; earlier benchmark is one-run evidence only. AC-036 custom matrix has local Chromium evidence, but its submitted branch needs exact-current-head revalidation. | **AC-037** large-canvas workload characterization, then AC-038 integration-readiness demo/package. | **AC-088** production-editor vs Canvas renderer workload study |
| 3 | Animation / export | PR #3 sprite-sheet exporter, #21 layout/metadata contract, #22 export planner and #55 compatibility/stress corpus. PR #55 reports exact-head workflow success (#325); PR #3/#21/#55 remain a dependency chain. Agent status file is stale at AC-027; reconcile and release workflow lock only when AC-027 CI wiring is complete. | **AC-042** export format documentation/gallery after completing AC-041. | **AC-089** async, cancellable export API |
| 4 | Agent API / MCP | PR #8 bridge hardening, #38 deadlines/cancellation and #54 cross-process profile lock. PR #38 reports full CI on its stacked head; PR #54 is stacked on #38/#8. Status file is stale at AC-004; update with current head/CI and resolve PR #1's non-duplicative assertions. | **AC-045** security/input hardening after AC-044; continue AC-046–048. | **AC-090** read-only local bridge doctor |
| 5 | UX / interaction design / accessibility | AC-026, AC-049–054 submitted via PRs #20, #24, #30, #35, #41, #47 and #51. AC-054 roadmap is the latest reported deliverable. No production UI ownership has been granted. | New design deliverable; preserve all existing UX specs and acceptance criteria. | **AC-091** professional workstation design system + interactive prototype |
| 6 | Editing safety / safe mutation | PRs #14, #23, #26, #40, #48, #49 and #29 cover guard, transactions, browser denial harness, import staging, integration contract and mutation-path audit. PR #40's custom browser harness has not itself been executed; standard editor E2E is not a substitute. Status file is stale at AC-015. | Existing queue through AC-060 is submitted; update status/dependency chain and complete any missing custom-harness evidence. | **AC-092** seeded adversarial/property-style safe-edit tests |
| 7 | Tile workflows | PR #13 tile preview, #28 tile transforms and #58 tile-map model. Status file records AC-062 as latest; no blocker reported. | **AC-063** seam diagnostics/suggestions, then AC-064–066. | **AC-093** autotile rule resolver |
| 8 | Palette tooling / color science | PRs #16, #27, #33, #39, #45, #53, #56 and #60 cover formats, analysis, color conversion, transformations, mapping, accessibility, corpus and workflow contract. Status file is stale at AC-017. | Existing queue through AC-073 is submitted; reconcile all branches/CI and update status. | **AC-094** opt-in CIEDE2000 perceptual matching |
| 9 | Project diagnostics / developer tooling | PR #12 inspector, #46 batch inspection and #59 structural diff. AC-018 and AC-074 exact-head CI were recorded as successful; #46/#59 are stacked on #12. | **AC-076** deep diagnostics/risk scoring, then AC-077–079. | **AC-095** project fingerprint/duplicate detection |
| 10 | Pixel-art algorithms | PRs #15, #31, #37, #44 and #50 cover craft effects, raster primitives, flood/regions, color/gradients and transforms. PR #50 is AC-083; status file is stale at AC-082. | **AC-084** advanced dithering/shading, then AC-085–086. | **AC-096** deterministic Bézier curve rasterization |

### Status reconciliation required on next resume

- **Agent 3:** status still reports AC-027 while PR #55 is already AC-041.
- **Agent 4:** status still reports AC-004 while PRs #38 and #54 cover AC-043/044.
- **Agent 6:** status still reports AC-015 while PRs #23/#26/#29/#40/#48/#49 cover later phases.
- **Agent 8:** status still reports AC-017 while PRs #27/#33/#39/#45/#53/#56/#60 cover AC-067–073.
- **Agent 10:** status still reports AC-082 while PR #50 covers AC-083.
- **Agent 1:** PR #61 is not yet reflected in the previously fetched status file.
- All workers must update only their own status files with the current branch/head, parent chain, exact tested SHA, CI state, completed phases and next 3–5 actions.

## Open PR inventory (52 open at this snapshot)

| Owner | Open PRs |
|---|---|
| Agent 1 | #1 (stale/overlapping), #25, #32, #36, #42, #57, #61 |
| Agent 2 | #18, #34, #43, #52 |
| Agent 3 | #3, #21, #22, #55 |
| Agent 4 | #8, #38, #54 |
| Agent 5 | #9, #20, #24, #30, #35, #41, #47, #51 |
| Agent 6 | #14, #23, #26, #29, #40, #48, #49 |
| Agent 7 | #13, #28, #58 |
| Agent 8 | #16, #27, #33, #39, #45, #53, #56, #60 |
| Agent 9 | #12, #46, #59 |
| Agent 10 | #15, #31, #37, #44, #50 |

Merged coordination/feature checkpoints include PRs #6 (Canvas renderer module), #7 (coordination system), #10 (recovery snapshot fix) and #11 (animated GIF exporter). No claim is made that these isolated modules are integrated into production UI.

## Dependency chains and merge cautions

- **Exporter:** PR #3 is the base for PR #21; PR #55 is stacked on #21. Verify the parent chain and full browser PNG proof before merging descendants. PR #22 must be reviewed on its own base/head.
- **Bridge:** PR #38 is stacked on PR #8; PR #54 is stacked on #38. Keep the shared `agent-bridge/e2e-test.mjs` lock with Agent 4 while PR #8 is reconciled.
- **Safe editing:** PR #23 extends PR #14; PR #26 extends the safety contract; PR #40 and #48 are stacked on #26; PR #49 follows PR #48. PR #40 still lacks execution evidence for its custom browser runner.
- **Diagnostics:** PR #46 is stacked on PR #12; PR #59 is stacked on PR #46. Do not merge descendants ahead of parents or retarget until the parent chain is accepted.
- **Tile:** PR #13, #28 and #58 are distinct phase deliverables; inspect exact branch bases and changed-file boundaries before review.
- **Palette:** review each PR against its actual base; PR #56 has a parent dependency on the formats work. Do not infer all follow-ons are stacked on PR #16.
- **QA:** PR #1 overlaps the shared persistence/E2E history. Agent 4 must confirm the non-duplicative frame-aware assertions are present in PR #8; then coordinator can close #1 as duplicate/superseded if appropriate.

## Shared-file locks (still in force)

- **`.github/workflows/project-tests.yml`:** Agent 3 is sole writer for AC-027 sprite-sheet browser verification/CI wiring. Agent 2 may run/prepare renderer harnesses but must not edit the workflow until Agent 3 explicitly releases it.
- **`agent-bridge/e2e-test.mjs`:** Agent 4 is sole writer while reconciling PR #8 and preserving PR #10 recovery/frame-aware assertions. Agent 1's QA work is read-only with respect to this file.
- **Production UI / `index.html`:** coordinator-controlled. Agent 5's AC-091 prototype is under `docs/ux/**` only and does not grant production UI authority.
- **Project model/storage:** no agent may alter these shared foundations outside a future explicit coordinator assignment.
- One writer per shared file; a dependency waiting on review does not stop independent work in owned paths.

## Immediate coordinator priorities

1. Review the parent PRs with current exact-head evidence before stacked descendants: #8, #14, #3, #12 and #16.
2. Resolve PR #1 after confirming AC-025's unique assertions are represented in the current bridge E2E.
3. Review PR #40's custom runner limitation separately; do not treat standard E2E as its evidence.
4. Reconcile stale Agent 3/4/6/8/10 status files on their next resume.
5. Keep workflow and bridge E2E locks explicit and release them immediately when their named task is complete.
6. Plan the production UI integration only after safety, viewport/renderer, timeline and export contracts have current review evidence. AC-091 is prototype-only.

## New coordinator-assigned extensions

The coordinator has appended one additional phase per agent: AC-087 through AC-096. Canonical details, paths and acceptance criteria are in each `coordination/assignments/agent-N.md` and indexed in `coordination/BACKLOG.md`. These additions do not supersede unfinished earlier phases or relax file ownership.

## Evidence rules and product constraints

- Passing CI applies only to the exact SHA tested. Any branch sync requires new exact-head validation.
- Distinguish Node unit tests, standalone custom browser runners, standard Chromium editor E2E, MCP E2E, CI and measured benchmarks.
- No benchmark claim without repeated representative measurements and raw samples.
- No feature is "integrated" because an isolated module or prototype exists.
- Keep plain JavaScript, local-first/GitHub Pages compatibility, bounded allocations, deterministic pixel values, integer pixel boundaries and no silent project mutation.
- Never add mandatory backend, login, cloud service, network runtime dependency or paid service for core editor use.

## Source of truth

The full scope and file ownership live in:
- `coordination/assignments/agent-1.md` through `agent-10.md`
- `coordination/BACKLOG.md`
- `coordination/DECISIONS.md`

Workers update only their own `coordination/status/agent-N.md`; the coordinator maintains this board.
