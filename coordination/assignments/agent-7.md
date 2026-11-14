# Agent 7 — Tile and seamless-texture workflow

## READY — AC-016: Build a tiled pixel-art preview engine

The product spec calls for seamless tile creation and repeat preview. The renderer agent owns the main canvas renderer; do not overlap its code.

### Branch
`agent/tile-preview`, based on main at `fe66725f7d010beca7ca60f497778d419e753d7b`.

### Work
1. Inspect the project pixel-array and composite data conventions.
2. Implement `js/tile-preview.js` as a renderer-independent utility that takes a flat row-major pixel buffer, width and height, then produces a repeated preview buffer for configurable columns/rows.
3. Add a seam diagnostic that compares opposing left/right and top/bottom tile edges, reporting exact mismatched coordinates and colors. Treat transparency as a value.
4. Validate dimensions, pixel-buffer length, repeat counts and safe output size before allocating.
5. Include utilities to extract edge strips and produce a structured seam report.
6. Document how the editor UI could consume the output later without coupling this module to Canvas or DOM.

### File scope
Only `js/tile-preview.js`, `tests/tile-preview.test.js`, and `docs/tile-preview.md`. Do not touch `index.html`, `js/canvas-renderer.js`, `js/agent-api.js` or `agent-bridge/*`.

### Acceptance criteria
- Exact, deterministic repeated pixel output.
- Correct horizontal and vertical seam diagnostics, including transparent pixels.
- Clear validation errors and memory limits.
- Unit tests for 1×1, rectangular tiles, multiple repeats, matching/mismatching edges and invalid inputs.
- No claim of UI integration.

### Handoff
Commit on `agent/tile-preview`, open a draft PR and update only `coordination/status/agent-7.md`.
