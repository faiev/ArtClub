# Status — Agent 2

## Active workstream
- **Active phase:** AC-088 — Live-editor versus Canvas renderer workload study
- **Status:** IN_PROGRESS — AC-038 submitted as PR #75; starting AC-088 on a separate branch without waiting for review.
- **Coordination source:** main
- **AC-088 branch:** create `agent/live-editor-canvas-workload-study` from current main after this status update.
- **Allowed files:** `tests/canvas-renderer.browser.*`, `benchmarks/renderer-*`, renderer validation/integration docs only. No `index.html`, project model, shared workflow, Agent API, bridge or MCP edits.

## Completed phases and PR ledger

### AC-028 — Real-browser renderer validation
- **PR #18:** https://github.com/faiev/ArtClub/pull/18 — open draft; currently not mergeable, requires base/branch reconciliation and exact-head validation.
- **Branch/head at last recorded refresh:** `agent/renderer-browser-validation` @ `087bf1ef0d6da4d9da6a9f60672944cb47743c3c`.
- **Evidence:** 7 real Chromium raster assertions passed, 0 failed, 0 page errors, Chromium 144.0.7559.96, DPR 1.5. Workflow #258 on that head passed 70 Node tests plus existing editor Chromium/GIF/MCP checks. Dedicated assertions are not wired into the shared workflow.

### AC-034 — Viewport/navigation utility
- **PR #34:** https://github.com/faiev/ArtClub/pull/34 — **merged** as `3bd35de8b75adf52945eb58c64407e74c815bcc7`.
- **Main module:** `js/canvas-viewport.js`.
- **Tests/contract:** 15 focused local equivalent-source tests passed. Refreshed exact-head workflow #600 on `041bbb114db5a0618420ad330ff8a7d95814c053`: Node/model suite **175 passed, 0 failed**; Chromium editor E2E, GIF browser verification and MCP E2E passed.

### AC-035 — Renderer project-state adapter
- **PR #43:** https://github.com/faiev/ArtClub/pull/43 — **merged** as `79013ee60239dfb4665c34f258dd6d69fdb2dac0`.
- **Main module:** `js/canvas-renderer-adapter.js`.
- **Tests/contract:** 20 focused equivalent-fixture tests passed. Refreshed exact-head workflow #601 on `1af6025f09ad89bd0d62c266d13dba1e56e1d82f`: Node/model suite **180 passed, 0 failed**; Chromium editor E2E, GIF browser verification and MCP E2E passed.
- **Known contract:** renderer accepts opaque HEX or null; adapter throws if final composition remains partially transparent.

### AC-036 — Browser visual/accessibility inspection
- **PR #52:** https://github.com/faiev/ArtClub/pull/52 — open draft; current PR not mergeable, exact-head revalidation and base sync still needed.
- **Branch/head at last recorded refresh:** `agent/canvas-renderer-accessibility` @ `c45ba40273bc0e372e3a1fab7d9f6709195a64e3`.
- **Dedicated local evidence:** Chromium 144.0.7559.96, DPR 1/1.25/1.5/2; each context passed 10 backing/visual assertions, focus boundaries, accessible name/role, overlay pointer transparency, resize, 24/24 teardown cycles; 0 page errors. Python Playwright local run; standard workflow does not invoke this custom matrix.

### AC-037 — Large-canvas renderer workload characterization
- **PR #73:** https://github.com/faiev/ArtClub/pull/73 — open draft; current PR not mergeable, requires base sync and exact-head revalidation.
- **Branch/head at last recorded sync:** `agent/canvas-renderer-workload-benchmarks` @ `129626efc53bed49ef6031e1d59c87e5399cc1aa`.
- **Artifacts:** `benchmarks/renderer-workload-benchmark.html`, `.mjs`, `renderer-workload-report.json`, `renderer-workload.md`.
- **Evidence:** 33 measured cases, 2 explicitly unmeasured; 5 sizes × 7 scenarios, 2 warm-ups and 5 raw samples per renderer, median/p95/mean/SD/CV/raw samples. Python Playwright, Chromium 144.0.7559.96, DPR 1.5, one Linux runner. Committed Node Playwright runner was not invoked locally because Node Playwright was unavailable in that runtime.
- **512×512 key result:** full sparse DOM median/p95 3530.6/3905.5ms vs Canvas 13.8/18.2ms; full dense DOM 3469.9/4515.4ms vs Canvas 37.4/45.9ms. For 64 dense 1px edits, DOM 0.1/0.3ms (near timer resolution) vs Canvas 1077.1/1230.8ms due to whole-array validation on each renderer call. Keep this negative result prominent.
- **Known buffer estimate:** 7.383MiB at 512/DPR1.5, or 9.383MiB with two onion snapshots; not measured RSS/GPU memory. Two dense 512 DOM overlay/onion cases did not complete and are explicitly recorded as unmeasured.
- **Scope limit:** renderer-only, not editor E2E or paint-to-photon; no general speedup claim.

