# Art Club — Product Feature Specification

**Product:** One Pixel Studio  
**Document:** Feature list, product requirements and implementation roadmap  
**Version:** 0.1 · Planning baseline  
**Status:** Active development — implementation is proceeding in small, verified slices. The feature list below is the target, not a claim that every item exists.

---

## 1. Product direction

One Pixel Studio should become a capable, browser-based pixel-art and sprite-animation editor. It should be useful for making game characters, props, icons, tiles, animated sprites and small pixel illustrations—not merely demonstrating that a browser can color a grid.

### Product promise

**A focused pixel-art workstation that runs in the browser, keeps artwork under the user's control, and exports assets that can go straight into a game or creative project.**

### What makes this product worth using

1. **Pixel accuracy:** a pixel is an intentional, discrete unit. No accidental blur, fractional scaling or anti-aliased edges in pixel-art operations.
2. **Real editing workflow:** layers, frames, selections, transformations, undo history and a usable timeline.
3. **Animation as a first-class feature:** draw, preview, adjust timing and export animations without leaving the app.
4. **Local-first ownership:** no account, subscription, upload or backend required. The user's projects remain on their device unless they choose to export them.
5. **Approachable, not toy-like:** a calm interface with discoverable tools, keyboard shortcuts and sensible defaults.

### Product boundaries

Art Club is hosted as a static GitHub Pages site. The first product should therefore work without a server, database, login or paid API. Browser storage and local file import/export are the foundation. Cloud sync, collaboration and server-side features are not part of the initial plan.

---

## 2. Who the app is for

| User | Main job to be done | What success looks like |
|---|---|---|
| Beginner pixel artist | Make a small illustration or game character without fighting the interface | Can start from a blank canvas, understand the tools and export a clean PNG |
| Pixel artist | Create precise sprites with a controlled palette and repeatable workflow | Can work with selections, layers, custom brushes, shading and pixel-perfect strokes |
| 2D game developer | Produce sprite animations and game-ready assets | Can organize frames, preview loops and export sprite sheets with metadata |
| Hobby animator | Make short looping animations | Can set frame timing, use onion skinning and export an animated GIF |

The desktop experience is the primary editing environment. Touch support should be useful on tablets and phones, but the app should not sacrifice precise desktop controls to make every panel fit on a phone screen.

---

## 3. Current product baseline

This inventory was checked against the current `index.html` in the repository. It is a description of the current implementation, not the target product.

### Already present

- Single-frame drawing with brush, eraser, flood fill, eyedropper, line, outlined/filled rectangle and outlined/filled ellipse tools. Shape tools show a preview before committing.
- Multi-layer canvas with independent cels, front-to-back composite rendering, active layer selection, add, duplicate, delete, rename, reorder, visibility and lock controls. Drawing targets only the active visible, unlocked layer.
- Square and rectangular canvas presets plus custom dimensions from 1 to 512 pixels per side. New projects can be created at a custom aspect ratio; existing artwork can be resampled to new dimensions.
- A small built-in palette, custom color entry and several palette presets.
- Undo and redo.
- Zoom controls, project naming and a responsive three-panel layout.
- Static image import, reduced to the current canvas and mapped to the nearest palette color.
- PNG export at native size and 16× scale, SVG export and JSON project export/import.
- IndexedDB project library with autosave, one previous-save recovery copy per project and a localStorage fallback backup.

### Available now: local project library and agent access

- Create multiple projects without overwriting the previous project.
- Open, rename, duplicate and delete browser-local projects.
- Keep one previous saved version per project for recovery.
- Restore the active project after a refresh; keep a local JSON backup where browser storage allows it.
- Versioned browser Agent API and local stdio MCP bridge for AI agents.
- Agent tools can inspect the visible composite, draw, fill, erase, batch edits, manage layers and rectangular selections, transform selected pixels, undo/redo, save, import/export projects and return PNG previews.

### Important gaps

