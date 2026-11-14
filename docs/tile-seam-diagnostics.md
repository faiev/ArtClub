# Tile seam diagnostics

The tile-seam-diagnostics module is a pure, bounded, renderer-independent analyzer for tile borders and repeated-block joins. It exports ArtClubTileSeamDiagnostics in browsers and a CommonJS module for Node.

## API

- analyzeTileSeams(pixels, width, height, options) returns a structured diagnostic report.
- formatTileSeamReport(report) produces a readable summary and advisory suggestions.
- serializeTileSeamReport(report, space) returns JSON text.

Input is a flat row-major Array or typed array with exactly width × height entries. Null represents transparency. Sparse arrays and undefined entries are rejected. Pixel values are compared exactly; the input buffer is never mutated.

## Diagnostics

The report identifies left/right and top/bottom edge mismatches, both diagonal corner pairs, transparent-versus-opaque edge mismatches, one-pixel shift candidates, and repeated-block boundary mismatches with preview-space coordinates.

Shift candidates compare equal-length interior edge windows with offsets -1 and +1. A candidate is returned only when it reduces the mismatch count. The report includes compared values and coordinates. The sign is the offset applied to the second edge sample coordinate. A candidate is a hint, not a correction.

## Repeated preview

repeatColumns and repeatRows default to 2. offsetX and offsetY default to 0. Positive offsets move artwork right/down in the repeated preview; negative offsets move it left/up. Offsets are normalized toroidally. Join analysis samples the source tile directly and does not allocate a full repeated-preview buffer.

## No automatic repair

This module only analyzes. It never shifts pixels, changes transparency, interpolates colors, or writes to source artwork. Suggestions are advisory; a separately authorized editor action must decide whether to modify pixels.

## Bounds

Dimensions are limited to 4,096 per side and 4,194,304 source pixels. Repeat counts are limited to 256 per axis. Estimated join comparisons plus the fixed diagnostic budget may not exceed 1,000,000 report items. Limits are exposed through the frozen LIMITS object.

## Tests

From the repository root run node --check js/tile-seam-diagnostics.js, node --check tests/tile-seam-diagnostics.test.js, and node --test tests/tile-seam-diagnostics.test.js.
