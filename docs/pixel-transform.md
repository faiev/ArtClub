# Pixel transforms (AC-083)

js/pixel-transform.js is a dependency-free pure JavaScript module for exact pixel-grid flips, quarter-turn rotations, cropping, padding and nearest-neighbor scaling. It is exposed as window.ArtClubPixelTransform in a browser and through CommonJS in Node.

## Buffer and result contract

- Input buffers are dense row-major arrays. Pixel (x, y) is at y * width + x.
- Opaque pixels use six-digit #RRGGBB; transparent pixels use null.
- Source and result dimensions are integers from 1 through 512 (maximum 262,144 pixels).
- Each operation returns { pixels, width, height } with a fresh output array. Source pixels are never modified.
- Transform operations move or copy exact pixel values. They do not smooth, blend, antialias or interpolate colors.

## API

### flipHorizontal(pixels, width, height) and flipVertical(pixels, width, height)

Horizontal flip mirrors each row left-to-right; vertical flip reverses row order. Dimensions do not change. Transparent pixels are moved exactly like opaque pixels.

### rotate90(pixels, width, height), rotate180(...) and rotate270(...)

All rotations are clockwise. 90° and 270° swap output width/height; 180° preserves them. Each source pixel is written to exactly one destination coordinate. Non-square canvases are supported.

### crop(pixels, width, height, x, y, cropWidth, cropHeight)

Copies the requested rectangle, whose origin is the inclusive top-left pixel. The crop rectangle must be entirely within the source canvas; out-of-bounds and zero-sized crops are rejected rather than silently padded or clipped. Output dimensions equal cropWidth/cropHeight.

### pad(pixels, width, height, left, top, right, bottom, fillColor)

Adds integer non-negative margins. fillColor defaults to transparent null and may be a six-digit HEX color. Existing source pixels are copied at offset (left, top). The resulting dimensions must remain within 512×512. Zero padding returns a fresh same-size copy.

### scaleNearest(pixels, width, height, newWidth, newHeight)

Scales to a validated 1..512 output size by sampling source pixel centers. For destination coordinate d, the source coordinate is floor(((2d + 1) * sourceSize) / (2 * destinationSize)), clamped to the last source pixel. This defines exact, deterministic behavior for both upscaling and downscaling. No new colors are created; null transparency is preserved.

## Complexity and safety

- Flips and rotations are O(width × height) time and output memory.
- Crop is O(cropWidth × cropHeight) time and output memory.
- Pad is O(newWidth × newHeight), including initialization of the fill area.
- Nearest-neighbor scale is O(newWidth × newHeight); source coordinate arithmetic is integer-only.
- No operation grows beyond the 512×512 output pixel limit, and malformed/sparse input buffers are rejected.

## Preview/commit boundary

These functions return complete transformed buffers. A future editor caller should display the result as a preview and commit it only after successful validation, inside the editor's existing undo transaction. Do not modify the project buffer incrementally during preview. No UI, renderer or Agent API integration is included in AC-083.