| Capability | Current state | Product consequence |
|---|---|---|
| Layers | Core editing implemented | Opacity controls, merge down and drag-to-reorder are still missing |
| Frames and timeline | Not implemented | No animation workflow |
| Playback and onion skin | Not implemented | Cannot create or inspect frame-to-frame motion |
| Selection and transforms | Rectangular selection implemented | Move, copy, cut, paste, clear, flip H/V and rotate 90° work; lasso, invert, freeform and scaling remain missing |
| Polygon and freeform shape tools | Not implemented | Other than line, rectangle and ellipse, freeform geometry is still missing |
| Custom rectangular canvas | Implemented | 1–512 px per side; nine-point canvas anchoring and crop/expand without resampling remain missing |
| Sprite-sheet export | Not implemented | No direct game-engine animation asset workflow |
| Animated GIF export | Not implemented | No shareable animated output |
| Durable project library | Implemented with IndexedDB | Local to this browser profile; export JSON for portability |
| Crash recovery | Basic previous-save recovery implemented | One previous saved version is kept per project; this is not a multi-version history or cloud backup |
| Advanced pixel-art tools | Not implemented | No symmetry, dithering, outline, shading or tile preview tools |

**Key conclusion:** the app now has a reliable multi-layer static-sprite foundation, rectangular selection/transforms and an AI-agent interface, but it is not yet a complete pixel-art studio. Animation, advanced selection, layer opacity/merge and game-ready sprite-sheet export remain major product gaps.

### Implementation log

#### Step A1 — Versioned project document model (implemented)

- Added a shared project-model module with a versioned `one-pixel-studio` document schema (v2).
- The schema represents canvas dimensions, palette, selected color, named layers, animation frames, per-frame duration, layer/frame cels, active layer/frame and metadata.
- Added structural validation for dimensions, pixel-buffer lengths, colors, layer/frame references, IDs, durations and safe data limits.
- Added migration from the old flat-canvas save/export format into a one-layer, one-frame v2 project.
- Wired the editor's current canvas, undo snapshots, local save and project JSON import/export to the v2 schema.
- Initially shipped the document model before layer UI. The layer UI is now implemented in Step C1; the timeline and multi-frame UI remain outstanding.
- Added Node's built-in test runner and automated GitHub Actions tests for project creation, cel creation, compositing, migration, serialization round-trip and invalid-file rejection.

**Verified:** 8 project-model tests passed in GitHub Actions. The Pages build was also triggered for the same repository revision.

**Verified:** 8 project-model tests passed. The later editor and agent regression suite also covers browser-script parsing, mouse strokes, erasing, fill, undo/redo and agent command execution.

#### Step A2 — Local project library and recovery (implemented)

- Added an IndexedDB database for multiple projects.
- Added project list, open, rename, duplicate and delete operations.
- Added a previous-saved-version recovery copy for each project.
- Autosave now writes to the project library and retains a lightweight localStorage backup where quota permits.
- Migrates an existing v2 or legacy v1 localStorage project into the IndexedDB library without discarding it.
- Adds a visible Projects dialog with save/open/recover actions and a local-only privacy explanation.
- If IndexedDB is unavailable, the editor retains its local backup fallback and reports that the full library is unavailable.

**Verified:** Chromium end-to-end tests created two projects, reopened a saved project, checked saved pixels, refreshed the browser and confirmed the same project and artwork were restored. Storage fallback and quota edge cases still need broader cross-browser coverage.

#### Step A3 — Browser Agent API and MCP bridge (implemented)

- Added `window.onePixelStudio`, a versioned browser API available after `window.OnePixelStudioReady` resolves.
- Added validated pixel, line, rectangle, fill, erase, clear, palette, batch, undo/redo, save, project import/export, project listing/opening and PNG preview operations.
- Agent batches are capped at 1,000 commands and are grouped into one undo step.
- Added coordinate/color validation and optional revision checks to reject stale edits.
- Agent writes are blocked while a human pointer stroke is in progress.
- Added a local MCP server using a dedicated Playwright Chromium profile and stdio transport. It does not add a public server endpoint to GitHub Pages.
- Added `AGENT_API.md` and `agent-bridge/README.md` with protocol, tools, setup and privacy details.

**Verified:** agent interaction tests pass; Chromium and MCP end-to-end suites exercise mouse and API drawing, undo/redo, batch edits, project storage/reopen/refresh, PNG preview and agent tool discovery. Layer-management tools are now part of the browser API and MCP bridge.


#### Step B1 — Rectangular and custom canvas dimensions (implemented)

- Added common portrait and landscape presets, including 32×48 and 48×32.
- Added a canvas setup dialog for exact custom width and height, with a 1–512 pixel limit per side.
- New projects can start at any valid rectangular size.
- Existing artwork can be resized with deterministic nearest-neighbor resampling; the operation is included in undo history.
- Updated the canvas viewport to preserve square logical pixels while fitting the new aspect ratio.
- Updated PNG, SVG, JSON, pixel addressing and project persistence paths to use independent width and height values.

