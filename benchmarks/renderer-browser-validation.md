# AC-028 — Real-browser renderer validation and benchmark

**Status:** Real Chromium raster validation passed; one renderer-only benchmark run captured. No general speedup or application-level claim is made.

## Browser correctness validation

Executed the seven AC-028 assertions in real Chromium **144.0.7559.96**, at **device-pixel ratio 1.5**, using a Playwright-controlled browser:

1. Native-size complete RGBA equality, including transparency — passed.
2. Enlarged nearest-neighbor complete raster equality — passed.
3. Grid/selection overlay isolation from the exact artwork ImageData buffer — passed.
4. Pointer mapping with fractional CSS bounds and DPR 1.5 — passed.
5. `frameId` and `compositeRevision` full-frame invalidation — passed.
6. Onion-mask mutation and stale-tint clearing — passed.
7. Sparse/undefined pixels and onion masks rejected before visible/buffer mutation — passed.

**Result: 7 passed, 0 failed, 0 page errors.**

The translucent onion tint is checked exactly in the renderer's ImageData and for exact clearing. Chromium's final visible Canvas readback can vary by one RGB unit from premultiplied-alpha round-trip quantization; that displayed tint check permits at most ±1 RGB unit while requiring exact alpha 89. Opaque artwork raster checks remain byte-for-byte exact.

Execution in this container used Python Playwright with the system Chromium executable because the repository's Node Playwright dependency was unavailable locally. The committed `tests/canvas-renderer.browser.mjs` remains the reproducible repository runner; the existing project workflow does not yet invoke it, and its workflow file remains under Agent 3's lock.

## Renderer-only DOM versus Canvas benchmark

One real Chromium run was completed at all assigned sizes. Method: **2 warm-ups** and **5 measured samples per renderer**; DOM-first and Canvas-first order alternated. Median and nearest-rank p95 are calculated from raw samples.

| Size | DOM median / p95 (ms) | Canvas median / p95 (ms) | DOM/Canvas median ratio |
|---|---:|---:|---:|
| 32×32 | 17.1 / 19.6 | 2.1 / 4.6 | 8.143× |
| 64×64 | 43.8 / 72.1 | 3.2 / 5.5 | 13.687× |
| 128×128 | 149.0 / 164.2 | 5.1 / 7.3 | 29.216× |
| 256×256 | 608.8 / 738.1 | 8.0 / 10.4 | 76.100× |
| 512×512 | 2667.5 / 2989.5 | 22.8 / 54.1 | 116.996× |

Raw sample arrays and full environment metadata are committed in [renderer-browser-validation-report.json](renderer-browser-validation-report.json).

### Environment

- Chromium: 144.0.7559.96 (HeadlessChrome), Linux x86_64
- Device-pixel ratio: 1.5
- CPU: Intel Xeon Platinum 8573C; 3 logical CPUs exposed to this container
- Reported host memory: approximately 5.81 GiB
- Runner: local ChatGPT execution container, not GitHub Actions

### Interpretation limits

- This is **one renderer-only microbenchmark run**, not a representative cross-device study and not an end-to-end editor benchmark.
- DOM timing includes creating one accessible div per pixel, appending through a DocumentFragment, replacing the grid and forcing layout. Canvas timing includes pixel conversion, drawing the raster/grid overlay and a one-pixel readback.
- It excludes editor compositing, brush/fill processing, pointer latency, frame scheduling, accessibility interactions and application-model costs.
- The ratio is a descriptive result for this exact runner and workload, not a general performance guarantee. More devices/runs and dense/sparse/dirty/onion workloads are needed for wider conclusions.
- The DOM renderer remains the active application renderer. AC-012 integration is still separately gated by AC-034–AC-038 and coordinator UI ownership.

## Reproduction

From the repository root:

```sh
cd agent-bridge
npm install --ignore-scripts
npx playwright install chromium
node ../tests/canvas-renderer.browser.mjs
```

The committed runner defaults to one warm-up and three measured samples per renderer; override with `ARTCLUB_BENCHMARK_WARMUPS` and `ARTCLUB_BENCHMARK_SAMPLES`. The benchmark page itself supports query parameters such as `?samples=7&warmup=2`.

The recorded measurement above used two warm-ups and five measured samples in the local Python Playwright harness, using the same production renderer and benchmark page. The committed Node runner was not invoked in this container.

## Integration boundary

The Canvas renderer remains isolated and the DOM renderer stays active. No `index.html`, project-model, Agent API, MCP or workflow changes were made. AC-012 is not started.
