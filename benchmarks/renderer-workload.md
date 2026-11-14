# AC-037 — Large-canvas renderer workload characterization

## Scope and evidence

This report compares the isolated production Canvas 2D prototype with a DOM-grid renderer baseline. It is a **renderer-only microbenchmark**, not a measurement of the full editor. It excludes project compositing, brush/fill algorithms, pointer processing, scheduling, accessibility interaction, and end-to-end frame presentation.

- Browser: headless Chromium **144.0.7559.96**
- Runner: Linux x86_64 local execution container, Python Playwright controlling `/usr/bin/chromium`
- CPU context: Intel Xeon Platinum 8573C; 3 logical CPUs exposed
- Reported memory: approximately 5.81 GiB
- Device-pixel ratio: **1.5**
- Sizes: 32×32, 64×64, 128×128, 256×256, 512×512
- Workload cases: 7 per size; **33 measured, 2 unmeasured**
- Measured cases: **2 warm-ups and 5 measured samples per renderer**
- Statistics: median, nearest-rank p95, mean, population standard deviation, coefficient of variation and all raw samples
- Full raw report: [renderer-workload-report.json](renderer-workload-report.json)

Each workload case ran in a fresh Chromium process to limit memory/DOM-node accumulation between cases. The committed Node Playwright runner is the reproducible repository entry point; it was not invoked in this local runtime because the repository's Node Playwright dependency was unavailable. The reported data was captured by the local Python Playwright harness against the same HTML workload page and production renderer module.

## Workloads

| Scenario | DOM baseline | Canvas prototype |
|---|---|---|
| `full_sparse` | Build/replace an accessible pixel-cell grid with 5% occupied pixels | Full `renderer.render(state)` of the same sparse raster |
| `full_dense` | Same grid with all pixels occupied | Full render of dense raster |
| `dirty_1px_sparse` | Update existing cell background styles in a batch | One `render(state, one-pixel dirtyRect)` call per edit |
| `dirty_1px_dense` | Same style update on dense artwork | Same per-pixel Canvas dirty calls |
| `overlay_grid_selection_dense` | Per-cell grid borders and selection outlines | Separate production Canvas grid/selection overlay surface |
| `onion_before_after_sparse` | RGBA CSS backgrounds for sparse before/after masks | Production Canvas onion-before/onion-after masks |
| `onion_before_after_dense` | RGBA CSS backgrounds for dense before/after masks | Production Canvas onion-before/onion-after masks |

Full DOM rendering creates a `div` per logical pixel, adds `tabIndex`, `role="gridcell"`, `aria-label` and background color, inserts via `DocumentFragment`, replaces the grid, and reads layout. Canvas full-render timing calls the production renderer and reads one output pixel to flush pending Canvas 2D work.

Dirty edit batches use 256 edits per sample at 32–128, and 64 at 256–512. The DOM path writes cell styles, reads computed background color and forces grid layout. The Canvas path makes a full renderer call for each one-pixel dirty rectangle and reads the visible canvas after the batch. The lower batch size at large dimensions is intentional: the current Canvas renderer validates the full source array on every call, and larger batches exceeded the isolated-runner budget. The exact update count is recorded in each JSON result.

## Largest measured canvas: 512×512

Median / p95 in milliseconds (five measured samples):

| Scenario | DOM median / p95 | Canvas median / p95 | Notes |
|---|---:|---:|---|
| Full sparse redraw | 3530.6 / 3905.5 | 13.8 / 18.2 | Canvas CV 0.353; raw samples show notable spread |
| Full dense redraw | 3469.9 / 4515.4 | 37.4 / 45.9 | Canvas CV 0.155 |
| 64 sparse 1-pixel edits | 0.1 / 0.8 | 229.8 / 389.3 | Canvas median ≈3.59 ms/edit |
| 64 dense 1-pixel edits | 0.1 / 0.3 | 1077.1 / 1230.8 | Canvas median ≈16.83 ms/edit |
| Sparse onion before + after | 3002.3 / 4216.9 | 42.3 / 58.7 | Canvas CV 0.208 |
| Dense overlay grid + selection | Unmeasured | Unmeasured | DOM baseline did not complete within the isolated execution window |
| Dense onion before + after | Unmeasured | Unmeasured | DOM baseline did not complete within the isolated execution window |

