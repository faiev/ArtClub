# Agent 8 — Palette formats and color interoperability

## READY — AC-017: Add palette import/export formats

The editor currently stores a list of HEX colors and offers built-in/custom palettes. The feature spec calls for palette-file interoperability. Keep this work independent of the editor UI.

### Branch
`agent/palette-formats`, based on main at `fe66725f7d010beca7ca60f497778d419e753d7b`.

### Work
Implement `js/palette-formats.js` with strict parsers and exporters for:
1. GIMP Palette (`.gpl`).
2. JASC-PAL (`.pal`).
3. A simple JSON palette format with version, name and color entries.

Requirements:
- Normalize colors to `#RRGGBB`.
- Preserve palette names and color names where the format supports them.
- Preserve color order and duplicates unless the format/spec explicitly forbids them; document decisions.
- Validate headers, version markers, counts, numeric channels and file size.
- Do not silently clamp malformed values.
- Make parsers return structured diagnostics with line numbers.
- No external runtime dependency.

### File scope
Only `js/palette-formats.js`, `tests/palette-formats.test.js`, and `docs/palette-formats.md`. Do not edit `index.html`, project model, exporters, Agent API or MCP bridge.

### Acceptance criteria
- Valid sample fixtures round-trip for each supported format.
- Invalid headers, truncated files, bad channels, excessive entries and malformed JSON are rejected with useful errors.
- Tests verify ordering, names, exact color channels and documented duplicate behavior.
- UI integration is not claimed.

### Handoff
Commit on `agent/palette-formats`, open a draft PR and update only `coordination/status/agent-8.md`.
