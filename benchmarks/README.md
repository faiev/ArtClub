# Renderer benchmark

Run the benchmark in a real browser from the repository root:

1. Start a static server: python3 -m http.server 8000
2. Open http://localhost:8000/benchmarks/renderer-benchmark.html
3. Let the run complete, then use Download JSON report.
4. Preserve the JSON file together with the browser version, operating system, CPU, memory and any power/performance mode notes.

The default run covers 32×32, 64×64, 128×128, 256×256 and 512×512. It performs two warm-up passes and five measured samples per renderer at each size. Query parameters can change the run, for example ?samples=7&warmup=2&max=256. Samples are alternated DOM-first and Canvas-first to reduce systematic ordering bias.

The DOM baseline mirrors the current renderGrid() strategy: one div.pixel-cell per pixel, with tabIndex, data-index, role, aria-label and inline background color, appended to a DocumentFragment before replacing the grid. It forces layout by reading the grid bounds.

The Canvas run includes pixel-buffer conversion, the display-resolution grid overlay and a 1×1 readback to force pending Canvas 2D work to complete before the timer stops. Both methods are timed synchronously; requestAnimationFrame yields between samples but is not included in the timing.

The report includes raw samples, median, nearest-rank p95, sample count, device-pixel ratio, user agent and available hardware hints. Median is the arithmetic middle (or average of the two middle values for an even sample count). p95 uses ceil(0.95 × n) - 1 in sorted samples.

This is a browser-local microbenchmark, not an end-to-end editor benchmark. It excludes project compositing, brush/fill algorithms, pointer latency, frame scheduling and accessibility interactions. Results depend on browser, version, hardware and device-pixel ratio; compare only runs collected under documented conditions.

No timing values are committed as benchmark evidence until a real browser run has completed. A page containing the benchmark harness is not itself proof of a performance gain.
