# Status — Agent 2

## Active workstream
- **Active phase:** AC-037 — Large-canvas renderer performance characterization
- **Status:** IN_PROGRESS — AC-028, AC-034, AC-035 and AC-036 submitted as separate draft PRs; continuing the authorized workstream without waiting for review.
- **Coordination source:** main (PR #7 merged)
- **AC-037 branch:** create `agent/canvas-renderer-workload-benchmarks` from latest main after this status update.
- **Allowed files:** `benchmarks/renderer-*.html`, `benchmarks/renderer-*.mjs`, `benchmarks/renderer-*.json`, `benchmarks/renderer-*.md`, renderer performance docs only.

## Submitted phase — AC-028
- **PR #18:** https://github.com/faiev/ArtClub/pull/18 (open, draft, unmerged).
- **Branch/head:** `agent/renderer-browser-validation` @ `087bf1ef0d6da4d9da6a9f60672944cb47743c3c`; synchronized with main `a5c1a008a12e919a1b8a74f0dde58920d944acbc` without force; compare 9 ahead, 0 behind.
- **Files:** tests/canvas-renderer.browser.html, tests/canvas-renderer.browser.mjs, benchmarks/renderer-browser-validation.md, benchmarks/renderer-browser-validation-report.json.
- **Real Chromium:** 7 assertions passed, 0 failed, 0 page errors in Chromium 144.0.7559.96 at DPR 1.5. Full native/enlarged pixels, transparency, overlays, fractional pointer mapping, frame/composite invalidation, onion-mask clearing and invalid-input atomicity exercised.
- **Benchmark:** one renderer-only run, 2 warm-ups and 5 measured samples at all sizes. 512×512 medians/p95: DOM 2667.5/2989.5 ms; Canvas 22.8/54.1 ms. Raw samples and metadata committed. One-run evidence only.
- **Exact-head CI run #258:** https://github.com/faiev/ArtClub/actions/runs/43610309367 — success. Node/model suite 70/70; Chromium editor E2E, GIF browser verification and MCP E2E passed. Dedicated AC-028 runner is not wired into the locked workflow.

## Submitted phase — AC-034
- **PR #34:** https://github.com/faiev/ArtClub/pull/34 (open, draft, unmerged).
- **Branch/head:** `agent/canvas-viewport` @ `582d79f32b2bb7b2e4565432c8e78b777702ab94`; synchronized with main `a5c1a008a12e919a1b8a74f0dde58920d944acbc`; compare 6 ahead, 0 behind.
- **Files:** js/canvas-viewport.js, tests/canvas-viewport.test.js, docs/CANVAS_VIEWPORT.md.
- **Scope:** pure pan/zoom/fit/reset, cursor-anchored zoom, edge clamp/centering, canvas↔CSS coordinates, fractional client bounds, DPR backing conversions, resize-center preservation, deterministic versioned serialization and fail-fast validation.
- **Local equivalent-source tests:** 15 passed, 0 failed.
- **Exact-head CI run #261:** https://github.com/faiev/ArtClub/actions/runs/43610317098 — success; Node/model suite 85/85, Chromium editor E2E, GIF browser and MCP passed.

## Submitted phase — AC-035
- **PR #43:** https://github.com/faiev/ArtClub/pull/43 (open, draft, unmerged).
- **Branch/head:** `agent/canvas-renderer-adapter` @ `a5204fd6e935dd5639cf8f17bfb245a45df68d52`; synchronized with main `a5c1a008a12e919a1b8a74f0dde58920d944acbc`; compare 4 ahead, 0 behind.
- **Files:** js/canvas-renderer-adapter.js, tests/canvas-renderer-adapter.test.js, docs/CANVAS_RENDERER_ADAPTER.md.
- **Scope:** deterministic v2 project-to-renderer conversion, bottom-to-top opacity compositing, adjacent-frame onion composites, stable structural revision, stale-frame rejection and malformed/sparse cel validation. Final partial alpha fails explicitly because current renderer accepts only opaque HEX/null.
- **Local equivalent-fixture tests:** 20 passed, 0 failed. Committed suite imports real ProjectModel.
- **Exact-head CI run #264:** https://github.com/faiev/ArtClub/actions/runs/43610386964 — success; Node/model suite **90/90**, Chromium editor E2E, GIF browser verification and MCP E2E all passed.

## Submitted phase — AC-036
- **PR #52:** https://github.com/faiev/ArtClub/pull/52 (open, draft, unmerged).
- **Branch/head:** `agent/canvas-renderer-accessibility` @ `c45ba40273bc0e372e3a1fab7d9f6709195a64e3`; synchronized with main `716ba1cc10a37d5bb49b3b6eb9207bc39ee9eda5` without force; compare 6 ahead, 0 behind.
- **Files:** tests/canvas-renderer-accessibility.html, tests/canvas-renderer-accessibility.mjs, docs/RENDERER_BROWSER_VALIDATION.md.
- **Real Chromium:** system Chromium 144.0.7559.96; DPR contexts 1, 1.25, 1.5 and 2. Each context: 10 visual/backing assertions passed; keyboard focus boundaries and visible ring passed; accessible name/role passed; pointer-transparent overlay passed; resize/backing-store recreation passed; 24/24 teardown cycles passed. 4/4 contexts; 0 page errors.
- **Known contract detail:** fractional CSS dimensions are supplied via measured DOMRect width/height to renderer displayWidth/displayHeight options; clientWidth/clientHeight are integer CSSOM values and can round fractional dimensions.
- **Screenshot:** a full-page DPR 1.5 screenshot was captured locally at `/mnt/data/ArtClub-agent2/accessibility-local/evidence-dpr-1.5.png`; the docs do not claim it is committed.
- **CI:** run #309 on pre-sync head `278b1bc51f0778ecec9ab670015c3701b318a051` had Node test job success and Chromium editor/GIF/MCP steps completed; final result was in progress at last check. The branch then merged latest main and needs a new exact-head result. The existing workflow does not run the dedicated AC-036 runner.

## Next authorized queue
1. **AC-037 (active):** sparse and dense canvases; frequent 1×1 dirty edits versus full redraws; grid/selection overlays; onion-before/after workloads; raw samples, median, p95, variance and typed-buffer memory estimates. Separate renderer-only timing from full-editor timing. Document slower cases without hiding them.
2. **AC-038:** integration-readiness document and isolated demo composing viewport + adapter + renderer. No `index.html` or live UI wiring without coordinator lock.

## Shared constraints
- Agent 3 owns `.github/workflows/project-tests.yml` during PR #11 / AC-027; no workflow edit until released.
- `index.html`, project model, app UI, Agent API, MCP and bridge are not editable in this workstream. No AC-012/live UI integration.
- Keep one narrow PR per phase, branches synced to main without force-push, and do not self-merge or mark work accepted.
- **Last updated:** 2026-11-14 — AC-036 submitted; AC-037 started.
