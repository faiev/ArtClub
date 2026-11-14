# Art Club backlog — rolling multi-agent workstreams

The coordinator owns this roadmap. The detailed, pre-authorized phase queues live in each agent's assignment. A listed phase is already authorized for its owner; workers do not need a new coordinator approval between phases.

## Continuous workstream index

| Agent | Workstream | Authorized phase range | Deliverable family |
|---|---|---|---|
| 1 | QA / release reliability | AC-025, AC-029–033 | regression matrix, lifecycle/migration/export coverage, browser QA harness, release checker |
| 2 | Rendering / navigation | AC-028, AC-034–038 | real-browser renderer tests, viewport/navigation utility, renderer adapter, benchmarks, integration demo |
| 3 | Animation / export | AC-011, AC-027, AC-039–042 | GIF, sprite-sheet browser verification/layouts, export planner, stress/compatibility corpus, export docs |
| 4 | Agent API / MCP | AC-004, AC-043–048 | deadlines/cancellation, process locking, security, capability discovery, export/pixel adapters, resilience |
| 5 | UX / accessibility | AC-026, AC-049–054 | keyboard spec, workspace, layer/timeline, palette/export, accessibility audit, static prototypes, integrated roadmap |
| 6 | Editing safety | AC-015, AC-055–060 | fail-closed guard, immutable edit transactions, mutation-path audit, browser harness, import staging, integration contract |
| 7 | Tile workflows | AC-016, AC-061–066 | tile transforms, offset preview, tile-map data model, seam diagnostics, atlas planner, integration contract |
| 8 | Palette tooling | AC-017, AC-067–073 | palette analysis, color science, transformations/generators, palette mapping, accessibility diagnostics, fuzz/format corpus |
| 9 | Project diagnostics | AC-018, AC-074–079 | batch inspect, structural diff, deep diagnostics, migration preview, CI/SARIF report, docs |
| 10 | Pixel algorithms | AC-019, AC-080–086 | raster primitives, flood fill, color/gradient operations, transforms, advanced dithering, golden fixtures, catalog |

## Workstream execution rules

- PR creation is a checkpoint, not completion of the agent's work.
- Each worker moves to the next unfinished, unblocked phase from its assignment without waiting for review/merge.
- Keep PRs narrow: one PR per coherent deliverable; use separate feature branches for independent phases.
- If a phase depends on a module PR that is not merged, work on independent phases, interface contracts, tests/fixtures and docs while it is pending.
- A worker must keep the next 3–5 actions in its own status file.
- No agent may idle merely because its PR is under review.
- Shared-file locks remain authoritative. The queue does not authorize editing another agent's files or index.html.
- Workers pause only for genuine blockers that prevent all useful independent work.
- ChatGPT chats do not wake from GitHub changes; the queue reduces coordinator prompts but does not provide background execution.

## Integration and shared-file constraints

### Shared E2E
Agent 4 is the only worker authorized to edit the bridge browser E2E file while reconciling PR #8. Agent 1's PR #1 audit is read-only. Preserve the PR #10 recovery regression.

### Project test workflow
PR #11 is merged. Agent 3 currently owns .github/workflows/project-tests.yml for AC-027 sprite-sheet browser verification/CI wiring. Agent 2 may build and run browser harness files/docs but must not change the workflow until Agent 3 releases the lock.

### Application UI
index.html and editor UI integration remain coordinator-controlled. Agents can build isolated modules, static UX prototypes, acceptance matrices, browser harnesses and integration contracts without stopping for the UI lock. No implicit UI authorization.

### Exporter dependency
Agent 3 owns GIF/sprite-sheet modules. Other agents may consume the documented contract in tests or planning but must not edit exporter implementation.

## Existing queued follow-ups

### AC-007 — Export UI and Agent API integration
Candidate: Agents 3 and 4, with coordinator-appointed single UI owner.
State: QUEUED until AC-004, AC-011 and AC-027 are accepted/merged. Add export controls, progress/cancel/error feedback and API/MCP adapters without duplicating encoding logic.

### AC-008 — Stale-write and single-writer contract
Candidate: Agent 4.
State: INCLUDED in AC-043–048. Retain explicit limits for multiple bridge processes and uncertain in-flight operations.