**Verified:** automated editor tests cover a new 32×48 canvas, row-major coordinate access, resize preservation and undo. Chromium E2E also creates a 32×48 project, saves it in the library, opens the earlier project and confirms its pixels survive refresh.

**Still outstanding in F-101:** nine-point canvas anchoring, separate canvas-vs-artwork resize modes and crop/expand without resampling.


#### Step C1 — Core layer editing (implemented)

- Added an inspector layer stack ordered front-to-back.
- Added new layer, duplicate, delete, select, rename (double-click), visibility and lock controls.
- Added explicit up/down layer reordering.
- Each layer has its own cel for the active frame; drawing, fill, eraser and shapes edit only the active visible, unlocked layer.
- The canvas, statistics, eyedropper, PNG/SVG export and Agent API readback use the composite of visible layers.
- Layer operations are undoable and autosaved. Projects still retain one animation frame in the UI.
- Exposed agent methods and MCP tools for list/add/select/rename/reorder/duplicate/delete/visibility/lock operations.

**Verified:** editor tests cover top-over-bottom compositing, visibility, locked-layer protection, duplicate/delete/undo and agent readback. Chromium E2E covers layer compositing and reload persistence; MCP E2E checks layer tools and verifies hidden/locked behavior.

**Still outstanding in F-105:** opacity slider/rendering, merge down, drag-to-reorder and layer groups.
 


#### Step B2 — Rectangular selection and pixel transforms (implemented)

- Added a rectangular marquee tool with a visible, non-exporting selection border and coordinate/size readout.
- Added select all, deselect, copy, cut, paste and clear-selection operations.
- Selected regions can be moved with the mouse; clipboard paste starts at the selection origin or canvas origin.
- Drawing and flood fill are constrained to the active selection.
- Added horizontal/vertical flips and 90° clockwise/counter-clockwise rotation of selected active-layer pixels. Quarter-turn rotation swaps the selection width and height and is rejected if the result would extend beyond the canvas.
- Added keyboard shortcuts for selection, copy/cut/paste, select-all, deselect and delete.
- Exposed selection creation, copy/cut/paste, move, clear, deselect and transforms through the browser Agent API and MCP tools. Selection changes participate in revision checks; selected pixels are edited in undoable transactions.

**Verified:** editor interaction tests cover marquee bounds, clipboard operations, movement, selection-constrained drawing, flip/rotate pixel mappings, undo and edge rejection. Chromium E2E and MCP client E2E cover the agent selection and transform paths.

**Still outstanding in F-104:** lasso/freeform and invert selection, scale/rotate by arbitrary angles, and floating selection previews.


---

---

## 4. Product priorities

- **P0 — Foundation:** required before adding substantial editing features. Prevents a fragile feature pile.
- **P1 — Core studio:** required for the first genuinely useful release.
- **P2 — Pixel-art power tools:** makes the editor efficient and distinctive for regular artists.
- **P3 — Advanced production tools:** expands the editor toward larger game-art workflows.

The priority labels describe product order, not implementation status.

---

# 5. Feature list

## P0 — Foundation and reliability

These are prerequisites. New features should be built on a consistent project model rather than bolted onto the current single-array canvas.

### F-001 · Real project document model

A project should be a structured document, not just a flat array of colors.

It must represent:
- Canvas width and height.
- A stack of named layers.
- Animation frames and per-frame duration.
- A cel for each layer/frame combination.
- Palette and color metadata.
- Project name and document settings.
- A file-format version for future migrations.

Each cel contains pixel data for one layer on one frame. An empty cel is transparent. The visible frame is the composite of its visible layers.

**Acceptance criteria**
- A project can contain multiple layers and multiple frames.
- Reordering layers changes the composite in the expected direction.
- Switching frames does not overwrite another frame's pixels.
- Saving and reopening preserves the whole document, not only the visible composite.
- A project created in an older file-format version can be migrated or rejected with a clear explanation—not silently corrupted.

### F-002 · Reliable undo and redo

Undo must represent meaningful editing actions.

Requirements:
- A complete brush stroke is one undo step, not one step per pixel.
- Fill, selection movement, transforms, layer changes and frame changes are undoable.
- Redo restores the exact state removed by undo.
- A new action after undo clears the redo branch.
- History has a memory limit and releases old pixel data safely.

