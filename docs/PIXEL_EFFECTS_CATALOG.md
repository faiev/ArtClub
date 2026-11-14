# One Pixel Studio — pixel algorithm catalog

This catalog covers Agent 10's dependency-free, pure JavaScript pixel algorithms. Operations return coordinates, colors or complete output buffers; none writes editor/project state. They require no backend, accounts, network access or external service.

## Shared input/output contract

- Pixel buffers are dense row-major arrays. Pixel (x, y) is at y * width + x.
- Opaque entries are six-digit #RRGGBB strings; null means fully transparent. Partial alpha is not represented.
- Canvas dimensions are integers 1..512 (262,144 pixels maximum).
- Malformed HEX, sparse buffers, invalid dimensions, unsafe coordinates and out-of-budget parameters are rejected.
- HEX outputs are canonical uppercase. Inputs are not mutated. Returned buffers/coordinate lists are independent values.
- Operations do not read active layer/cel, selection, history, viewport or project state.

## Module and integration status

| Task | Module | Status at catalog update |
|---|---|---|
| AC-019 | js/pixel-effects.js | PR #15 open, isolated |
| AC-080 | js/pixel-primitives.js | PR #31 merged to main |
| AC-081 | js/pixel-regions.js | PR #37 open, isolated |
| AC-082 | js/pixel-color.js | PR #44 open, isolated |
| AC-083 | js/pixel-transform.js | PR #50 open, isolated |
| AC-084 | js/pixel-advanced-dither.js | PR #69 open, isolated |
| AC-085 | tests/fixtures/pixel-effects/** | PR #70 open; first golden tranche |

A module on main is not necessarily integrated into the live editor. No UI or Agent API integration is implied.

---

## AC-019 — symmetry, simple outline, shading and ordered Bayer

Module/global: js/pixel-effects.js / window.ArtClubPixelEffects  
Node: require("../js/pixel-effects.js")

- expandSymmetry(pointOrStroke, {width, height, mode}): point or point-array to unique {x,y} coordinates. mode horizontal, vertical or four-way (default). Center is fixed at x'=width-1-x and y'=height-1-y. Clips out-of-canvas points and removes duplicates in first-seen order. Up to four output candidates per input point.
- generateOutline(pixels, width, height, {color, neighbors}): returns a copied buffer, adding a one-pixel color around non-null pixels into null neighbors. color defaults #000000; neighbors defaults 8, may be 4. Existing artwork is not overwritten; edges clip. O(N × neighbor count).
- shadeColor(color, amount): amount -1..1, negative toward black and positive toward white. lightenColor/darkenColor accept 0..1. Each channel uses linear interpolation and Math.round (half-up). O(1).
- createBayerMatrix(size): fresh 2/4/8 rank matrix.
- orderedDither(tones, width, height, {colorA,colorB,matrixSize,originX,originY}): normalized 0..1 tone buffer or null; returns colorA/colorB/null. matrixSize defaults 4. Threshold is (matrix[y][x]+0.5)/(matrixSize²); strict tone > threshold selects colorB, equality selects colorA. O(N).

Limits: canvas 1..512. Symmetry uses fixed canvas center; outline is one pixel and treats non-null as opaque; dithering consumes caller-supplied tones rather than deriving luminance from RGB.

---

## AC-080 — raster primitives (merged)

Module/global: js/pixel-primitives.js / window.ArtClubPixelPrimitives  
Node: require("../js/pixel-primitives.js")

All return unique {x,y} coordinates clipped to options.width × options.height. Canvas is 1..512. Coordinates are safe integers bounded to ±8192. Shape output is row-major; line order follows start-to-end direction.

- rasterizeLine(x0,y0,x1,y1,options): integer Bresenham; both endpoints inclusive before clipping; max 8192 major-axis steps. O(max(|dx|,|dy|)).
- rasterizeRectangle(x,y,rectWidth,rectHeight,options): inclusive top-left; width/height are pixel extents 1..512. options.filled defaults false. One-pixel rows/columns emit each pixel once. O(clipped bounding-box area).
- rasterizeEllipse(x,y,ellipseWidth,ellipseHeight,options): half-open bounding box; integer pixel-center ellipse equation. Default outline is included pixels with at least one orthogonal neighbor outside the discrete ellipse; options.filled true returns interior. O(clipped bounding-box area).
- rasterizeCircle(x,y,diameter,options): ellipse with equal extents; diameter is a bounding-box extent, not radius.
- rasterizePolygon(points,options): 3..4096 integer vertices. Removes adjacent/closing duplicates. Even-odd scanline fill at pixel centers; horizontal edges ignored; lower-Y crossings included, upper-Y excluded; spans are left-inclusive/right-exclusive. Self-intersections use even-odd. Bounded by 512 scanlines × 4096 edges plus canvas checks.

No floating-point antialiasing. Polygon fill returns interior only; compose rasterizeLine for a stroke. Bounds beyond ±8192 or extents beyond 512 are rejected.

---

## AC-081 — connected regions, border extraction and flood fill

Module/global: js/pixel-regions.js / window.ArtClubPixelRegions  
Node: require("../js/pixel-regions.js")

- selectRegion(pixels,width,height,startX,startY,options): options connectivity 4/8 (default 4), tolerance 0 only, maxIterations, shouldCancel. Returns {color,points,bounds,iterations}; points are fresh row-major {x,y}.
- extractRegionBorder(...): returns {color,points,bounds,regionSize,iterations}. A selected pixel is border if a configured neighbor is outside the region or canvas.
- floodFill(...,replacementColor,options): replacement is HEX or null. Returns {pixels,color,replacementColor,points,bounds,changed,iterations}; output HEX uppercase. Same-color replacement returns an independent copy and changed=0.

Exact RGB match, case-insensitive HEX. null is a selectable transparent region. Dense buffers only. Queue and visited map are typed arrays bounded to 262,144 entries. maxIterations defaults to full canvas size; exceeding it throws instead of returning partial results. shouldCancel is synchronous; true throws AbortError. O(N) time and bounded O(N) auxiliary memory; fill additionally copies output buffer. Synchronous calls cannot be preempted from another thread while the JS event loop is blocked.

---

## AC-082 — exact color and gradient operations

Module/global: js/pixel-color.js / window.ArtClubPixelColor  
Node: require("../js/pixel-color.js")

- replaceColor(pixels,width,height,fromColor,toColor): exact HEX source to HEX or null; null source selects transparent entries.
- mapPalette(pixels,width,height,mappings): ordered {from,to} exact mapping; either side may be null. Unmapped colors stay unchanged. Duplicate sources/sparse mappings rejected; max 256 entries.
- applyGradient(pixels,width,height,colorA,colorB,options): horizontal default, vertical or linear. Recolors non-null pixels only. Linear projects integer pixel coordinates onto start/end vector, clamps to [0,1], default top-left to bottom-right; endpoints must be inside canvas. Zero-length vector resolves to colorA. Channel interpolation uses rational integer arithmetic and half-up rounding.
- quantizeColor(color,levels), posterize(pixels,width,height,levels): levels 2..256; each RGB channel independently quantized to evenly spaced values with integer half-up rounding. null preserved.
- applyColorRamp(pixels,width,height,ramp): 2..256 ordered HEX colors; integer Rec.601 luma (299R+587G+114B)/1000 selects nearest equally spaced stop; ties choose brighter/higher index. This is luma mapping, not nearest-RGB palette search.

All are O(N) or O(N × bounded mappings), validate dense buffers and return complete new arrays.

---

## AC-083 — exact pixel-grid transforms

Module/global: js/pixel-transform.js / window.ArtClubPixelTransform  
Node: require("../js/pixel-transform.js")

Every operation returns {pixels,width,height} with a fresh dense buffer.

- flipHorizontal / flipVertical: mirror columns or rows; dimensions unchanged; O(N).
- rotate90 / rotate180 / rotate270: clockwise. 90/270 swap width/height; 180 preserves them; O(N).
- crop(pixels,width,height,x,y,cropWidth,cropHeight): fully in-bounds rectangle only; no clipping/padding; O(crop area).
- pad(pixels,width,height,left,top,right,bottom,fillColor): non-negative integer margins; fill defaults null or HEX; resulting dimensions validated ≤512 before allocation; O(output area).
- scaleNearest(pixels,width,height,newWidth,newHeight): source index for destination coordinate d is floor(((2d+1)*sourceSize)/(2*destinationSize)), clamped to last pixel. Pixel-center sampling; no smoothing/interpolation; O(output area).

Null pixels are moved/copied exactly. Malformed/sparse buffers rejected.

---

## AC-084 — advanced dithering and configurable outlines

Module/global: js/pixel-advanced-dither.js / window.ArtClubPixelAdvancedDither  
Node: require("../js/pixel-advanced-dither.js")

- floydSteinberg(pixels,width,height,palette,options): palette is 2..64 unique HEX colors. Returns {pixels,width,height,scanDirection,alphaMode,distanceMetric}. Uses 7/16,3/16,5/16,1/16 error weights. Scan is left-to-right, right-to-left or serpentine (default; alternate row direction). Alpha preserve (default) leaves null transparent and treats it as a diffusion barrier; composite requires backgroundColor HEX and makes null opaque before processing. Distance is squared euclidean-rgb or weighted-rec601 (299dr²+587dg²+114db²). Exact ties choose earliest palette entry. Adjusted channels clamp 0..255 before matching; Float64 scratch carries error. O(N × palette), palette ≤64.
- outlinePixels(pixels,width,height,options): options color default #000000, thickness 1..32, mode outer (default), inner or both, connectivity 4/8. Outer writes into transparent cells within graph distance of artwork; inner colors opaque cells within thickness of transparent pixels or canvas exterior; both applies both. Output clipped to source canvas. Typed-array distance maps and queues bounded by N; O(N × neighbor count).

Both operations return complete new buffers or throw; no partial output.

---

## AC-085 — golden fixtures and stress corpus

The initial corpus under tests/fixtures/pixel-effects/ contains checkerboard, diagonal line, transparent-hole ring, grayscale ramp, symmetric sprite and generated 512×512 checkerboard fixtures. Current tests validate fixture integrity and compare several expected geometry cases directly against merged AC-080 raster primitives. Remaining work: compare raw output buffers for AC-019 and AC-081–084 as their modules merge; add repeated-run, full-size stress, runtime/allocation and non-mutation assertions across every operation.

---

## Preview, validation and commit boundary

All operations are preview functions. A future UI/Agent adapter must:
1. Read active cel/layer into a dense immutable source buffer.
2. Call the pure API and retain its complete result separately from project state.
3. Validate result dimensions, buffer length, colors and transparency invariants.
4. Show preview without changing project data or history.
5. On confirmation, commit the entire buffer inside one existing undo transaction.
6. On error/cancellation, discard preview and leave source/history unchanged.

Illustrative future adapter only (not a shipped editor API):

~~~javascript
const preview = PixelRegions.floodFill(sourcePixels, width, height, seedX, seedY, replacement);
validateCompleteBuffer(preview.pixels, preview.width, preview.height);
showPreview(preview);
if (userConfirmed) {
  runInSingleUndoTransaction(() => replaceActiveCel(preview.pixels));
}
~~~

Production adapters must use the editor's actual transaction/history APIs and preserve conflict/selection semantics. This catalog does not authorize index.html, renderer, project model, palette implementation, bridge or Agent API changes. A documented module is not a shipped user-facing feature.
