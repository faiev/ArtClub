# Agent 1 — QA / persistence

## READY — AC-006: Fix the Project Library recovery snapshot bug

You are assigned this task now. Do not wait for PR #1 or PR #5 to merge.

### Context
QA reported a suspected one-step recovery bug (Issue #2): opening Project Library calls `persistNow()`; a no-op save may rotate the recovery snapshot and replace the previous version with the current version.

### Branch
Create/use `agent/qa-recovery-snapshot`, based on the current `main` commit `fe66725f7d010beca7ca60f497778d419e753d7b`. Keep the existing `agent/qa-release` / PR #1 unchanged.

### Work
1. Reproduce A → autosaved B → open Project Library → Recover.
2. Inspect `js/project-storage.js` and the save/autosave call paths. Confirm or disprove the suspected root cause.
3. Add a browser E2E regression test that fails on the bug.
4. Implement the smallest safe fix. A clean/no-op save must not rotate the previous recovery snapshot.
5. Verify normal dirty autosave, explicit save, project switching and existing project migration still work.
6. Run unit tests and Chromium browser E2E; include exact commands and results.

### File scope
`js/project-storage.js`, recovery-focused tests, and `agent-bridge/e2e-test.mjs`. Do not edit `index.html` or bridge/API files. If the fix truly requires another file, stop before changing it and explain why.

### Acceptance criteria
- Recovery returns version A after version B is autosaved.
- Opening Project Library without further changes does not replace A with B in the recovery slot.
- A subsequent genuine edit/save rotates recovery as intended.
- No test assertion is weakened to hide the bug.

### Handoff
Commit to `agent/qa-recovery-snapshot`, open a draft PR, and update only `coordination/status/agent-1.md`. Include root cause, PR, commit SHA, tests and remaining risks.