**Acceptance criteria:** draw a stroke, fill an area, move a selection and change a layer; undo each action in reverse order and redo them without visual differences or lost pixels.

### F-003 · Durable local project storage

Replace the single-project local-storage approach with IndexedDB-backed project storage.

Requirements:
- Autosave the active project after edits, using a short debounce.
- Keep a recoverable last-saved state if the tab closes or crashes.
- Show honest save states: saving, saved, recovery available and save failed.
- Handle storage quota errors without pretending the project was saved.
- Let users create, rename, duplicate, open and delete local projects.
- Never silently discard a project when the user starts another one.

**Acceptance criteria:** create two projects, edit both, refresh the browser and reopen them independently. A failed save must produce a visible warning and an export/recovery path.

### F-004 · Portable native project format

Define a versioned project format that preserves editable structure: layers, cels, frames, durations, palette and metadata.

- JSON may be used for the first format, but large pixel payloads should be encoded efficiently.
- Import must validate dimensions, frame counts, pixel lengths, palette values and format version.
- Unknown future versions must show an understandable compatibility message.
- Exported files must reopen to the same editable project.

**Acceptance criteria:** export a multi-layer, multi-frame project, import it in a fresh browser session, and verify that its structure and appearance are unchanged.

### F-005 · Performance and rendering foundation

- Separate the document model from the display surface.
- Use a canvas-based renderer for large grids rather than creating one DOM element for every pixel.
- Keep nearest-neighbor sampling for pixel-art scale operations.
- Update only affected regions when practical.
- Move expensive image quantization and export work off the main thread when necessary.
- Set documented safety limits for canvas size, frames and project memory.

**Acceptance criteria:** the UI remains responsive during normal drawing on a 256×256 canvas and during a representative multi-frame project. Large or invalid imports fail gracefully.

---

## P1 — Core studio (first useful release)

### F-101 · Flexible canvas creation and resizing

- New project dialog with width, height and preset sizes.
- Rectangular canvases as well as square canvases.
- Common presets for icons, characters, portraits, tiles and game assets.
- Transparent, solid-color or custom background.
- Resize canvas with a nine-point anchor selector.
- Resize artwork separately from canvas size.
- Nearest-neighbor scaling by default, with an explicit option to preserve original pixels.

**Acceptance criteria:** create a 48×32 canvas, anchor artwork to the bottom-left while expanding it, and resize artwork to 2× without blurred edges.

### F-102 · Professional canvas navigation

- Zoom from pixel-level detail to a full-document view.
- Fit canvas, 100% view and reset zoom.
- Pan using Space + drag and middle mouse.
- Mouse-wheel zoom centered around the cursor.
- Keep the canvas centered when the viewport changes.
- Show pixel boundaries only when useful at the current zoom.
- Toggle transparency checkerboard and canvas background independently.

**Acceptance criteria:** users can reach and edit every edge of a large canvas without losing their place; zoom and pan never change document pixels.

### F-103 · Essential drawing tools

| Tool | Required behavior |
|---|---|
| Pencil | Exact single-pixel or configurable hard-edged strokes |
| Brush | Adjustable size and selectable hard-edged brush shapes |
| Eraser | Erase to transparency, respecting the active layer |
| Bucket | Contiguous fill, with tolerance and contiguous/all-layers options |
| Eyedropper | Pick visible composite color or active-layer color |
| Line | Live preview before committing a straight line |
| Rectangle | Outline and filled modes |
| Ellipse | Outline and filled modes |
| Polygon | Click to place vertices and close the shape |
| Hand / Pan | Move the viewport without changing artwork |
| Zoom | Zoom in/out by click or shortcut |

Tool options should be visible and contextual. A tool should not silently change the active color or active layer.

### F-104 · Selection system

Selection is essential for editing, not an optional advanced extra.

- Rectangular marquee selection.
- Deselect, invert selection and select all.
- Move selected pixels without moving the whole layer.
- Cut, copy and paste.
- Duplicate selection.
- Clear selected pixels.
- Flip horizontal/vertical and rotate 90 degrees.
- Constrain drawing and fill operations to the active selection.
- Show a visible selection boundary.

Freeform/lasso selection can follow in P2.

**Acceptance criteria:** select a region, move it, undo and redo; transparent pixels outside the selection must remain untouched.

### F-105 · Layers panel

