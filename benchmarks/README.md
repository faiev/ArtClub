# Renderer benchmark

Open `benchmarks/renderer-benchmark.html` in a modern browser. It compares the current editor's full-grid DOM renderer with `js/canvas-renderer.js` at 32×32, 64×64, 128×128, 256×256 and 512×512.

The DOM baseline mirrors `renderGrid()` in `index.html`: one `div.pixel-cell` per pixel, with `tabIndex`, `data-index`, `role`, `aria-label` and inline background color, appended to a `DocumentFragment` before replacing the grid. It then forces layout by reading the grid bounds.

The Canvas run includes pixel-buffer conversion, grid overlay and a 1×1 readback to include synchronous canvas work. Warm-up is excluded. Smaller sizes use four samples; 256×256 and 512×512 use one DOM sample and two Canvas samples to reduce memory churn.

This is a browser-local microbenchmark, not an end-to-end editor benchmark. Record browser/version, device pixel ratio, and hardware with any reported results. Do not compare results from different machines or browser versions as if they were directly equivalent.
