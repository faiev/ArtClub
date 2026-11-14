# Tile transform and offset-preview utility

`js/tile-transform.js` is a deterministic, renderer-independent utility for integer-pixel tile transforms and wrap inspection. It does not use Canvas or the DOM, mutate source buffers, interpolate colors, or write into project data.

The module is available as `window.ArtClubTileTransform` in a browser and through `require("../js/tile-transform.js")` in Node.js.

## Pixel contract

All operations accept a flat row-major Array or typed array with exactly `width × height` entries. `null` represents transparency. Sparse slots and `undefined` are rejected. Transform results use new regular JavaScript arrays and preserve pixel values exactly.

## API

- `rotateTile(pixels, width, height, quarterTurns)` rotates clockwise by 90° per turn. Negative and greater-than-three safe integer values normalize modulo four. Odd turns swap output width and height.
- `flipTile(pixels, width, height, { horizontal, vertical })` flips across the vertical axis when `horizontal` is true and across the horizontal axis when `vertical` is true. Either option defaults to false.
- `offsetTile(pixels, width, height, offsetX, offsetY)` translates pixels on a torus. Positive X/Y move pixels right/down; negative values move them left/up. Offsets wrap and are returned normalized into the tile bounds.
- `createOffsetPreview(pixels, width, height, offsetX, offsetY, columns, rows)` builds a repeated row-major preview from the toroidally offset tile. It validates dimensions and the final output allocation before allocating.
- `cropTile(pixels, width, height, { x, y, width, height })` crops a non-empty in-bounds rectangle. It rejects out-of-bounds requests instead of silently clipping them and returns `sourceRect`.
- `padTile(pixels, width, height, { top, right, bottom, left }, fillPixel)` pads the tile with `null` by default or an exact caller-supplied fill value. Missing side values are zero. It returns both normalized padding and the exact `sourceRect` in the output.
- `getTileBoundaryCoordinates(width, height)` returns top/right/bottom/left edge coordinate arrays and explicit top-left/top-right/bottom-right/bottom-left corners. Edge arrays include their endpoint corners.
- `diagnoseCornerWraps(pixels, width, height)` compares both diagonal corner pairs meeting at a four-tile junction and reports the exact coordinates and values.
- `diagnoseTileWraps(pixels, width, height)` combines opposing left/right and top/bottom edge checks with diagonal corner-wrap checks. It reports all mismatches without attempting automatic repair.

## Validation and limits

The frozen exported `LIMITS` object caps each source/output side at 4,096 pixels, source/padded buffers at 4,194,304 pixels, repeat counts at 256 per axis, offset preview sides at 16,384 pixels, and offset-preview output at 4,194,304 pixels. Sizes are checked before result arrays are allocated. Coordinates, dimensions and offsets must be safe integers; crops and padding must be non-negative/in-bounds as documented.

## Tests

Run from the repository root:

```sh
node --check js/tile-transform.js
node --test tests/tile-transform.test.js
```

Coverage includes rectangular quarter-turn rotations, negative turn normalization, flips, positive/negative toroidal offsets, repeated offset previews, transparent values, crop/pad bounds, exact source rectangle and edge/corner coordinates, diagonal corner-wrap diagnostics, typed arrays, immutability and allocation guardrails.
