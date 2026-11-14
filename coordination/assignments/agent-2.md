# Agent 2 — Rendering / performance

## AC-010 — Canvas renderer prototype

Your AC-010 implementation has been accepted as an isolated prototype and merged:

- PR #6: https://github.com/faiev/ArtClub/pull/6
- Merge commit: `1ba0aaee597d5bf11083c97a03a312c7ee434530`
- CI run #43605014989 passed: 58 Node tests, Chromium editor E2E and MCP E2E.

The active editor still uses the DOM renderer. No AC-012 integration is authorized, and no performance speedup is claimed because the renderer benchmark has not yet been measured.

## NEW ASSIGNMENT — AC-028: Real-browser renderer validation and benchmark capture

### Branch
`agent/renderer-browser-validation`

Branch was created from main at `1ba0aaee597d5bf11083c97a03a312c7ee434530`. Main has since advanced with the merged coordination system; merge the latest main into this branch before implementation, without force-pushing.

This dedicated branch already exists.

### Goal
Add a repeatable real-browser validation suite for the isolated Canvas renderer and collect benchmark measurements with explicit environment metadata.

### Files
- `tests/canvas-renderer.browser.html`
- `tests/canvas-renderer.browser.mjs`
- `benchmarks/renderer-browser-validation.md`
- `benchmarks/renderer-benchmark.html` only if the existing harness needs a focused correction.
- `.github/workflows/project-tests.yml` only after the coordinator releases this file lock following PR #11 integration. Until then, develop the browser harness and docs without editing the workflow file.

### Required checks
1. Real Chromium rendering: compare complete ImageData/output pixels against exact known input buffers.
2. Transparency and nearest-neighbor scaling at native and enlarged display sizes.
3. Grid/selection overlay must not contaminate artwork pixels.
4. Pointer-to-logical-pixel mapping at fractional CSS dimensions and DPR.
5. Frame/composite revision change forces full redraw.
6. Onion mask change and clearing removes stale tints.
7. Invalid/sparse pixel inputs fail before visible output or render buffer mutation.
8. Run DOM-grid versus Canvas measurements at 32, 64, 128, 256 and 512 dimensions; include warm-up, multiple samples, median, p95, raw samples, browser version and runner/hardware details.

### Limits
- Do not change `index.html`, editor UI, project model, Agent API or MCP bridge.
- Do not claim a general speedup from one CI runner.
- Report renderer-only measurements separately from the existing editor's full render costs.
- Keep the current DOM renderer as the active application renderer.

### Handoff
Open a new draft PR from `agent/renderer-browser-validation`, report exact test commands and measured results, and update only `coordination/status/agent-2.md`.
