# Agent 2 — Rendering / performance / canvas navigation

## Continuous workstream: finish the Canvas rendering pipeline as a tested subsystem

AC-010's Canvas renderer prototype is merged in PR #6. It is not yet the active editor renderer. Your assignment now covers browser verification, measurable performance evidence and independent navigation infrastructure. Do not wait for each PR to be reviewed before starting the next phase.

### Phase 0 — AC-028: Real-browser renderer validation
Branch: agent/renderer-browser-validation (already created; sync latest main first).
Create tests/canvas-renderer.browser.html, tests/canvas-renderer.browser.mjs and benchmarks/renderer-browser-validation.md. Use real Chromium to check:
- exact full-raster output for known pixel arrays;
- native and enlarged nearest-neighbor scaling and alpha;
- grid/selection overlays never alter artwork pixels;
- mapping under fractional CSS sizes and DPR;
- frame/composite revisions force full redraw;
- onion-mask changes remove stale tint;
- malformed/sparse buffers fail before visible output mutation.
Capture DOM-grid versus Canvas measurements at 32, 64, 128, 256 and 512 with warm-ups, repeated samples, median, p95, raw samples, browser version and runner details. No performance claim from a single runner.

### Phase 1 — AC-034: Canvas viewport and navigation utility
Build a renderer-independent pure module js/canvas-viewport.js with tests:
- pan, zoom, fit-to-canvas, reset and bounded zoom;
- cursor-anchored zoom that preserves the logical point under the cursor;
- screen-to-canvas and canvas-to-screen coordinate conversion;
- device-pixel-ratio and fractional CSS-size handling;
- clamp/pan behavior for tiny and large canvases;
- deterministic transform state, serialization and invalid input rejection.
No UI wiring is authorized. Provide a clear integration contract for a later editor owner.

### Phase 2 — AC-035: Renderer state adapter and invalidation contract
Build js/canvas-renderer-adapter.js with tests and docs. Convert a v2 project/frame/layer state into renderer inputs deterministically. Track frame/composite revisions so layer order, visibility, opacity, active frame and onion neighbors cannot accidentally use a dirty partial update. Validate stale/mismatched frame data. Do not modify project-model.js, index.html or agent API.

### Phase 3 — AC-036: Browser visual and accessibility inspection pack
Expand the browser harness to cover:
- pointer mapping at 1x, 1.25x, 1.5x and 2x display scale;
- keyboard focus boundaries and overlay pointer transparency;
- selection/grid visibility and high-contrast colors;
- resize, browser zoom and backing-store recreation;
- teardown, repeated mount/unmount and memory cleanup.
Create docs/RENDERER_BROWSER_VALIDATION.md with a reproducible manual checklist and screenshots/evidence references (do not fabricate screenshots or results).

### Phase 4 — AC-037: Large-canvas performance characterization
Extend the benchmark protocol for sparse and dense canvases, frequent small dirty updates, full redraws, overlays and onion skin. Record raw results in benchmark artifacts and distinguish renderer-only timings from full-editor timings. Include memory estimates and variance. If a workload is slower, document it rather than hiding it.

### Phase 5 — AC-038: Integration readiness package
Produce docs/CANVAS_RENDERER_INTEGRATION.md and a small isolated demo page showing how viewport + adapter + renderer compose without changing the live editor. Define fallback behavior, pointer contract, keyboard accessibility, resize lifecycle and test gates. Do not modify index.html until coordinator grants a UI lock.

## Ownership
- js/canvas-viewport.js and tests/canvas-viewport.test.js
- js/canvas-renderer-adapter.js and tests/canvas-renderer-adapter.test.js
- tests/canvas-renderer.browser.*
- benchmarks/renderer-*.*
- docs for renderer/viewport validation and integration

Agent 3 currently owns .github/workflows/project-tests.yml while PR #11 is being reconciled. Prepare browser harnesses and docs without editing that workflow until released. Do not touch index.html, project model, Agent API or bridge.

## Working rules
All phases are authorized. PRs are checkpoints, not stop points. Use a new branch for each independent deliverable after opening the current PR. Keep main synced without force-push. No speedup or UI-integration claim without evidence.

## Handoff
Update only coordination/status/agent-2.md with active phase, branches/PRs, exact test results, benchmark raw-data locations and next 3–5 tasks. Do not merge or self-accept.
