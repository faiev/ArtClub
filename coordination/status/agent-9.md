# Status — Agent 9

- **Task:** AC-018 — Read-only project inspector CLI
- **Status:** REVIEW
- **Branch:** `agent/project-inspector`
- **Synced base:** `65f989757131b9db6756a41d1b8a6f65196e91ef`
- **Current branch head:** `ffeda5ac3c225064209a1d9171b2b1713f0682b5`
- **Original implementation commit:** `a512783b025e5609f19925a891b8ece6c2621a38`
- **Pull request:** [#12 — AC-018: Add read-only project inspector CLI](https://github.com/faiev/ArtClub/pull/12) (open, draft)
- **Changed files:** 9 (exact assigned file scope)
- **Last updated:** 2026-11-14 — latest main sync and full CI revalidation submitted for coordinator review.

## Implementation summary

- Added an offline Node CLI using built-in modules and the existing CommonJS `js/project-model.js`.
- Reuses `Project.deserializeProject()` and `Project.validateProject()` for authoritative v2 validation and in-memory legacy migration.
- Supports human-readable and `--json` output with stable diagnostics and nonzero exit codes for invalid files.
- Reports source/normalized format and version, project name/ID, canvas dimensions, palette size, layer/frame counts, active layer/frame, cel count, expected/actual pixel totals, visibility/lock state, frame durations, and occupied/transparent pixel totals.
- Legacy input is migrated in memory only. The input is opened read-only; it is never rewritten.
- Enforces a 64 MiB file-size cap before and during reads.
- Added a UTF-8 BOM input regression case.
- No UI, storage, project-model, renderer, Agent API or bridge implementation files were changed.

## Synchronization and scope evidence

- Latest `main` at sync: `65f989757131b9db6756a41d1b8a6f65196e91ef`.
- Feature branch head: `ffeda5ac3c225064209a1d9171b2b1713f0682b5`.
- Compare against `main`: 0 commits behind; 15 commits ahead (including main-sync merge commits and the feature work).
- The source diff is exactly the 9 assigned AC-018 files: CLI, test, six fixtures, and documentation.
- The PR remains open and draft. Agent 9 has not merged it.

## Test evidence — GitHub Actions run #172

Workflow: https://github.com/faiev/ArtClub/actions/runs/43607076693

- **Passed:** `node --test tests/*.test.js` — 67 passed, 0 failed, 0 skipped. This includes all 9 project-inspector tests.
- **Passed:** `node --check agent-bridge/server.mjs`.
- **Passed:** `npm run test:e2e` — Chromium browser E2E completed successfully.
- **Passed:** `npm run test:mcp` — MCP client integration E2E completed successfully.
- Both workflow jobs (`test` and `browser-e2e`) completed with conclusion `success`.

Local execution was not performed: this environment could not resolve github.com for a local clone. The passing results above are from GitHub Actions, not a local run.

## Risks and limitations

- Files above 64 MiB are rejected as an explicit inspector safety limit, even if they might otherwise meet the project model's structural limits.
- Occupied/transparent totals count all cel pixel slots, including hidden layers and non-active frames; they are not flattened composite-image totals.
- Legacy source files lack v2 project/layer/frame IDs, so synthetic migration IDs are not shown as source IDs.
- The CLI does not repair or rewrite projects, batch-inspect, compare project versions, or integrate into the editor UI. Such enhancements remain separate tasks.

## Handoff

Coordinator: review PR #12 and the full passing run #172 evidence. The latest branch is synchronized with `main`, the diff remains within Agent 9's nine owned paths, and the implementation is ready for review. Agent 9 remains in `REVIEW` and does not self-accept or merge.
