# Art Club — UX and Product Workflow Audit

**Product:** One Pixel Studio  
**Repository:** https://github.com/faiev/ArtClub  
**Audit branch:** agent/ux-audit  
**Audit base:** main at c7ff0702c27cba22e443f9012fc482c217363613  
**Audit date:** 2026-11-14  
**Status:** Source-backed audit; live-session validation still required

---

## 1. Executive summary

Art Club has moved beyond a single-canvas demo. The current implementation includes a real project document model, multiple local projects, layers and independent cels, rectangular selection and transforms, a multi-frame timeline, loop/once/ping-pong playback, onion-skin guides, PNG/SVG/JSON export, and a versioned browser Agent API with a local MCP bridge.

That is a substantial foundation. The main product risk is now workflow integrity: the editor exposes many editing operations, but some are hard to discover, several important animation workflows are incomplete, and two destructive actions bypass the layer protection model.

The highest-priority findings are:

1. **Clear and image import can modify a hidden or locked active layer.** The Clear command also says it clears every pixel on the canvas, but the implementation clears only the active layer's current cel.
2. **Large-canvas editing is not yet a practical pixel-art workflow.** The viewport has no pan interaction, zoom is capped at 200%, and the canvas is clipped when it grows beyond its viewport.
3. **The rendering implementation creates one DOM element per pixel and rebuilds the grid.** At the supported maximum, that is 262,144 elements. This is a verified architectural risk, not a measured performance result.
4. **Animation can be previewed but cannot yet be delivered as a game-ready asset.** Sprite-sheet export, frame metadata, PNG sequences and GIF export are not present.
5. **The timeline is a horizontal list of named frame cards, not a visual layer/cel timeline.** There are no frame thumbnails or cel copy/paste operations.
6. **The AI-agent capability is powerful but invisible to normal users.** Connecting it requires a local Node/Playwright setup and an MCP client; the bridge uses a separate browser profile and therefore a separate local project library.

The product should prioritize protecting existing artwork, making large canvases navigable, and completing the animation pipeline before spending effort on decorative polish.

## 2. Scope and evidence

### Inspected

- Current repository default branch and latest commit.
- README.md and FEATURES.md.
- index.html, including the page structure, responsive CSS, canvas rendering, timeline/layer controls, project actions, import/export handlers and keyboard handling.
- AGENT_API.md and agent-bridge/README.md.
- Existing product requirements and workflow acceptance criteria in FEATURES.md.

### Validation limitation

I attempted to open the deployed application at https://faiev.github.io/ArtClub/ and to retrieve the repository through a direct clone, but the live page and direct network access were unavailable from this execution environment. The connected GitHub repository interface did provide the current tracked source. Therefore, this document is a **source and interaction-flow audit**, not a claim that I completed a hands-on browser session.

No browser usability test, touch-device test, accessibility audit with assistive technology, or performance benchmark was run. Findings below distinguish source-verifiable behavior from performance risks that still need measurement.

### Evidence references

- Main editor structure and controls: index.html, lines 245–420.
- Canvas viewport and responsive layout: index.html, lines 60–63 and 95–107.
- Project synchronization and active-cel behavior: index.html, lines 536–558.
- Pixel-grid renderer: index.html, lines 809–840.
- Timeline frame-card renderer: index.html, lines 856–905.
- Layer list renderer: index.html, lines 1077–1105.
- Zoom implementation: index.html, lines 1215–1228.
- Clear action: index.html, lines 1983–1986.
- Image import: index.html, lines 2047–2071.
- Keyboard handling: index.html, lines 2073–2091.
- Current product baseline and implementation log: FEATURES.md, lines 45–200.
- Intended interface rules: FEATURES.md, lines 630–652.
- Browser agent connection and bridge setup: AGENT_API.md, lines 5–14; agent-bridge/README.md, lines 7–53 and 118–137.

---

## 3. Workflow-by-workflow review

### A. Creating a new project

**Current workflow**

