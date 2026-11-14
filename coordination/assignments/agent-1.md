# Assignment — Agent 1: QA / release

## Current task
**AC-001 — Correct frame-aware persistence E2E checks**

- State: `REVIEW`
- Branch: `agent/qa-release`
- PR: https://github.com/faiev/ArtClub/pull/1
- Your branch currently changes `agent-bridge/e2e-test.mjs`.
- PR description reports 35 unit/editor tests, Chromium browser E2E, MCP E2E and npm audit passing. The coordinator must verify the actual CI run and review the diff.

Do not merge the PR or change application code as part of AC-001.

## Next assigned task
**AC-006 — Fix project recovery snapshot rotation**

- State: `QUEUED`
- Dependency: AC-001 must be reviewed and merged first.
- Reference: https://github.com/faiev/ArtClub/issues/2
- Start only after the coordinator updates this assignment to `READY`.

When AC-006 becomes ready, reproduce the A → autosaved B → open Project Library → Recover scenario, implement a focused fix, add Chromium regression coverage, and submit a separate PR. Do not make the recovery behavior appear fixed by weakening the test.

## Scope
QA, browser E2E and focused persistence regression work. Coordinate with the owner of `index.html` and `js/project-storage.js` before changing shared application files.