The dirty DOM timings are at or close to the timer's sub-millisecond resolution. A reported `0.0 ms` is a rounded measurement, **not proof of literally zero work**. These numbers are not a paint-to-photon comparison: DOM updates force style/layout resolution, while Canvas uses a readback to flush Canvas drawing work.

## Other key findings

- Full redraws: at 256×256, sparse DOM median/p95 was 1057.0/1125.5 ms versus Canvas 4.4/10.8 ms; dense DOM was 862.3/1131.2 ms versus Canvas 12.5/22.7 ms.
- Grid/selection overlays: at 256×256, DOM median/p95 was 1001.8/1440.8 ms versus Canvas 13.2/23.8 ms.
- Onion skin: at 256×256, dense before/after masks measured DOM 753.8/896.7 ms versus Canvas 28.5/32.6 ms. Sparse masks measured DOM 764.6/1306.7 ms versus Canvas 9.9/16.8 ms.
- Repeated small dirty edits are a clear weakness in the current Canvas prototype. The renderer validates every pixel in its source array on each `render(state, dirtyRect)` call. At 512×512 this makes 64 dirty calls expensive, especially for dense buffers. This should be addressed before considering Canvas as the production renderer for brush strokes.
- Variance is not uniform. See per-case coefficient of variation and raw samples in the JSON; for example 512 sparse full Canvas CV is 0.353 and 256 overlay Canvas CV is 0.342.

## Known renderer-buffer memory lower bound

At DPR 1.5 the benchmark displays the logical artwork in a 560 CSS-pixel square, producing an 840×840 visible backing store and a separate 840×840 overlay backing store. Estimated renderer-owned buffers:

| Logical canvas | No onion skin | With before + after onion snapshots |
|---|---:|---:|
| 32×32 | 5.391 MiB | 5.399 MiB |
| 64×64 | 5.415 MiB | 5.446 MiB |
| 128×128 | 5.508 MiB | 5.633 MiB |
| 256×256 | 5.883 MiB | 6.383 MiB |
| 512×512 | 7.383 MiB | 9.383 MiB |

These are **known typed/backing-buffer estimates only**: logical ImageData, raster OffscreenCanvas, visible canvas, overlay canvas and (when enabled) two `Uint32Array` onion snapshots. They exclude project pixel-string arrays, 262,144 possible DOM elements, JS object overhead, browser/GPU copies, driver allocations, allocator slack and garbage-collector overhead. They are not measured process RSS or GPU memory.

## Two unmeasured 512×512 cases

1. `overlay_grid_selection_dense`: the isolated Chromium page remained busy while creating and styling 262,144 accessible DOM cells with per-cell grid borders and selection outlines. Playwright could not observe completion within the isolated execution window.
2. `onion_before_after_dense`: the dense before/after onion DOM baseline exceeded the isolated browser execution window while creating/styling the full 262,144-cell grid.

No timing is fabricated for these cases. Both appear in `unmeasuredCases` in the JSON artifact, with their reason. Their absence is part of the result, not an omitted result.

## Interpretation and limits

This is one local Linux/Chromium environment and one implementation of each renderer path. It is useful to locate current bottlenecks, but it is not a cross-device performance study, an end-to-end editor benchmark, or evidence for a general speedup. The DOM path performs accessible per-pixel element creation on full redraw; the Canvas path has whole-array validation on every call. Different internal work is being timed, and the application-level model and user input path are outside the test.

The isolated Canvas prototype is compelling for full raster redraw and overlays at the measured sizes, but its current dirty-update path is materially slower in these tests. Do not adopt Canvas for the live editor based on the full-redraw results alone. AC-038 still needs the integration contract/demo and fallback requirements; the coordinator-added AC-088 later supplies the production-editor versus renderer decision study. The DOM renderer remains active.

## Reproduction

From repository root, after installing the existing bridge Playwright dependency and Chromium:

```sh
cd agent-bridge
npm install --ignore-scripts
npx playwright install chromium
node ../benchmarks/renderer-workload-benchmark.mjs
```

Environment controls:

- `ARTCLUB_WORKLOAD_WARMUPS` (default 2; 1–4)
- `ARTCLUB_WORKLOAD_SAMPLES` (default 5; 5–11)
- `ARTCLUB_WORKLOAD_CASE_TIMEOUT_MS` (default 180000)
- `ARTCLUB_BENCHMARK_DPR` (default 1.5)

The runner opens a fresh Chromium process for each size/scenario and writes the JSON report incrementally. A case that fails or exceeds its timeout is recorded under `unmeasuredCases`; it is not silently dropped.
