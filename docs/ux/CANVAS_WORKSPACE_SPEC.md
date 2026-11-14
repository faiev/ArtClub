# Canvas Workspace and Navigation Specification

**Task:** AC-049 — Canvas navigation and workspace interaction specification  
**Owner:** Agent 5 — UX / accessibility  
**Branch:** `agent/canvas-workspace-spec`  
**Production source reviewed:** `main` `index.html` blob `4645281c1aad8580529e7feb99cd299a88543913` (UI-01 workstation shell)  
**Status:** Product/interaction specification only. No production UI or code is included.

---

## 1. Purpose and product outcome

The canvas must remain easy to inspect and edit from a small sprite to the largest supported 512×512 document. Users need to zoom toward the pixel they are inspecting, move the artwork through a constrained viewport, get back to a useful framing quickly, and continue drawing without accidentally changing the artwork while navigating.

This is a behavior and acceptance specification for the later implementation owner. It is deliberately aligned with Agent 2's renderer-independent viewport utility work (AC-034) without prescribing an implementation API or claiming that the renderer has been integrated.

### Goals

- Make pan, zoom, fit and reset predictable, reversible viewport operations.
- Define cursor-anchored zoom and logical-pixel coordinate mapping.
- Preserve crisp pixel rendering at fractional CSS sizes and high device-pixel ratios.
- Specify mouse, keyboard, touch and trackpad behavior without stealing browser gestures.
- Preserve canvas access when side panels open, close or collapse.
- Make viewport controls reachable and understandable without a pointer.
- Ensure viewport changes never alter artwork, history, project serialization or exports.

### Non-goals

- No changes to drawing tools, the project model, cels, frames or pixel algorithms.
- No production UI, CSS, JavaScript, tests or workflow changes in AC-049.
- No renderer replacement or performance claim.
- No mandatory minimap in the first navigation pass.
- No custom shortcut-remapping or command-palette implementation.

## 2. Current behavior verified in main

The post-release source audit was rechecked against the current production `index.html` blob `4645281c1aad8580529e7feb99cd299a88543913` (the merged UI-01 workstation shell). UI-01 changed the editor's layout and responsive hierarchy but intentionally retained the live DOM pixel grid, drawing handlers and original zoom model.

### 2.1 Existing canvas and zoom presentation

- The production editor now presents a compact workstation: the left tool panel, central stage/canvas, right inspector and bottom timeline. The canvas remains the central editing surface; UI-01 did not replace it with the AC-091 prototype's synthetic layer-by-frame matrix.
- The stage exposes three live zoom controls: `#zoomOut`, `#zoomReset` and `#zoomIn`. The reset button's visible percentage is dynamically populated by `applyZoom()`.
- `applyZoom()` derives a fit-relative base size from the canvas wrapper: `maxSide = clamp(parentWidth - 48, 96, 560)`; it then multiplies that base by the current zoom factor and scales the largest logical canvas dimension to that size. This is not a CSS-pixel-per-artwork-pixel measurement.
- `setZoom()` clamps the factor to 0.5–2.0 in 0.25 increments. The visible “100%” value therefore means the fit-relative factor 1.0, **not** one CSS pixel per logical artwork pixel.
- There is still no distinct Fit action, no true Actual Size action, and no pan/hand mode in the live stage. The center may scroll when content exceeds its wrapper, but scrolling is not a deliberate, bounded viewport-pan model.
- UI-01 added a responsive shell: at 1050 CSS px the inspector moves beneath the primary workspace; at 700 CSS px the workspace stacks into one column and the tool controls reflow. The viewport specification must treat panel reflow and canvas wrapper resizing as inputs to the future viewport owner, not as proof that view state is already preserved across every layout transition.
- The production grid has an additional bounding rule in `.canvas-wrap #pixelGrid`: width is constrained to the wrapper and 560 px maximum while its project aspect ratio is retained. This protects reachability of the first/last pixel after the UI-01 height/layout correction.

### 2.2 Existing input behavior

