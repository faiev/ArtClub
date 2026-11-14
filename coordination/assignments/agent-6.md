# Agent 6 — Editing safety / layer protection

## READY — AC-015: Build a tested layer-edit safety guard

The UX audit identified that Clear and image import may bypass hidden/locked-layer protection. Agent 1 is handling project persistence; Agent 4 is handling the Agent API/MCP bridge. Your job is the isolated editing-safety contract.

### Branch
`agent/layer-safety`, based on main at `fe66725f7d010beca7ca60f497778d419e753d7b`.

### Work
1. Inspect the current layer model and the Clear, image-import, and agent edit paths.
2. Document precisely which operations currently check `visible` and `locked` and which do not.
3. Implement a small pure-JavaScript module `js/layer-edit-guard.js` with validated helpers to resolve whether a target layer/cel is editable and return structured denial reasons.
4. Add tests covering missing layers, hidden layers, locked layers, visible/unlocked layers, inactive layer IDs, missing cels and malformed documents.
5. Document an integration contract with examples for Clear, image import and agent edits.
6. Do not claim the application bug is fixed until the guard is wired into the live editor and browser-tested. The integration can be a separately assigned UI task.

### File scope
Only `js/layer-edit-guard.js`, `tests/layer-edit-guard.test.js`, and `docs/layer-edit-safety.md`. Do not touch `index.html`, `js/project-storage.js`, `js/agent-api.js` or `agent-bridge/*`.

### Acceptance criteria
- A single shared guard contract covers all edit paths.
- Tests prove hidden/locked layers are rejected and visible/unlocked layers accepted.
- Denials are explicit and machine-readable; no silent no-op.
- No editor integration is claimed in this isolated task.

### Handoff
Commit on `agent/layer-safety`, open a draft PR and update only `coordination/status/agent-6.md`.