The top bar has a Projects entry. The canvas header has a plus icon that opens a new-canvas dialog. The dialog accepts width and height, provides common presets, explains the 1–512 pixel limit, and saves the current project before creating a new blank one. The Projects dialog supports opening, renaming, duplicating, recovering and deleting local projects.

**What works well**

- A new project does not need to overwrite the current project.
- Custom dimensions are explicit rather than being inferred from screen size.
- The local-only storage model is explained in the Projects dialog.
- The project name is editable in the workspace.

**Problem**

The plus control is an icon without a visible text label. The distinction between the Projects library and New project is not obvious until a user recognizes the plus icon or opens the library. The project list is text-based; there are no artwork thumbnails to help distinguish similarly named projects.

**Recommendation**

Keep the compact header, but give the plus control a visible “New project” label where space allows, and add a project preview thumbnail to each library entry. Keep the current “save current project before starting a new one” behavior.

**Priority:** Medium for the entry-point discoverability; Low for library thumbnails.

### B. Choosing canvas dimensions

**Current workflow**

The left panel has a preset dimension selector and a custom width/height dialog. The resize dialog clearly says that existing artwork will be resampled. New projects can be created with custom dimensions.

**Problem**

The preset control is labelled “Canvas dimensions,” but changing it resamples existing artwork. That is different from changing the canvas boundary while preserving the original pixels. There is no crop/expand operation or anchor control. On screens at or below 700px, the entire size-area is hidden, including the custom resize button. A mobile user can create a new project with custom dimensions through the header dialog, but cannot resize the current project from the visible workspace.

**Recommendation**

Separate these actions in the product language and UI:

- **Resize artwork:** resample pixel data to a new width and height.
- **Resize canvas:** expand or crop the canvas without resampling existing pixels.
- Provide a nine-point anchor control for canvas expansion/cropping.

Keep a compact “Canvas size” entry available on mobile, even if it opens a dialog.

**Priority:** High for distinguishing artwork resampling from canvas resizing; Medium for mobile access.

### C. Drawing and editing pixels

**Current workflow**

The visible tools are Brush, Eraser, Fill, Pick, Line, Rect, Ellipse and rectangular Select. Shape fill is a contextual checkbox. The canvas uses a logical grid and supports keyboard navigation between individual cells.

**What works well**

- Tool selection is visible and the active tool is reflected above and below the canvas.
- The line, rectangle and ellipse tools are present, and filled shapes are supported.
- The grid and transparency checkerboard can be toggled independently.
- The canvas cells have row/column metadata and accessible labels in the DOM.
- Drawing is constrained to the active selection and active layer.

**Problems**

- Brush editing is fixed at one pixel. There is no visible brush size, shape or preset control.
- The canvas has no visible Hand/Pan tool, Space-drag pan, middle-mouse pan or cursor-centered wheel zoom.
- The zoom control stops at 200%. At 512×512, the fitted canvas is only about 560 CSS pixels wide at 100% and about 1,120 pixels at the maximum zoom. Since the viewport uses overflow hidden, the enlarged canvas can be clipped without a way to reach the clipped edges.
- The interface provides no live cursor coordinate readout, which makes precise sprite construction and agent/human cross-checking harder.

**Recommendation**

Add a dedicated pan interaction and a wider zoom range, with Fit, 100% and cursor-centered zoom. Preserve crisp pixel rendering. Show the logical canvas coordinate under the pointer and the active tool/layer/frame in the status area. Brush size presets can follow the navigation work; the 1px brush should remain the default.

**Priority:** High for pan/zoom and edge access; Medium for brush options and coordinate feedback.

### D. Selecting and transforming artwork

**Current workflow**

The Select tool creates a rectangular marquee. Copy, Cut, Paste, Clear, Select all, Deselect, Flip H, Flip V and Rotate 90° controls are present. Selected edits are constrained to the selection.

**What works well**

The core rectangular-selection loop exists, is undoable, and is exposed through the Agent API. This is already more useful than a canvas that only supports drawing and erasing.

