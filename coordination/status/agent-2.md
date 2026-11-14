# Status — Agent 2

## Active workstream
- **Active phase:** AC-035 — Canvas renderer state adapter and invalidation contract
- **Status:** IN_PROGRESS — AC-028 and AC-034 are submitted as separate draft PRs; continuing next authorized phase without waiting for reviews.
- **Coordination source:** main (PR #7 merged)
- **AC-035 branch:** agent/canvas-renderer-adapter (create from latest main after this status update)
- **AC-035 allowed files:** js/canvas-renderer-adapter.js, tests/canvas-renderer-adapter.test.js, renderer/adapter documentation only.

## Completed phase — AC-028
- **PR #18:** https://github.com/faiev/ArtClub/pull/18 (open, draft, unmerged)
- **Branch/head:** agent/renderer-browser-validation @ 5b40cebabf12521cf62f3dbeeaf18257ff5f0fb0; synchronized with main ba1f36a59f08135127af6a03737f7bf92d8ade9c (8 ahead, 0 behind at sync).
- **Deliverables:** tests/canvas-renderer.browser.html, tests/canvas-renderer.browser.mjs, benchmarks/renderer-browser-validation.md, benchmarks/renderer-browser-validation-report.json.
- **Real Chromium:** 7 assertions passed, 0 failed, 0 page errors in Chromium 144.0.7559.96 at DPR 1.5. Full native/enlarged pixels, transparency, overlays, fractional pointer mapping, revision invalidation, onion-mask clearing, and invalid-input atomicity exercised. Semi-transparent visible tint permits only one RGB unit of premultiplied-alpha readback quantization; internal buffer/clearing remain exact.
- **Benchmark:** one renderer-only run, 2 warm-ups and 5 measured samples at all sizes. 512×512 medians/p95: DOM 2667.5/2989.5 ms; Canvas 22.8/54.1 ms. Complete raw samples and environment committed as JSON. This single-container measurement is not a general speedup claim.
- **CI:** existing project workflow run #214 on exact synchronized head 5b40cebabf12521cf62f3dbeeaf18257ff5f0fb0: Node/model job passed; editor Chromium E2E and GIF verification passed; MCP step was running at last check. Existing workflow does not run the dedicated AC-028 test runner. Browser assertions/benchmark were separately run with Python Playwright because Node Playwright was unavailable locally.

## Completed phase — AC-034
- **PR #34:** https://github.com/faiev/ArtClub/pull/34 (open, draft, unmerged)
- **Branch/head:** agent/canvas-viewport @ b6f4ac63c7038b9f3453a8884c1979399bcb81b1; synced with main cc7663ef1aa32ca3e9c18cc275aa2867c5ad68aa without force-push.
- **Files:** js/canvas-viewport.js, tests/canvas-viewport.test.js, docs/CANVAS_VIEWPORT.md.
- **Scope:** pure pan/zoom/fit/reset, cursor-anchored zoom, edge clamp/centering, canvas↔CSS coordinate transforms, fractional client bounds, DPR backing conversions, resize-center preservation, deterministic versioned serialization and fail-fast validation.
- **Local validation:** Node 22.16.0: node --check js/canvas-viewport.js passed; node --test tests/canvas-viewport.test.js — 15 passed, 0 failed on an equivalent local source mirror. PR-head CI pending.

## Next authorized queue
1. **AC-035 (active):** adapt v2 project/frame/layer state deterministically into renderer inputs; frame/composite revisions must cover layer order, visibility, opacity, active frame and onion neighbors; validate mismatched/stale frame data. Own adapter/tests/docs only.
2. **AC-036:** browser visual/accessibility pack: DPR 1/1.25/1.5/2, focus boundaries, overlay pointer transparency, resize/zoom/backing-store recreation, teardown/remount.
3. **AC-037:** large-canvas characterization for sparse/dense rasters, dirty/full redraw, overlays/onion skins, variance and memory estimates.
4. **AC-038:** integration-readiness document and isolated demo composing viewport + adapter + renderer. No live UI wiring.
5. After each phase, create a narrow PR and continue on a new branch; keep all branches synced to latest main.

## Shared constraints and blockers
- Agent 3 owns .github/workflows/project-tests.yml during PR #11 / AC-027. No workflow edits until released.
- index.html, project model, Agent API, MCP and bridge are not editable in this workstream. Project model may be read to implement AC-035 but not changed.
- AC-012/live UI renderer integration is not authorized. DOM renderer remains active.
- No blockers for AC-035; inspect the exact v2 model shape first.
- **Last updated:** 2026-11-14 — AC-034 submitted; started AC-035.
