# Advanced dithering and configurable outlines (AC-084)

js/pixel-advanced-dither.js is a dependency-free pure JavaScript module. It is exposed as window.ArtClubPixelAdvancedDither in a browser and through CommonJS in Node. Every operation returns a new buffer and does not modify editor/project state.

## Buffer and allocation contract

- Dense row-major JavaScript arrays; pixel (x, y) is at y * width + x.
- Opaque entries are six-digit #RRGGBB colors; null is transparent.
- Width and height are integers from 1 through 512 (262,144 pixels maximum).
- Sparse arrays, malformed colors and invalid options are rejected before pixel output is returned.
- Dither palettes contain 2–64 unique HEX colors. Palette order is significant for exact nearest-color ties.
- Outline thickness is 1–32 pixels.

## Floyd–Steinberg error diffusion

API:

~~~javascript
const preview = PixelAdvancedDither.floydSteinberg(
  pixels,
  width,
  height,
  ["#172B3A", "#F4EDDA"],
  {
    scanDirection: "serpentine",
    alphaMode: "preserve",
    distanceMetric: "euclidean-rgb"
  }
);
~~~

Returns { pixels, width, height, scanDirection, alphaMode, distanceMetric }. Every processed opaque pixel is replaced by one exact palette color. The method uses the standard 7/16, 3/16, 5/16 and 1/16 error weights.

### Scan direction

- left-to-right: each row scans from x=0 to x=width-1.
- right-to-left: every row scans from x=width-1 to x=0 and mirrors the error-neighbor pattern.
- serpentine (default): even rows scan left-to-right; odd rows scan right-to-left.

The scan mode changes the diffusion path and can change output patterns. For identical inputs, palette and options, each mode is deterministic.

### Color-distance policy and ties

- euclidean-rgb (default): squared Euclidean distance in unweighted 8-bit RGB channel space.
- weighted-rec601: integer weighted squared RGB distance, 299*dr² + 587*dg² + 114*db². This gives green differences more weight than red and blue, following the documented Rec.601 luma weights.
- An exact distance tie chooses the earliest entry in the supplied palette. Palette order must therefore be treated as part of the operation input.
- Before palette matching, adjusted channel values are clamped to [0, 255]. Diffusion error is computed from those clamped values, preventing out-of-range values from amplifying error.
- Error scratch values use JavaScript Float64 arithmetic. Output pixels are exact palette HEX strings; no interpolation or antialiasing is written into the result.

### Alpha behavior

- preserve (default): null entries remain null. They do not receive or emit error and act as diffusion barriers. Error weights directed to transparent/out-of-bounds cells are dropped, not redistributed.
- composite: requires backgroundColor as a HEX color. Null entries are first treated as that opaque background color and are then processed normally. Output is fully opaque.

This policy is explicit; the routine does not infer partial alpha because the source buffer format is HEX-or-null only.

## Configurable outline

API:

~~~javascript
const outlined = PixelAdvancedDither.outlinePixels(
  pixels,
  width,
  height,
  {
    color: "#172B3A",
    thickness: 2,
    mode: "outer",
    connectivity: 4
  }
);
~~~

Returns a new row-major buffer. Existing source data is read-only.

- outer (default): writes the outline color into transparent pixels whose shortest path through transparent pixels to artwork is at most thickness. Existing artwork pixels are preserved.
- inner: replaces opaque artwork pixels within thickness steps of a transparent pixel or the canvas exterior. Transparent pixels remain unchanged.
- both: applies the outer and inner behavior in one returned buffer.
- connectivity 4 (default) measures distance through orthogonal neighbors. connectivity 8 includes diagonal neighbors and yields a Chebyshev-style distance.
- color defaults to #000000 and is normalized uppercase.
- thickness must be an integer from 1 through 32.

Canvas edges count as transparent for inner outlines. Outer outlines are clipped to the canvas because output dimensions never expand. A solid opaque canvas therefore receives an inner edge outline but no outer pixels. An empty transparent canvas produces no outline. Distance maps use bounded Uint8Array buffers and fixed-size typed queues; no queue can exceed the pixel count.

## Complexity and preview/commit boundary

- Floyd–Steinberg uses O(N) output, visitation and Float64 channel scratch memory, plus O(N * paletteSize) comparisons; paletteSize is capped at 64 and N at 262,144.
- Outline generation uses O(N) distance/queue memory and at most a bounded number of neighbor checks per pixel for each requested inner/outer pass.
- Both functions compute complete results or throw; neither returns partial buffers.
- A future editor caller should display the returned buffer as a preview and apply it only after success inside one existing undo transaction. Do not incrementally mutate project pixels during diffusion or outline calculation.
- No editor UI, renderer, project model or Agent API integration is included in AC-084.