Each layer should have:
- Name and inline rename.
- Visibility toggle.
- Lock/unlock.
- Opacity.
- Reorder by drag and keyboard.
- Add, duplicate and delete.
- Merge down.
- Clear layer.
- Highlight for the active layer.

The active layer is the only layer changed by ordinary drawing operations. Locked and hidden layers must be protected from accidental edits.

Blend modes and layer groups are P2/P3, not blockers for the first release.

**Acceptance criteria:** create separate outline, color and detail layers; hide one, reorder another, lock one and export the correct composite. Reopening the project must preserve the layer stack.

### F-106 · Animation timeline

A timeline must sit below the canvas and be collapsible.

- Add blank frame.
- Duplicate frame.
- Delete frame.
- Reorder frames.
- Select a frame.
- Set frame duration in milliseconds.
- Set a default duration for newly created frames.
- Copy/paste a cel or frame.
- Scrub the timeline.
- Display frame thumbnails.
- Prevent accidental deletion of the only remaining frame.

The timeline is a grid of layers and frames. Each cell is a cel.

**Acceptance criteria:** create a four-frame animation across two layers, reorder one frame, change one frame's duration and save/reopen without losing the sequence.

### F-107 · Animation playback and onion skin

- Play, pause and stop.
- Adjustable frames per second.
- Loop, once and ping-pong playback.
- Per-frame duration overrides.
- Onion skin for previous and next frames.
- Adjustable onion-skin opacity and frame range.
- Distinguish previous and next frames with subtle tinting.
- Real-time preview while editing.

**Acceptance criteria:** a four-frame loop plays at the requested timing; onion skin is a visual aid only and never appears in exported frames unless explicitly requested.

### F-108 · Palette and color workflow

- Custom palette editing, rename and reorder swatches.
- Remove and duplicate colors.
- Recent colors.
- Foreground/background color slots and swap.
- RGB and HEX entry.
- Alpha/transparency control.
- Palette import/export for common plain-text palette formats.
- Restrict drawing to selected palette colors (indexed-style workflow).
- Basic color ramp grouping for shadows, midtones and highlights.

**Acceptance criteria:** importing a palette produces the correct color values; indexed-palette mode never introduces an unlisted color by accident.

### F-109 · Production-ready export

**Image export**
- Current composite as transparent PNG.
- Current layer as PNG.
- Individual frames as PNG sequence.
- Integer-scale export using nearest-neighbor sampling.
- Optional background color and transparent background.

**Sprite-sheet export**
- Export selected frames or all frames.
- Horizontal, vertical and grid layouts.
- Configurable columns, margin, spacing and cell size.
- Optional trimming of transparent edges.
- Optional JSON metadata containing frame rectangles and timing.
- Preview the sheet before download.

**Animation export**
- Animated GIF.
- Preserve frame durations and loop choice.
- Preview size and output dimensions before export.

**Acceptance criteria:** exported PNGs contain crisp hard-edged pixels; sprite-sheet rectangles match the metadata exactly; GIF playback respects frame durations within the limits of the selected format.

---

### F-110 · AI agent drawing interface

Expose the actual editor operations to AI systems through a stable, documented interface. Agents must draw in logical canvas coordinates and must not depend on screen positions or DOM implementation details.

Requirements:
- A versioned page-scoped JavaScript Agent API.
- Read project status, dimensions, palette and pixels.
- Draw pixels, lines and rectangles; fill and erase regions; change colors.
- Batch related commands into one undoable transaction.
- Read a pixel/canvas back and request a PNG preview to inspect the result.
- Save, list, open, import and export local projects.
- Reject out-of-range coordinates, invalid colors, oversized batches and stale revision writes.
- Keep agent operations from interrupting a human pointer stroke.
- Optional local MCP server exposing equivalent structured tools over stdio.
- Do not expose arbitrary JavaScript execution, shell access or a public unauthenticated network endpoint.

**Acceptance criteria:** an MCP-connected agent can inspect a canvas, draw a sprite in a batch, request a PNG preview, correct the result, undo/redo and save the editable project. Human mouse drawing and agent edits must share the same pixels and history.

**Current implementation:** browser Agent API v1 and local Playwright-backed MCP bridge are implemented. Agents can inspect and edit the visible composite, manage layers, create/move/transform rectangular selections, and use the same undo/save flow as a human editor. The app currently exposes one animation frame; timeline and frame-aware operations are deferred.

---

## P2 — Pixel-art power tools