**Remaining limitation**

Only rectangular selection is available. Lasso/freeform selection, invert selection, scaling, arbitrary-angle rotation and floating transform previews are not implemented.

**Recommendation**

Do not add all advanced selection types at once. First add a duplicate-selection action and a clearer transform preview/commit state. Lasso and invert selection are the next meaningful additions for irregular sprite shapes.

**Priority:** Medium.

### E. Managing layers

**Current workflow**

The right inspector lists layers with select, visibility, lock and up/down reorder controls. Add, Duplicate and Delete are available. Rename is triggered by double-clicking the layer name.

**What works well**

The project model supports layer/frame cels, and the selected layer is explicit. Visibility and lock state are visible. Ordering is available without requiring drag-and-drop precision.

**Problems**

- Opacity and merge-down are missing.
- Renaming depends on double-clicking, a gesture that is not obvious from the visible label.
- Layer controls are separated from the timeline, so the user cannot scan each layer's cels across frames.
- Clear and image import do not consistently honor the active layer's hidden/locked state; see findings UX-01 and UX-02.

**Recommendation**

Retain the explicit up/down controls, but add an always-visible rename affordance or a per-layer menu. Add opacity and merge-down after the protection issue is fixed. A layer-by-frame timeline is preferable to adding more controls to the layer list.

**Priority:** High for layer protection; Medium for rename discoverability and missing layer operations.

### F. Working with multiple frames

**Current workflow**

The timeline is a horizontally scrolling row of cards. Each card shows a frame number, frame name, duration in milliseconds, and earlier/later controls. Users can add, duplicate, delete, select, rename and reorder frames.

**What works well**

- Frames are independently editable.
- Frame durations can be changed directly.
- The last frame cannot be deleted.
- Frame operations are represented in the project model and available to agents.

**Problems**

- Frame cards have no visual thumbnails. A user must select frames one at a time to see their artwork.
- There is no visible layer-by-frame cel grid. Layers are selected in the inspector, while frames are selected separately below the canvas.
- There is no cel copy/paste workflow.
- Reordering depends on repeated arrow clicks. This becomes slow when a project contains many frames.
- The timeline is not collapsible, even though static-art users may not need it.

**Recommendation**

Make the timeline visual before making it more complex:

1. Add a small composite thumbnail to each frame card.
2. Add a compact per-layer cel indicator or a layer-by-frame timeline mode.
3. Add copy/paste cel and duplicate-cel actions.
4. Support drag reordering as a supplement to the existing keyboard/button controls.
5. Allow the timeline to collapse while preserving its current scroll position.

**Priority:** High for thumbnails and cel visibility; Medium for reordering and collapse.

### G. Previewing animation

**Current workflow**

The UI has Play/Pause, a Loop/Once/Ping-pong selector and an Onion checkbox. Frame durations drive playback. The project keeps the selected editing frame separate from the preview frame.

**What works well**

The playback state is separated from the document's active editing frame. The editor blocks drawing while playback is running. The Agent API exposes play, pause, stop, playback mode and onion-skin control.

**Problem**

The UI exposes Play and Pause through one toggle but has no visible Stop action. Pause intentionally leaves the preview frame visible. Stop exists in the Agent API, but not as a clear user-facing control. A paused preview frame can therefore be mistaken for the selected editing frame.

**Recommendation**

Expose three explicit states/actions: Play, Pause and Stop. When paused, label the canvas as “Paused preview” and keep the selected editing frame visibly distinguished in the timeline. Stop should return to the selected editing frame.

**Priority:** Medium.

### H. Exporting artwork

**Current workflow**

The Export panel offers PNG at 1×, PNG at 16×, SVG, Project JSON and Open JSON. PNG and SVG are based on the visible composite of the selected editing frame. The JSON file preserves the editable project.

**What works well**

- The user has a portable editable project format.
- PNG export uses integer scaling and disables image smoothing.
- SVG output uses crisp-edge rendering.
- The current visible composite is exported rather than only the active layer.

