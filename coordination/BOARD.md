# Art Club coordination board

Coordinator snapshot: 2026-11-14  
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
| 1 | QA / release reliability | PR #1 read-only audit, then regression matrix | AC-025, AC-029–033 | tests/qa/**, QA fixtures, release QA docs/tool |
| 2 | Rendering / performance | Browser renderer validation, then viewport + adapter | AC-028, AC-034–038 | Canvas renderer, viewport/adapter, renderer browser tests/benchmarks/docs |
| 3 | Animation / export | Refresh GIF PR, then sprite-sheet verification and export subsystem | AC-011, AC-027, AC-039–042 | GIF/sprite-sheet modules, export tests, workflow while PR #11 lock active |
| 4 | Agent API / MCP | Reconcile PR #8, then reliability/security/resilience program | AC-004, AC-043–048 | AGENT_API.md, agent-bridge/**, js/agent-api.js, bridge-related index.html |
| 5 | UX / accessibility | Keyboard spec, then complete UX spec/prototype pack | AC-026, AC-049–054 | KEYBOARD_SHORTCUTS_PLAN.md, docs/ux/**, static prototypes |
| 6 | Editing safety | Fix sparse cel validation, then immutable safe-edit transaction subsystem | AC-015, AC-055–060 | layer guard, safe-edit/import staging modules, tests/docs |
| 7 | Tile workflows | Refresh tile PR, then transforms, map model, atlas planning | AC-016, AC-061–066 | tile-preview/transform/map modules, tests/docs |
| 8 | Palette tooling | Refresh palette PR, then analysis/color science/transforms | AC-017, AC-067–073 | palette-formats/tools modules, tests/docs |
| 9 | Project diagnostics | Refresh inspector PR, then batch/diff/deep diagnostics | AC-018, AC-074–079 | tools/project-inspector, tests/fixtures, diagnostics docs |
| 10 | Pixel algorithms | Refresh pixel-effects PR, then raster primitives/fill/transforms | AC-019, AC-080–086 | js/pixel-* modules, tests/fixtures, algorithm docs |

All phase IDs above are authorized by the current assignments. The coordinator need not approve each one separately.

## Current PR inventory

| PR | Deliverable | Current state |
|---|---|---|
| #1 | Frame-aware persistence QA | Open draft; Agent 1 read-only coverage audit; Agent 4 retains shared bridge E2E writer lock |
| #3 | Sprite-sheet PNG exporter | Open draft; Agent 3's later AC-027 phase adds real-browser full-raster/metadata verification |
| #6 | Canvas renderer prototype | Merged; isolated module only; DOM renderer remains active; benchmark unmeasured |
| #7 | Coordination system | Merged; all active coordination now on main |
| #8 | Agent API/MCP hardening | Open draft; sync/reconcile main and preserve PR #10 E2E assertions |
| #9 | UX implementation roadmap | Open draft; docs review accepted; new AC-026–054 workstream assigned |
| #10 | Recovery snapshot fix | Merged; Issue #2 closed completed |
| #11 | Animated GIF exporter | Open, ready for review; prior tested head passed 48 Node tests, Chromium editor E2E, GIF full-raster ImageDecoder and MCP; refresh latest main |
| #12 | Project inspector CLI | Open draft; earlier Node passed, browser failure predates PR #10; sync and rerun |
| #13 | Tile preview | Open draft; earlier Node passed, browser failure predates PR #10; sync and rerun |
| #14 | Layer-edit safety guard | Open draft; one outstanding sparse/undefined cel validation correction |
| #15 | Pixel algorithms | Open draft; earlier browser failure predates PR #10; sync and rerun |
| #16 | GPL/JASC-PAL/JSON palettes | Open, ready for review; prior run passed 53 Node tests, Chromium E2E and MCP; refresh latest main |

Merged feature PRs: #6 and #10. Coordination PR #7 is also merged. Do not infer UI integration from isolated modules.

## Immediate priorities

1. Agent 4 reconciles PR #8 with PR #10's recovery E2E and runs full Node/Chromium/MCP checks.
2. Agent 3 refreshes PR #11 against current main; then continues AC-027 on PR #3 without waiting for merge.
3. Agent 6 fixes sparse/undefined pixel validation in PR #14 and continues safe-edit transaction work.
4. Agents 7–10 refresh their PRs and rerun full current-head CI; after that they move to their next modules.
5. Agents 1, 2 and 5 proceed with their expanded QA, renderer and UX queues.

## Shared-file locks

- **Bridge E2E:** Agent 4 is sole writer of agent-bridge/e2e-test.mjs while PR #8 is reconciled. Agent 1's PR #1 audit is read-only.
- **Workflow:** Agent 3 owns .github/workflows/project-tests.yml while PR #11 is being reconciled. Agent 2 can prepare browser harnesses/docs but cannot edit the workflow until Agent 3 releases it.
- **UI:** index.html and production UI wiring remain coordinator-controlled. No worker implicitly acquires a UI lock.
- **Module files:** each agent's assignment lists their exclusive module/test/doc paths. Do not edit another agent's paths.

## Evidence and policy

- PR #10 run #108 passed 36 Node tests, Chromium/IndexedDB recovery E2E and MCP E2E.
- PR #6 run #43605014989 passed 58 Node tests, Chromium editor E2E and MCP E2E. Benchmark still unmeasured.
- PR #11 run #43605119104 passed 48 Node tests, Chromium editor E2E, full-raster GIF decode and MCP E2E.
- PR #16 run #43605193529 passed 53 Node tests, Chromium editor E2E and MCP E2E.
- PR #12/#13/#14/#15 earlier browser runs predate PR #10; revalidate on latest main without weakening assertions.
- PR #8 still documents no hard operation timeout/cancellation and no cross-process lock until its follow-on phases implement and test them.
- Every CI claim must identify the tested commit SHA. Rerun after base changes.
- Plain JavaScript, deterministic pixels, bounded allocation, local-first behavior and no silent data mutation remain mandatory.

## Source of truth

The detailed phase descriptions and per-agent file boundaries are in coordination/assignments/agent-1.md through agent-10.md. The long-range phase index is coordination/BACKLOG.md. Shared rules are in coordination/DECISIONS.md. This board is a concise status/index, not a replacement for the complete assignment.
