# Art Club backlog

The coordinator owns task assignment and prioritization. Active task owners/states live in BOARD.md.

## Existing follow-ups

### AC-007 — Integrate sprite-sheet export into editor and agent tools
- Candidate: Agent 3
- State: QUEUED after AC-027 is accepted and AC-004's Agent API/MCP contract is accepted.
- Add UI controls and download flow for PNG plus JSON metadata; expose the same operation through browser Agent API/MCP without duplicating exporter logic.
- Do not begin shared UI/API edits until the coordinator grants file locks.

### AC-008 — Add stale-write and single-writer concurrency contract
- Candidate: Agent 4
- State: QUEUED behind AC-004 acceptance; independent test-design/documentation can be prepared meanwhile.
- Verify stale revisions are rejected with structured errors and no newer edit is silently overwritten. Document single-writer policy; do not claim collaboration without tests.

### AC-012 — Integrate the Canvas 2D renderer
- Candidate: Agent 2
- State: QUEUED behind AC-028 real-browser correctness validation and benchmark evidence, plus coordinator-approved UI ownership.
- Integrate incrementally, preserve DOM fallback, verify pointer mapping, selection, grid, onion skin, keyboard/accessibility and large-canvas behavior.

### AC-013 — Keyboard shortcuts and command discoverability
- Candidate: Agent 5
- State: Specification task AC-026 assigned; implementation remains queued.
- Define shortcuts, conflict handling, help/discoverability and acceptance tests before implementation.

### AC-014 — Frame thumbnails and cel workflow improvements
- Candidate: Agent 3
- State: QUEUED behind exporter API/UI work and timeline integration ownership.
- Specify thumbnails, copy/paste cels and frame navigation as a testable workflow.

## Agents 6–10 follow-ups

### AC-020 — Integrate shared layer-edit safety guard
- Candidate: Agent 6
- State: QUEUED after AC-015 acceptance.
- Wire the tested guard into Clear, image import and browser Agent API edit paths. Coordinator assigns one integration owner and locks shared files first. Verify hidden/locked layers cannot be changed through every edit path in Chromium.

### AC-021 — Add seamless tile preview to editor
- Candidate: Agent 7
- State: QUEUED after AC-016 acceptance and renderer/UI ownership availability.
- Add a toggleable tiled preview using the isolated module, without changing artwork data or contaminating exports. Add browser tests for edge painting and exact tile output.

### AC-022 — Add palette file controls to UI
- Candidate: Agent 8
- State: QUEUED after AC-017 acceptance.
- Add GPL, JASC-PAL and JSON import/export controls, preserving order and names where supported. Coordinate UI ownership with Agent 4/5.

### AC-023 — Integrate pixel-art craft algorithms
- Candidate: Agent 10
- State: QUEUED after AC-019 acceptance.
- Define UI/Agent API interface for symmetry, outline, shading and dithering. Integrate only after module contracts are accepted and shared files are released.

### AC-024 — Project inspector enhancements
- Candidate: Agent 9
- State: QUEUED after AC-018 acceptance.
- Consider optional batch inspection, structured project diff and CI artifact diagnostics. No auto-repair or source modification without a separate assignment.

## Coordinator-assigned follow-ups

### AC-025 — Audit remaining QA coverage in PR #1
- Owner: Agent 1
- State: ASSIGNED
- Scope: Read-only compare PR #1 against current main (including PR #10) and PR #8. Identify unique assertions, duplicate assertions and a safe keep/drop list.
- Constraint: Do not edit `agent-bridge/e2e-test.mjs`; Agent 4 is the only writer during PR #8 reconciliation.
- Handoff: update only agent-1 status; no code PR required.

### AC-026 — Keyboard shortcut and command-discoverability specification
- Owner: Agent 5
- State: ASSIGNED
- Branch: `agent/keyboard-shortcuts-plan` (created from main prior to PR #6 merge; update against latest main without force-pushing).
- Allowed file: `KEYBOARD_SHORTCUTS_PLAN.md` only.
- Requirements: inspect existing key handlers; propose common tool/undo/redo/selection/layer/frame/playback shortcuts; define Windows/Linux/macOS modifier policy; identify browser/OS reserved combinations; define focus rules for inputs/dialogs; discoverability/help behavior; keyboard-only/accessibility acceptance matrix; phased implementation and ownership.
- Constraint: documentation only, no index.html/app JS/CSS/test edits.
- Handoff: draft PR and update only agent-5 status.

### AC-027 — Complete real-browser sprite-sheet PNG verification
- Owner: Agent 3
- State: QUEUED_AFTER_AC011_SYNC
- Branch: `agent/animation-export` (existing PR #3).
- Goal: update PR #3 to latest main and add real Chromium PNG decode verification for complete RGBA raster, dimensions, transparency, margins/spacing, frame order and JSON metadata correspondence.
- Constraints: keep PR #3 separate from PR #11; do not edit index.html/Agent API/MCP; do not edit `.github/workflows/project-tests.yml` until PR #11 has merged and the coordinator releases the workflow lock.
- Handoff: update PR #3 and agent-3 status with exact browser/CI evidence.

### AC-028 — Real-browser Canvas renderer validation and benchmark capture
- Owner: Agent 2
- State: READY
- Branch: `agent/renderer-browser-validation` (created from current main commit `1ba0aaee597d5bf11083c97a03a312c7ee434530`).
- Files: `tests/canvas-renderer.browser.html`, `tests/canvas-renderer.browser.mjs`, `benchmarks/renderer-browser-validation.md`, and optionally `benchmarks/renderer-benchmark.html`.
- Goal: use real Chromium to validate complete raster pixels, transparency, nearest-neighbor scaling, overlay isolation, fractional-DPR pointer mapping, frame/revision invalidation and onion-mask changes. Capture DOM-grid versus Canvas timings at 32/64/128/256/512 with warm-ups, multiple samples, median, p95, raw samples and environment metadata.
- Constraints: do not modify index.html, project model, Agent API, MCP or bridge. Do not claim a general speedup from a single CI runner. Keep DOM renderer active.
- Workflow lock: Agent 3 owns `.github/workflows/project-tests.yml` during PR #11 reconciliation. Agent 2 may prepare tests/docs but may only add a workflow step after PR #11 merges and coordinator releases that file.
- Handoff: new draft PR and agent-2 status with real-browser results and exact CI.

## Integration policy

All modules remain local, deterministic and isolated until their acceptance evidence is complete. No UI/API integration starts without a coordinator-issued shared-file lock. A green CI run applies only to its exact commit and tested base; repeat it after base updates.