**Problem**

The application can preview an animation but cannot export it as an animation or sprite sheet. There is no frame PNG sequence, sprite-sheet layout, JSON frame metadata, margin/spacing controls or export preview. This prevents the animation workflow from producing a ready-to-use game asset.

**Recommendation**

Treat animation export as a core production workflow, not a decorative extra. Implement sprite-sheet PNG first, then matching JSON metadata, then PNG sequences and GIF. Add a preview that makes frame order, sheet dimensions, transparent padding and duration metadata visible before download.

**Priority:** High.

### I. Saving and reopening projects

**Current workflow**

The app uses an IndexedDB project library, autosave, a localStorage backup and one previous-save recovery copy per project. The Projects dialog supports Open, Duplicate, Rename, Recover and Delete.

**What works well**

The local-first model is understandable and avoids requiring an account or remote storage. The save-state text distinguishes library save from local backup and reports failures. Exporting JSON provides a portable backup.

**Remaining problems**

- The project library is text-only, so finding the correct project becomes difficult as the list grows.
- Recovery is one previous saved version, not a browsable history. The UI should not suggest that it is a complete version history.
- Storage behavior has not been validated here across browsers or under quota exhaustion.

**Recommendation**

Add project thumbnails and sort by recent activity. Keep the recovery wording explicit: “Recover previous saved version.” Continue to show a visible failure state and JSON export path if IndexedDB is unavailable.

**Priority:** Low for project thumbnails/sorting; broader storage validation is a release-quality task.

### J. Using AI agents to create artwork

**Current workflow**

The browser exposes a documented, versioned Agent API. The optional local MCP bridge launches a dedicated Chromium profile and exposes structured tools over stdio. The tools cover inspection, drawing, layers, selection, frames, playback, undo/redo, projects and PNG preview.

**What works well**

This is a meaningful product capability. Agents work in logical canvas-pixel coordinates, share the editor's project model and undo workflow, and can read their results back. The local-only architecture avoids adding a public command endpoint to GitHub Pages.

**Problem**

There is no visible agent entry point in the editor. A user must find the repository documentation, install Node dependencies, install a Playwright Chromium browser, configure an MCP client and understand that the bridge uses a separate browser profile. Projects in that profile are not automatically the same local library as the user's normal browser profile.

**Recommendation**

Add an “AI agent access” help/onboarding entry in the application. It should explain:

- The bridge is optional and runs locally.
- The required Node and Playwright setup.
- Where to paste the MCP configuration.
- That the agent uses a dedicated browser profile and a separate local project library.
- How to export/import the editable JSON project between the agent profile and the user's normal browser.
- How to inspect the agent's work, undo a batch and export a PNG preview.

Do not imply that GitHub Pages itself accepts remote agent commands. Preserve the current local bridge boundary.

**Priority:** High if AI-agent drawing is part of the product promise; otherwise Medium.

---

## 4. Prioritized findings

### UX-01 — Clear and import bypass hidden/locked-layer protection

**Priority:** High  
**Problem:** The Clear action and image-import handler write directly to the active pixel buffer without checking whether the active layer is visible and unlocked. The normal drawing path uses an active-layer editability check, so these actions behave differently from drawing. The Clear confirmation also says “Clear every pixel on this canvas,” while the buffer being cleared is the active layer's current cel. Pixels on other layers remain visible.  
**Why it matters:** A user can clear or replace data in a hidden/locked layer without seeing the result or receiving a protection warning. The result also contradicts the wording of the confirmation. Undo provides a recovery route, but it does not make the action predictable.  
**Recommended solution:** Make the operation's scope explicit. If Clear is intended to clear the active layer, label it “Clear active layer,” explain that other layers remain, and disable it for hidden/locked layers. If a whole-frame clear is needed, expose that as a separate, explicit action. Apply the same hidden/locked guard to image import, or require the user to choose a valid target.  
**Acceptance criteria:**
- A locked active layer cannot be modified by Clear or image import.
- A hidden active layer cannot be modified by Clear or image import without an explicit user override.
- “Clear active layer” affects only the active layer and says so before confirmation.
- A separate whole-frame action, if provided, states whether it affects visible layers or all layers.
- Undo restores the exact pre-operation project.
- Automated interaction tests cover visible, hidden, locked and unlocked active-layer states.  
**Dependencies:** Coordinator/UI owner; Agent 1 should add regression coverage. No renderer change is required.

