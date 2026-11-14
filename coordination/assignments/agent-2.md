# Agent 2 — Rendering / performance

## READY — AC-010: Validate and harden the Canvas 2D renderer prototype

You already have a prototype PR. Continue that work; do not wait for PR #6 to merge.

### Existing work
- Branch: `agent/canvas-renderer`
- PR: https://github.com/faiev/ArtClub/pull/6
- Files include `js/canvas-renderer.js`, `tests/canvas-renderer.test.js`, `benchmarks/renderer-benchmark.html`, `benchmarks/README.md`, and `docs/rendering-architecture.md`.
- The PR explicitly says no reliable Chromium timing was obtained in the development environment. Do not claim a speedup.

### Work
1. Rebase/update your branch against latest main without discarding your commits. Do not force-push.
2. Run the renderer unit tests and expand coverage for dirty rectangles, transparent pixels, crisp scaling, pointer-to-pixel mapping, overlay isolation and onion-skin composition.
3. Inspect whether the render loop handles partial redraws correctly and whether resize/device-pixel-ratio changes reset buffers safely.
4. Improve the browser benchmark page so it records repeatable DOM-grid versus Canvas timings, warm-up runs, multiple samples, median and p95, and test dimensions up to 512×512.
5. If local Chromium cannot run, do not fabricate results. Make the benchmark runnable from the live app or a local browser and document exactly how the user can collect results.
6. Update PR #6 with the validation summary and any fixes.

### File scope
`js/canvas-renderer.js`, `tests/canvas-renderer.test.js`, `benchmarks/*`, `docs/rendering-architecture.md`. Do not edit `index.html`, project model, Agent API or MCP bridge.

### Acceptance criteria
- Correctness tests cover the cases above.
- Benchmark reports actual measured values only, with methodology.
- No performance gain is claimed unless measured.
- Renderer remains isolated; the active app renderer is not replaced.

### Handoff
Update the existing draft PR and only `coordination/status/agent-2.md`.
