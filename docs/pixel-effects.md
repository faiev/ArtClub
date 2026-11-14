# Pixel-art craft algorithms

The module at js/pixel-effects.js provides dependency-free, deterministic utilities for future symmetry, outline, shading and dithering tools. It does not read editor state, write project data or mutate caller-owned arrays. It is available as window.ArtClubPixelEffects in the browser and through CommonJS require in Node.

Canvas buffers are row-major flat arrays: pixel (x, y) is at y * width + x. Opaque pixels use #RRGGBB; transparent pixels use null. Dimensions must be integers from 1 through 512 on each side. Buffer operations return new arrays.

## Symmetry

~~~javascript
const points = PixelEffects.expandSymmetry(
  [{ x: 4, y: 3 }, { x: 5, y: 3 }],
  { width: 16, height: 16, mode: "four-way" }
);
~~~

expandSymmetry(pointOrStroke, options) accepts one { x, y } point or an array of points. The mode is horizontal (left/right reflection), vertical (top/bottom reflection), or four-way; four-way is the default. Reflection uses the canvas center: x' = width - 1 - x and y' = height - 1 - y. Results outside the canvas are clipped. Duplicate coordinates, including points on a symmetry axis, are removed while preserving first-seen order. The result is an array of { x, y } objects for both point and stroke inputs.

This task uses a fixed canvas center. Adjustable symmetry centers and live stroke previews are future UI work.

## One-pixel outline

~~~javascript
const outlined = PixelEffects.generateOutline(pixels, width, height, {
  color: "#172B3A",
  neighbors: 8
});
~~~

generateOutline(pixels, width, height, options) returns a copied buffer with a one-pixel border filled around each non-null source pixel. The outline color defaults to #000000. The neighbor mode defaults to 8 and may be set to 4 for orthogonal neighbors only. Existing artwork is never overwritten; pixels beyond canvas edges are ignored. Null is fully transparent because the current project buffer has no partial-alpha representation.

## Shading

~~~javascript
const lighter = PixelEffects.lightenColor("#336699", 0.25);
const darker = PixelEffects.darkenColor("#336699", 0.25);
const signed = PixelEffects.shadeColor("#336699", -0.25);
~~~

shadeColor(color, amount) accepts a signed amount from -1 through 1: negative darkens toward black, positive lightens toward white, and zero preserves the color. lightenColor and darkenColor accept non-negative amounts from 0 through 1. Out-of-range values are rejected rather than silently clamped. Each RGB channel is linearly interpolated toward its target and rounded to the nearest integer with Math.round (half values round up). Returned colors are canonical uppercase #RRGGBB strings.

## Ordered Bayer dithering

~~~javascript
const dithered = PixelEffects.orderedDither(tones, width, height, {
  colorA: "#172B3A",
  colorB: "#F4EDDA",
  matrixSize: 4,
  originX: 0,
  originY: 0
});
~~~

orderedDither(tones, width, height, options) accepts a row-major tone buffer. Entries must be finite normalized ramp positions from 0 through 1, or null to preserve transparency. Tone 0 always selects colorA and tone 1 always selects colorB. Intermediate tones are compared with the repeating Bayer matrix selected by matrixSize (2, 4 or 8; default 4). The threshold is (matrix[y][x] + 0.5) / (matrixSize * matrixSize). A strict tone > threshold comparison selects colorB, so equality selects colorA. Optional integer originX and originY offsets align a cropped preview with a stable canvas-level pattern. The result contains only colorA, colorB or null.

createBayerMatrix(size) returns the corresponding rank matrix for inspection or preview. Each call returns a fresh matrix.

## Integration notes

- These are pure utilities. A future caller should apply returned points or buffers inside the editor's existing undo transaction rather than allowing this module to mutate the project.
- Symmetry currently mirrors around the canvas center and clips to canvas bounds. Adjustable pivots, preview UI, brush-size expansion and shape-tool event wiring are not included.
- Outline generation is one pixel wide and treats any non-null project pixel as fully opaque. Multi-pixel expansion/contraction and fractional alpha are not implemented.
- Dithering accepts normalized tone values instead of inferring luminance from source RGB colors. A future palette or conversion UI should derive tones and manage preview/commit behavior outside this module.
- No editor UI or Agent API integration is included in AC-019.