### UX-02 — Image import has no safe target or conversion preview

**Priority:** High  
**Problem:** Importing an image immediately converts it to the current canvas size, maps colors to the existing palette, and replaces the active layer's current cel. There is no preview, crop/contain/cover choice, target-layer choice or “import as new layer” option.  
**Why it matters:** The user cannot see the conversion before replacing editable content. The simple contain-and-center conversion can be predictable for small examples but is not sufficient for varied source aspect ratios or palette constraints.  
**Recommended solution:** Add a conversion dialog with a preview, target dimensions, contain/cover/stretch/crop options, palette selection, transparency handling and a target choice of new layer, active cel or new project. Default to a new layer or new project so the original artwork remains intact.  
**Acceptance criteria:**
- Import preview does not mutate the project.
- The selected fit mode and palette mapping are visible before commit.
- Import-as-new-layer preserves all existing cels.
- Import to an existing cel is explicit and undoable.
- Import is rejected or safely redirected when the active target layer is hidden or locked.  
**Dependencies:** Coordinator/UI owner; may share conversion code with a later image-import feature.

### UX-03 — No practical pan or pixel-level zoom for large canvases

**Priority:** High  
**Problem:** The canvas viewport clips overflow. Zoom is limited to 50–200%, with no pan gesture or navigation tool. At 512×512 the fit size is about 560 CSS pixels across; at maximum zoom the grid is about 1,120 CSS pixels across, but clipped content cannot be panned into view.  
**Why it matters:** Users cannot comfortably inspect and edit detailed areas of large supported canvases. The problem is more significant as the logical pixel count increases.  
**Recommended solution:** Implement Fit, 100%, cursor-centered wheel zoom, Space-drag pan and middle-mouse pan. Increase the zoom range substantially while keeping nearest-neighbor display and a stable canvas origin.  
**Acceptance criteria:**
- Every pixel on a 512×512 canvas can be brought into the viewport and edited.
- Zooming around the pointer keeps the pointed-to logical pixel under the pointer.
- Fit and 100% are one-action commands.
- Pan/zoom never modifies document data.
- Pixel edges remain crisp at all zoom levels.  
**Dependencies:** UI owner and Agent 2's renderer integration.

### UX-04 — DOM-per-pixel rendering creates a large-canvas responsiveness risk

**Priority:** High  
**Problem:** renderGrid creates one div per logical pixel and replaces the entire grid. At 512×512 this is 262,144 pixel elements. Timeline preview advances through renderGrid for every frame.  
**Why it matters:** Large initial renders and frame-by-frame rebuilds can make drawing and playback unresponsive. This is a source-verifiable scaling risk; no benchmark was available in this audit, so no performance regression is claimed as measured.  
**Recommended solution:** Complete Agent 2's Canvas 2D investigation and benchmark. Keep hit testing, accessible coordinate information and overlay rendering separate from the pixel display surface. Avoid rebuilding the entire visual surface for a one-pixel edit or a frame change.  
**Acceptance criteria:**
- Benchmark 32×32, 64×64, 128×128, 256×256 and 512×512 canvases with one and multiple layers.
- Record initial render time, frame-switch time, playback frame time, drawing latency and memory.
- Keep ordinary 256×256 editing responsive and verify the 512×512 maximum without browser lockups.
- A one-pixel edit does not recreate every visual pixel element.
- The renderer preserves crisp edges, selection borders, onion skin and composite output.  
**Dependencies:** Agent 2. UX review should be repeated after the renderer prototype is integrated.