- `#pixelGrid[role=grid]` remains the production canvas. Pointer input is routed to the active drawing/selection/fill/sampling tool; the UI-01 shell did not add a separate pan gesture or alter pixel mutation handlers.
- The grid retains its keyboard pixel navigation and Space/Enter activation model. These actions operate on logical cells, not on a separate viewport-focus navigation mode.
- The document-level key handler still processes project shortcuts before its editable-control guard for some modified keys; this specification does not treat the current shortcut routing as a completed accessibility implementation.
- The three toolbar zoom controls call `setZoom()` directly. They do not preserve a pointer-anchored logical pixel because the production zoom model does not track viewport offsets or a zoom anchor.
- No production wheel zoom, trackpad pan, two-finger pinch, middle-button pan or temporary Space-drag pan behavior is wired.
- Canvas pointer mapping continues to be tied to the DOM grid's current geometry. Any later viewport wiring must prove that drawing/selection still maps to the same logical cell after zoom, wrapper resize, responsive reflow and browser zoom.

### 2.3 Relevant system constraints and available modules

- ProjectModel permits a maximum canvas width or height of 512 logical pixels.
- The renderer-independent viewport utility is now present on `main` as `js/canvas-viewport.js`, documented by `docs/CANVAS_VIEWPORT.md`. Its pure API includes `createViewport`, `panBy`, `zoomAt`, `zoomBy`, `fitToCanvas`, `resetViewport`, `resizeViewport`, coordinate conversion helpers and DPR/backing-store helpers.
- The viewport utility uses CSS pixels for offsets and screen coordinates; DPR is applied only at backing-store conversion boundaries. Its pan functions clamp content to the viewport and center content that is smaller than the view. Invalid dimensions, scales and coordinates are rejected.
- The viewport module is a reusable contract, **not a live production integration**. UI-01 continues to render the existing DOM pixel grid, and this specification does not imply a Canvas renderer replacement.
- The isolated Canvas renderer and its project adapter remain separate from the production DOM grid. Any renderer decision must use Agent 2's current workload evidence and preserve the DOM fallback until raster, pointer, focus, overlay and performance gates pass.

## 3. Core viewport model and invariants

The viewport is presentation state, not artwork data.

### 3.1 Conceptual state

The implementation may use a matrix, explicit offsets or another deterministic representation, but its observable behavior must be equivalent to:

- `zoom`: CSS display pixels per one logical artwork pixel.
- `panX`, `panY`: translation in viewport-local CSS pixels.
- `viewportWidth`, `viewportHeight`: available content-box dimensions in CSS pixels.
- `canvasWidth`, `canvasHeight`: logical project dimensions in pixels.
- `mode`: `fit` or `manual`, so resizing can distinguish automatic fit from a user-selected zoom.

The conceptual forward mapping is:

`viewportX = panX + zoom × canvasX`  
`viewportY = panY + zoom × canvasY`

The inverse mapping must recover the same logical point, then floor to the pixel cell only after rejecting points outside the logical canvas. The exact module method names and object shape belong to Agent 2's AC-034 contract.

### 3.2 Non-negotiable invariants

1. Panning and zooming never mutate source pixels, selections, palette, layers, frames, undo history or save state.
2. Viewport state is excluded from PNG, GIF, sprite-sheet and editable project artwork data. A later local preference may remember a view, but it must not alter exported content.
3. All viewport geometry is expressed in CSS pixels. Device-pixel ratio applies only at the renderer/backing-store boundary; do not multiply pointer coordinates by DPR a second time.
4. Pointer-to-pixel conversion always uses the current viewport transform and actual client bounds. It must remain correct after scroll, pan, zoom, resize, panel changes and browser zoom.
5. Pixel sampling and drawing use integer logical coordinates. Fractional CSS scale or DPR must not create fractional artwork coordinates.
6. Rendering remains nearest-neighbor/pixelated. No smoothing or interpolation may be introduced to make zoom look softer.
7. Invalid dimensions, non-finite offsets, zero/negative zoom and malformed viewport state fail predictably without leaving a partially updated transform.
8. Switching between Fit and Manual modes is explicit and must not silently reset the user's framing.

