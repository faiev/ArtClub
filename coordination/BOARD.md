# Art Club coordination board

Coordinator snapshot: 2026-11-14  
Repository: [faiev/ArtClub](https://github.com/faiev/ArtClub)  
Default branch: `main`  
Current main commit: `1ba0aaee597d5bf11083c97a03a312c7ee434530`  
Bootstrap coordination ref: `coordination/orchestration-v2` (PR #7 not yet merged)

> Coordinator owns this board. Workers update only their own status files.

## Ten-worker status and active assignments

| Agent | Role | Active task | Feature branch | State |
|---|---|---|---|---|
| 1 | QA / persistence | AC-025 — Read-only unique-assertion audit of PR #1 after AC-006 merge | `agent/qa-release` | `READY` — fetch updated assignment |
| 2 | Rendering / performance | AC-028 — Real-browser renderer validation and benchmark capture | `agent/renderer-browser-validation` | `READY` — branch created |
| 3 | Animation / export | AC-011 reconciliation of PR #11; next AC-027 sprite-sheet PNG browser verification | `agent/gif-export` then `agent/animation-export` | `REVIEW` — PR #11 accepted, needs main sync |
| 4 | Agent bridge / MCP | AC-004 — Reconcile PR #8 with merged recovery fix and current main | `agent/bridge-hardening` | `REVIEW` — needs shared E2E reconciliation |
| 5 | UX / product | AC-026 — Keyboard shortcut and command-discoverability spec | `agent/keyboard-shortcuts-plan` | `READY` — fetch updated assignment |
| 6 | Editing safety | AC-015 — Fix sparse/undefined cel validation, refresh base and retest | `agent/layer-safety` | `CHANGES_REQUESTED` |
| 7 | Tile workflows | AC-016 — Refresh base and rerun full CI for tile module | `agent/tile-preview` | `REVIEW` |
| 8 | Palette interoperability | AC-017 — Refresh base and rerun full CI for palette formats | `agent/palette-formats` | `REVIEW` |
| 9 | Project diagnostics | AC-018 — Refresh base and rerun full CI for inspector CLI | `agent/project-inspector` | `REVIEW` |
| 10 | Pixel-art algorithms | AC-019 — Refresh base and rerun full CI after recovery fix | `agent/pixel-effects` | `REVIEW` |

All ten have actionable work. No worker should wait for an unrelated PR.

## Current pull requests

| PR | Work | State / coordinator note |
|---|---|---|
| [#1](https://github.com/faiev/ArtClub/pull/1) | Frame-aware QA | Open draft; 3 commits ahead on stale base. Agent 1 performs read-only coverage audit; Agent 4 exclusively owns shared bridge E2E edits. |
| [#3](https://github.com/faiev/ArtClub/pull/3) | Sprite-sheet PNG exporter | Open draft; stale branch. Agent 3 will add real-browser decoded PNG/full-raster/metadata verification under AC-027 after GIF branch reconciliation. |
| [#6](https://github.com/faiev/ArtClub/pull/6) | Canvas renderer prototype | **Merged** as `1ba0aaee597d5bf11083c97a03a312c7ee434530`. Isolated module only; DOM renderer remains active; no speedup claim. |
| [#7](https://github.com/faiev/ArtClub/pull/7) | Ten-agent coordination system | Open, ready, unmerged; coordination branch is behind main after PR #10/#6. Merge commit must include latest main and preserve every worker status. |
| [#8](https://github.com/faiev/ArtClub/pull/8) | MCP / Agent API hardening | Open draft; branch stale and not mergeable. Agent 4 owns E2E reconciliation with PR #10. |
| [#9](https://github.com/faiev/ArtClub/pull/9) | UX implementation roadmap | Open draft; docs review accepted, stale base. |
| [#10](https://github.com/faiev/ArtClub/pull/10) | Recovery snapshot fix | **Merged** as `57b4da3cf9be2a9a4b1c98fea942729e42314d54`; Issue #2 closed completed. |
| [#11](https://github.com/faiev/ArtClub/pull/11) | Animated GIF exporter | Open, ready, review accepted; run #119 passed 48 tests, Chromium editor E2E, full-raster GIF decode and MCP. Now needs latest-main merge after PR #6 before merge. |
| [#12](https://github.com/faiev/ArtClub/pull/12) | Read-only project inspector | Open draft; run #109 Node passed (43 tests), browser failed on the now-fixed pre-PR10 persistence assertion. Refresh and rerun all jobs. |
| [#13](https://github.com/faiev/ArtClub/pull/13) | Tile preview / seam diagnostics | Open draft; run #110 Node passed, browser failed on the same pre-PR10 assertion. Refresh and rerun all jobs. |
| [#14](https://github.com/faiev/ArtClub/pull/14) | Layer-edit safety guard | Open draft; run #111 Node passed. Changes still required: reject sparse cel pixel arrays/undefined. Refresh and rerun all jobs after fix. |
| [#15](https://github.com/faiev/ArtClub/pull/15) | Pixel-art algorithms | Open draft; run #109? Actual run #43604907494 passed Node, failed old persistence E2E before MCP. Refresh and rerun all jobs. |
| [#16](https://github.com/faiev/ArtClub/pull/16) | GPL/JASC-PAL/JSON palettes | Open, ready, review accepted; run #120 passed 53 Node tests, Chromium editor E2E and MCP. Needs latest-main refresh after PR #6 before merge. |

PR #6 and #10 are the only merged feature PRs from this queue. No module below is wired to editor UI unless separately stated.

## Active task table

| Task | Owner | State | Acceptance / next action |
|---|---|---|---|
| AC-004 — MCP/API hardening | Agent 4 | `REVALIDATE` | Sync PR #8 to current main; preserve recovery and bridge E2E assertions; full CI |
| AC-006 — Recovery snapshot rotation | Agent 1 | `MERGED` | PR #10 integrated; Issue #2 closed |
| AC-009 — UX roadmap | Agent 5 | `REVIEW_ACCEPTED` | Documentation deliverable accepted; no application code |
| AC-010 — Canvas renderer prototype | Agent 2 | `MERGED` | Isolated prototype in main; no UI integration or speedup claim |
| AC-011 — GIF exporter | Agent 3 | `ACCEPTED_PENDING_SYNC` | Merge latest main into PR #11 and rerun full CI |
| AC-015 — Layer safety guard | Agent 6 | `CHANGES_REQUESTED` | Replace `.some()` cel validation with indexed own-slot validation; test sparse hole and undefined |
| AC-016 — Tile preview | Agent 7 | `REVALIDATE` | Sync current main and full CI |
| AC-017 — Palette formats | Agent 8 | `ACCEPTED_PENDING_SYNC` | Sync current main and full CI |
| AC-018 — Project inspector | Agent 9 | `REVALIDATE` | Sync current main and full CI |
| AC-019 — Pixel effects | Agent 10 | `REVALIDATE` | Sync current main and full CI |
| AC-025 — QA coverage audit | Agent 1 | `ASSIGNED` | Read-only PR #1 keep/drop report |
| AC-026 — Keyboard shortcut spec | Agent 5 | `ASSIGNED` | Platform-aware shortcut/focus/conflict/test plan |
| AC-027 — Sprite-sheet browser verification | Agent 3 | `QUEUED_AFTER_AC011_SYNC` | Decoded PNG full-raster and JSON metadata verification for PR #3 |
| AC-028 — Renderer browser validation | Agent 2 | `READY` | Real Chromium raster/overlay/pointer validation and benchmark evidence |

## File ownership and integration locks

| Agent | Owned files for current task |
|---|---|
| 1 | Read-only PR #1 review only; no E2E edits |
| 2 | New AC-028 branch: renderer browser tests, benchmark validation docs; workflow edit only after PR #11 integration lock is released |
| 3 | PR #11 GIF exporter reconciliation; then PR #3 sprite-sheet exporter/browser tests |
| 4 | `AGENT_API.md`, `agent-bridge/*`, `js/agent-api.js`, bridge-related `index.html` edits |
| 5 | `KEYBOARD_SHORTCUTS_PLAN.md` only |
| 6 | Layer guard module/tests/docs only |
| 7 | Tile preview module/tests/docs only |
| 8 | Palette formats module/tests/docs only |
| 9 | Project inspector CLI/tests/fixtures/docs only |
| 10 | Pixel effects module/tests/docs only |

**Single writer for shared E2E:** Agent 4 alone may edit `agent-bridge/e2e-test.mjs` while reconciling PR #8. Agent 1's AC-025 review is read-only. Preserve PR #10 recovery regression. Rerun browser and MCP after combined changes.

**Workflow-file lock:** Agent 3 currently owns PR #11 changes to `.github/workflows/project-tests.yml`. Agent 2 may prepare browser harness files but must not edit that workflow until PR #11 is merged and the coordinator releases it.

**UI lock:** `index.html` remains coordinator-controlled for feature integration. No GIF, sprite-sheet, palette, tile, effects, layer safety or Canvas renderer UI integration is authorized yet.

## Decisions and CI policy

- PR #10 run #108: 36 Node tests; Chromium/IndexedDB recovery E2E and MCP E2E passed.
- PR #6 run #43605014989: 58 Node tests (22 renderer tests); Chromium editor E2E and MCP E2E passed. Benchmark remains unmeasured.
- PR #11 run #43605119104: 48 Node tests; Chromium editor E2E, full-raster GIF ImageDecoder verification and MCP E2E passed.
- PR #16 run #43605193529: 53 Node tests; Chromium editor E2E and MCP E2E passed.
- PR #12/#13/#14/#15 earlier browser failures happened before PR #10 was integrated. Revalidate after syncing to current main; do not weaken tests.
- PR #8 has no hard per-operation timeout/cancellation or cross-process lock; forced-crash reconnect remains untested.
- A successful CI run applies only to the tested head/base. Revalidate after a base change before merging.
- Isolated modules are not shipped user-facing features until separately integrated and browser-tested.

## Dependencies

- AC-006 is integrated.
- AC-010 is integrated only as an isolated Canvas renderer module. AC-028 provides real-browser raster validation/benchmark evidence before AC-012 UI integration.
- AC-004 can proceed independently after its E2E reconciliation; no dependency for isolated modules.
- AC-015/016/017/018/019 remain module-first; UI follow-ups require coordinator-issued ownership locks.
- AC-027 waits for PR #11's workflow-file edit to merge before adding its own workflow step.
- AC-025 is read-only; it must not interfere with Agent 4's shared file lock.
- AC-026 is documentation-only; no application code or index.html edits.

See [BACKLOG.md](BACKLOG.md) and [DECISIONS.md](DECISIONS.md).