### UX-05 — Animation is previewable but not exportable as a production asset

**Priority:** High  
**Problem:** The editor supports frames, durations and playback, but there is no sprite-sheet PNG, JSON frame metadata, frame PNG sequence or animated GIF export.  
**Why it matters:** The animation workflow stops at preview. A game developer cannot take the animation directly into an engine or asset pipeline.  
**Recommended solution:** Implement sprite-sheet export with horizontal, vertical and grid layouts, then produce matching metadata. Add a preview that shows frame order, dimensions, spacing, margins and transparency before download. GIF can follow once timing and encoding are reliable.  
**Acceptance criteria:**
- Exported sheet preserves exact pixel colors and transparent pixels.
- No interpolation or smoothing is applied.
- Metadata rectangles match actual frame positions and include dimensions and durations.
- Frame order is explicit and configurable.
- Automated tests verify known input frames against output sheet pixels and metadata.  
**Dependencies:** Agent 3.

### UX-06 — Frame cards do not communicate the artwork or layer/cel structure

**Priority:** High  
**Problem:** Frame cards show only number, name, duration and reorder controls. They do not show artwork thumbnails or a per-layer cel grid.  
**Why it matters:** The user must select frames individually to identify their poses. When working across multiple layers, the timeline does not show which layer/frame cels contain artwork. This makes animation review and editing unnecessarily memory-dependent.  
**Recommended solution:** Add thumbnails first. Follow with a compact layer-by-frame timeline where each cell is a cel and the active row/column is obvious. Add copy/paste cel operations and maintain the simple frame-card mode for small screens.  
**Acceptance criteria:**
- Each frame card displays an accurate composite thumbnail.
- Active editing frame and paused preview frame are visually distinct.
- A layer-by-frame view shows existing, blank and selected cels.
- Copy/paste cel works between frames without changing other layers.
- Frame reorder preserves each layer's corresponding cels.  
**Dependencies:** Agent 3 for cel/export workflow; coordinator for timeline UI integration.

### UX-07 — AI-agent access is not discoverable and uses a separate project library

**Priority:** High when agent drawing is advertised as a first-class capability  
**Problem:** The editor itself has no visible Agent Access or setup entry. The bridge requires a local Node/Playwright installation and MCP-client configuration. It launches a dedicated browser profile, separate from the user's everyday browser profile.  
**Why it matters:** A normal user can see the editor but has no obvious way to discover or enable its defining AI-agent workflow. Users can also misunderstand where agent-created projects are stored.  
**Recommended solution:** Add an in-app setup/help entry that links to the local bridge guide and clearly describes the separate browser profile, local data boundary, import/export handoff and undo/preview workflow.  
**Acceptance criteria:**
- A new user can find Agent Access from the editor without searching the repository.
- Setup instructions match the actual bridge requirements and MCP configuration.
- The separate project library is disclosed before the first agent session.
- The guide explains how to move an editable project between profiles.
- The user can verify an agent result through a preview and undo it.  
**Dependencies:** Agent 4 for bridge documentation; coordinator for in-app onboarding.

### UX-08 — Mobile layout removes the existing-canvas resize entry point

**Priority:** Medium  
**Problem:** At the 700px breakpoint, the stylesheet hides the size-area, which contains both the preset selector and the Custom width & height button. The visible New project action remains, but it creates a new project rather than resizing the current one.  
**Why it matters:** Mobile users cannot resize the current project from the editor even though custom canvas dimensions are otherwise supported.  
**Recommended solution:** Keep a compact Canvas size command in a mobile toolbar or menu that opens the existing resize dialog. Do not expose the full desktop sidebar just to make this action available.  
**Acceptance criteria:**
- A user on a 375px-wide viewport can resize the current project.
- The resize dialog remains usable without horizontal scrolling.
- The project name, canvas and primary draw tools remain visible after closing the dialog.  
**Dependencies:** Coordinator/UI owner.