## 4. Zoom behavior

### 4.1 Separate Fit, 100% and manual zoom

These actions must have distinct meanings:

- **Fit:** calculate the largest uniform scale that displays the complete canvas inside the available viewport with a comfortable margin (recommended 24 CSS pixels on each side), then center it. The displayed value may be fractional and should be labelled “Fit” or “Fit · N%”.
- **100% / Actual size:** set the scale to exactly 1 CSS pixel per logical artwork pixel, then center the canvas. This is the predictable reference for inspecting native pixel size.
- **Manual zoom:** increment/decrement the current scale without changing the meaning of 100% or Fit. A recommended bounded range is 12.5%–1600%, with a discrete progression that includes 25%, 50%, 75%, 100%, 125%, 150%, 200%, 300%, 400%, 600%, 800%, 1200% and 1600%. Fit may calculate an intermediate value.
- **Zoom in / Zoom out:** change one step in the supported sequence. The controls must disable or stop changing at their bounds.
- **Reset:** in the initial implementation, make the existing percentage/reset control explicitly say “100%” or “Actual size”. Do not use one control to ambiguously mean both Fit and 100%.

The exact lower/upper bounds may be adjusted after testing very narrow viewports, but the implementation must cover 512×512 canvases without making the whole artwork permanently inaccessible.

### 4.2 Cursor-anchored zoom

When the pointer is inside the canvas viewport, a zoom operation should keep the logical artwork point under that pointer at the same viewport-local position.

Conceptually:

1. Convert the pointer's viewport-local position to a logical canvas coordinate using the old zoom and pan.
2. Apply the new zoom.
3. Recalculate pan so that the same logical coordinate maps back to the original pointer position.
4. Clamp the resulting pan only after preserving the anchor, and report when a viewport edge constraint prevents exact preservation.

For keyboard-triggered zoom, use the focused canvas point if there is one; otherwise use the viewport center. For a toolbar zoom click, use the last known pointer position when it is still inside the viewport; otherwise use the viewport center.

After anchoring, the pixel under the pointer must remain the same unless a documented edge clamp is reached. Zoom must not unexpectedly center the canvas on every click.

### 4.3 Fit behavior after layout changes

- When the viewport is in Fit mode, recalculate the fit scale after a container resize, responsive breakpoint change, inspector/tool drawer opening or closing, or window resize.
- When the viewport is in Manual mode, preserve the logical canvas point at the viewport center while the viewport dimensions change, then clamp pan to valid bounds.
- When a project changes dimensions or a different project opens, use Fit for the new project unless a later explicit product decision adds per-project view restoration.
- Changing panels must not reset a manually selected zoom to Fit or 100%.
- Fit must account for padding and visible overlays/controls; artwork must not be hidden beneath a fixed toolbar or status strip.

## 5. Pan behavior and input mapping

### 5.1 Pointer and mouse

Provide an explicit, discoverable **Pan / Hand** mode. In that mode, primary-button drag pans the viewport and never draws, fills, samples or changes a selection.

Also support:

- Middle-button drag as a temporary pan gesture in any drawing tool.
- Space + primary-button drag as a temporary Hand gesture while the pointer is over the canvas.
- Returning to the prior drawing tool when a temporary gesture ends.
- Pointer capture and cancellation so a pan remains coherent if the pointer leaves the viewport or the browser dispatches `pointercancel`.

Space-alone activation on a focused pixel cell must remain the grid's existing keyboard action. The implementation must distinguish a completed Space tap from a Space-held pointer drag; it must not paint a pixel and then pan for the same gesture. If that state machine proves unreliable across browsers, retain the explicit Pan mode and middle-button drag, and defer Space-drag rather than ship ambiguous input.

Primary-button drag in a drawing tool remains an artwork edit. A user must never have to guess whether a drag will paint or pan.

### 5.2 Touch and pen

