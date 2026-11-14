# UI-03 — Canvas navigation acceptance contract

**Owner:** Coordinator owns production UI wiring. Agent 2 owns this navigation/renderer acceptance contract and specialist review.  
**Status:** Acceptance criteria only; this document does not implement or authorize production UI changes.  
**Related modules:** `js/canvas-viewport.js` (merged in PR #34), `js/canvas-renderer-adapter.js` (merged in PR #43), isolated Canvas renderer prototype.  
**Production renderer:** Keep the existing DOM-grid renderer active for UI-03. Navigation must not imply a Canvas renderer migration.

## 1. User-visible outcomes

The editor must make the artwork reliably navigable without changing its pixels:

- **Fit** makes the entire logical canvas visible inside the available viewport, preserves its aspect ratio and centers it.
- **Actual size / 1:1** means one logical artwork pixel maps to exactly one CSS pixel. Device pixel ratio affects backing resolution only; it does not redefine “actual size”.
- **Zoom in/out** changes scale within documented finite bounds.
- **Cursor-anchored zoom** keeps the same logical canvas point beneath the pointer while zooming, except where an explicit viewport boundary clamp makes that mathematically impossible.
- **Pan** moves the view in CSS-pixel space without starting a brush stroke, selection, drag-edit or other artwork mutation.
- Viewport resize and DPR changes refresh display/backing geometry without corrupting logical coordinate mapping.

These are separate commands. “Fit” must not be labelled “100%”, and “Actual size” must not merely restore the last fit scale.

## 2. Coordinate-space contract

Use the following coordinate spaces consistently:

| Space | Units | Contract |
|---|---|---|
| Logical canvas | Logical pixel units | Artwork coordinates. The canvas occupies `[0,width) × [0,height)`; integer cell `(x,y)` is the half-open unit square `[x,x+1) × [y,y+1)`. |
| Viewport-local | CSS pixels | Pointer and pan coordinates relative to the visible canvas viewport's content box. |
| Browser client | CSS pixels | `clientX/clientY`; convert to viewport-local by subtracting the current viewport `getBoundingClientRect().left/top`. |
| Backing store | Device pixels | Used only when allocating/drawing a raster backing surface; dimensions are rounded from CSS size × DPR. |

For a logical point `(x,y)`, scale `s` CSS pixels per logical unit, and CSS offsets `(ox,oy)`, the transform is:

```text
screenX = ox + x * s
screenY = oy + y * s
canvasX = (screenX - ox) / s
canvasY = (screenY - oy) / s
```

Pointer conversion must not multiply or divide by DPR. Convert browser client coordinates to viewport-local CSS coordinates first; then apply the inverse viewport transform. Convert a valid logical point to a cell with `floor(x), floor(y)`, rejecting points outside the half-open canvas bounds. The right and bottom edges are outside the canvas, not an extra row or column.

For a CSS display size `(displayWidth,displayHeight)` and DPR `d`, backing dimensions are:

```text
backingWidth  = max(1, round(displayWidth  * d))
backingHeight = max(1, round(displayHeight * d))
```

DPR must never change the logical cell under a pointer or the meaning of 100% / actual size. Do not mix backing-store pixels with pointer coordinates.

## 3. Required navigation behavior

### 3.1 Fit-to-canvas

- Compute one uniform scale from both available viewport dimensions after applying a consistent, documented inner padding:
  `fitScale = min(availableWidth / canvasWidth, availableHeight / canvasHeight)`.
- Preserve the artwork's width-to-height ratio. Do not independently clamp rendered width and height.
- Center the canvas on both axes when the scaled content is smaller than the viewport.
- When content is larger than the viewport, keep the full canvas reachable through pan; no logical rows/columns may become permanently inaccessible.
- Recompute fit when the user invokes Fit. Do not silently refit after every render or after ordinary artwork changes.
- After viewport resize, preserve the current center logical point and current zoom where possible; clamp offsets to the new extents. Fit remains an explicit command unless the UI is in a documented “fit on resize” mode.

### 3.2 Actual size / 1:1

- Set `scale = 1 CSS px per logical canvas unit`, subject only to documented minimum-scale constraints if the viewport library cannot represent 1 (the current viewport utility supports 1).
- Do not use `DPR` as the actual-size multiplier.
- The command must produce the same logical-to-CSS scale on DPR 1, 1.25, 1.5 and 2.
- Keep the canvas centered when it fits; when it does not fit, clamp it so all artwork remains pan-reachable.

### 3.3 Bounded zoom

- Configure finite, explicit minimum and maximum scales. The merged viewport utility defaults to 0.1–16; a production control may expose a narrower range only if the selected limits are documented and consistently applied to pointer, keyboard and button zoom.
- Every zoom entry point (buttons, wheel/trackpad, keyboard) must use the same state and limits.
- Reaching a limit must not accumulate hidden scale or offset drift.
- Display a readable zoom percentage derived from the actual scale. Do not display 100% when the scale is not 1.

### 3.4 Cursor-anchored zoom

For a pointer at viewport-local CSS coordinate `(px,py)`, preserve the logical anchor:

```text
anchorX = (px - ox) / oldScale
anchorY = (py - oy) / oldScale
newOffsetX = px - anchorX * newScale
newOffsetY = py - anchorY * newScale
```

- Preserve the anchor within floating-point tolerance whenever offset clamping is not required.
- When the canvas edge clamp prevents exact preservation, clamp deterministically and document that the anchor can move only by the amount required to keep the canvas bounds valid.
- Use viewport-local coordinates, not raw client coordinates or backing-store coordinates.
- Test pointer positions at the center, near all four corners, on fractional CSS coordinates and near canvas edges.
- A zoom gesture must never dispatch a paint/erase/fill or selection action.

### 3.5 Pan

- Pan deltas are CSS pixels in viewport-local space.
- Panning must be a view-only operation: it does not modify project pixels, selection contents, layer/frame data, undo history or saved project bytes.
- When the scaled canvas is smaller than the viewport on an axis, center it on that axis rather than exposing arbitrary empty space.
- When it is larger, clamp offsets so no region outside the canvas can be exposed as an unreachable gap and all canvas edges can be brought into view.
- Pointer capture must be released on pointer-up, pointer-cancel, lost capture and component teardown. A pan must not leave drawing state latched.
- Provide a keyboard-accessible alternative to pointer pan (for example, focusable pan buttons or documented keyboard pan mode). Do not make drag the only navigation path.

## 4. Resize and lifecycle behavior

- Observe the actual viewport content box (for example with `ResizeObserver`) and re-evaluate viewport dimensions when it changes.
- Avoid a resize feedback loop: renderer/canvas backing-size writes must not continually resize the observed CSS layout box.
- Preserve the logical center and zoom on ordinary viewport resize, then apply deterministic bounds clamping.
- DPR changes must recreate or resize backing surfaces without changing CSS scale or logical pointer mapping.
- Cover device-pixel-ratio changes caused by moving the window between displays or browser zoom where detectable. If the browser does not emit a direct DPR event, recheck DPR on the next resize/visibility/navigation event.
- Teardown must release pointer capture, observers and listeners. Repeated mount/unmount must not leave duplicate listeners or stale viewport state.
- Resize and DPR changes must force any necessary full raster/backing redraw; they must not alter the source artwork buffer.

## 5. Pointer and artwork invariants

- A pointer at the first cell center must map to `(0,0)`; a pointer at the last cell center must map to `(width-1,height-1)`.
- Points immediately outside each canvas edge must return no cell. Fractional CSS dimensions and non-integer DPR must not cause off-by-one rows/columns.
- The active production DOM grid and its real cell event targets remain authoritative during UI-03. If a future renderer integration is considered, it must separately satisfy the same coordinate contract.
- Fit, 1:1, zoom, pan, grid visibility, selection-outline visibility and resize must leave the logical artwork pixels byte-for-byte unchanged.
- Navigation must not add undo entries or alter dirty/save state.
- Grid, selection outlines and other display-only overlays must remain outside exported artwork.

## 6. Acceptance test matrix

Run real Chromium tests on the exact integration PR head. Record browser version, OS, DPR, viewport, canvas dimensions, tested action, exact result and screenshot references where available.

### Canvas dimensions

| Shape | Dimensions | Purpose |
|---|---:|---|
| Small square | 16 × 16 | Centering and minimum display geometry |
| Default square | 24 × 24 | Existing default workflow |
| Portrait | 32 × 48 | Height-constrained fit and aspect preservation |
| Landscape | 48 × 32 | Width-constrained fit and aspect preservation |
| Medium square | 64 × 64 | Larger viewport and pan behavior |
| Maximum supported square | 512 × 512 | Max-size bounds, pan reachability and backing-store cost |

### Viewports and DPR

| Viewport | Expected focus |
|---|---|
| 1440 × 900 | Desktop shell, full canvas, inspector and timeline |
| 1280 × 800 | Compact desktop shell, vertical space constraints |
| 1100 px wide | Three-column to compact layout transition |
| 900 px wide | Inspector relocation and scroll reachability |
| 680 px wide | Narrow stacked layout |
| 390 px wide | Phone-width layout; no horizontal page overflow |

Run the core mapping/scale matrix at DPR **1, 1.25, 1.5 and 2**. The 390 px layout should be exercised at minimum DPR 1 and one fractional DPR.

### Required cases

1. Fit and 1:1 separately produce their defined scales and preserve aspect ratio for every canvas shape.
2. Cursor-anchored zoom preserves the same logical point at center/corners and with fractional pointer coordinates, unless the explicit bounds clamp applies.
3. Zoom limits are respected identically by buttons, wheel/trackpad and keyboard.
4. Pan can reveal the first and last rows/columns for large canvases; small canvases remain centered.
5. First/last cell-center mapping is correct after fit, actual-size, repeated zoom, pan, resize and DPR change.
6. Right/bottom edge and just-outside points are rejected; no phantom row/column appears.
7. Viewport resize preserves center/scale as specified and does not cause aspect-ratio distortion or observer loops.
8. Pointer-up, pointer-cancel, lost pointer capture and teardown all terminate pan cleanly; the next canvas click behaves normally.
9. Keyboard-only navigation reaches named controls, keeps visible focus and offers a non-drag pan alternative.
10. Repeat zoom/pan/resize cycles and mount/unmount cycles; no stale listeners, stuck pointer capture or accumulating offset drift.
11. Compare source artwork bytes, undo/redo state, active selection and saved project serialization before and after navigation-only actions; all must remain unchanged.
12. Check for horizontal/vertical page overflow, clipped first/last cells, unreachable tools, inspector compression and timeline accessibility at all listed viewport widths.

## 7. Accessibility and interaction requirements

- Controls have explicit accessible names: “Fit canvas”, “Actual size (100%)”, “Zoom in”, “Zoom out” and “Reset view” where that command is distinct.
- Expose current zoom percentage as readable text; do not communicate it through color alone.
- Keyboard focus remains visible against the workstation theme. Tab/Shift+Tab navigation must not enter a trap.
- Wheel/trackpad zoom behavior must be discoverable and must not unexpectedly hijack page scrolling when the pointer is outside the canvas viewport.
- Pan mode and drawing mode must be distinguishable. A pan gesture must never be interpreted as artwork input.
- Honor `prefers-reduced-motion`; avoid animated zoom/pan transitions when reduced motion is requested, and keep motion short and non-blocking otherwise.
- Keep focus on the initiating navigation control after activation unless a documented, user-beneficial focus transition is required.

## 8. Release gates and ownership

UI-03 navigation is acceptable only when:
- the coordinate contract and all navigation behaviors above pass the required Chromium matrix;
- artwork bytes, project state, undo/redo and exports remain unchanged by navigation;
- keyboard and focus behavior are verified;
- no first/last cell becomes unreachable at supported dimensions and viewport sizes;
- exact-head Node and real-Chromium editor E2E checks pass;
- the reviewer records the exact tested SHA and browser/environment evidence.

**Renderer replacement is not part of this acceptance contract.** Replacing the DOM grid with Canvas is a separate adoption decision requiring full raster parity, fractional CSS/DPR pointer parity, accessibility/focus parity, invalidation correctness, repeated representative workload evidence, lifecycle cleanup and a working DOM fallback. Keep current DOM rendering as the production path until that separate gate is accepted.

**Ownership boundary:** this document is an Agent 2 acceptance deliverable only. Production `index.html`, production CSS/UI wiring and workflow changes remain outside Agent 2's authority.