### UX-09 — Pause and Stop are not distinct in the visible animation controls

**Priority:** Medium  
**Problem:** The visible Play button changes to Pause. Pausing keeps the preview frame visible; the visible UI has no Stop button, even though the Agent API provides stop_playback.  
**Why it matters:** Users may believe the paused preview is the active editable frame or may not know how to return to the editing frame.  
**Recommended solution:** Expose Stop next to Play/Pause and label the preview state. Keep the timeline's selected editing frame visibly marked while a different preview frame is displayed.  
**Acceptance criteria:**
- Pause keeps the current preview frame visible and labels it as paused.
- Stop returns to the selected editing frame.
- The active editing frame and preview frame cannot be confused visually.
- The UI controls and Agent API report the same playback state.  
**Dependencies:** Coordinator/UI owner; Agent 4 should keep tool behavior documented consistently.

### UX-10 — Rename and palette-removal actions rely on hidden gestures

**Priority:** Medium  
**Problem:** Layer and frame rename use double-click. Palette removal uses right-click on a swatch. The layer/frame tooltips mention double-click, but there is no visible edit affordance; right-click removal has no equivalent touch action.  
**Why it matters:** Important operations are discoverable only after a user experiments or reads a tooltip. Touch users cannot reliably use a conventional right-click gesture.  
**Recommended solution:** Add a small rename/menu affordance to layer and frame entries. Add a palette swatch context menu that works with click/tap and keyboard, including Remove and Duplicate.  
**Acceptance criteria:**
- Rename can be discovered without double-clicking.
- Palette removal is available by mouse, keyboard and touch.
- Destructive removal asks for confirmation only when needed and explains that existing pixels retain their color.  
**Dependencies:** Coordinator/UI owner.

### UX-11 — Shortcut hints use Apple-only symbols on every platform

**Priority:** Medium  
**Problem:** The shortcut guide displays Command symbols for copy, cut, paste, select all, undo/redo and save. The implementation accepts Ctrl or Meta, so Windows and Linux users receive misleading labels. Implemented zoom shortcuts ([, ], 0) are not listed in the guide.  
**Why it matters:** The visible help does not describe the behavior of the current platform and omits useful navigation controls.  
**Recommended solution:** Show Ctrl on Windows/Linux and Command on macOS, or use neutral “Ctrl/Cmd” wording. Include zoom shortcuts and tooltips for all implemented shortcuts.  
**Acceptance criteria:**
- Shortcut labels match the active platform or use platform-neutral wording.
- Every documented shortcut has a matching handler.
- Every commonly used implemented shortcut appears in the shortcut guide or a contextual tooltip.  
**Dependencies:** Coordinator/UI owner.

### UX-12 — Basic brush and palette workflows are too limited for sustained pixel-art work

**Priority:** Medium  
**Problem:** The only brush mode is a fixed 1px brush. Palette controls support preset selection, custom color entry, adding a color and right-click removal, but not swatch reorder, rename, duplicate, recent colors or palette import/export.  
**Why it matters:** One-pixel precision is a useful default, but repeated shading and larger cluster work require more efficient control over brush shapes and color organization.  
**Recommended solution:** Add a small set of hard-edged brush presets and a focused palette manager. Do not introduce soft brushes or anti-aliased strokes that undermine the one-cell/one-pixel promise.  
**Acceptance criteria:**
- Brush sizes and shapes are integer, hard-edged pixel patterns.
- Brush preview matches the committed pixels exactly.
- Palette reorder/duplicate/remove operations preserve existing pixel colors.
- Palette import/export round-trips exact HEX values.  
**Dependencies:** Coordinator; can follow renderer integration.

### UX-13 — Product inventory still marks some shipped animation work as missing

