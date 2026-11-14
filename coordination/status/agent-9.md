# Status — Agent 9

- **Task:** AC-018 — Read-only project inspector CLI
- **Status:** REVIEW
- **Branch:** `agent/project-inspector`
- **Base:** `fe66725f7d010beca7ca60f497778d419e753d7b`
- **Commit:** `a512783b025e5609f19925a891b8ece6c2621a38`
- **Pull request:** [#12 — AC-018: Add read-only project inspector CLI](https://github.com/faiev/ArtClub/pull/12) (draft)
- **Files:** tools/project-inspector.mjs, tests/project-inspector.test.js, tests/fixtures/project-inspector/*, docs/project-inspector.md
- **Changed files:** 9
- **Last updated:** 2026-11-14 — implementation submitted for coordinator review.

## Implementation summary

- Added an offline Node CLI using built-in modules and the existing CommonJS js/project-model.js.
- Reuses Project.deserializeProject() and Project.validateProject() for authoritative validation and legacy migration.
- Supports human-readable and --json output with stable error codes and nonzero invalid-input exits.
- Reports format/version, project name/ID, canvas dimensions, palette size, layer/frame counts, active layer/frame, cel count, per-cel and total expected/actual pixel counts, visibility/lock state, frame durations and occupied/transparent pixel totals.
- Legacy inputs are migrated in memory only. Synthetic migration IDs are not shown as source IDs.
- Input is opened read-only; a 64 MiB file-size limit is enforced before and during reading.
- No UI, storage, project-model, Agent API or MCP files were changed.

## Test evidence

GitHub Actions run #109: https://github.com/faiev/ArtClub/actions/runs/43604558863

- **Passed:** `node --test tests/*.test.js` — 43 passed, 0 failed, 0 skipped. This includes all 8 new project-inspector tests.
- **Passed:** `node --check agent-bridge/server.mjs`.
- **Failed (separate browser job):** `npm run test:e2e` failed at unmodified `agent-bridge/e2e-test.mjs:229`, assertion “refresh should preserve saved pixels” (`null !== '#ff0000'`). AC-018 changes none of the bridge, persistence, or E2E files.
- **Not executed:** `npm run test:mcp` was skipped by the workflow because the preceding E2E command failed.
- **Local execution:** not run; local clone failed because this execution environment could not resolve github.com. The passing results above are from GitHub Actions, not a local run.

## Risks and limitations

- Files above 64 MiB are rejected as an explicit inspector safety limit, even if their structure might otherwise be valid.
- Pixel coverage counts all cel data, including hidden layers and non-active frames; it is not a flattened composite count.
- Legacy project IDs and frame/layer IDs are not present in the old source format and are therefore reported as absent.
- The CLI is a developer diagnostic only; it does not repair, rewrite, batch-process or compare projects.
- The unrelated browser E2E failure remains outside this assignment and was not modified.

## Handoff

Coordinator: review PR #12 and the CI evidence. The Node suite is green; the independent browser E2E job is red for the saved-pixels refresh assertion noted above. Agent 9 has not merged the PR and does not self-accept.
