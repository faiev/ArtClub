# Pixel color and gradient operations (AC-082)

js/pixel-color.js is a dependency-free pure JavaScript module for exact color replacement, palette mapping, masked gradients, posterization and deterministic color-ramp application. It is exposed as window.ArtClubPixelColor in a browser and through CommonJS in Node.

## Buffer contract

- Buffers are dense row-major arrays. Pixel (x, y) is at y * width + x.
- Opaque pixels use six-digit #RRGGBB; null denotes transparency.
- Width and height are integers from 1 through 512. All operations reject sparse or malformed buffers before returning a result.
- HEX inputs are compared case-insensitively and returned colors are canonical uppercase. Null is preserved unless an operation explicitly maps it to another value.
- Every operation returns a new array or a new color string. Caller buffers are never mutated; these are preview values, not editor commits.

## API

### replaceColor(pixels, width, height, fromColor, toColor)

Replaces every exact source HEX color with a target HEX color or null. A null source selects only transparent pixels. Neighboring colors are not changed.

### mapPalette(pixels, width, height, mappings)

Applies ordered exact mappings shaped as [{ from: "#RRGGBB", to: "#RRGGBB" }]. Either side may be null to map transparency. Unmapped colors are copied unchanged. Duplicate source keys (including duplicate null sources) and sparse/malformed mapping lists are rejected. The mapping list is capped at 256 entries.

### applyGradient(pixels, width, height, colorA, colorB, options)

Recolors only non-null pixels of the supplied buffer, preserving its transparent mask. The orientation is horizontal by default, vertical, or linear.

- Horizontal uses the integer x coordinate from left (A) to right (B); a width-1 buffer resolves to A.
- Vertical uses integer y from top (A) to bottom (B); a height-1 buffer resolves to A.
- Linear projects each pixel coordinate onto the vector from (startX, startY) to (endX, endY), clamps the projection to [0, 1], and interpolates the HEX channels. The default line runs from the top-left to bottom-right canvas pixel. Endpoints, when supplied, must be integer coordinates inside the canvas. A zero-length line resolves to A.
- Each channel is interpolated with integer rational arithmetic and rounded to the nearest integer, with exact half ties rounded upward. There is no dithering or interpolation across transparent pixels.

### quantizeColor(color, levels) and posterize(pixels, width, height, levels)

Levels must be an integer from 2 through 256. Each RGB channel is quantized independently to the nearest of that many evenly spaced channel values between 0 and 255. The quantization index and reconstructed channel both use integer half-up rounding. Posterize applies that operation to every opaque pixel and preserves null entries.

### applyColorRamp(pixels, width, height, ramp)

Maps each opaque pixel to the nearest equally spaced stop in an ordered ramp of 2–256 HEX colors. Pixel intensity uses integer Rec.601 luma (299R + 587G + 114B) / 1000; the ramp stop index is rounded to nearest with exact half ties sent to the brighter (higher-index) stop. The output is the chosen ramp color; transparent pixels remain null. This is a deterministic luminance-to-ramp mapping, not a nearest-RGB-palette search.

## Bounds and complexity

- Canvas allocation is capped at 512×512 (262,144 entries).
- Replace, palette map, posterize and ramp application are O(canvas pixels) plus at most 256 mapping/ramp entries.
- A gradient is O(canvas pixels), with constant integer channel work per opaque pixel.
- Palette maps and ramps are each limited to 256 colors/stops.
- All operations are deterministic for identical source buffers and options. They do not edit project state, history, layers or UI.

## Preview/commit boundary

These functions produce complete new buffers. A future editor caller should display the returned preview and commit it only after the whole operation succeeds, inside one existing undo transaction. Do not mutate the project pixel array incrementally while calculating a preview. No UI, renderer or Agent API wiring is included in AC-082.
