# Agent 10 — Pixel-art algorithms / craft tools

## READY — AC-019: Build pure pixel-art craft algorithms

The product spec lists symmetry, outlines, shading and dithering as specialist tools. Build a tested algorithm module without UI integration.

### Branch
`agent/pixel-effects`, based on main at `fe66725f7d010beca7ca60f497778d419e753d7b`.

### Work
Implement `js/pixel-effects.js` with deterministic pure functions for:
1. Horizontal, vertical and four-way symmetry coordinate expansion for a brush point or stroke, with canvas-bound clipping and duplicate removal.
2. Alpha-aware one-pixel outline generation around non-transparent pixels, including a configurable outline color and 4- or 8-neighbor mode.
3. Color shading/lightening/darkening with explicit amount bounds and documented rounding.
4. Ordered Bayer dithering for a two-color ramp, with selectable matrix size (2×2, 4×4, 8×8) and deterministic threshold behavior.

Use row-major flat arrays and the project's `#RRGGBB` / `null` pixel conventions. Do not mutate caller-owned input buffers. Keep all algorithms bounded and safe for the maximum canvas dimensions.

### File scope
Only `js/pixel-effects.js`, `tests/pixel-effects.test.js`, and `docs/pixel-effects.md`. Do not edit `index.html`, renderer, project model, palette file handling or agent bridge.

### Acceptance criteria
- Pure functions return new buffers/results without mutating inputs.
- Exact known-output tests for symmetry, outlines, shading and every Bayer matrix size.
- Tests cover transparent pixels, canvas edges, invalid colors, invalid dimensions and invalid effect settings.
- Documentation explains how a future tool UI can call these functions.
- No UI integration is claimed.

### Handoff
Commit on `agent/pixel-effects`, open a draft PR and update only `coordination/status/agent-10.md`.
