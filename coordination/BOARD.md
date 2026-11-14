# Art Club coordination board

Coordinator snapshot: 2026-11-14  
Repository: [faiev/ArtClub](https://github.com/faiev/ArtClub)  
Default branch: `main`  
Current main commit: `57b4da3cf9be2a9a4b1c98fea942729e42314d54` (PR #10 merged)  
Bootstrap coordination ref: `coordination/orchestration-v2` (PR #7 not yet merged)

> The coordinator owns this board. Worker updates belong in their individual status files.

## Team status and active assignments

| Agent | Role | Active task | Feature branch | Current state |
|---|---|---|---|---|
| 1 | QA / release | AC-025 — Audit unique QA coverage in PR #1 after AC-006 merge (read-only) | `agent/qa-release` | `READY` |
| 2 | Rendering / performance | AC-010 — Correct renderer validation and invalidation gaps | `agent/canvas-renderer` | `REVIEW` — changes requested on PR #6 |
| 3 | Animation / export | AC-011 — Correct GIF quantization, browser raster checks and memory budget | `agent/gif-export` | `REVIEW` — changes requested on PR #11 |
| 4 | Agent bridge / MCP | AC-004 — Reconcile bridge PR with merged recovery/E2E changes | `agent/bridge-hardening` | `REVIEW` — update branch and revalidate PR #8 |
| 5 | UX / product | AC-026 — Keyboard shortcuts and command-discoverability specification | `agent/keyboard-shortcuts-plan` | `READY` |
| 6 | Editing safety | AC-015 — Reject sparse/undefined cel buffers in layer guard | `agent/layer-safety` | `REVIEW` — one validation correction requested on PR #14 |
| 7 | Tile workflows | AC-016 — Tiled preview and seam diagnostics | `agent/tile-preview` | `REVIEW` — isolated module review positive; sync/retest |
| 8 | Palette interoperability | AC-017 — GPL, JASC-PAL and JSON palette formats | `agent/palette-formats` | `IN_PROGRESS` |
| 9 | Project diagnostics | AC-018 — Read-only project inspector CLI | `agent/project-inspector` | `REVIEW` — isolated module review positive; sync/retest |
| 10 | Pixel-art algorithms | AC-019 — Symmetry, outlines, shading and dithering | `agent/pixel-effects` | `IN_PROGRESS` |

**All ten agents have actionable work.** Agents 1 and 5 have new assignments; Agents 2–4 and 6–9 have concrete review/fix/revalidation actions; Agents 8 and 10 continue implementation.

## Current pull requests

| PR | Work | Current state / coordinator note |
|---|---|---|
| [#1](https://github.com/faiev/ArtClub/pull/1) | Frame-aware persistence QA | Open draft; 3 ahead / 4 behind main. Agent 1 audits unique assertions read-only; no E2E edits while Agent 4 owns the shared bridge test file. |
| [#3](https://github.com/faiev/ArtClub/pull/3) | Sprite-sheet PNG exporter | Open draft; 3 ahead / 4 behind main. Needs branch refresh and real-browser decoded PNG/raster verification before integration. |
| [#6](https://github.com/faiev/ArtClub/pull/6) | Canvas 2D renderer | Open draft; 12 ahead / 0 behind at last comparison. Changes requested: reject sparse/undefined pixels, enforce allocation limits, test full invalidation for frame/onion changes. No benchmark measurement yet. |
| [#7](https://github.com/faiev/ArtClub/pull/7) | Ten-agent coordination system | Open draft; 54 ahead / 1 behind main at last comparison. Coordinator is refreshing board/decisions before enabling merge. |
| [#8](https://github.com/faiev/ArtClub/pull/8) | MCP / Agent API hardening | Open draft; 22 ahead / 1 behind main. Must reconcile `agent-bridge/e2e-test.mjs` with merged PR #10, preserve recovery coverage and rerun unit/browser/MCP checks. |
| [#9](https://github.com/faiev/ArtClub/pull/9) | UX implementation roadmap | Open draft; 1 ahead / 1 behind main. Documentation review accepted; sync branch before final integration. |
| [#10](https://github.com/faiev/ArtClub/pull/10) | Recovery snapshot rotation fix | **Merged** as `57b4da3cf9be2a9a4b1c98fea942729e42314d54`. |
| [#11](https://github.com/faiev/ArtClub/pull/11) | Animated GIF exporter | Open draft; 6 ahead / 1 behind main. Changes requested for quantization mapping, full-raster browser verification and peak memory. |
| [#12](https://github.com/faiev/ArtClub/pull/12) | Project inspector CLI | Open draft; 1 ahead / 1 behind main. Node job passed (43 tests); prior browser job hit the persistence assertion now fixed by PR #10. Sync and rerun full workflow. |
| [#13](https://github.com/faiev/ArtClub/pull/13) | Tile preview / seam diagnostics | Open draft; 1 ahead / 1 behind main. Node job passed; prior browser job hit the persistence assertion now fixed by PR #10. Sync and rerun full workflow. |
| [#14](https://github.com/faiev/ArtClub/pull/14) | Layer-edit safety guard | Open draft; 1 ahead / 1 behind main. Node job passed (45 tests); changes requested for sparse cel buffer validation. |

All PR states and ahead/behind counts above are from the latest coordinator verification; refresh before any merge. PRs #1, #3, #6–#9 and #11–#14 remain unmerged.

## Active task table

| Task | Owner | State | Acceptance / next action |
|---|---|---|---|
| AC-004 — MCP/API hardening | Agent 4 | `IN_REVIEW` | Sync PR #8 after PR #10; preserve all browser recovery and bridge assertions; fresh full CI |
| AC-006 — Recovery snapshot rotation | Agent 1 | `MERGED` | PR #10 merged; Issue #2 closed as completed |
| AC-009 — UX implementation roadmap | Agent 5 | `REVIEW_ACCEPTED` | Documentation deliverable accepted; follow-up AC-026 assigned |
| AC-010 — Renderer prototype | Agent 2 | `CHANGES_REQUESTED` | Validate pixels fail-closed; allocation bounds; frame/onion invalidation tests |
| AC-011 — Animated GIF export | Agent 3 | `CHANGES_REQUESTED` | Correct actual-RGB quantization; full decoded raster; memory budget |
| AC-015 — Layer-edit safety guard | Agent 6 | `CHANGES_REQUESTED` | Reject sparse holes/undefined cel entries and add regression |
| AC-016 — Tile preview engine | Agent 7 | `REVIEW` | Module review positive; sync main and rerun complete CI |
| AC-017 — Palette formats | Agent 8 | `IN_PROGRESS` | Submit tested GPL/JASC-PAL/JSON module |
| AC-018 — Project inspector | Agent 9 | `REVIEW` | Module review positive; sync main and rerun complete CI |
| AC-019 — Pixel-art algorithms | Agent 10 | `IN_PROGRESS` | Submit tested symmetry/outline/shading/dithering module |
| AC-025 — PR #1 QA coverage audit | Agent 1 | `READY` | Read-only report identifying unique assertions and safe disposition after PR #10 |
| AC-026 — Keyboard-shortcut specification | Agent 5 | `READY` | Implementation-ready shortcut/conflict/help/test specification; no app code |

## File ownership and integration locks

| Agent | Owned files for active task |
|---|---|
| 1 | Read-only review of PR #1; no application files during AC-025 |
| 2 | `js/canvas-renderer.js`, renderer tests, `benchmarks/*`, `docs/rendering-architecture.md` |
| 3 | `js/gif-export.js`, GIF tests/browser verification/docs; sprite-sheet PR #3 remains a separate submitted deliverable |
| 4 | `AGENT_API.md`, `agent-bridge/*`, `js/agent-api.js`, bridge-related `index.html` edits |
| 5 | `KEYBOARD_SHORTCUTS_PLAN.md` only |
| 6 | `js/layer-edit-guard.js`, its tests and safety documentation |
| 7 | `js/tile-preview.js`, its tests and documentation |
| 8 | `js/palette-formats.js`, its tests and documentation |
| 9 | `tools/project-inspector.mjs`, its tests/fixtures and documentation |
| 10 | `js/pixel-effects.js`, its tests and documentation |

**Single-writer rule:** Agent 4 is the only worker authorized to edit `agent-bridge/e2e-test.mjs` during PR #8 reconciliation. Agent 1's PR #1 audit is read-only. PR #10's recovery E2E fix is already on main and must be preserved. No other worker may change the shared E2E file without a new coordinator lock.

**UI lock:** `index.html` remains coordinator-controlled for future UI integrations. No Canvas, GIF, sprite-sheet, tile, palette or pixel-effects UI integration is authorized yet.

## Verified CI facts and known limitations

- PR #10 run #108 on its exact head passed: 36 Node tests, Chromium/IndexedDB E2E and MCP E2E. This PR is merged.
- PR #12 run #109: Node job passed (43 tests); browser job failed on the old frame-selection persistence assertion before MCP E2E.
- PR #13 run #110: Node job passed; browser job failed on the same old persistence assertion before MCP E2E.
- PR #14 run #111: Node job passed (45 tests); browser job failed on the same old persistence assertion before MCP E2E.
- Those PR #12–#14 browser results predate the PR #10 fix now on main. Their branches need to sync with main and rerun before acceptance.
- PR #6 has no trustworthy renderer benchmark measurements. No performance improvement is claimed.
- PR #8 has no hard per-operation timeout/cancellation or cross-process lock; a forced-crash recovery scenario is not yet browser-E2E tested.
- Isolated modules do not become user-facing features until separately integrated and browser-tested.

## Dependencies

- AC-006 is integrated; Issue #2 is closed.
- AC-004 PR #8 may proceed after updating against PR #10's merged E2E state. It is not a dependency for Agents 6–10.
- AC-015, AC-016, AC-017, AC-018 and AC-019 remain isolated modules. Their later UI integrations require a coordinator-assigned owner and exclusive shared-file lock.
- AC-010 renderer integration (AC-012) remains deferred pending correctness review, browser parity and actual benchmark evidence.
- GIF/sprite-sheet UI and MCP integration (AC-007) remains deferred pending exporter review and accepted bridge contract.
- AC-025 is read-only and cannot modify shared E2E files.
- AC-026 is documentation/specification only and cannot edit app source or `index.html`.

See [BACKLOG.md](BACKLOG.md) and [DECISIONS.md](DECISIONS.md).
