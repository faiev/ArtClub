# Canvas viewport utility — coordinate and integration contract

## Coordinate spaces

The utility is pure JavaScript and independent of Canvas 2D or the editor DOM.

- Canvas coordinates are logical pixel-space units (pixel boundaries are integer values).
- Screen coordinates are CSS pixels local to the viewport element.
- `offsetX` and `offsetY` are CSS-pixel translations; `scale` is CSS pixels per logical canvas unit.
- Device-pixel ratio (DPR) is only used for backing-store conversion. Pointer mapping always starts in CSS/client coordinates.

The transform is:

`screenX = offsetX + canvasX * scale`

`screenY = offsetY + canvasY * scale`

The inverse divides the translated screen coordinate by `scale`.

## Pan and clamp policy

When scaled content is smaller than a viewport axis, it remains centered and cannot be panned into empty space. When scaled content is larger, the offset is clamped to `[viewSize - contentSize, 0]`, so neither edge can be panned past the viewport. This is deterministic for both small and large canvases.

Cursor-anchored zoom first resolves the logical point under the CSS screen anchor, then recomputes offsets at the target scale. When the requested zoom does not hit an edge clamp, the logical point under the cursor remains unchanged.

## API

`createViewport({canvasWidth, canvasHeight, viewWidth, viewHeight, ...})` returns a new transform state. The default scale fits the whole canvas into the CSS viewport. Defaults are minScale 0.1, maxScale 16 and DPR 1.

Pure functions return new state:
- `panBy(state, dx, dy)`
- `zoomAt(state, nextScale, screenX, screenY)`
- `zoomBy(state, factor, screenX, screenY)`
- `fitToCanvas(state, padding = 0)`
- `resetViewport(state)` (1×, centered if content is smaller; top/left aligned if larger)
- `resizeViewport(state, viewWidth, viewHeight, dpr?)` preserves the logical canvas point at the viewport center, subject to edge clamping.

Conversions:
- `canvasToScreen`, `screenToCanvas` work in logical canvas and CSS viewport coordinates.
- `clientToCanvas` accepts client coordinates plus `getBoundingClientRect()`-compatible bounds. Fractional CSS sizes are supported.
- `screenToBacking`, `backingToScreen`, `getBackingSize` convert CSS coordinates/dimensions with DPR.

Serialization uses a stable property order and version 1. Invalid dimensions, scales, DPR, coordinates, bounds, JSON and serialization versions throw instead of being silently repaired.

## Minimal integration example

```js
const viewport = ArtClubCanvasViewport.createViewport({
  canvasWidth: project.width,
  canvasHeight: project.height,
  viewWidth: element.getBoundingClientRect().width,
  viewHeight: element.getBoundingClientRect().height,
  devicePixelRatio: window.devicePixelRatio
});

const point = ArtClubCanvasViewport.clientToCanvas(
  viewport, event.clientX, event.clientY, element.getBoundingClientRect()
);
const cssPoint = ArtClubCanvasViewport.canvasToScreen(viewport, point.x, point.y);
const backingSize = ArtClubCanvasViewport.getBackingSize(viewport);
```

This phase is intentionally module-only. It does not attach event handlers, mutate project data, create a canvas element, or modify editor UI. A later adapter/renderer owner should keep viewport transforms separate from project pixels and apply nearest-neighbor rendering at the CSS/backing-store boundary.