### AC-038 — Integration readiness demo/package
- **PR #75:** https://github.com/faiev/ArtClub/pull/75 — open draft, **mergeable**, base `main`.
- **Branch/head:** `agent/canvas-renderer-integration-readiness` @ `cd36ce37e796106b472772a7783ad942158631ae`; main `c2b0d4c395497f05756fb60723ef251ca2eaa788`; compare **12 ahead, 0 behind**.
- **Diff:** exactly four files: `demos/canvas-renderer-integration.html`, `docs/CANVAS_RENDERER_INTEGRATION.md`, `tests/canvas-renderer-integration-demo.test.js`, `tests/canvas-renderer-integration-demo.browser.mjs`. Duplicate viewport source was removed after PR #34/#43 merged. No production UI changes.
- **Dedicated Chromium evidence:** exact page and exact modules from main, Python Playwright, Chromium 144.0.7559.96, DPR 1/1.25/1.5/2. **4/4 contexts passed**, 0 page errors; frame changes, overlays/onion, fit/actual, button/keyboard/wheel zoom, resize/DPR and renderer cleanup all passed. Separate fallback context rendered 768/768 cells, hid Canvas and produced 0 page errors. Runner committed; standard CI does not interact with the demo.
- **Exact-head workflow #747:** https://github.com/faiev/ArtClub/actions/runs/43619927046 — **both jobs succeeded** on exact head `cd36ce37e796106b472772a7783ad942158631ae`: Node/model suite **243 passed, 0 failed**; standard Chromium editor E2E, GIF browser verification and MCP E2E passed.
- **Recommendation:** defer production Canvas renderer replacement; AC-037 shows the current repeated-dirty-call path is materially slower and AC-038 is only an isolated demo. DOM renderer remains active; production UI/ `index.html` stays coordinator-owned.

## AC-088 — active scope
- Create a reproducible real-Chromium study separating three categories: **production editor end-to-end**, **isolated DOM-grid renderer**, and **isolated Canvas renderer**.
- Representative actions: initial render, repeated brush strokes, erasing, fill-like full updates, zoom/resize, grid/selection overlays, frame switches and project reopen/close.
- Sizes 32/64/128/256/512; sparse/dense; warm-ups and repeated samples; median, p95, variance and raw observations.
- Record browser/runtime, OS, DPR, viewport, available hardware context, DOM-node/memory estimates, and slow/failed cases.
- Define adoption gates for pixel parity, input latency, frame budget, accessibility/focus, cleanup and fallback; make an adopt/defer/reject recommendation.
- No production UI changes or claim of renderer speedup based only on isolated measurements.

## Next authorized queue
1. **AC-088 (active):** establish three separate benchmark lanes and instrument real editor actions without editing application code.
2. Reconcile/sync PR #18, #52 and #73 against current main, then rerun exact-head tests/evidence before asking for review.
3. Keep PR #75 draft for coordinator review; do not merge or self-accept.
4. Provide specialist review for the coordinator's UI-03 navigation/renderer wiring when requested, within review-only boundaries.

## Shared constraints
- Agent 3 retains `.github/workflows/project-tests.yml` ownership for AC-027; no workflow edits until explicit release.
- No `index.html`, production UI/CSS, project model, Agent API, bridge or MCP edits. No renderer switch.
- Use dedicated feature branches, merge main without force-push, preserve exact tested SHAs and distinguish standard E2E from custom benchmark/demo evidence.
- **Last updated:** 2026-11-14 — AC-038 submitted with exact-head CI and dedicated Chromium evidence; AC-088 started.
