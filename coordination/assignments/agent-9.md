# Agent 9 — Project format diagnostics / developer tooling

## READY — AC-018: Build a read-only project inspector CLI

As Art Club grows, debugging project JSON by hand is inefficient. Build a developer tool that can inspect project files offline without changing them.

### Branch
`agent/project-inspector`, based on main at `fe66725f7d010beca7ca60f497778d419e753d7b`.

### Work
1. Inspect `js/project-model.js` and reuse its real validation/migration rules. Do not fork the project schema.
2. Implement `tools/project-inspector.mjs`, a Node CLI accepting a path to a project JSON file.
3. Report project format/version/name/ID, canvas dimensions, palette size, layer/frame counts, active layer/frame, cel count, expected vs actual pixel counts, visible/locked layer summary, durations and transparent/occupied pixel totals when the data is valid.
4. Support `--json` for machine-readable output and nonzero exit codes for invalid files.
5. Support legacy project migration in memory for inspection, but never overwrite the source file.
6. Include file-size and JSON parse safeguards and useful diagnostics.
7. Add fixtures for valid v2, valid legacy, malformed JSON, invalid cels, missing references and over-limit documents.

### File scope
Only `tools/project-inspector.mjs`, `tests/project-inspector.test.mjs`, `tests/fixtures/project-inspector/*`, and `docs/project-inspector.md`. Do not modify `js/project-model.js`, storage, editor UI or agent bridge.

### Acceptance criteria
- CLI works with Node's built-in APIs and existing CommonJS project-model module.
- Human-readable and JSON output are stable and documented.
- Valid legacy input can be inspected through in-memory migration without source mutation.
- Invalid files exit nonzero with actionable messages.
- Automated tests use temporary fixture copies and verify the original file is unchanged.

### Handoff
Commit on `agent/project-inspector`, open a draft PR and update only `coordination/status/agent-9.md`.
