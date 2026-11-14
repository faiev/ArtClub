# Canvas renderer prototype

## Current renderer audit

The current editor in `index.html` uses a CSS grid. `renderGrid()` creates one `.pixel-cell` div for every pixel, sets its `tabIndex`, `data-index`, `role="gridcell"`, `aria-label` and inline background color, then replaces the existing grid with a new document fragment.

At 512×512 this is **262,144 DOM elements**. Every full render allocates that many nodes and updates several properties/attributes per node. `renderSelectionOverlay()` also walks every cell to remove old selection classes before applying the new selection edges.

The drawing path is DOM-dependent too: `paint()` updates `grid.children[i]`; `getCell()` uses `.pixel-cell` DOM hit testing; and `updateShapePreview()` changes individual cell styles. Flood fill calls `paint()` for each changed pixel, so a large fill causes many DOM mutations.

There is an additional application-model bottleneck: `compositePixels()` allocates a full pixel array and calls `compositePixelAt()` for each cell, walking visible layers. `renderStats()` recomputes that composite and builds more arrays/sets. Switching renderers will not automatically remove these costs.

## Prototype interface

Load `js/canvas-renderer.js` as a regular script. It exposes `window.ArtClubCanvasRenderer.CanvasPixelRenderer` and a CommonJS export for Node tests.

```js
const renderer = new ArtClubCanvasRenderer.CanvasPixelRenderer(canvas);

const state = {
  width: 24,
  height: 24,
  pixels: compositedPixels, // Array(width * height) of #RRGGBB or null
  onionBefore: previousFrameMask, // optional truthy/falsy mask
  onionAfter: nextFrameMask,      // optional truthy/falsy mask
  grid: true,
  selection: null,
  selectionPreview: null
};

renderer.render(state); // full refresh
renderer.render(state, { x: 4, y: 7, width: 1, height: 1 }); // dirty pixel
const point = renderer.mapClientToPixel(event.clientX, event.clientY);
```

The module keeps an `ImageData` buffer at logical canvas resolution. It writes that buffer into a pixel-resolution offscreen surface, then scales the result to the visible canvas with `imageSmoothingEnabled = false` and `image-rendering: pixelated`. Grid lines and the rectangular selection outline are drawn on a separate transparent overlay surface, so these effects are not saved into project pixels. Onion skin is a translucent tint over cells that are transparent in the active composite.

A dirty rectangle updates only the specified source pixels and blits that crop to the visible canvas. The overlay is redrawn separately and composited over the dirty destination rectangle. When selection/grid/canvas size/zoom/frame/onion/layer visibility changes, issue a full `render(state)` so stale overlay pixels are cleared. Dirty updates are intended for pixel changes while overlay state remains unchanged.

`mapClientToPixel()` replaces the current DOM-per-pixel hit test with coordinate mapping from pointer position and canvas bounds.

## Integration plan

1. Keep `ProjectModel` as the source of truth. The renderer is a view, not a second document store.
2. On project, frame, layer or visibility changes, compute the visible composite once and issue a full render. Cache the active-frame composite rather than walking layers for every pixel edit.
3. For brush/eraser edits, update the cel and cached composite, then render a one-pixel dirty rectangle. For a stroke, fill or shape, track a bounding box and render once when the operation is committed where possible.
4. Replace `getCell()` with `renderer.mapClientToPixel()` while preserving pointer capture on the canvas.
5. Preserve keyboard editing and accessibility. Canvas does not automatically provide the current per-cell `role="gridcell"`, label or roving-`tabIndex` behavior. Provide a labelled canvas plus keyboard navigation/editing and an accessible focused-cell representation or alternative grid model.
6. Rework `renderStats()` separately. Maintain painted count/used colors incrementally or compute them on operation completion; do not recomposite and allocate a new full array on every pointer movement.
7. Do not remove the old DOM renderer until brush, fill, selection, import/export, layers, frames, onion skin, zoom, keyboard use and browser E2E tests pass with Canvas.

## Limits and risks

- This is an isolated prototype, not a drop-in editor replacement. `index.html`, the agent API and project model are untouched.
- It owns raster display, basic grid lines, onion tint masks and a rectangular selection outline. It does not implement brush/fill operations, layer compositing, shape generation, selection transforms or playback.
- A full render still visits each pixel. Incremental callers must supply a correct dirty rectangle and keep their composited pixel array current.
- Overlay changes require a full render. Selection movement cannot safely use a pixel-only dirty rectangle until old/new overlay bounds are tracked.
- Canvas needs explicit keyboard and screen-reader work before replacing the current DOM grid.
- The renderer creates a pixel surface, a separate overlay surface and a visible canvas. Measure real browser memory and frame time before choosing it as the default.

## Tests and benchmark

Run the isolated unit suite:

```sh
node --test tests/canvas-renderer.test.js
```

Open `benchmarks/renderer-benchmark.html` in a modern browser to compare the existing DOM construction strategy with the prototype at 32×32, 64×64, 128×128, 256×256 and 512×512. It displays medians and raw samples. Results depend on browser, device pixel ratio and hardware; record those details with measurements.

No trustworthy timing numbers are claimed from the development environment for this branch. Its installed Chromium process hung even when asked to render `about:blank`, so the browser benchmark could not be run here.
