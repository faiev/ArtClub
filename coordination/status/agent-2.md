# Status — Agent 2

## Active workstream
- **Active phase:** AC-036 — Canvas renderer browser visual / accessibility inspection pack
- **Status:** IN_PROGRESS — AC-028, AC-034 and AC-035 each submitted as separate draft PRs; continue independent phases without waiting for reviews.
- **Coordination source:** main (PR #7 merged)
- **AC-036 branch:** create `agent/canvas-renderer-accessibility` from latest main after this status update.
- **Allowed files:** new `tests/canvas-renderer-accessibility.html`, `tests/canvas-renderer-accessibility.mjs`, and `docs/RENDERER_BROWSER_VALIDATION.md`. No workflow edit while Agent 3 owns the workflow.

## Submitted phase — AC-028
- **PR #18:** https://github.com/faiev/ArtClub/pull/18 (open, draft, unmerged).
- **Branch/head:** `agent/renderer-browser-validation` @ `087bf1ef0d6da4d9da6a9f60672944cb47743c3c`; synchronized with main `a5c1a008a12e919a1b8a74f0dde58920d944acbc` without force; compare 9 ahead, 0 behind.
- **Files:** tests/canvas-renderer.browser.html, tests/canvas-renderer.browser.mjs, benchmarks/renderer-browser-validation.md, benchmarks/renderer-browser-validation-report.json.
- **Real Chromium:** 7 assertions passed, 0 failed, 0 page errors in Chromium 144.0.7559.96 at DPR 1.5. Full native/enlarged pixels, transparency, overlays, fractional pointer mapping, frame/composite invalidation, onion-mask clearing, and invalid-input atomicity exercised. Semi-transparent visible tint allows only one RGB unit of premultiplied-alpha readback quantization; internal buffer/clearing remain exact.
- **Benchmark:** one renderer-only run, 2 warm-ups and 5 measured samples at all sizes. 512×512 medians/p95: DOM 2667.5/2989.5 ms; Canvas 22.8/54.1 ms. Complete raw samples and environment committed as JSON. One-container measurement only; no general speedup claim.
- **Exact-head CI run #258:** https://github.com/faiev/ArtClub/actions/runs/43610309367 — success. Node/model suite 70 passed, 0 failed; Chromium editor E2E, GIF browser verification and MCP E2E all passed. Workflow does not invoke the dedicated AC-028 browser runner; its seven assertions and benchmark were run separately with Python Playwright because Node Playwright was unavailable locally.

## Submitted phase — AC-034
- **PR #34:** https://github.com/faiev/ArtClub/pull/34 (open, draft, unmerged).
- **Branch/head:** `agent/canvas-viewport` @ `582d79f32b2bb7b2e4565432c8e78b777702ab94`; synchronized with main `a5c1a008a12e919a1b8a74f0dde58920d944acbc` without force; compare 6 ahead, 0 behind.
- **Files:** js/canvas-viewport.js, tests/canvas-viewport.test.js, docs/CANVAS_VIEWPORT.md.
- **Scope:** pure pan/zoom/fit/reset, cursor-anchored zoom, edge clamp/centering, canvas↔CSS coordinate transforms, fractional client bounds, DPR backing conversions, resize-center preservation, deterministic versioned serialization and fail-fast validation.
- **Local validation:** Node 22.16.0 equivalent local source/test mirror: syntax check passed; 15 passed, 0 failed.
- **Exact-head CI run #261:** https://github.com/faiev/ArtClub/actions/runs/43610317098 — success. Node/model suite **85 passed, 0 failed**, Chromium editor E2E passed, GIF browser verification passed, MCP E2E passed.

## Submitted phase — AC-035
- **PR #43:** https://github.com/faiev/ArtClub/pull/43 (open, draft, unmerged).
- **Branch/head:** `agent/canvas-renderer-adapter` @ `a5204fd6e935dd5639cf8f17bfb245a45df68d52`; synchronized with main `a5c1a008a12e919a1b8a74f0dde58920d944acbc` without force; compare 4 ahead, 0 behind.
- **Files:** js/canvas-renderer-adapter.js, tests/canvas-renderer-adapter.test.js, docs/CANVAS_RENDERER_ADAPTER.md.
- **Scope:** deterministic v2 ProjectModel-to-renderer conversion; bottom-to-top layer compositing; visibility/opacity; active and adjacent frame onion composites; stable frame/composite revision; stale expected-active-frame rejection; malformed project/cel/sparse pixel validation. Final partial alpha fails explicitly because current renderer accepts only opaque HEX/null.
- **Local validation:** 20 passed, 0 failed using an equivalent local fixture mirror. The committed tests import the real repository ProjectModel and are verified by exact-head CI.
- **Exact-head CI run #264:** https://github.com/faiev/ArtClub/actions/runs/43610386964. Node/model suite **90 passed, 0 failed**; Chromium editor E2E passed. GIF-browser verification was running and MCP step pending at last check; do not call the whole run green until both finish.

## Next authorized queue
1. **AC-036 (active):** real-browser visual/accessibility pack: DPR 1, 1.25, 1.5, 2; focus/keyboard boundaries; overlay pointer transparency; selection/grid visibility and high-contrast palette; resize/browser zoom/backing-store recreation; repeated mount/unmount and teardown cleanup. Document reproducible manual checks in docs/RENDERER_BROWSER_VALIDATION.md. Do not touch the workflow until released.
2. **AC-037:** large-canvas characterization for sparse/dense rasters, dirty/full redraw, overlays/onion skins, variance and memory estimates; commit raw artifacts and avoid general speedup claims from a single runner.
3. **AC-038:** integration-readiness document and isolated demo composing viewport + adapter + renderer. No `index.html` or live UI wiring without coordinator lock.
4. Create a separate narrow PR per phase and continue; keep branches synchronized to latest main without force.

## Shared constraints
- Agent 3 owns `.github/workflows/project-tests.yml` during PR #11 / AC-027. No workflow edits until released.
- `index.html`, project model, app UI, Agent API, MCP and bridge are not editable in this workstream. Read-only use of project model for the adapter is permitted.
- AC-012/live UI renderer integration is not authorized. DOM renderer remains active.
- **Last updated:** 2026-11-14 — AC-035 submitted; AC-036 started.
