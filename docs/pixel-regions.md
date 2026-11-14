# Pixel regions and flood fill (AC-081)

js/pixel-regions.js is a dependency-free pure JavaScript module for bounded connected-region selection, border extraction and flood fill. It is exposed as window.ArtClubPixelRegions in a browser and through CommonJS in Node.

## Buffer contract

- Pixel buffers are dense row-major JavaScript arrays. Pixel (x, y) is at y * width + x.
- Opaque pixels are six-digit #RRGGBB strings; transparent pixels are null.
- Width and height are integers from 1 through 512 (at most 262,144 pixels).
- Sparse arrays, missing entries, non-HEX strings and malformed dimensions are rejected before any result is produced.
- Color matching compares exact RGB channel values. HEX letter casing is ignored (#aabbcc matches #AABBCC); neighboring colors do not. Partial-alpha colors are not represented.
- options.connectivity defaults to 4 and may be 8. The selected color region includes orthogonal neighbors only in 4-connectivity, and diagonal neighbors as well in 8-connectivity.

## API

### selectRegion(pixels, width, height, startX, startY, options)

Finds the connected region whose exact color (or transparent null) matches the seed pixel. Returns { color, points, bounds, iterations }. points are fresh {x, y} objects sorted row-major; bounds is the smallest inclusive pixel extent as {x, y, width, height}. The seed must be an integer coordinate inside the canvas.

### extractRegionBorder(pixels, width, height, startX, startY, options)

Selects the same connected region and returns its outer border as { color, points, bounds, regionSize, iterations }. A selected pixel is a border pixel when at least one neighbor in the configured connectivity is outside the selected region or outside the canvas. Points are sorted row-major. The 8-connected mode considers diagonal neighbors when deciding whether a pixel is on the border.

### floodFill(pixels, width, height, startX, startY, replacementColor, options)

Returns a complete new pixel buffer and selection metadata: { pixels, color, replacementColor, points, bounds, changed, iterations }. The replacement must be null or a valid six-digit HEX color; output HEX values are canonical uppercase. If the replacement already matches the seed color, an independent copy is returned with changed: 0. Otherwise, only the selected connected region is replaced. Inputs are never mutated.

## Bounds, cancellation and failure behavior

- The region queue is preallocated to the validated canvas pixel count, never grows beyond that count, and uses a typed visitation map. The maximum queue is 262,144 entries.
- options.maxIterations defaults to the full canvas pixel limit and must be an integer from 1 to 262,144. If the region requires more dequeues than the limit, the operation throws RangeError and does not return a partial fill or selection.
- options.shouldCancel, when provided, must be a synchronous function. It is checked before traversal and during each queue iteration. Returning true throws an AbortError; no output buffer is committed. The callback should be quick and deterministic. This synchronous API cannot be preempted from another thread while the JavaScript event loop is blocked; an asynchronous worker-based UI can cancel by terminating its worker.
- options.tolerance is deliberately restricted to 0. Non-zero/fuzzy RGB tolerance is rejected so exact palette-color grouping remains predictable; fuzzy matching requires a separate color-distance policy.
- Traversal uses a fixed neighbor order and row-major result ordering, so identical inputs and options produce identical points and buffers.
- Region collection is O(canvas pixels) worst case and uses O(canvas pixels) bounded auxiliary memory. Border extraction is O(region pixels); flood fill additionally copies the input buffer before applying the complete result.

## Usage example

~~~javascript
const selected = PixelRegions.selectRegion(pixels, width, height, seedX, seedY, {
  connectivity: 4,
  maxIterations: width * height
});

const preview = PixelRegions.floodFill(pixels, width, height, seedX, seedY, "#D65B45", {
  connectivity: 4
});
// A future editor caller can show preview.pixels, then apply it in one undo transaction.
~~~

The module does not change the editor project, history, current layer, or UI. A caller owns preview/commit and must apply the returned complete buffer inside the editor's existing undo transaction. No UI or Agent API wiring is part of AC-081.