- A single touch/pen pointer continues to use the active tool.
- Two-touch gesture pans the viewport; pinch changes zoom around the gesture centroid.
- Lifting one finger during a two-touch gesture must not turn the remaining finger into an accidental paint stroke.
- Pointer cancellation, orientation change or page interruption must end the gesture cleanly without mutating artwork.
- A visible Pan mode and toolbar zoom controls remain available when gesture recognition is unavailable or disabled.
- Do not rely on hover for touch-device discoverability.

### 5.3 Wheel and trackpad policy

- Plain vertical/horizontal wheel and two-axis trackpad scrolling over the viewport pan the canvas by the event's CSS-pixel delta.
- Consume a wheel delta only while the viewport can move in that direction. At a pan boundary, allow the page/container to continue scrolling rather than trapping the user.
- Do not bind Ctrl+wheel or Meta+wheel to canvas zoom. These gestures are commonly used for browser page zoom; preserve the browser's behavior and do not call `preventDefault()` for them.
- Do not bind Alt+wheel; avoid operating-system and input-method conflicts.
- Trackpad pinch gestures surfaced as Ctrl/Meta+wheel are treated as browser zoom, not app zoom. Dedicated two-touch pointer pinch remains available on touch screens.
- Wheel zoom is not required for the first implementation. Cursor-anchored toolbar/keyboard zoom provides an unambiguous alternative without stealing browser controls.
- Avoid page scroll hijacking when the pointer is outside the actual canvas viewport.

## 6. Pan bounds and viewport edges

- If the rendered artwork is smaller than the viewport in an axis, center it in that axis and do not permit arbitrary drift into empty space.
- If the rendered artwork is larger than the viewport, allow movement far enough to inspect and align every artwork edge.
- Clamp pan so the canvas cannot be lost entirely. At most a small intentional gutter (recommended 24 CSS pixels) may appear beyond an edge when the edge is aligned.
- Do not use a fixed pan limit based on canvas dimensions alone; limits must be computed from current viewport size, zoom and canvas dimensions.
- At Fit, the full canvas is visible and centered; pan is either disabled or resets to the fitted position.
- At extreme zoom, the user can reach all four corners and edge pixels without an inaccessible dead zone.
- At the minimum zoom, the implementation must not allocate a huge blank scroll surface. At the maximum zoom, backing-store allocation is bounded by the renderer's established memory policy.

## 7. Keyboard alternatives and focus

The workspace must support a complete navigation path without a mouse.

- Keep the current pixel-grid arrow-key behavior: when a pixel cell owns focus, plain arrows move the logical pixel focus and Space/Enter activate the current tool.
- Add a focusable Pan/Hand control with a visible pressed/active state. When Pan mode is active and the viewport owns focus, arrow keys pan by a predictable amount (recommended 32 CSS pixels; Shift+Arrow may use a larger step).
- Escape exits temporary Pan mode and returns focus to the previous canvas/tool context without changing artwork.
- Keep Fit, 100%, Zoom in and Zoom out as real buttons with accessible names; they must be reachable by Tab and activatable with Enter/Space.
- Do not assign Alt+Arrow to pan because browsers use Alt+Left/Right for history navigation.
- Do not make Space+drag the only keyboard-accessible navigation mechanism.
- Keep the shortcut/help documentation consistent with the behavior ultimately implemented. Any new permanent key (including an eventual Hand-tool key) must be reconciled with AC-026's shortcut map and conflict matrix before implementation.

The viewport region should have a clear accessible name (for example, “Canvas viewport”) and concise instructions describing how to enter Pan mode, return to drawing, zoom, fit and reach canvas edges. Do not announce every trackpad delta to a live region; announce completed Fit/Actual-size/manual zoom actions and Pan-mode changes, and keep a visible percentage/mode label.

## 8. Responsive workspace and panels

### Desktop

- Preserve the current overall hierarchy: tool rail on the left, canvas as the primary center region, contextual inspector on the right, timeline below.
- The center canvas must receive the remaining flexible space; side panels must not force the canvas outside the viewport at common laptop widths.
- Opening or collapsing a panel recomputes available viewport dimensions. Fit mode recalculates; Manual mode preserves the center logical point and scale.

