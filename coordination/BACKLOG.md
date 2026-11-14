# Art Club backlog

The coordinator owns task assignment and prioritization. The active tasks are in BOARD.md.

## Current follow-ups (not blockers for active work)

### AC-007 — Integrate sprite-sheet export into editor and agent tools
- Candidate: Agent 3
- State: QUEUED
- Depends on review of PR #3 and Agent 4's accepted API/MCP contract.
- Add UI controls and download flow for PNG plus JSON metadata; expose the same operation through the browser Agent API/MCP without duplicating exporter logic.
- Do not begin shared UI/API edits until the coordinator grants the file lock.

### AC-008 — Add stale-write and single-writer concurrency contract
- Candidate: Agent 4
- State: QUEUED behind AC-004 handoff/review, but independent documentation and test-design work may be prepared in AC-004.
- Verify stale revisions are rejected with structured errors and no newer edit is silently overwritten. Document whether the product supports one writer or concurrent writers. Do not claim collaboration without tests.

### AC-012 — Integrate the Canvas 2D renderer
- Candidate: Agent 2
- State: QUEUED
- Depends on acceptance of PR #6 and a coordinator-approved UI file lock.
- Integrate incrementally, preserve a fallback renderer, verify pointer mapping, selection, grid, onion skin and accessibility, and test on large canvases.

### AC-013 — Add keyboard shortcuts and command discoverability
- Candidate: Agent 5
- State: QUEUED
- Depends on accepted UX implementation plan and coordinator review.
- Define shortcuts, conflict handling, help/discoverability, and acceptance tests before implementation.

### AC-014 — Add frame thumbnails and cel workflow improvements
- Candidate: Agent 3
- State: QUEUED
- Depends on export API/UI work and timeline integration ownership.
- Specify thumbnails, copy/paste cels, and frame navigation as a testable workflow.

## Future candidates

New backlog items must include a concrete user problem, scope, acceptance criteria, dependencies, file ownership, and a test plan. Do not add features merely because another editor has them.
