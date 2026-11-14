# Art Club coordination board

Coordinator snapshot: 2026-11-14  
Repository: [faiev/ArtClub](https://github.com/faiev/ArtClub)  
Default branch / coordination source: `main`  
PR #7 merge commit: `f0c470392fe4411ca79b1d17bfe72e928af3be00`

> Coordinator owns this board. Workers update only their own status files.

## Ten-worker status and active assignments

| Agent | Role | Active task | Feature branch | State |
|---|---|---|---|---|
| 1 | QA / persistence | AC-025 — Read-only unique-assertion audit of PR #1 | `agent/qa-release` | `READY` — fetch updated assignment/status |
| 2 | Rendering / performance | AC-028 — Real-browser renderer validation and benchmark capture | `agent/renderer-browser-validation` | `READY` — branch created |
| 3 | Animation / export | Reconcile accepted AC-011 PR #11; then AC-027 sprite-sheet PNG verification in PR #3 | `agent/gif-export` then `agent/animation-export` | `REVIEW` — latest-main sync required |
| 4 | Agent bridge / MCP | AC-004 — Reconcile PR #8 with merged recovery/E2E changes | `agent/bridge-hardening` | `REVIEW` — current main sync and E2E reconciliation required |
| 5 | UX / product | AC-026 — Keyboard shortcut and command-discoverability specification | `agent/keyboard-shortcuts-plan` | `READY` — fetch updated assignment/status |
| 6 | Editing safety | AC-015 — Fix sparse/undefined cel validation and revalidate | `agent/layer-safety` | `CHANGES_REQUESTED` |
| 7 | Tile workflows | AC-016 — Sync current main and rerun full CI | `agent/tile-preview` | `REVIEW` |
| 8 | Palette interoperability | AC-017 — Sync current main and rerun full CI | `agent/palette-formats` | `REVIEW` |
| 9 | Project diagnostics | AC-018 — Sync current main and rerun full CI | `agent/project-inspector` | `REVIEW` |
| 10 | Pixel-art algorithms | AC-019 — Sync current main and rerun full CI | `agent/pixel-effects` | `REVIEW` |

All ten workers have actionable tasks. Do not wait for unrelated PRs.

## Current pull requests

| PR | Work | Current status / coordinator note |
|---|---|---|
| [#1](https://github.com/faiev/ArtClub/pull/1) | Frame-aware QA | Open draft, stale base. Agent 1 is auditing unique assertions read-only; Agent 4 owns shared E2E editing. |
| [#3](https://github.com/faiev/ArtClub/pull/3) | Sprite-sheet PNG exporter | Open draft, stale base. AC-027 adds real-browser decoded PNG/full-raster/metadata verification. |
| [#6](https://github.com/faiev/ArtClub/pull/6) | Canvas renderer prototype | **Merged** as `1ba0aaee597d5bf11083c97a03a312c7ee434530`. Isolated module only; DOM renderer remains active; benchmark not measured. |
| [#7](https://github.com/faiev/ArtClub/pull/7) | Ten-agent coordination system | **Merged** as `f0c470392fe4411ca79b1d17bfe72e928af3be00`. Coordination source is now main. |
| [#8](https://github.com/faiev/ArtClub/pull/8) | MCP / Agent API hardening | Open draft; stale base / not mergeable. Agent 4 must reconcile shared E2E with PR #10 and rerun full CI. |
| [#9](https://github.com/faiev/ArtClub/pull/9) | UX implementation roadmap | Open draft, stale base. Documentation review accepted; no app implementation authorized. |
| [#10](https://github.com/faiev/ArtClub/pull/10) | Recovery snapshot fix | **Merged** as `57b4da3cf9be2a9a4b1c98fea942729e42314d54`; Issue #2 closed as completed. |
| [#11](https://github.com/faiev/ArtClub/pull/11) | Animated GIF exporter | Open, ready, source review accepted. Run #119 passed 48 Node tests, Chromium editor E2E, complete GIF ImageDecoder raster verification and MCP. Sync with latest main after PR #6 before merge. |
| [#12](https://github.com/faiev/ArtClub/pull/12) | Read-only project inspector | Open draft; run #109 Node job passed (43 tests), browser job failed on old persistence assertion before PR #10. Sync main and rerun. |
| [#13](https://github.com/faiev/ArtClub/pull/13) | Tile preview / seam diagnostics | Open draft; run #110 Node job passed, browser job failed on old persistence assertion before PR #10. Sync main and rerun. |
| [#14](https://github.com/faiev/ArtClub/pull/14) | Layer-edit safety guard | Open draft; run #111 Node job passed (45 tests). Sparse-array validation correction required before acceptance. |
| [#15](https://github.com/faiev/ArtClub/pull/15) | Pixel-art algorithms | Open draft; run #43604907494 Node job passed, browser job failed on old persistence assertion before PR #10. Sync main and rerun. |
| [#16](https://github.com/faiev/ArtClub/pull/16) | GPL/JASC-PAL/JSON palettes | Open, ready, source review accepted. Run #120 passed 53 Node tests, Chromium editor E2E and MCP; sync main after PR #6 before merge. |

Only PRs #6, #7 and #10 are merged from this set. Merged modules do not imply UI integration.

## Active task table

| Task | Owner | State | Next action |
|---|---|---|---|
| AC-004 — MCP/API hardening | Agent 4 | `REVALIDATE` | Sync PR #8 with latest main; preserve recovery and bridge E2E assertions; full CI |
| AC-006 — Recovery snapshot rotation | Agent 1 | `MERGED` | Integrated; Issue #2 closed |
| AC-009 — UX implementation roadmap | Agent 5 | `REVIEW_ACCEPTED` | Documentation-only deliverable accepted |
| AC-010 — Canvas renderer prototype | Agent 2 | `MERGED` | Isolated prototype in main; no speedup claim |
| AC-011 — Animated GIF export | Agent 3 | `ACCEPTED_PENDING_SYNC` | Sync PR #11 with latest main and rerun complete CI |
| AC-015 — Layer safety guard | Agent 6 | `CHANGES_REQUESTED` | Indexed own-slot cel validation; sparse-hole and undefined regressions |
| AC-016 — Tile preview | Agent 7 | `REVALIDATE` | Sync latest main; full CI |
| AC-017 — Palette formats | Agent 8 | `ACCEPTED_PENDING_SYNC` | Sync latest main; full CI |
| AC-018 — Project inspector | Agent 9 | `REVALIDATE` | Sync latest main; full CI |
| AC-019 — Pixel-art algorithms | Agent 10 | `REVALIDATE` | Sync latest main; full CI |
| AC-025 — QA coverage audit | Agent 1 | `ASSIGNED` | Read-only PR #1 keep/drop report |
| AC-026 — Keyboard shortcut specification | Agent 5 | `ASSIGNED` | Platform-aware shortcut/focus/conflict/test specification |
| AC-027 — Sprite-sheet browser verification | Agent 3 | `QUEUED_AFTER_AC011_SYNC` | Chromium PNG full-raster and JSON metadata verification |
| AC-028 — Renderer browser validation | Agent 2 | `READY` | Chromium raster/overlay/pointer tests and benchmark evidence |

## File ownership and integration locks

| Agent | Owned files for active work |
|---|---|
| 1 | Read-only PR #1 review only; no E2E edits |
| 2 | AC-028 branch: renderer browser tests and benchmark validation docs; workflow step only after PR #11 merges and coordinator releases workflow lock |
| 3 | PR #11 GIF reconciliation; then PR #3 sprite-sheet exporter/browser tests |
| 4 | `AGENT_API.md`, `agent-bridge/*`, `js/agent-api.js`, bridge-related `index.html` edits |
| 5 | `KEYBOARD_SHORTCUTS_PLAN.md` only |
| 6 | `js/layer-edit-guard.js`, tests and docs |
| 7 | `js/tile-preview.js`, tests and docs |
| 8 | `js/palette-formats.js`, tests and docs |
| 9 | `tools/project-inspector.mjs`, tests/fixtures and docs |
| 10 | `js/pixel-effects.js`, tests and docs |

**Shared browser E2E:** Agent 4 is the sole worker authorized to edit `agent-bridge/e2e-test.mjs` while reconciling PR #8. Agent 1's AC-025 is read-only. Preserve PR #10 recovery regression. Rerun browser and MCP after combined changes.

**Workflow lock:** Agent 3 currently owns PR #11 changes to `.github/workflows/project-tests.yml`. Agent 2 may prepare browser test files but cannot edit that workflow until PR #11 merges and the coordinator releases it.

**UI lock:** `index.html` remains coordinator-controlled for future UI integrations. No new module-to-UI/API wiring is authorized yet.

## Evidence and integration policy

- PR #10 run #108 passed 36 Node tests, Chromium/IndexedDB recovery E2E and MCP E2E.
- PR #6 run #43605014989 passed 58 Node tests (22 renderer tests), Chromium editor E2E and MCP E2E. Benchmark remains unmeasured.
- PR #11 run #43605119104 passed 48 Node tests, Chromium editor E2E, GIF full-raster ImageDecoder verification and MCP E2E.
- PR #16 run #43605193529 passed 53 Node tests, Chromium editor E2E and MCP E2E.
- PR #12/#13/#14/#15 earlier browser results predate PR #10; revalidate after base update without weakening tests.
- PR #8 lacks a hard operation timeout/cancellation and cross-process lock; forced-crash reconnect remains untested.
- CI evidence applies only to the tested head/base. Repeat checks after branch/base updates.
- Isolated modules are not user-facing features until separately integrated and browser-tested.