### Tablet and narrow windows

- Permit tool and inspector panels to collapse independently.
- Provide obvious expand/collapse controls and preserve the canvas transform through each state change.
- Avoid panel transitions that move the canvas under a stationary pointer and cause an unintended drawing start.
- Keep timeline access available without requiring the user to scroll through a long inspector.

### Phone-width screens

- Keep the canvas as the primary visible work surface.
- Present tools and inspector as compact tabs/drawers or another explicitly designed compact pattern; do not simply stack every settings section above or below the canvas.
- Keep Fit, 100%, Zoom and Pan controls visible or one clearly labelled action away.
- Preserve natural page scrolling outside the canvas. Inside the canvas, use the stated pan/pinch gestures.
- Avoid horizontal page overflow; horizontal scrolling belongs to the canvas viewport or timeline only when needed.
- Recalculate Fit after a drawer/tab changes the canvas's available size.
- Controls must have practical touch targets and not overlap the drawing surface.

## 9. Minimap decision

**Defer the minimap in the first navigation implementation.**

The supported canvas maximum is 512×512. Fit, bounded zoom, predictable pan and explicit edge navigation should be implemented and tested first. A minimap adds another interactive surface and focus model and is not justified without evidence that users lose orientation after those fundamentals work.

Reconsider a minimap only if usability testing demonstrates one or more of these conditions:

- Users routinely lose their location at high zoom and cannot recover through Fit, pan or coordinate feedback.
- The typical viewport exposes a small fraction of a 512×512 canvas and users frequently navigate between distant regions.
- A future feature increases canvas dimensions beyond the current 512-per-side limit.
- A specific production workflow requires repeated navigation between distant regions.

If later added, the minimap must be a non-destructive viewport overlay, show the visible viewport rectangle, support keyboard and pointer use, never enter artwork exports, and remain optional/collapsible.

## 10. Pixel fidelity and renderer coordination

- The viewport transforms presentation only; source buffers and logical dimensions remain unchanged.
- Nearest-neighbor scaling is mandatory. No CSS filter, canvas smoothing or interpolation may blur pixel boundaries.
- At fractional CSS sizes/DPR, the rendered pixels may occupy uneven physical pixel widths, but pointer hit testing must still map each displayed region to exactly one logical pixel.
- Do not apply DPR in both the viewport utility and renderer. Viewport coordinates remain CSS-space; renderer backing-store scaling is separate.
- Overlay layers (grid, selection, cursor, guides) remain separate from artwork pixels and exports.
- A redraw caused by resize or zoom must not change frame/composite data or insert an undo step.
- Keep DOM-grid rendering as the active fallback until Agent 2's AC-028 browser validation, AC-034 viewport module, AC-035 state adapter and the coordinator-approved renderer integration gates are complete.
- The viewport utility should be renderer-independent. Its contract should accept canvas/viewport dimensions and a deterministic transform state; renderer-specific mounting and pointer binding belong to a later integration owner.
- Reconcile pointer coordinates with the renderer's actual displayed bounds. Do not use stale dimensions captured before resize or panel layout changes.

## 11. Acceptance criteria

AC-049 is ready for implementation review when the eventual behavior satisfies all of the following:

1. Fit displays the entire 1×1, 24×24, 512×512 and asymmetric canvas with a consistent margin.
2. 100% means exactly one CSS pixel per logical artwork pixel; Fit is separately labelled and may be fractional.
3. Cursor-anchored zoom keeps the same logical pixel beneath the pointer except where a documented edge clamp applies.
4. Pan can reach each canvas edge and corner without losing the artwork or permitting unbounded empty-space drift.
5. Pan, zoom, Fit and panel resizing never change source pixels, selection geometry, undo/redo history or project data.
6. A normal drawing drag still paints/edits; a Pan gesture never edits; middle-button and explicit Pan mode work.
7. Space-alone on a focused pixel still activates that cell; Space-drag does not paint first and pan second.
8. Single-touch drawing remains available; two-touch pan/pinch never leaves a partial stroke or accidental edit.
9. Ctrl/Meta-wheel remains browser zoom; regular wheel/trackpad pan does not trap page scrolling at the viewport boundary.
10. Pointer mapping is correct at DPR 1, 1.25, 1.5 and 2; at fractional CSS viewport sizes; after pan, zoom, scroll, resize, Fit and panel changes.
11. Fit mode recalculates after responsive layout changes; Manual mode preserves its center logical point and zoom.
12. The visible zoom label, Pan mode, Fit and Actual-size actions are accessible and work by keyboard.
13. The canvas remains the primary work surface at desktop, tablet and phone-width viewports; no accidental body overflow or hidden critical controls.
14. Artwork remains pixel-crisp and exports are byte/pixel-identical before and after viewport-only operations.
15. The implementation does not claim minimap support or renderer integration unless those later features are actually delivered and tested.

## 12. Acceptance-test matrix

| Area | Setup / action | Expected result |
|---|---|---|
| Fit small canvas | 1×1 and 24×24 projects; activate Fit | Entire canvas centered with the same target margin |
| Fit maximum canvas | 512×512; activate Fit at desktop and narrow viewport | All edges visible; fit label reports computed scale |
| Asymmetric fit | 512×32 and 32×512 | Entire long edge visible; no clipping |
| Actual size | Activate 100% | One CSS pixel per logical pixel; status shows 100% |
| Fit vs 100% | Compare on 24×24 and 512×512 | Fit scale changes with viewport/canvas; actual size remains 1 CSS px/pixel |
| Zoom bounds | Repeatedly zoom out/in | Stops at documented bounds without NaN, overflow or disabled-control mismatch |
| Cursor anchor | Place pointer over a known pixel and zoom in/out | Same logical pixel remains under the pointer unless edge clamp is reached |
| Keyboard anchor | Focus canvas, zoom with keyboard | Focused pixel or documented center anchor remains stable |
| Pan edges | Pan to all four corners at high zoom | Every edge and corner can be reached |
| Pan clamp | Drag beyond all edges | Canvas cannot be lost; empty-space gutter remains bounded |
| Drawing vs pan | Draw with brush, then use explicit Pan/middle drag | Drawing changes pixels; Pan changes only viewport |
| Space behavior | Space tap on a focused pixel; then Space+drag | Tap activates the focused pixel once; drag pans without painting |
| Pointer cancel | Start a pan and dispatch pointercancel / release outside | Gesture ends cleanly; no stuck Pan mode or artwork mutation |
| Touch draw | One-finger stroke on touch device | Existing active tool works |
| Two-touch pan | Two fingers move without pinch | Canvas pans; no drawing stroke or selection is created |
| Two-touch pinch | Pinch around a point with two fingers | Zoom follows gesture centroid; centroid anchor is preserved within bounds |
| Wheel pan | Vertical and horizontal wheel over canvas | Canvas pans by corresponding delta |
| Wheel boundary | Scroll beyond an edge | Remaining wheel delta can scroll the page/container |
| Browser zoom | Ctrl/Meta+wheel or browser pinch gesture | App does not prevent default; browser zoom remains functional |
| DPR mapping | DPR 1, 1.25, 1.5, 2 with fractional viewport bounds | Pointer maps to expected integer logical cell; no DPR double multiplication |
| Resize in Fit | Resize window and open/close panels | Fit recalculates and centers full canvas |
| Resize in Manual | Resize window while zoomed/panned | Same center logical point and zoom preserved, then pan clamped |
| Project switch | Open a project with different dimensions | New project starts fitted and all edges are reachable |
| Pixel fidelity | Render checkerboard/color test at multiple zooms | No smoothing; logical pixel colors remain unchanged |
| Non-destructive view | Record project/history/export; pan/zoom repeatedly | Project data, history and export raster remain identical |
| Focus and keyboard | Tab to Pan/Fit/100%/zoom controls and operate | Visible focus, accessible names and correct actions |
| Screen reader | Inspect viewport and zoom status | Region instructions and current zoom/Pan state are announced meaningfully |
| Responsive layout | Test 1440, 1024, 768, 600, 390 and 320 CSS-pixel widths | Canvas remains primary; no horizontal body overflow; controls remain reachable |
| Minimap policy | Inspect first implementation | No minimap required; decision to defer is documented |

