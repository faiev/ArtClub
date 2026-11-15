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

## Coordinator-added extension — AC-088: Live-editor versus Canvas renderer workload study

After AC-037 and AC-038, produce an evidence-based decision package for whether and where the isolated Canvas renderer should replace the current production DOM-grid renderer.

### Deliverable
- Add a reproducible real-Chromium workload harness and report under the existing renderer benchmark ownership.
- Measure representative editor actions: initial render, repeated brush strokes, erasing, fill-like full updates, zoom/resize, grid/selection overlays, frame switches and repeated project reopen/close.
- Keep three result categories separate: production editor end-to-end, isolated DOM-grid renderer, and isolated Canvas renderer. Do not present renderer-only numbers as editor-level performance.
- Use representative 32, 64, 128, 256 and 512 canvases; sparse and dense artwork; repeated warm-ups and enough measured samples to report median, p95, variance and raw samples.
- Record browser/runtime, OS, DPR, viewport, hardware context when known, memory/DOM-node estimates and any failed/slow workload.
- Define explicit adoption gates: pixel parity, input latency, frame budget, accessibility/focus behavior, cleanup and fallback. Recommend adopt, defer or reject with evidence.
- Do not alter production UI or claim a speedup from a single run.

**Allowed files:** renderer browser harnesses, `benchmarks/renderer-*`, renderer validation/integration documentation only. No index.html, project model, shared workflow or UI integration.


## Coordinator-added specialist review — UI-01 production shell / PR #84

Review the current coordinator-owned production shell in [PR #84](https://github.com/faiev/ArtClub/pull/84) after fetching current main and PR head. The previous candidate head was `af2717daea892331b77482bc3e3c85fbbc1fabce`; exact-head run #43621240342 passed both workflow jobs.

Review only the canvas/viewport layout and responsive behavior:
- At 1440×900 and 1280×800, verify the live pixel grid stays fully visible and pointer coordinates map to the intended first/last cells.
- Check 1100/900/680/390px breakpoints for overflow, clipped canvas, unreachable tools, inspector compression and timeline usability.
- Confirm the existing DOM grid renderer remains active and no renderer adapter/Canvas switch is implied.
- Inspect CSS interactions between `#pixelGrid` inline aspect-ratio/grid sizing and the new flex viewport constraints; test multiple supported canvas aspect ratios if possible, not only 24×24.
- Provide exact tested SHA, browser/version, viewport/device pixel ratio, results and reproduction steps. Attach screenshots if available; if not, report the limitation.

**Boundaries:** read-only review. Do not modify `index.html`, production CSS, project model, Agent 4 bridge files, Agent 3 workflow, or shared browser E2E. Do not change AC-038 demo scope to force production renderer adoption.

Update `coordination/status/agent-2.md` with the review result and next 3–5 actions.

## Coordinator restart directive — 2026-11-15
Reconcile #18/#52/#73/#75 (and merged #34/#43) with current exact heads/base/CI. Preserve negative small-dirty-update results and distinguish renderer-only from production-editor timings. Review UI-01 canvas sizing/pointer behavior, then deliver UI-03 fit/actual-size/cursor-zoom/pan/DPR acceptance criteria. No index.html, model/storage, API/bridge or workflow edits.