### F-201 · Pixel-perfect drawing mode
A stroke correction mode that removes awkward corner pixels and avoids unwanted staircase artifacts. It must be optional because intentional pixel clusters sometimes need irregular shapes.

### F-202 · Symmetry tools
- Horizontal and vertical symmetry.
- Both axes together.
- Adjustable symmetry center.
- Preview the mirrored stroke.
- Symmetry must work with pencil, brush, eraser and supported shape tools.

### F-203 · Dithering tools
- Standard patterns: 25%, 50%, 75% and checker.
- Custom pattern brush.
- Foreground/background color control.
- Preview before applying.
- Pattern remains aligned to the canvas grid.

### F-204 · Outline and shading tools
- Add outline around opaque regions.
- Expand or contract outline by one pixel.
- Shade mode using palette ramps.
- Configurable light direction for simple shading assistance.
- Every operation must be undoable and previewable.

### F-205 · Brush presets
- Square, round, diagonal and custom pixel brushes.
- Save, rename, duplicate and delete brush presets.
- Hard-edged behavior by default.
- Optional pattern and spacing settings.

### F-206 · Tiled drawing preview
- Repeat the canvas in a 3×3 preview while editing.
- Seam-aware drawing at opposite edges.
- Toggle tiled preview without changing exported dimensions.
- Useful for seamless backgrounds, textures and tiles.

### F-207 · Improved image-to-pixel-art conversion
The current image import is basic. A useful conversion workspace should offer:
- Crop, contain, cover and stretch modes.
- Explicit target dimensions.
- Nearest-neighbor preview.
- Color-count reduction.
- Palette selection and nearest-color mapping.
- Ordered dithering and error-diffusion options.
- Preserve or remove transparency.
- Side-by-side source and result preview.
- Commit conversion as a new layer, not destructive replacement by default.

### F-208 · Reference images
- Import an image as a non-exporting reference.
- Move, scale and lower opacity.
- Lock it in place.
- Hide/show reference independently of art layers.
- Keep reference pixels out of sprite-sheet and PNG export unless the user explicitly chooses otherwise.

### F-209 · Import animated sources
- Import animated GIF as frames.
- Import a sprite sheet and slice it by cell size or row/column count.
- Preview detected frames before importing.
- Preserve timing when the source provides it.
- Import into a new project by default.

---

## P3 — Advanced production features

### F-301 · Frame tags and animation clips
Named ranges such as `Idle`, `Walk`, `Attack` and `Jump`. Export a chosen tag without manually selecting frame ranges.

### F-302 · Linked cels and duplicate management
Allow a cel to reference the same pixel data as another cel until the user edits it. Provide clear unlink/make-unique behavior.

### F-303 · Layer groups and blend modes
Folders/groups, clipping behavior where feasible, and common blend modes such as Multiply and Screen. Keep the initial layer workflow simple.

### F-304 · Tile-set and tile-map editor
- Define reusable tiles.
- Paint tiles into a map.
- Tile palette and tile selection.
- Flip/rotate tile instances.
- Export tile set and map data with documented metadata.
- Seamless tile preview.

### F-305 · Slices and export regions
Named rectangles for UI panels, sprite parts, nine-patch regions or game-engine export boundaries.

### F-306 · Custom keyboard shortcuts and command search
- Searchable command palette.
- Rebind common shortcuts.
- Display shortcuts in tooltips and menus.
- Detect and resolve conflicting shortcuts.

### F-307 · Offline installable app
Optional PWA support with an explicit update flow. The current site should remain usable as a normal GitHub Pages website even when installation is not available.

### F-308 · Additional project quality-of-life features
- Project thumbnails and recent-project browser.
- Duplicate project and rename.
- Export presets.
- Brush and palette libraries.
- Recovery copies and backup reminders.
- Optional local reference library.
- Contextual help and a concise shortcut cheat sheet.

---

# 6. Required user workflows

The feature list should be built around complete jobs, not isolated buttons.

## Workflow A — Create a game character

1. Create a new 32×32 or custom-size canvas.
2. Choose a limited palette.
3. Draw the outline on its own layer.
4. Add base colors and details on separate layers.
5. Use symmetry where appropriate.
6. Save automatically and export a transparent PNG at an integer scale.

**Done means:** the user gets a crisp PNG and can reopen the editable project later.

## Workflow B — Animate a walk cycle

