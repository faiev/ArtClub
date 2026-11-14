# Art Club coordination board

Coordinator snapshot: 2026-11-14  
Repository: [faiev/ArtClub](https://github.com/faiev/ArtClub)  
Default branch: `main`  
Snapshot main commit: `fe66725f7d010beca7ca60f497778d419e753d7b`

> The coordinator owns this board. Worker updates belong in their individual status files.

## Team status and active assignments

| Agent | Role | Active task | Feature branch | State |
|---|---|---|---|---|
| 1 | QA / release | AC-006 — Fix project recovery snapshot rotation | `agent/qa-recovery-snapshot` | `READY` |
| 2 | Rendering / performance | AC-010 — Validate renderer prototype and complete benchmark evidence | `agent/canvas-renderer` | `READY` — PR #6 exists |
| 3 | Animation / export | AC-011 — Implement standalone animated GIF export | `agent/gif-export` | `READY` |
| 4 | Agent bridge / MCP | AC-004 — Finalize, test and submit bridge/API hardening | `agent/bridge-hardening` | `READY` — existing branch needs reviewable handoff |
| 5 | UX / product | AC-009 — Convert UX audit into implementation-ready plan | `agent/ux-implementation-plan` | `READY` |
| 6 | Editing safety | AC-015 — Build layer-edit safety guard | `agent/layer-safety` | `READY` |
| 7 | Tile workflows | AC-016 — Build tiled preview and seam diagnostics | `agent/tile-preview` | `READY` |
| 8 | Palette interoperability | AC-017 — Import/export GPL, JASC-PAL and JSON palettes | `agent/palette-formats` | `READY` |
| 9 | Project diagnostics | AC-018 — Build read-only project inspector CLI | `agent/project-inspector` | `READY` |
| 10 | Pixel-art algorithms | AC-019 — Implement symmetry, outline, shading and dithering utilities | `agent/pixel-effects` | `READY` |

**All ten have actionable work. Do not make them wait for unrelated PR merges.** The only hard integration lock is on shared UI/API/bridge files.

## Current PRs

| PR | Work | Current note |
|---|---|---|
| [#1](https://github.com/faiev/ArtClub/pull/1) | Frame-aware persistence E2E QA | Draft; branch is behind current main. Review separately; Agent 1 can work on AC-006 on a fresh branch. |
| [#3](https://github.com/faiev/ArtClub/pull/3) | Sprite-sheet PNG exporter + JSON metadata | Draft; branch is behind current main. Agent 3's new GIF work is isolated from this PR. |
| [#5](https://github.com/faiev/ArtClub/pull/5) | First coordination attempt | Stale/diverged bootstrap branch; superseded by PR #7. |
| [#6](https://github.com/faiev/ArtClub/pull/6) | Canvas 2D renderer prototype | Draft; currently reports mergeable. Browser timing was not measured because Chromium hung in the agent's environment. The branch has a reproducible browser benchmark page; do not claim a measured speedup yet. |
| [#7](https://github.com/faiev/ArtClub/pull/7) | Current coordination system | New branch based on latest main; this is the bootstrap source of truth. |

## File ownership — do not overlap these edits

| Agent | Owned paths for current task |
|---|---|
| 1 | `js/project-storage.js`, new recovery tests, `agent-bridge/e2e-test.mjs` |
| 2 | `js/canvas-renderer.js`, `tests/canvas-renderer.test.js`, `benchmarks/*`, `docs/rendering-architecture.md` |
| 3 | `js/gif-export.js`, GIF-specific tests and GIF export documentation |
| 4 | `AGENT_API.md`, `agent-bridge/*`, `js/agent-api.js`, `tests/agent-api.test.js`, bridge-related `index.html` edits |
| 5 | `UX_IMPLEMENTATION_PLAN.md` only |
| 6 | `js/layer-edit-guard.js`, `tests/layer-edit-guard.test.js`, `docs/layer-edit-safety.md` |
| 7 | `js/tile-preview.js`, `tests/tile-preview.test.js`, `docs/tile-preview.md` |
| 8 | `js/palette-formats.js`, `tests/palette-formats.test.js`, `docs/palette-formats.md` |
| 9 | `tools/project-inspector.mjs`, its tests/fixtures and `docs/project-inspector.md` |
| 10 | `js/pixel-effects.js`, `tests/pixel-effects.test.js`, `docs/pixel-effects.md` |

Agent 1 must not edit `index.html` in this task. If a UI change becomes necessary, record it as a separate follow-up for the coordinator.

Agent 3 must not wire GIF into `index.html`, Agent API or MCP yet. Deliver the isolated encoder and API contract first.

Agent 4 must not edit project persistence or the renderer. Agent 2 must not integrate its renderer into `index.html` in this task.

## Active task table

| Task | Owner | State | Acceptance evidence |
|---|---|---|---|
| AC-006 — Recovery snapshot rotation fix | Agent 1 | `READY` | A → autosaved B → open library → Recover restores A; regression test passes |
| AC-010 — Renderer prototype validation | Agent 2 | `READY` | Correctness tests and reproducible browser benchmark harness/results; no unmeasured claims |
| AC-011 — Animated GIF export module | Agent 3 | `READY` | Browser-compatible GIF output with frame timing, loop, transparency behavior and tests |
| AC-004 — MCP/API hardening handoff | Agent 4 | `READY` | Reviewable PR, exact tests, API/error/concurrency contract and known risks |
| AC-009 — UX implementation plan | Agent 5 | `READY` | Five prioritized, dependency-aware implementation tasks based on UX_AUDIT.md |
| AC-015 — Layer-edit safety guard | Agent 6 | `READY` | Shared guard contract and tests for hidden/locked/missing layers |
| AC-016 — Tiled preview engine | Agent 7 | `READY` | Repeated pixel buffers and seam diagnostics |
| AC-017 — Palette file formats | Agent 8 | `READY` | GPL, JASC-PAL and JSON parsers/exporters with fixtures |
| AC-018 — Project inspector CLI | Agent 9 | `READY` | Read-only validation/summary tool for v2 and legacy projects |
| AC-019 — Pixel-art algorithms | Agent 10 | `READY` | Tested symmetry, outline, shading and ordered dithering utilities |

## Dependencies that are real

- AC-006, AC-010, AC-011 and AC-009 are independent and should proceed in parallel.
- AC-004 can proceed independently on its assigned bridge files. It is not a prerequisite for tests or isolated modules.
- Export UI/MCP integration and renderer UI integration are intentionally deferred until the isolated modules and bridge contract have been reviewed.
- Agents 6–10 own separate files and can proceed independently. Their deliverables are isolated libraries/diagnostic tools, not UI integrations; no shared editor files are currently assigned to them.
- A PR being behind main does not prevent a worker from continuing on a fresh branch or from preparing a non-conflicting follow-up.

See [BACKLOG.md](BACKLOG.md) for follow-on jobs and [DECISIONS.md](DECISIONS.md) for shared rules.
