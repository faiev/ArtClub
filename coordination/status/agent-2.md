# Status — Agent 2

## Active workstream
- **Active phase:** AC-034 — Canvas viewport and navigation utility
- **Status:** IN_PROGRESS — AC-028 browser validation/benchmark submitted as PR #18; started the next authorized isolated module without waiting for PR review.
- **Coordination source:** `main` (PR #7 merged)
- **Feature branch:** `agent/canvas-viewport` (to be created from latest main)
- **Active phase allowed files:** `js/canvas-viewport.js`, `tests/canvas-viewport.test.js`, viewport integration-contract docs.
- **No blocker:** the Agent 3 workflow lock and coordinator UI lock do not prevent this pure, renderer-independent module.

## Completed phase — AC-028
- **PR:** #18 — https://github.com/faiev/ArtClub/pull/18 (open, draft, unmerged)
- **Branch:** `agent/renderer-browser-validation`
- **Synchronized feature head:** `5b40cebabf12521cf62f3dbeeaf18257ff5f0fb0`
- **Latest main incorporated:** `ba1f36a59f08135127af6a03737f7bf92d8ade9c`; branch compare at sync: 8 ahead, 0 behind. Sync used a non-force merge commit.
- **Changed files:** `tests/canvas-renderer.browser.html`, `tests/canvas-renderer.browser.mjs`, `benchmarks/renderer-browser-validation.md`, `benchmarks/renderer-browser-validation-report.json`.
- **Real browser evidence:** Chromium 144.0.7559.96 at DPR 1.5; **7 renderer checks passed, 0 failed, 0 page errors**. Checked native/enlarged full RGBA output, transparency, overlay isolation, fractional CSS pointer mapping, frame/composite invalidation, onion-mask clearing, and sparse/undefined rejection. A one-unit displayed RGB tolerance is limited to semi-transparent tint readback due to premultiplied-alpha round-trip; internal tint buffer and cleared stale pixel are exact.
- **Benchmark:** 2 warm-ups and 5 measured samples per renderer at 32, 64, 128, 256 and 512. Raw sample data and runner metadata are in the committed JSON artifact. At 512×512, DOM median/p95 2667.5/2989.5 ms; Canvas median/p95 22.8/54.1 ms. This is a single renderer-only run, not a general speedup or end-to-end claim.
- **CI run #214:** https://github.com/faiev/ArtClub/actions/runs/43609063053 on merge-synchronized head `5b40cebabf12521cf62f3dbeeaf18257ff5f0fb0`. Node/model test job passed; existing editor Chromium E2E and animated GIF browser verification passed; MCP job was still running at last check. The workflow does not invoke the dedicated AC-028 runner. Prior CI run #200 passed both existing jobs (58 Node tests, browser editor E2E, GIF verification and MCP), but was on earlier code head `14b98e0b08b316692e2c3867dc5ab6c781b00f8d`.
- **Runner limitation disclosed:** the seven browser assertions and benchmark were run via Python Playwright controlling system Chromium. The committed Node Playwright runner was not invoked directly because the Node Playwright package was unavailable in this local environment.
- **No integration:** DOM renderer remains active. No `index.html`, project model, Agent API, MCP or workflow edits. AC-012 remains separately gated.

## Next authorized queue
1. **AC-034:** implement/test `js/canvas-viewport.js` (pan, bounded zoom, fit/reset, cursor-anchored zoom, coordinate transforms, fractional CSS/DPR, clamp behavior, deterministic serialization and validation).
2. **AC-035:** deterministic v2 project/frame/layer-to-renderer adapter with revision/invalidation checks; own `js/canvas-renderer-adapter.js`, tests and docs only.
3. **AC-036:** expand browser visual/accessibility inspection pack, including 1x/1.25x/1.5x/2x, focus, overlay pointer transparency, resize/zoom, teardown/mount cycles.
4. **AC-037:** sparse/dense, dirty/full, overlays/onion performance characterization with raw artifacts and memory estimates.
5. **AC-038:** integration readiness docs and isolated demo; no `index.html` or live UI wiring without coordinator lock.

## Shared constraints
- Agent 3 owns `.github/workflows/project-tests.yml` during PR #11 / AC-027 work. Prepare tests/docs but do not edit the workflow until released.
- `index.html`, app UI wiring, project model, Agent API, MCP and bridge remain outside this workstream's current ownership.
- Keep each phase on a dedicated feature branch/PR where cohesive; keep branches synced to latest main without force-push. Never merge own PRs.
- **Last updated:** 2026-11-14 — AC-028 submitted with real-browser/benchmark evidence; continuing AC-034.