1. Open a sprite project.
2. Create or duplicate frames in the timeline.
3. Use onion skin to compare adjacent poses.
4. Adjust frame timing and playback mode.
5. Preview the loop at actual speed.
6. Export a GIF and a sprite sheet with metadata.

**Done means:** the animation loops correctly, the exported frames are ordered correctly and timing is retained.

## Workflow C — Convert an image into pixel art

1. Import a local image.
2. Choose crop/fit behavior and target dimensions.
3. Choose a palette and color count.
4. Compare dithering and non-dithering previews.
5. Commit the result to a new editable layer.
6. Continue editing with ordinary pixel tools.

**Done means:** conversion is predictable, reversible and does not overwrite the original project.

## Workflow D — Prepare a seamless texture

1. Create a tile-sized canvas.
2. Enable tiled preview.
3. Paint across boundaries while checking the repeated result.
4. Export the tile at native resolution.
5. Reimport or preview it in a repeated grid to verify seams.

**Done means:** the tile repeats without visible seams at its edges.

---

# 7. Interface and interaction requirements

A serious tool needs a workspace designed around the work.

### Recommended desktop layout

- **Top bar:** project name, file actions, undo/redo, zoom, save status.
- **Left tool rail:** drawing, shape, selection, navigation and transform tools.
- **Center:** canvas viewport with checkerboard, pixel grid, zoom and pan.
- **Right inspector:** contextual tool settings, color controls, palette and layers.
- **Bottom:** timeline and playback controls. Collapsible when the user is working on a static image.
- **Status bar:** canvas dimensions, cursor coordinates, active layer, active frame and zoom.

### Interaction rules

- Drawing must never select text, drag a panel or scroll the page unintentionally.
- All primary actions must be reachable by mouse and keyboard.
- Destructive actions must be undoable or confirmed.
- Disabled actions should explain why they are disabled.
- Tool options should change when the active tool changes.
- The interface should not hide important editing controls behind decorative UI.
- Preserve the canvas viewport when panels open or close.
- On narrow screens, panels may become drawers or tabs; the canvas remains the primary focus.

### Essential shortcuts

| Action | Suggested shortcut |
|---|---|
| Pencil | B |
| Eraser | E |
| Fill | G |
| Eyedropper | I |
| Rectangular selection | M |
| Hand / pan | Space (hold) |
| Undo / redo | Ctrl/Cmd + Z / Shift + Z |
| Copy / cut / paste | Ctrl/Cmd + C / X / V |
| Select all / deselect | Ctrl/Cmd + A / Ctrl/Cmd + D |
| Zoom in / out | + / - or wheel |
| Play / pause animation | Enter or Space when timeline has focus |
| Save project file | Ctrl/Cmd + S |

Shortcuts must not conflict with normal text entry. They should be discoverable in menus/tooltips and remappable in P3.

---

# 8. Technical and privacy constraints

1. **Static hosting:** the application must work from GitHub Pages at a repository subpath. Do not assume root-relative assets or server-side routing.
2. **No backend requirement:** core editing, storage, import and export must work without accounts or API calls.
3. **Local persistence:** use IndexedDB for project documents and recovery data. Local storage may be used for lightweight preferences only.
4. **Rendering:** use a document model independent of the canvas renderer. Avoid one DOM element per pixel for large canvases.
5. **Pixel fidelity:** use nearest-neighbor sampling for pixel-art transforms and integer-scale exports. Never silently smooth an image.
6. **File safety:** validate imported project structure, dimensions, data lengths, palette entries and file sizes before allocating large buffers.
7. **Privacy:** image and project files are processed locally. The app must clearly disclose if any future feature introduces network transfer.
8. **Dependencies:** avoid runtime CDN dependencies. Any library needed for GIF/ZIP encoding should be bundled locally, license-reviewed and documented.
9. **Browser compatibility:** support current Chromium, Firefox and Safari desktop releases where practical. Feature-detect optional APIs.
10. **Accessibility:** keyboard access, visible focus states, labels, reduced-motion support and adequate contrast are required for all core operations.

### Suggested document architecture

A project should conceptually contain:

- `Project`: name, version, canvas size, palette, metadata.
- `Layer[]`: id, name, visibility, lock, opacity, order.
- `Frame[]`: id, duration, optional tag.
- `Cel[layerId, frameId]`: pixel data for that layer in that frame.
- `History`: grouped edit commands with bounded memory.
- `Viewport`: zoom, pan and display preferences; not part of the exported artwork.

