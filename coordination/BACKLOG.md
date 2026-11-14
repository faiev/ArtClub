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
- State: QUEUED — blocked on AC-010 correctness corrections, browser parity and measured benchmark evidence.
- Integrate incrementally, preserve a fallback renderer, verify pointer mapping, selection, grid, onion skin and accessibility, and test on large canvases.

### AC-013 — Add keyboard shortcuts and command discoverability
- Candidate: Agent 5
- State: IN_PROGRESS as specification task AC-026; implementation remains queued.
- Define shortcuts, conflict handling, help/discoverability, and acceptance tests before implementation. Do not edit app source in the specification phase.

### AC-014 — Add frame thumbnails and cel workflow improvements
- Candidate: Agent 3
- State: QUEUED
- Depends on export API/UI work and timeline integration ownership.
- Specify thumbnails, copy/paste cels, and frame navigation as a testable workflow.

## Future candidates

New backlog items must include a concrete user problem, scope, acceptance criteria, dependencies, file ownership, and a test plan.


## Additional workstreams — Agents 6–10

### AC-020 — Integrate the shared layer-edit safety guard
- Candidate: Agent 6
- State: QUEUED after AC-015 is reviewed and accepted.
- Wire the tested guard into Clear, image import and browser Agent API edit paths. The coordinator must assign a single integration owner and lock the affected shared files before implementation.
- Verify with real Chromium tests that hidden/locked layers cannot be changed through any edit path.

### AC-021 — Add seamless tile preview to the editor
- Candidate: Agent 7
- State: QUEUED after AC-016 is reviewed and renderer/UI ownership is available.
- Add a toggleable tiled preview using the isolated module, without changing artwork data or contaminating exports. Add browser tests for edge painting and exact tile output.

### AC-022 — Add palette file controls to the UI
- Candidate: Agent 8
- State: QUEUED after AC-017 is reviewed.
- Add import/export controls for GPL, JASC-PAL and JSON palettes, preserving order and color names where supported. Coordinate the UI file lock with Agent 4 and Agent 5.

### AC-023 — Integrate pixel-art craft algorithms
- Candidate: Agent 10
- State: QUEUED after AC-019 is reviewed.
- Design the UI/agent API interface for symmetry, outline, shading and dithering. Add integration only after module contracts are accepted and relevant files are released.

### AC-024 — Project inspector enhancements
- Candidate: Agent 9
- State: QUEUED after AC-018 is reviewed.
- Consider optional batch inspection, structured diff between two project versions and CI artifact diagnostics. Do not modify project files or introduce auto-repair without a separate explicit task.

## Newly assigned coordination follow-ups

### AC-025 — Audit remaining frame-aware QA coverage in PR #1
- Owner: Agent 1
- State: ASSIGNED
- Goal: After PR #10 merged, compare the open PR #1 diff against current main and identify which frame-aware persistence/import/export assertions are unique, already covered, redundant or unsafe to merge.
- Scope: Read-only review of PR #1 and current main. Do not edit `agent-bridge/e2e-test.mjs`, another agent's branch or any application source. Agent 4 owns the shared E2E file during PR #8 reconciliation.
- Acceptance criteria: concise report with exact unique assertions, overlaps with PR #10/#8, recommended keep/drop list, branch divergence and a safe integration sequence.
- Handoff: update only `coordination/status/agent-1.md`; no new PR is required for this read-only review.

### AC-026 — Keyboard shortcut and command-discoverability specification
- Owner: Agent 5
- State: ASSIGNED
- Goal: Turn AC-013 into an implementation-ready, platform-aware shortcut and discoverability specification.
- Branch: `agent/keyboard-shortcuts-plan`, created from main commit `57b4da3cf9be2a9a4b1c98fea942729e42314d54`.
- Allowed files: `KEYBOARD_SHORTCUTS_PLAN.md` only, plus the agent's own coordination status file.
- Requirements: inspect existing keyboard handlers; identify browser/OS reserved combinations; define Windows/Linux/macOS modifier policy; specify shortcuts for common tools, undo/redo, selection, layer/frame navigation and playback; define conflict/focus rules for text fields and dialogs; specify discoverable help/command reference behavior; include acceptance tests for keyboard-only use and accessibility.
- Constraints: documentation/specification only. Do not modify `index.html`, application JS, CSS or tests. Call out shared-file ownership needed for a later implementation.
- Acceptance criteria: every proposed shortcut has context, platform mapping and conflict handling; no browser-reserved shortcut is silently intercepted; test matrix and phased implementation order are included.
- Handoff: open a draft PR and update only `coordination/status/agent-5.md`.
