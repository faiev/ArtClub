# Tiled preview utility

`js/tile-preview.js` is a renderer- and DOM-independent utility for repeating a pixel-art tile and checking whether its opposing edges match. It does not modify artwork, attach to the editor UI, use Canvas, or affect exports.

The module follows the project's browser-global/CommonJS pattern:

- Browser global: `window.ArtClubTilePreview` (also available on `globalThis`).
- Node.js: `require("../js/tile-preview.js")`.

## Pixel-buffer contract

Functions accept a flat row-major JavaScript `Array` or typed array. The expected index for `(x, y)` is `y * width + x`. Values are copied and compared exactly; the utility does not parse, normalize, blend, or interpolate colors. `null` is a valid explicit transparent pixel. `undefined` and sparse array slots are rejected so missing data cannot be confused with transparency.

## API

### `createTiledPreview(pixels, width, height, columns, rows)`

Returns a new regular JavaScript array repeated horizontally `columns` times and vertically `rows` times:

```js
{
  width: width * columns,
  height: height * rows,
  columns,
  rows,
  pixels
}
```

Output uses row-major indexing. The source buffer is never mutated. Repeat counts are positive integers; no scaling or smoothing is performed.

### `extractEdgeStrips(pixels, width, height)`

Returns `{ width, height, left, right, top, bottom }`. `left` and `right` contain one value per row, ordered top-to-bottom. `top` and `bottom` contain one value per column, ordered left-to-right. Transparency is returned as `null` unchanged.

### `diagnoseSeams(pixels, width, height)`

Compares the left and right edge values at each row, and the top and bottom edge values at each column. The result is structured as:

```js
{
  width,
  height,
  seamless,       // true only when both edge pairs match
  mismatchCount,  // combined count of edge comparisons that differ
  leftRight: {
    matches,
    mismatches: [
      { row, left: { x, y, color }, right: { x, y, color } }
    ]
  },
  topBottom: {
    matches,
    mismatches: [
      { column, top: { x, y, color }, bottom: { x, y, color } }
    ]
  }
}
```

`Object.is` is used for exact value comparison. A mismatch includes both source coordinates and both values, including `null` where transparent. Coordinates are zero-based.

## Validation and allocation limits

The exported frozen `LIMITS` object documents the guardrails:

| Limit | Value |
|---|---:|
| Source width or height | 4,096 pixels |
| Source buffer | 4,194,304 pixels |
| Horizontal or vertical repeat count | 256 |
| Preview width or height | 16,384 pixels |
| Preview output buffer | 4,194,304 pixels |

Dimensions and repeat counts must be positive whole numbers. The source buffer length must equal `width × height`. Preview dimensions and total output length are checked before allocating the output array. Invalid types, missing pixels, malformed lengths and over-limit sizes throw descriptive `TypeError` or `RangeError` exceptions.

The limits are deliberately finite because a repeated preview is a separate in-memory pixel buffer. A future UI should choose repeat counts that remain within these limits and should not persist preview pixels back into project cels.

## Future editor integration contract

A later UI owner can pass a composite pixel buffer plus its canvas width and height into `createTiledPreview`, then draw the returned output using its own integer-aligned rendering path. The seam report can be displayed beside the preview without changing the source artwork. The UI should keep preview output transient, retain the original project dimensions, and exclude the repeated buffer from PNG, SVG and project exports. This module intentionally does not prescribe Canvas drawing, controls, state management or export wiring.

## Tests

Run the isolated tests from the repository root:

```sh
node --test tests/tile-preview.test.js
```

The tests cover 1×1 and rectangular tiles, multiple repeats, row-major output, typed arrays, edge extraction, exact mismatch coordinates and values, transparent pixels, invalid input, allocation limits and input immutability.