**Priority:** Medium  
**Problem:** FEATURES.md line 76 still describes playback and onion skin as missing from the frame/timeline capability, while the later Step D2 log (lines 189–200) and README describe them as implemented.  
**Why it matters:** This is likely to confuse future contributors and make the roadmap duplicate already completed work. It also makes it harder for a user or agent to understand what remains unfinished.  
**Recommended solution:** Update the baseline table so playback and basic onion skin are marked implemented. Keep adjustable onion opacity/range, thumbnails and animation export in the remaining-gaps column.  
**Acceptance criteria:**
- README, FEATURES.md baseline table and implementation log agree on shipped behavior.
- Remaining gaps are described precisely and do not include completed features.  
**Dependencies:** Coordinator/documentation owner.

---

## 5. Essential fixes versus optional polish

### Essential before calling this a serious pixel-art and sprite-animation release

1. Fix the hidden/locked-layer mutation paths and correct Clear's scope and wording.
2. Add pan and genuinely useful pixel-level zoom for large canvases.
3. Complete and benchmark the large-canvas renderer work.
4. Add frame thumbnails and improve frame/cel visibility.
5. Deliver sprite-sheet PNG and matching metadata; add animation export after the sheet workflow is stable.
6. Provide a discoverable, accurate local Agent setup path if AI-agent drawing remains part of the public product promise.

### Useful next improvements

- Add a visible Stop control and clearer paused-preview state.
- Add mobile resize access.
- Replace double-click/right-click-only operations with discoverable menus.
- Correct platform-specific shortcut hints.
- Add hard-edged brush presets and palette organization.
- Add project thumbnails and sorting.
- Add lasso/invert selection and more flexible transforms.
- Add a collapsible timeline for static-art work.

### Defer until core workflows are solid

Symmetry, dithering, advanced shading, tiled preview, reference images, animated-source import, frame tags, linked cels, groups/blend modes and tile-map editing are valuable later capabilities. They should not be prioritized ahead of safe editing, navigation, animation export and project handoff.

---

## 6. Recommended acceptance run for the coordinator

After the responsible agents integrate their work, repeat these user tasks in a real browser:

1. Create a 32×48 blank project, rename it and draw a small sprite.
2. Add outline, color and detail layers. Lock one layer and hide another.
3. Attempt Clear and image import on each layer state. Confirm protected layers remain unchanged.
4. Resize the canvas by expanding from each anchor direction without resampling the existing art.
5. Zoom into a 512×512 canvas, pan to all four corners and edit one pixel at each edge.
6. Create four animation frames across two layers, add thumbnails, reorder frames and copy a cel.
7. Preview loop, once and ping-pong. Pause, stop and verify the selected editing frame.
8. Export a sprite sheet and metadata, then verify frame rectangles and colors against the source project.
9. Save two projects, refresh, reopen both, and recover a previous saved version.
10. Run an MCP-connected agent batch, inspect its PNG preview, undo it, and export the editable project from the dedicated bridge profile.

For performance, record initial render, frame-switch and playback timings at 32×32, 64×64, 128×128, 256×256 and 512×512. Do not mark the large-canvas issue resolved on the basis of a prototype alone.

---

## 7. Handoff

- **Agent 1:** Add regression tests for clear/import behavior on hidden and locked layers after the implementation owner fixes the paths.
- **Agent 2:** Benchmark the per-pixel DOM renderer and validate the Canvas 2D path, including onion skin and selection overlays.
- **Agent 3:** Prioritize sprite-sheet PNG and metadata; frame thumbnails/cel-copy behavior should be coordinated with the timeline UI owner.
- **Agent 4:** Keep the local MCP profile and permissions model intact, but make setup and profile separation explicit in the user-facing onboarding.
- **Coordinator:** Assign the UI-only items (clear/import scope, navigation, mobile resize, playback Stop, rename menus, shortcut labels and timeline presentation) and decide the order of integration.

**Audit conclusion:** Art Club has a useful functional base, but it should not yet be presented as a complete production pixel-art/animation studio. The first release-quality step is to make edits safe and predictable; the next is to make large-canvas and animation workflows genuinely usable end to end.
