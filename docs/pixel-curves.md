# Pixel Bézier curves (AC-096)

js/pixel-curves.js is a dependency-free pure JavaScript module for deterministic pixel-grid rasterization of quadratic and cubic Bézier paths. It is exposed as window.ArtClubPixelCurves in a browser and through CommonJS in Node.

## API

### rasterizeQuadratic(p0, p1, p2, options)

### rasterizeCubic(p0, p1, p2, p3, options)

Each control point is an integer {x, y} coordinate. options must include integer canvas width and height from 1 through 512. The functions return a path-ordered array of unique integer {x, y} points clipped to the canvas.

Both endpoints are included when they lie inside the canvas. Each flattened chord uses inclusive Bresenham endpoints. At segment junctions, duplicate points are emitted once; for a closed path whose end equals its start, that coordinate appears once at its first position. Points outside the canvas are omitted without shifting or scaling the curve.

## Deterministic flattening and coordinate precision

- Inputs are integer pixel coordinates bounded to -8192..8192 on each axis.
- Control points are promoted to signed fixed-point units at 1024 subpixel units per pixel.
- De Casteljau subdivision uses integer midpoint arithmetic. Exact half ties round away from zero. This fixed rounding policy is applied at every subdivision level.
- Flatness is tested against the finite chord segment, not just its infinite supporting line. Every inner control point must lie within the configured perpendicular tolerance of the segment; when the projection falls outside the segment, distance to the nearest endpoint is tested. A zero-length chord uses endpoint distance.
- Cross-product flatness comparisons use BigInt integer arithmetic, avoiding floating-point threshold instability. The tolerance is measured in fixed-point units.
- When a chord is flat enough, both chord endpoints are rounded to the nearest integer pixel; exact half-pixel ties round away from zero. The chord is then rasterized by integer major-axis sampling. Exact half ties in the minor coordinate round toward the segment endpoint; reversing or reflecting a segment therefore reflects the selected pixel as well.
- The algorithm uses an explicit stack, pushing the right half before the left half so output traversal remains left-to-right along the supplied curve parameter. It does not rely on JavaScript recursion depth.

Default options:
- flatnessTolerance: 128 (1/8 pixel, expressed in 1/1024-pixel units);
- maxDepth: 12 subdivision levels;
- maxSegments: 4096 flattened chords;
- maxIterations: 8191 processed subdivision nodes;
- maxRasterSteps: 262144 total Bresenham pixel steps.

## Bounds and failure behavior

- Canvas width/height: 1..512.
- Input control coordinates: safe integers from -8192..8192.
- flatnessTolerance: integer 1..1024 fixed-point units.
- maxDepth: integer 1..16.
- maxSegments: integer 1..8192.
- maxIterations: integer 1..16383; counts each popped subdivision node.
- maxRasterSteps: integer 1..1,048,576; counts the total major-axis Bresenham work across flattened chords.

If the curve cannot reach the requested flatness within maxDepth, exceeds maxIterations or maxSegments, or would exceed maxRasterSteps, the operation throws RangeError and returns no partial coordinate list. Invalid/sparse control point arrays, non-finite/fractional coordinates, invalid canvas dimensions and out-of-policy coordinates are rejected before subdivision. The function does not mutate supplied point objects.

## Complexity and output guarantees

Let I be processed subdivision nodes, S be accepted flat segments and R be total Bresenham steps. The operation is bounded by O(I + R) work and O(I + output points) memory, with user-configurable ceilings and hard absolute maxima above. A curve fully outside the viewport returns an empty list. Duplicate coordinates created by overlapping/closed path segments are removed while preserving first-seen path order.

The result is a pixel-grid path only: integer pixel coordinates with no antialiasing, alpha coverage, subpixel compositing or vector stroke width. A future shape/curve UI can consume the points and commit them inside one editor undo transaction, but AC-096 does not wire a Pencil/Curve tool or modify the live editor.