### Test layers

**Viewport module unit tests (Agent 2 / AC-034)**

- Pure pan/zoom/fit/reset calculations.
- Cursor-anchor invariance.
- Forward/inverse coordinate conversion.
- Pan bounds for canvas smaller/larger than viewport.
- Non-finite/invalid dimensions and transform rejection.
- Fractional CSS sizes and stable serialization.
- Fit/manual resize behavior.

**Browser interaction tests (later single UI integration owner)**

- Real pointer drag, Space/middle-button pan, wheel, two-touch gestures, focus and panel resize.
- Pointer-to-logical-pixel mapping at the listed DPRs.
- Pixel data/history/export unchanged by viewport operations.
- Responsive layout and no accidental page-scroll/pointer-capture conflicts.

**Manual validation**

- Mouse, pen and touch behavior on at least one touch-capable device.
- Trackpad pan and browser zoom gesture behavior on supported desktop browsers.
- Keyboard-only flow and screen-reader announcement quality.
- Pixel crispness at native and enlarged zoom levels.

## 13. Files, dependencies and ownership

This is a specification task; no implementation file is changed by AC-049.

| File / area | Later implementation role | Ownership / constraint |
|---|---|---|
| `docs/ux/CANVAS_WORKSPACE_SPEC.md` | Canonical interaction and acceptance spec | Agent 5 / AC-049 |
| `js/canvas-viewport.js` | Pure pan/zoom/fit/coordinate utility | Agent 2 / AC-034; Agent 5 specifies UX, does not edit module |
| `tests/canvas-viewport.test.js` | Deterministic transform and bounds tests | Agent 2 / AC-034 |
| `js/canvas-renderer.js` and renderer adapter | Renderer output and viewport integration contract | Agent 2; keep current DOM fallback until gates pass |
| `tests/canvas-renderer.browser.*` and `benchmarks/renderer-*` | Real-browser correctness/performance validation | Agent 2; dedicated AC-028 browser suite still needs execution |
| `index.html` | Production canvas shell, toolbar, Pan mode, panel responsive states and event wiring | Coordinator-controlled. No UI lock granted to Agent 5 or Agent 2 |
| Proposed focused workspace browser tests | Pan/zoom/pointer/focus/responsive acceptance | Coordinator assigns a future integration owner; prefer new dedicated files |
| `.github/workflows/project-tests.yml` | Optional CI wiring for new browser tests | Agent 3 owns while reconciling PR #11 / AC-027; no edit in this phase |

### Dependencies

- AC-049 can be specified independently of PR #18 review or renderer integration.
- Implementation should consume Agent 2's AC-034 viewport module when its contract is accepted; do not create a second competing pan/zoom utility.
- Cursor mapping and renderer display bounds must be tested together before UI release.
- Production UI wiring requires an explicit coordinator-issued `index.html` lock.
- Do not edit the shared E2E file; Agent 4 owns it while reconciling PR #8.

## 14. Definition of done

AC-049 is ready for coordinator review when:

- Current viewport behavior is accurately distinguished from proposed behavior.
- Fit, actual-size, manual zoom, cursor anchoring, pan, bounds, wheel/touchpad, touch, responsive panels and keyboard alternatives are specified.
- The minimap decision is explicit and evidence-based.
- Pixel fidelity, DPR and pointer mapping constraints are testable.
- The complete acceptance and test matrix is present.
- Agent 2's AC-034/AC-028 dependencies and all shared-file locks are identified.
- Only this UX specification is delivered; there is no production UI or implementation claim.
