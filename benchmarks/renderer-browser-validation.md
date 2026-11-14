# AC-028 — Real-browser renderer validation and benchmark

**Status:** Browser harness authored; real Chromium execution and timing capture are pending. Do not interpret the existing benchmark page or this document as measured performance evidence.

## Scope

This validates the isolated `CanvasPixelRenderer` in a real Chromium runtime. It does not switch the editor away from its DOM renderer and does not claim the Canvas implementation is faster end-to-end.

The Playwright runner covers:

1. Complete native-size RGBA raster equality, including transparent pixels.
2. Complete enlarged raster equality using nearest-neighbor scaling.
3. Grid and selection overlay isolation from the artwork `ImageData` buffer.
4. Pointer mapping with fractional CSS bounds and a 1.5 device-pixel ratio.
5. Full redraw behavior on `frameId` and `compositeRevision` changes, checked against every visible raster byte.
6. Onion-mask changes and stale-tint clearing, checked against every visible raster byte.
7. Sparse/undefined pixel and onion-mask rejection before visible or renderer-buffer mutation.

The benchmark runner opens the existing `benchmarks/renderer-benchmark.html` and captures DOM-grid versus Canvas timings at 32, 64, 128, 256 and 512. It reports warm-up count, multiple raw samples, median, nearest-rank p95, browser version, device-pixel ratio, user agent, platform, hardware concurrency, CPU model, logical CPU count and available-memory metadata.

## Run locally

From the repository root, install the existing bridge dependency and Chromium once:

```sh
cd agent-bridge
npm install --ignore-scripts
npx playwright install chromium
node ../tests/canvas-renderer.browser.mjs
```

The runner starts a temporary static server and shuts it down on completion. The script defaults to one warm-up and three measured samples per renderer to keep the 512×512 DOM baseline bounded. Override with `ARTCLUB_BENCHMARK_WARMUPS` and `ARTCLUB_BENCHMARK_SAMPLES`; samples are clamped to 3–15 and warm-ups to 1–5. The benchmark prints its complete JSON report, including raw samples, to stdout.

## Interpretation

- These are renderer-only synchronous microbenchmarks. They exclude editor compositing, brush/fill work, pointer latency, frame scheduling, accessibility interactions and application-model costs.
- Compare only runs with documented browser, OS, CPU, memory, power mode and device-pixel ratio. A single runner is not representative evidence of a general speedup.
- A passing renderer browser suite establishes the tested pixels and invalidation behavior in that Chromium version; it does not authorize renderer UI integration.
- The DOM renderer remains the active application renderer. AC-012 remains separately queued and requires coordinator approval and a UI file lock.

## Execution record

| Item | Result |
|---|---|
| Main base | `6759e751074e16eaf328fe5a073318bcc2bc2ba6` |
| Browser test execution | Not yet run in this environment |
| Benchmark measurements | Not yet captured |
| Chromium version / runner hardware | Pending execution |
| Workflow integration | Deferred; `.github/workflows/project-tests.yml` remains locked by Agent 3 during PR #11 reconciliation |

No timing values are stated until the Playwright runner completes on a real browser.
