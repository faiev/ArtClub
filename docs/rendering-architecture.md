# Canvas renderer prototype

## Current renderer audit

The current editor in index.html uses a CSS grid. renderGrid() creates one .pixel-cell div for every pixel, sets its tabIndex, data-index, role="gridcell", aria-label and inline background color, then replaces the existing grid with a new document fragment.

At 512×512 this is 262,144 DOM elements. Every full render allocates that many nodes and updates several properties/attributes per node. renderSelectionOverlay() also walks every cell to remove old selection classes before applying the new selection edges.

The drawing path is DOM-dependent too: paint() updates grid.children[i]; getCell() uses .pixel-cell DOM hit testing; and updateShapePreview() changes individual cell styles. Flood fill calls paint() for each changed pixel, so a large fill causes many DOM mutations.

There is an additional application-model bottleneck: compositePixels() allocates a full pixel array and calls compositePixelAt() for each cell, walking visible layers. renderStats() recomputes that composite and builds more arrays/sets. Switching renderers will not automatically remove these costs.

## Prototype interface

Load js/canvas-renderer.js as a regular script. It exposes window.ArtClubCanvasRenderer.CanvasPixelRenderer and a CommonJS export for Node tests.

    const renderer = new ArtClubCanvasRenderer.CanvasPixelRenderer(canvas);

    const state = {
      width: 24,
      height: 24,
      pixels: compositedPixels, // Array(width * height) of #RRGGBB or null
      onionBefore: previousFramePixels, // optional Array(width * height) of #RRGGBB or null
      onionAfter: nextFramePixels,      // optional Array(width * height) of #RRGGBB or null
      frameId: "frame-1",               // optional identity; a change forces a full redraw
      compositeRevision: 1,             // bump when frame/layer/order/visibility composite changes
      grid: true,
      selection: null,
      selectionPreview: null
    };

    renderer.render(state); // full refresh
    renderer.render(state, { x: 4, y: 7, width: 1, height: 1 }); // dirty pixel
    const point = renderer.mapClientToPixel(event.clientX, event.clientY);

The module keeps an ImageData buffer at logical canvas resolution. It writes that buffer into a pixel-resolution offscreen surface, then scales the result to the visible canvas with imageSmoothingEnabled = false and image-rendering: pixelated. Grid lines and the rectangular selection outline are drawn on a separate transparent overlay surface, so these effects are not written into project pixels. Onion skin is a translucent tint over cells that are transparent in the active composite.

A dirty rectangle updates only the specified source pixels and blits that crop to the visible canvas. The overlay is redrawn separately and composited over that crop. The renderer tracks grid/selection overlay state: when the grid, its color, selection bounds or selection color changes, it performs a full visible blit. It also snapshots onion-mask contents and forces a full redraw whenever either neighboring-frame mask changes, including in-place edits. Logical size, CSS display size and device-pixel-ratio changes also force full redraws.

For frame, layer, layer-order or visibility changes, callers must either call `render(state)` without a dirty rectangle or change `state.compositeRevision` (and should supply `state.frameId`). A changed `frameId` or `compositeRevision` forces a full redraw even when a dirty rectangle is supplied. Keep the revision token stable for ordinary pixel edits that are accurately bounded by the dirty rectangle. If no revision token is supplied, a full render is mandatory for any whole-composite change. The renderer validates every source pixel and onion-mask entry before resizing or mutating surfaces; only explicit `null` represents transparency, and sparse/undefined/malformed entries are rejected.

The project limit is enforced before allocations: width and height must each be from 1 through 512, for at most 262,144 logical pixels. Callers must still supply accurate dirty bounds for normal pixel edits and keep the composited pixel array current.

mapClientToPixel() maps pointer coordinates from the canvas client bounds to logical pixel positions. It returns null before the first successful render, for invalid bounds and for positions outside the canvas.

## Integration plan

1. Keep ProjectModel as the source of truth. The renderer is a view, not a second document store.
2. On project, frame, layer or visibility changes, compute the visible composite once and issue a full render. Cache the active-frame composite rather than walking layers for every pixel edit.
3. For brush/eraser edits, update the cel and cached composite, then render a one-pixel dirty rectangle. For a stroke, fill or shape, track a bounding box and render once when the operation is committed where possible.
4. Replace getCell() with renderer.mapClientToPixel() while preserving pointer capture on the canvas.
5. Preserve keyboard editing and accessibility. Canvas does not automatically provide the current per-cell role="gridcell", label or roving-tabIndex behavior. Provide a labelled canvas plus keyboard navigation/editing and an accessible focused-cell representation or alternative grid model.
6. Rework renderStats() separately. Maintain painted count/used colors incrementally or compute them on operation completion; do not recomposite and allocate a new full array on every pointer movement.
7. Do not remove the old DOM renderer until brush, fill, selection, import/export, layers, frames, onion skin, zoom, keyboard use and browser E2E tests pass with Canvas.

## Limits and risks

- This is an isolated prototype, not a drop-in editor replacement. index.html, the agent API and project model remain untouched.
- It owns raster display, basic grid lines, onion tint masks and a rectangular selection outline. It does not implement brush/fill operations, layer compositing, shape generation, selection transforms or playback.
- A full render still visits each pixel. Pixel arrays and onion masks are fully validated on each call; onion masks are compared against exact snapshots to detect in-place neighbor-frame changes.
- Grid/selection and onion-mask changes force a full visible blit. Frame/layer/composite changes force a full blit when callers omit the dirty rectangle or advance compositeRevision/change frameId.
- Composite revisions are caller-managed: update them for frame/layer/order/visibility changes. Without a revision token, callers must issue an explicit full render for those changes.
- Canvas needs explicit keyboard and screen-reader work before replacing the current DOM grid.
- The renderer creates a pixel surface, a separate overlay surface and a visible canvas. Measure real browser memory and frame time before choosing it as the default.

## Tests and benchmark

Run the isolated mocked-context suite:

    node --test tests/canvas-renderer.test.js

The tests cover strict null-only transparency, sparse/undefined input rejection, the 512×512 project bounds, overlapping onion masks, dirty-rectangle clipping and writes, full redraw after logical/display/DPR changes, frame/composite revision invalidation, in-place onion-mask transitions, crisp scaling, overlay isolation, pointer mapping and cleanup. They use fake Canvas 2D contexts and are not a substitute for a real browser test.

For a browser benchmark, start a static server from the repository root:

    python3 -m http.server 8000

Then open http://localhost:8000/benchmarks/renderer-benchmark.html in a real browser and download the JSON report. The harness performs warm-ups, alternates renderer order, captures multiple samples, and reports median, p95 and raw values for 32×32 through 512×512. Record browser and hardware details with each run.

No trustworthy performance timing is claimed in this handoff. The existing development environment previously hung while launching Chromium; the browser benchmark has not been run here. The harness is reproducible, but no speedup should be claimed until an actual browser run is attached.
