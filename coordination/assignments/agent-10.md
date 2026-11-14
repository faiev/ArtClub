# Agent 10 — Pixel-art algorithms / craft tools

## Continuous workstream: build a deterministic pixel-art algorithm library

You own pure pixel operations with exact integer behavior. The initial four algorithms are only the first phase.

### Phase 0 — AC-019: Refresh and revalidate pixel algorithms
PR #15: https://github.com/faiev/ArtClub/pull/15
Sync latest main without force-pushing. Preserve deterministic symmetry, outline, shading and Bayer dithering. Run focused tests plus full Node 24, Chromium and MCP workflow on the new head.

### Phase 1 — AC-080: Raster primitives
Add tested pure operations for:
- integer line rasterization (Bresenham);
- rectangle outline and filled rectangle;
- circle/ellipse outline and filled variants;
- polygon fill with documented edge rules;
- clipping to canvas bounds;
- deterministic de-duplication and output order.
Use exact known-output fixtures, avoid floating-point antialiasing and preserve null transparency.

### Phase 2 — AC-081: Flood fill and region operations
Implement bounded flood fill (4/8-connected), tolerance policy for exact HEX colors, contiguous region selection and border extraction. Protect against huge queue memory, malformed/sparse buffers and cancellation/iteration limits. Never mutate input buffers.

### Phase 3 — AC-082: Color and gradient operations
Implement color replace, palette map, horizontal/vertical/linear gradients between HEX colors, quantization/posterize and deterministic color ramp application. Define rounding and tie-breaking. Preserve transparency and provide preview-only return values.

### Phase 4 — AC-083: Pixel transforms
Implement horizontal/vertical flip, 90/180/270 rotations, crop, pad and nearest-neighbor scale. Validate output dimensions before allocation. Keep integer pixel coordinates and no smoothing/interpolation.

### Phase 5 — AC-084: Advanced dithering and shading
Add deterministic error-diffusion option (for example Floyd–Steinberg) alongside ordered Bayer, with explicit scan direction, alpha handling and color-distance policy. Add configurable outline thickness and inner/outer behavior if bounded. Keep algorithm outputs explicit and deterministic.

### Phase 6 — AC-085: Golden fixture and stress corpus
Build a small source-art fixture corpus made only of original synthetic patterns: checkerboards, diagonal lines, transparent holes, gradients, symmetric sprites and edge cases. Verify every algorithm against expected raw buffers. Add maximum-dimension/stress tests, non-mutation checks and runtime/allocation guards.

### Phase 7 — AC-086: Algorithm integration contracts
Create docs/PIXEL_EFFECTS_CATALOG.md with each operation's input/output schema, limits, determinism, complexity and future UI/Agent API integration examples. Provide a preview/commit boundary so the future UI never writes partial results on error. Do not edit index.html, renderer, project model or Agent API.

## Ownership
- js/pixel-effects.js and tests/pixel-effects.test.js
- additional pure modules under js/pixel-*.js with matching tests
- tests/fixtures/pixel-effects/**
- docs/pixel-effects.md and docs/PIXEL_EFFECTS_CATALOG.md

Do not edit index.html, Canvas renderer, project model, palette implementation, Agent API, bridge or another agent's files.

## Working rules
All phases are pre-authorized. After refreshing PR #15, start raster primitives on a separate branch while CI/review runs. Keep separate PRs for independent algorithms, or group tightly related primitives. Do not stop at a single green CI result.

## Handoff
Update only coordination/status/agent-10.md with phases, branch/PR ledger, exact test evidence, known algorithm limits and next 3–5 actions. Do not merge or self-accept.
