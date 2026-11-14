# Status — Agent 2

## Active workstream
- **Active phase:** AC-038 — Canvas renderer integration readiness package
- **Status:** IN_PROGRESS — AC-037 submitted as PR #73; continuing without waiting for review.
- **Coordination source:** main (PR #7 merged)
- **AC-038 branch:** create `agent/canvas-renderer-integration-readiness` from latest main after this status update.
- **Allowed files:** `docs/CANVAS_RENDERER_INTEGRATION.md`, an isolated demo page under `demos/` or `tests/` that composes viewport + adapter + renderer. Do not modify production UI, project model, shared workflow, Agent API or bridge.

## Submitted phases

### AC-028 — browser raster validation and initial benchmark
- **PR #18:** https://github.com/faiev/ArtClub/pull/18 (open, draft).
- **Branch/head at latest refresh:** `agent/renderer-browser-validation` @ `087bf1ef0d6da4d9da6a9f60672944cb47743c3c`.
- **Files:** tests/canvas-renderer.browser.html/.mjs; benchmarks/renderer-browser-validation.md and JSON.
- **Evidence:** 7 real Chromium assertions passed, 0 failed, 0 page errors, Chromium 144.0.7559.96, DPR 1.5.
- **CI run #258:** https://github.com/faiev/ArtClub/actions/runs/43610309367 — 70 Node tests and existing Chromium editor, GIF and MCP checks passed. Dedicated AC-028 runner was not in workflow.
- **Note:** earlier one-run microbenchmark is not a general performance claim.

### AC-034 — viewport/navigation utility
- **PR #34:** https://github.com/faiev/ArtClub/pull/34 (open, draft).
- **Branch/head at latest refresh:** `agent/canvas-viewport` @ `582d79f32b2bb7b2e4565432c8e78b777702ab94`.
- **Files:** js/canvas-viewport.js, tests/canvas-viewport.test.js, docs/CANVAS_VIEWPORT.md.
- **Scope:** pure pan/zoom/fit/reset, cursor anchored zoom, clamping, logical↔CSS conversions, fractional bounds, DPR helpers, resize-center preservation and serialization.
- **Local equivalent-source tests:** 15 passed, 0 failed.
- **CI run #261:** https://github.com/faiev/ArtClub/actions/runs/43610317098 — 85 Node tests and existing Chromium editor, GIF and MCP checks passed.

### AC-035 — renderer state adapter
- **PR #43:** https://github.com/faiev/ArtClub/pull/43 (open, draft).
- **Branch/head at latest refresh:** `agent/canvas-renderer-adapter` @ `a5204fd6e935dd5639cf8f17bfb245a45df68d52`.
- **Files:** js/canvas-renderer-adapter.js, tests/canvas-renderer-adapter.test.js, docs/CANVAS_RENDERER_ADAPTER.md.
- **Scope:** v2 project composition, bottom-to-top layers, visibility/opacity, active frame and onion neighbors, structural composite revision, stale-frame rejection, strict cel validation. Partial alpha fails explicitly under current HEX/null renderer contract.
- **Local equivalent-fixture tests:** 20 passed, 0 failed.
- **CI run #264:** https://github.com/faiev/ArtClub/actions/runs/43610386964 — 90 Node tests and existing Chromium editor, GIF and MCP checks passed.

### AC-036 — browser visual/accessibility pack
- **PR #52:** https://github.com/faiev/ArtClub/pull/52 (open, draft).
- **Branch/head:** `agent/canvas-renderer-accessibility` @ `c45ba40273bc0e372e3a1fab7d9f6709195a64e3` at last recorded sync; board specifically notes exact-current-head revalidation is still needed.
- **Files:** tests/canvas-renderer-accessibility.html/.mjs, docs/RENDERER_BROWSER_VALIDATION.md.
- **Real Chromium local evidence:** DPR 1, 1.25, 1.5, 2; each context 10 visual/backing checks, focus order, visible focus ring, accessible name/role, pointer-transparent overlay, resize/backing-store recreation and 24/24 teardown cycles passed; 0 page errors.
- **Caveat:** custom matrix was run separately using Python Playwright; standard workflow does not invoke it. Fractional display dimensions need measured DOMRect values passed to renderer options. DPR1.5 screenshot exists locally, not committed.
- **Exact current head CI:** pending revalidation after latest branch sync; do not infer from the prior pre-sync run.

### AC-037 — large-canvas workload characterization
- **PR #73:** https://github.com/faiev/ArtClub/pull/73 (open, draft).
- **Branch/head:** `agent/canvas-renderer-workload-benchmarks` @ `129626efc53bed49ef6031e1d59c87e5399cc1aa`.
- **Base synchronized:** main `567c178df307b8332f6dd156b313021be77cf5f4`; compare at sync 7 ahead, 0 behind; non-force merge commit `129626efc53bed49ef6031e1d59c87e5399cc1aa`.
- **Files:** benchmarks/renderer-workload-benchmark.html, benchmarks/renderer-workload-benchmark.mjs, benchmarks/renderer-workload-report.json, benchmarks/renderer-workload.md.
- **Coverage:** 5 sizes × 7 scenarios: sparse/dense full redraw; sparse/dense repeated 1-pixel dirty edits; dense grid+selection; sparse/dense onion-before/after.
- **Evidence:** 33 measured cases, 2 explicitly unmeasured (512×512 dense grid+selection and dense onion DOM baselines did not complete). Each measured case has 2 warm-ups and 5 raw samples per renderer, with median, nearest-rank p95, mean, SD, CV and raw samples. Local Python Playwright controlling Chromium 144.0.7559.96 at DPR1.5; the committed Node runner was syntax checked but not run locally because Node Playwright package was unavailable.
- **Key result:** at 512×512, full sparse DOM median/p95 3530.6/3905.5ms vs Canvas13.8/18.2ms; dense DOM3469.9/4515.4ms vs Canvas37.4/45.9ms. 64 dense 1-pixel dirty calls: DOM0.1/0.3ms (near timer resolution) vs Canvas1077.1/1230.8ms due to validating the full input buffer on every call. This is an important negative result, not hidden.
- **Memory lower bound:** known renderer-owned buffers at 512/DPR1.5 ≈7.383MiB, or 9.383MiB with two onion snapshots; not process RSS or GPU measurement.
- **Limitations:** renderer-only test, not end-to-end editor or paint-to-photon. DOM dirty values near timer resolution; 2 512 dense DOM workloads explicitly unmeasured. No general speedup claim.
- **Integrity check:** `node --check benchmarks/renderer-workload-benchmark.mjs` passed; JSON validated, 33 measured/2 unmeasured/35 expected; all measured cases have 5 raw samples per renderer.
- **PR-head CI:** no workflow run visible yet for head `129626ef...`; check again. Shared workflow remains locked to Agent 3 and PR #73 does not change it.

## Next authorized queue
1. **AC-038 (active):** document integration/fallback/keyboard/pointer/resize lifecycle and test gates; build an isolated demo that composes viewport + adapter + renderer, no live UI wiring.
2. **AC-088:** evidence-based production-editor vs Canvas renderer workload study (separate from renderer-only measures), after AC-038.
3. Revalidate PR #52 custom matrix on exact current head once its branch/CI has caught up; do not equate standard editor E2E with the custom matrix.
4. Continue to keep earlier PRs narrow and unmerged by Agent 2.

## Shared constraints
- Agent 3 owns `.github/workflows/project-tests.yml`; do not edit until release.
- No `index.html`, project model, production UI, Agent API, bridge or MCP edits. No AC-012/live UI integration.
- Branches synced with main using non-force merges; do not self-merge or self-accept.
- **Last updated:** 2026-11-14 — AC-037 submitted; AC-038 started.
