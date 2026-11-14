# Art Club coordination board

Coordinator snapshot: 2026-11-14 — refreshed after PR #11 merge  
Repository: faiev/ArtClub  
Coordination source: main  
Workstream assignments and autonomy protocol: updated on main

> This board tracks ten continuous workstreams. A PR awaiting review is not a reason for an agent to stop.

## Operating model

Every agent has a multi-phase, pre-authorized queue in coordination/assignments/agent-N.md. After submitting one coherent PR, the agent continues to the next unfinished, unblocked phase on a separate branch. They do not ask the coordinator for another task between phases. Status files must list the next 3–5 actions.

This avoids coordinator approval between routine deliverables. It does not wake inactive chats or provide background execution; the user still needs to resume a chat that is idle.

## Ten-agent workstream board

| Agent | Role | Current workstream | Long queue | Main file ownership |
|---|---|---|---|---|
| 1 | QA / release reliability | AC-025 audit complete; begin lifecycle/migration QA matrix | AC-025, AC-029–033 | tests/qa/**, QA fixtures, release QA docs/tool |
| 2 | Rendering / performance | PR #18 harness prepared; execute real-browser assertions/benchmarks, then viewport + adapter | AC-028, AC-034–038 | Canvas renderer, viewport/adapter, renderer browser tests/benchmarks/docs |
| 3 | Animation / export | PR #11 merged; AC-027 sprite-sheet browser verification/CI, then AC-039–042 | AC-011, AC-027, AC-039–042 | GIF/sprite-sheet modules, export tests, workflow while PR #11 lock active |
| 4 | Agent API / MCP | Refresh PR #8 and port PR #1's non-duplicative QA assertions; continue AC-043–048 | AC-004, AC-043–048 | AGENT_API.md, agent-bridge/**, js/agent-api.js, bridge-related index.html |
| 5 | UX / accessibility | PR #20 keyboard spec submitted; continue AC-049–054 | AC-026, AC-049–054 | KEYBOARD_SHORTCUTS_PLAN.md, docs/ux/**, static prototypes |
| 6 | Editing safety | Sparse-array correction submitted in PR #14; continue AC-055–060 while PR refreshes | AC-015, AC-055–060 | layer guard, safe-edit/import staging modules, tests/docs |
| 7 | Tile workflows | PR #13 submitted; continue AC-061–066 while PR refreshes | AC-016, AC-061–066 | tile-preview/transform/map modules, tests/docs |
| 8 | Palette tooling | PR #16 submitted; continue AC-067–073 while PR refreshes | AC-017, AC-067–073 | palette-formats/tools modules, tests/docs |
| 9 | Project diagnostics | PR #12 submitted; continue AC-074–079 while PR refreshes | AC-018, AC-074–079 | tools/project-inspector, tests/fixtures, diagnostics docs |
| 10 | Pixel algorithms | PR #15 submitted; continue AC-080–086 while PR refreshes | AC-019, AC-080–086 | js/pixel-* modules, tests/fixtures, algorithm docs |

All phase IDs above are authorized by the current assignments. The coordinator need not approve each one separately.

## Current PR inventory

| PR | Deliverable | Current state |
|---|---|---|
| #1 | Frame-aware persistence QA | Open draft but stale/overlapping; AC-025 audit complete; Agent 4 must port useful assertions into #8 and then coordinator can close #1 |
| #3 | Sprite-sheet PNG exporter | Open draft; AC-027 adds browser PNG full-raster verification; currently Node/fixture checks pass but real Chromium decode remains unverified |
| #6 | Canvas renderer prototype | Merged; isolated module only; DOM renderer remains active; benchmark unmeasured |
| #7 | Coordination system | Merged; all active coordination now on main |
| #8 | Agent API/MCP hardening | Open draft; sync/reconcile main and preserve PR #10 E2E assertions |
| #9 | UX implementation roadmap | Open draft; docs review accepted; new AC-026–054 workstream assigned |
| #10 | Recovery snapshot fix | Merged; Issue #2 closed completed |
| #11 | Animated GIF exporter | **Merged** as `d691bf86cec76c4d5742289b0d97f92e0e7952b8`; exact-head CI run #178 passed 70 Node tests, Chromium editor E2E, full-raster GIF ImageDecoder and MCP |
| #12 | Project inspector CLI | Open draft; 67 Node tests + Chromium + MCP passed on submitted head; branch is 3 commits behind/diverged from current main; sync and rerun |
| #13 | Tile preview | Open draft; 69 Node + Chromium + MCP passed on submitted head; now needs sync/retest after PR #11 main update |
| #14 | Layer-edit safety guard | Open; indexed own-slot validation rejects sparse/undefined; 71 Node + Chromium + MCP passed on submitted head; sync/retest after PR #11 |
| #15 | Pixel algorithms | Open draft; 79 Node + Chromium + MCP passed on submitted head; 27 commits behind/diverged from current main; sync and rerun |
| #16 | GPL/JASC-PAL/JSON palettes | Open; 75 Node + Chromium + MCP passed on submitted head; 20 commits behind/diverged from current main; sync and rerun |

Merged feature PRs: #6, #10 and #11. Coordination PR #7 is also merged. Do not infer UI integration from isolated modules.

## Immediate priorities

1. Agent 3 completes AC-027: run the sprite-sheet browser PNG decoder against the 7×7 fixture, wire it into the workflow, then release the workflow lock.
2. Agent 4 refreshes PR #8 to current main, integrates AC-025's useful import/autosave/frame assertions, and reruns Node/Chromium/MCP; continue AC-043 independently.
3. Agents 6 and 7 refresh PRs #14/#13 after PR #11, rerun required CI and continue their next modules.
4. Agents 8–10 refresh PRs #16/#12/#15 (large divergence for #15), rerun current-head CI, and continue their next modules.
5. Agents 1, 2 and 5 continue AC-029, AC-028/034 and AC-049 respectively; no idle on review.

## Shared-file locks

- **Bridge E2E:** Agent 4 is sole writer of agent-bridge/e2e-test.mjs while PR #8 is reconciled. Agent 1's PR #1 audit is read-only.
- **Workflow:** Agent 3 owns .github/workflows/project-tests.yml while PR #11 is being reconciled. Agent 2 can prepare browser harnesses/docs but cannot edit the workflow until Agent 3 releases it.
- **UI:** index.html and production UI wiring remain coordinator-controlled. No worker implicitly acquires a UI lock.
- **Module files:** each agent's assignment lists their exclusive module/test/doc paths. Do not edit another agent's paths.

## Evidence and policy

- PR #10 run #108 passed 36 Node tests, Chromium/IndexedDB recovery E2E and MCP E2E.
- PR #6 run #43605014989 passed 58 Node tests, Chromium editor E2E and MCP E2E. Benchmark still unmeasured.
- PR #11 current-head run #43607535398 passed 70 Node tests, Chromium editor E2E, full-raster GIF decode and MCP E2E; merged as `d691bf86cec76c4d5742289b0d97f92e0e7952b8`.
- PR #16 run #43605193529 passed 53 Node tests, Chromium editor E2E and MCP E2E.
- PR #12/#13/#14/#15/#16/#18/#20 must be refreshed/reconciled to current main and rerun where their base is stale; do not weaken assertions to obtain green CI.
- PR #8 still documents no hard operation timeout/cancellation and no cross-process lock until its follow-on phases implement and test them.
- PR #18's new renderer-specific Chromium suite/benchmark is not yet executed; existing green editor E2E is not evidence for that harness. PR #3's sprite-sheet browser harness is also not yet executed in real Chromium.
- PR #21 is stacked on PR #3; do not merge it independently until its parent dependency is accepted or keep the stacked relationship explicit.
- Every CI claim must identify the tested commit SHA. Rerun after base changes.
- Plain JavaScript, deterministic pixels, bounded allocation, local-first behavior and no silent data mutation remain mandatory.

## Source of truth

The detailed phase descriptions and per-agent file boundaries are in coordination/assignments/agent-1.md through agent-10.md. The long-range phase index is coordination/BACKLOG.md. Shared rules are in coordination/DECISIONS.md. This board is a concise status/index, not a replacement for the complete assignment.