Keep the project model, editing commands, renderer, storage and exporters as separate modules. This is more important than choosing a particular framework.

---

# 9. Quality gates before calling it a real release

A feature is not done merely because its button appears.

### Pixel correctness
- One logical pixel remains one logical pixel in drawing, transforms and export.
- No unintended anti-aliasing or fractional coordinate drift.
- Transparent pixels remain transparent.
- Shape boundaries are deterministic.

### Editing correctness
- Undo/redo restores exact prior pixels and structure.
- Hidden or locked layers cannot be accidentally edited.
- Selection operations affect only selected pixels.
- Frame and layer operations preserve all unrelated cels.

### Persistence correctness
- Refreshing the page does not lose a saved project.
- Exported project files can be reopened.
- Invalid/corrupt files fail safely.
- Storage failures are visible to the user.

### Animation correctness
- Playback order matches the timeline.
- Frame duration is respected.
- Onion skin never contaminates exports.
- Sprite-sheet metadata matches the exported image rectangles.

### Browser and interaction quality
- No console errors during the core workflows.
- Pointer drawing works with mouse, pen and touch where supported.
- Keyboard shortcuts work without breaking input fields.
- Layout remains usable at common desktop and tablet widths.

---

# 10. Recommended implementation order

This order minimizes rewrites and gets a usable product sooner.

| Milestone | Scope | Why it comes here |
|---|---|---|
| **A — Project foundation** | Document model, versioned project format, IndexedDB autosave/recovery, grouped undo/redo, tests | Layers and frames are difficult to add safely to a single flat pixel array |
| **B — Editing fundamentals** | Flexible canvas size, zoom/pan, essential tools, filled shapes, selection, copy/paste, transforms | Makes static sprite creation genuinely useful |
| **C — Layers** | Layer panel, visibility, lock, rename, reorder, opacity, duplicate, merge | Enables non-destructive artwork organization |
| **D — Animation** | Timeline, frames/cels, timing, playback, onion skin | Delivers the biggest missing capability for sprite artists |
| **E — Game exports** | PNG sequences, GIF, sprite sheets, JSON metadata, export preview | Completes the create-to-game-asset workflow |
| **F — Pixel-art craft tools** | Pixel-perfect mode, symmetry, dithering, outlines, shading, tiled preview, palette files | Adds efficiency and specialist capability |
| **G — Production workflow** | Animated import, reference images, frame tags, tile tools, PWA/offline polish | Expands into larger asset workflows after core reliability is proven |

### First release definition

Do not call the app a full pixel-art studio until Milestones A–E are complete and pass the quality gates.

The first public release should include:
- A reliable multi-project document model.
- Arbitrary rectangular canvas dimensions.
- Essential drawing, shape and selection tools.
- Layers.
- Multi-frame timeline.
- Playback and onion skin.
- PNG, GIF and sprite-sheet export.
- Native editable project import/export.
- Autosave and recovery.

Everything in P2 and P3 can follow. A small set of deeply functional tools is better than a large toolbar full of incomplete buttons.

---

## 11. Explicit non-goals for the initial product

- User accounts or cloud project storage.
- Real-time collaboration.
- Paid APIs or subscription-gated features.
- AI image generation as a substitute for editing tools.
- A full general-purpose raster editor.
- Vector illustration workflows.
- Pretending that a static image editor supports animation before frames and cels actually exist.

---

## 12. Product benchmark references

These products are useful references for established pixel-art workflows. They are benchmarks, not instructions to copy their UI.

- [Aseprite — feature overview](https://aseprite.com/) — layers, frames/cels, animation tags, playback, onion skin, pixel-art tools, GIF and sprite-sheet export.
- [Aseprite — basic document model](https://aseprite.org/docs/basics/) — explains sprites as frames and layers, with editable cels at their intersections.
- [Piskel — official browser editor](https://www.piskelapp.com/) — demonstrates an approachable browser-based sprite workflow with live animation preview and GIF/PNG export.
- [LibreSprite — project overview](https://github.com/LibreSprite/LibreSprite) — an open-source reference for animation previews, onion skin, palettes, layers, frames and tiled drawing.
- [LibreSprite — layer guide](https://libresprite.dev/docs/layers/) — practical explanation of layer ordering and frame/cel organization.

---

**Decision recorded:** prioritize the project model, editing fundamentals, layers, timeline and exports before adding more decorative UI. This is the product direction for subsequent Art Club development.
