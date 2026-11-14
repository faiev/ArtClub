# Pixel effects and raster primitives — working catalog

This catalog is being expanded phase by phase under the Agent 10 workstream. All modules are dependency-free plain JavaScript and return new values; they do not modify editor/project state. Canvas-backed operations validate dimensions up to 512×512 and clip generated pixels to the supplied canvas.

## AC-080 — Raster primitives

Module: js/pixel-primitives.js  
Node import: require("../js/pixel-primitives.js")  
Browser global: window.ArtClubPixelPrimitives

Every operation returns an array of unique { x, y } pixel-coordinate objects. options.width and options.height are the target canvas dimensions, each an integer from 1 through 512. Coordinates are integers bounded to -8192 through 8192. Pixels outside the canvas are omitted.

### rasterizeLine(x0, y0, x1, y1, options)

Uses integer Bresenham stepping. Both endpoints are inclusive before clipping. Result order follows the supplied start-to-end direction; reversing endpoints reverses traversal and can choose the opposite side of an exact tie. Lines longer than 8192 major-axis steps are rejected before iteration. No floating-point antialiasing is used.

### rasterizeRectangle(x, y, rectWidth, rectHeight, options)

x/y name the inclusive top-left pixel and the extents count pixels (not coordinate differences). Width and height must be integers from 1 through 512. The default is an outline; set options.filled = true for a filled rectangle. Degenerate one-pixel-wide/high rectangles return each pixel once. Output is row-major.

### rasterizeEllipse(x, y, ellipseWidth, ellipseHeight, options)

The ellipse occupies the half-open bounding box [x, x + ellipseWidth) × [y, y + ellipseHeight). Each candidate is tested at its pixel center using an integer ellipse equation, with no floating-point antialiasing. The default returns the discrete perimeter: included pixels with at least one orthogonal neighbor outside the discrete ellipse. Set options.filled = true for the complete interior. Output is row-major.

### rasterizeCircle(x, y, diameter, options)

Convenience wrapper over rasterizeEllipse with equal width and height. diameter is a bounding-box pixel extent from 1 through 512, not a radius. Outline/fill and clipping semantics are identical to the ellipse operation.

### rasterizePolygon(points, options)

Accepts 3–4096 integer { x, y } vertices. Adjacent duplicate vertices and a repeated final copy of the first vertex are normalized away. Uses an even-odd scanline fill sampled at pixel centers. Horizontal edges do not create scanline crossings; non-horizontal crossings include their lower-Y endpoint and exclude their upper-Y endpoint. Each paired fill span includes its left crossing and excludes its right crossing. These half-open rules make shared vertices deterministic and avoid double-counting. Self-intersections use the even-odd rule. Output is clipped and row-major.

### Determinism and complexity

- Line traversal is O(max(|dx|, |dy|)) with a hard 8192-step bound and O(canvas pixels) worst-case output.
- Rectangle and ellipse candidates are restricted to the intersection of their bounding box and the canvas, at most 262,144 candidates.
- Polygon scan conversion is bounded by 512 scanlines × at most 4096 edges plus at most 262,144 output-candidate checks.
- All algorithms return fresh arrays/objects and leave caller-owned inputs unchanged.
- Primitives return coordinates only; applying them to artwork, undo history or UI state remains the responsibility of a future caller.

### Validation and known limits

Malformed dimensions, non-integer coordinates, invalid extents, sparse/malformed polygons and oversized polygon inputs are rejected. Line endpoints and shape bounds are limited to the documented coordinate range. Rectangle and ellipse bounding-box extents are limited to 512; larger shapes should be decomposed or clipped by a higher-level caller. Polygon fill does not generate a polygon outline; compose its edges with rasterizeLine when an outline is needed.

## Next catalog phases

This working catalog will be extended with AC-081 flood fill/regions, AC-082 color/gradient operations, AC-083 transforms, AC-084 error diffusion/configurable shading, and AC-085 fixture/stress evidence before AC-086 publishes the complete integration contract. The existing pixel-effects module from AC-019 remains a separate PR until coordinator merge.