### AC-012 — Canvas renderer UI integration
Candidate: Agents 2 and 5.
State: QUEUED behind AC-028 and AC-034–038 browser validation and coordinator-issued index.html lock. Preserve the DOM fallback until parity and accessibility are demonstrated.

### AC-013 — Keyboard shortcuts and command discoverability
Candidate: Agent 5.
State: INCLUDED in AC-026 and AC-049–054.

### AC-014 — Frame thumbnails and cel workflow
Candidate: Agents 3 and 5.
State: Future UI work after exporter/timeline contracts and UI lock.

### AC-020–024 — Initial integration follow-ups
- AC-020 layer safety integration — Agent 6, after guard/transaction phases and UI lock.
- AC-021 tiled preview integration — Agent 7, after tile workflow phases and renderer/UI lock.
- AC-022 palette controls — Agent 8, after palette tools and UI lock.
- AC-023 pixel-effects integration — Agent 10, after algorithm catalog and UI/API lock.
- AC-024 inspector enhancements — Agent 9; its batch/diff/deep-diagnostic scope is already included in AC-074–079.

## Detailed workstream definitions

The canonical deliverables, file ownership, acceptance criteria and phase ordering for AC-025 through AC-086 are in:
- coordination/assignments/agent-1.md
- coordination/assignments/agent-2.md
- coordination/assignments/agent-3.md
- coordination/assignments/agent-4.md
- coordination/assignments/agent-5.md
- coordination/assignments/agent-6.md
- coordination/assignments/agent-7.md
- coordination/assignments/agent-8.md
- coordination/assignments/agent-9.md
- coordination/assignments/agent-10.md

These are not merely suggestions: they are the current pre-authorized queues. The coordinator may reorder or suspend a phase only when a new dependency, safety concern, user decision or file conflict requires it.

## Coordinator-added extension phases (2026-11-14)

The following follow-on phases have been appended to the canonical assignments on `main`. Each is pre-authorized only after the owner's existing queue is complete or its earlier phases have been submitted and the new phase's own dependencies are met.

| Agent | Extension | Deliverable |
|---|---|---|
| 1 | **AC-087** | Discoverable, deterministic runner for nested QA suites; explicit suite manifest, safe child-process invocation and machine-readable results |
| 2 | **AC-088** | Real-Chromium workload study comparing production editor, isolated DOM renderer and isolated Canvas renderer; evidence-based adoption gates |
| 3 | **AC-089** | Async GIF/sprite-sheet export entry points with cooperative cancellation, structured progress and byte-identical deterministic output |
| 4 | **AC-090** | Offline, read-only local MCP bridge doctor with configuration, runtime, browser and profile-lock diagnostics |
| 5 | **AC-091** | Professional workstation design system and high-fidelity interactive prototype, explicitly separate from production UI |
| 6 | **AC-092** | Seeded adversarial/property-style conformance tests for guard, immutable transactions and import staging |
| 7 | **AC-093** | Deterministic 4/8-neighbor autotile rule resolver and versioned ruleset contract |
| 8 | **AC-094** | Opt-in CIEDE2000 perceptual palette matching with published reference-pair tests; preserve existing RGB defaults |
| 9 | **AC-095** | Read-only exact-byte and semantic project fingerprints plus bounded duplicate detection |
| 10 | **AC-096** | Deterministic quadratic/cubic Bézier rasterization with integer pixel output and bounded tessellation |

### Sequencing and ownership

- These phases do not supersede any unfinished phase in the existing queue. Agents complete their current authorized sequence first, unless a dependency requires switching to a listed independent phase.
- AC-091 is a standalone UX prototype and design system only. It grants no production `index.html` or application CSS/JS lock.
- AC-088 measures the current production editor and isolated renderer separately; it grants no renderer or UI integration authority.
- AC-089 adds async/cancellation behavior only to Agent 3's exporter modules; Agent 4 retains bridge request cancellation ownership.
- AC-087 does not authorize editing `.github/workflows/project-tests.yml`; Agent 3's AC-027 workflow lock remains until explicitly released.
- No extension permits changes to another agent's tests/modules, project model/storage, or shared files outside the assignment's stated ownership.
