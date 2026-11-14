# Art Club — UX Implementation Plan

**Task:** AC-009 — Turn the UX audit into an implementation-ready roadmap  
**Repository:** [faiev/ArtClub](https://github.com/faiev/ArtClub)  
**Branch:** \`agent/ux-implementation-plan\`  
**Base commit:** \`fe66725f7d010beca7ca60f497778d419e753d7b\`  
**Source audit:** [UX_AUDIT.md](UX_AUDIT.md)  
**Plan date:** 2026-11-14  
**Status:** Documentation-only plan; no application source changed

---

## 1. Executive roadmap

The next product work should improve editing safety first, then make the canvas and animation workflows usable at production scale. Do not start with optional pixel-art effects or a broad redesign.

This plan breaks the audit into eight independently reviewable implementation tasks:

| Order | Proposed task | Priority | Scope | Main dependency |
|---|---|---:|---:|---|
| 1 | Safe Clear behavior and layer protection | P0 · Critical | S/M | None; must preserve undo |
| 2 | Non-destructive image import and conversion preview | P0 · High | L | Task 1's common layer-target rules |
| 3 | Integrate the validated Canvas 2D renderer | P1 · High | L | AC-010 / PR #6 reviewed |
| 4 | Pan, zoom and large-canvas navigation | P1 · High | M | Task 3's stable canvas surface |
| 5 | Production animation export workflow | P1 · High | L | PR #3 exporter + AC-011 GIF module reviewed |
| 6 | Visual timeline, thumbnails and cel operations | P1 · High | L | Stable renderer; timeline UI ownership available |
| 7 | In-app AI-agent setup and project handoff | P2 · Medium/High | M | AC-004 bridge/API contract reviewed |
| 8 | Editing feedback, shortcut and small-screen gaps | P2 · Medium | M | UI file ownership available |

**Recommended phases**

1. **Correctness and data safety:** Tasks 1–2. Never silently mutate a locked/hidden layer or replace existing artwork by surprise.
2. **Editing foundation:** Tasks 3–4. Prove the renderer before integration; make every supported canvas pixel reachable.
3. **Complete production workflows:** Tasks 5–6. Let users create, inspect and export animations instead of stopping at preview.
4. **Discoverability and polish:** Tasks 7–8. Explain the optional agent workflow and close the smaller interaction gaps.

Tasks 1 and 2 can be planned and tested independently of other PRs. Tasks 3–6 should be sequenced around the active single-writer locks below. The coordinator should create separate implementation assignments; this document does not assign work to any agent.

## 2. Evidence baseline and validation limits

### Source-verified current behavior

The following details were checked against \`main\` at \`fe66725f7d010beca7ca60f497778d419e753d7b\`:

- The Clear handler confirms “Clear every pixel on this canvas,” then blanks the active \`pixels\` buffer and updates the current project. The active buffer is the active layer's cel for the selected frame; other layer/frame cels are not cleared. The handler does not check the active layer's visible/locked state.  
  [\`index.html\` — Clear handler](https://github.com/faiev/ArtClub/blob/main/index.html#L1983-L1986)
- The normal drawing path uses an active-layer editability guard, but the image import \`onload\` handler builds a quantized image and directly replaces \`pixels\` without an equivalent guard or target choice. It uses a centered contain fit, maps source colors to the current palette, and replaces the active cel.  
  [\`index.html\` — image import](https://github.com/faiev/ArtClub/blob/main/index.html#L2046-L2067)
- The canvas viewport has \`overflow:hidden\`; the zoom helper clamps zoom to 50–200%. No pan interaction is present in the inspected editor event handling.  
  [\`index.html\` — viewport CSS](https://github.com/faiev/ArtClub/blob/main/index.html#L60-L65) · [zoom helper](https://github.com/faiev/ArtClub/blob/main/index.html#L1215-L1228)
- \`renderGrid()\` creates a \`div\` for every logical pixel and replaces all children with a newly built fragment. At 512×512, the grid contains 262,144 pixel elements. This is an architectural scaling risk; no frame-time or memory regression was measured for this plan.  
  [\`index.html\` — renderGrid](https://github.com/faiev/ArtClub/blob/main/index.html#L809-L840)
- The current frame cards show frame number, name, duration and move controls. They do not render frame artwork thumbnails or a layer-by-frame cel matrix.  
  [\`index.html\` — renderTimeline](https://github.com/faiev/ArtClub/blob/main/index.html#L856-L905)
- The current export panel exposes PNG 1×/16×, SVG and editable project JSON. The main-branch README still describes animated GIF and sprite-sheet export as future work.  
  [\`index.html\` — export controls](https://github.com/faiev/ArtClub/blob/main/index.html#L391-L398) · [README](https://github.com/faiev/ArtClub/blob/main/README.md)
- The in-app interface has no visible Agent Access entry. The bridge setup and separate Chromium profile are documented outside the editor.  
  [\`agent-bridge/README.md\`](https://github.com/faiev/ArtClub/blob/main/agent-bridge/README.md#L13-L53)

### Relevant work in progress — not yet integrated into main

- **AC-010 / PR #6:** \`agent/canvas-renderer\` contains an isolated \`CanvasPixelRenderer\` prototype and Node tests. The tests use fake canvas contexts; the board explicitly says that reliable Chromium timing was not obtained. The module is not the active main-branch renderer and must not be described as a measured speedup.
- **PR #3:** \`agent/animation-export\` contains a standalone sprite-sheet PNG builder and JSON metadata contract. It is not yet integrated into the main UI.
- **AC-011:** \`agent/gif-export\` is assigned a separate GIF encoder module. Its correctness, color quantization, transparency handling and browser decode still require evidence.
- **AC-004:** Agent 4 owns the active bridge/API hardening handoff and the bridge-related \`index.html\` changes.

### Not verified in this planning task

No live-browser usability session, touch-device session, accessibility audit with assistive technology, performance benchmark or application test run was performed. The tasks below include those as future acceptance evidence. In particular, no claim is made that the DOM renderer currently misses a particular frame rate, or that the Canvas 2D prototype is faster in the target browser.

## 3. Shared file ownership and integration rules

The coordination board's current ownership table is part of this plan:

| Path / area | Current owner | Planning consequence |
|---|---|---|
| \`js/project-storage.js\`, recovery tests, \`agent-bridge/e2e-test.mjs\` | Agent 1 / AC-006 | Do not add UX tests to the owned E2E file during AC-006. Extend \`tests/editor-interactions.test.js\` or create a separate test file until Agent 1 releases it. |
| \`js/canvas-renderer.js\`, renderer tests, benchmarks and architecture docs | Agent 2 / AC-010 | Do not modify the prototype or its tests. Treat AC-010 review as the renderer integration gate. |
| \`js/sprite-sheet-export.js\` from PR #3; \`js/gif-export.js\`, GIF tests/docs from AC-011 | Agent 3 | UI work must consume the reviewed module contract; do not duplicate encoder/compositor logic. |
| \`AGENT_API.md\`, \`agent-bridge/*\`, \`js/agent-api.js\`, bridge-related \`index.html\` | Agent 4 / AC-004 | Do not overlap bridge wiring or edit the shared E2E harness. Coordinate any \`index.html\` integration after Agent 4's handoff. |
| \`UX_IMPLEMENTATION_PLAN.md\` | Agent 5 / AC-009 | This task changes only this document. |

**Important:** \`index.html\` is the shared application shell. Even when a future task owns a different UI region, its implementer must check the current branch/diff and obtain a serialized edit window before changing that file. Prefer a small standalone module for new behavior, but loading or wiring it may still require a coordinated, narrowly scoped \`index.html\` change.

---

## 4. Implementation tasks

### Task UX-01 — Make Clear safe, explicit and layer-aware

**Priority:** P0 · Critical  
**Scope:** S/M  
**Audit references:** UX-01  
**User problem and current workflow**

A user clicks the trash/clear icon, confirms a message that says the entire canvas will be cleared, and expects all visible artwork to disappear. The current handler actually blanks only the active layer's current cel. It also permits the operation when that active layer is hidden or locked. Normal drawing has an editability check, so Clear behaves inconsistently with the rest of the editor.

**Source-verified facts**

- \`clearBtn\` calls \`remember()\`, sets \`pixels = blank(w,h)\`, renders and saves.
- \`pixels\` is synchronized to the active layer/frame cel by \`syncProjectDocument()\`.
- The handler has no \`isActiveLayerEditable()\` check.
- The normal pointer-drawing path checks editability before starting an edit.

**Assumptions / browser validation still needed**

- Confirm the exact visual consequence with multiple visible layers and with the active layer hidden/locked.
- Confirm whether users currently understand the trash icon as “clear active layer” or “clear composite.” Do not resolve this ambiguity by guessing; test the proposed labels.

**Exact proposed behavior**

1. Rename the current action to **Clear active layer**.
2. Confirm with the active layer name and selected frame name/number: “Clear pixels on ‘Ink’ for Frame 2? Other layers and frames will remain unchanged.”
3. Disable the action, or show a clear explanation, when the active layer is hidden or locked. Do not silently bypass the layer protection model.
4. Keep a separate **Clear visible frame** action out of the first implementation unless user testing shows it is needed. If added later, specify whether it clears visible layers only or every layer.
5. Keep the operation as a single undoable transaction and update the save indicator only after the normal save path is scheduled.

**Acceptance criteria**

- Clear never changes a hidden or locked active layer.
- Clear changes only the active layer's cel on the selected frame.
- Other layers and all other frames remain byte-for-byte unchanged.
- The UI label and confirmation accurately state the operation's scope.
- Cancel leaves pixels and project revision unchanged.
- Undo and redo restore the complete pre/post project state exactly.
- The same rule is enforced by any keyboard shortcut or future command-palette invocation, not only by the visible button.

**Affected files**

- \`index.html\` — Clear control label, disabled/tooltip state, event handler and confirmation.
- \`tests/editor-interactions.test.js\` — extend the existing VM-backed interaction suite.
- Optional new \`tests/editor-clear.test.js\` only if separation materially improves test readability.

**Dependencies / ownership**

- No hard technical dependency.
- Coordinate the narrow \`index.html\` edit with Agent 4 while AC-004 owns bridge-related changes in that file.
- Do not edit Agent 1's \`agent-bridge/e2e-test.mjs\` during AC-006. A later browser acceptance test can be added after that file is released.

**Test plan**

- Unit/interaction: active visible unlocked layer clears; hidden and locked layer attempts do not mutate; a second layer and a second frame remain intact; cancel is a no-op; undo/redo round-trip.
- Browser: create two layers and two frames with visibly different pixels; lock/hide the active layer and verify Clear is blocked; unlock/show it and verify only the selected cel clears.
- Regression: save/reopen and compare all layer/frame cels to prove the operation did not clear more than its stated scope.

---

### Task UX-02 — Turn image import into a previewed, non-destructive workflow

**Priority:** P0 · High  
**Scope:** L  
**Audit references:** UX-02 and the import part of UX-01  
**User problem and current workflow**

The user chooses a local image and the app immediately converts it to the current canvas dimensions, maps colors to the current palette and replaces the active layer's current cel. There is no conversion preview, fit-mode choice or destination selection. A user can lose the content of the active cel without being shown the quantized result first.

**Source-verified facts**

- Import currently uses a centered contain fit.
- It disables smoothing, ignores source alpha values below 32, maps each surviving pixel to the nearest existing palette color, then assigns the result directly to \`pixels\`.
- There is no pre-commit preview or explicit new-layer/new-project destination.
- The image import handler does not validate the active layer's visible/locked state before replacement.

**Assumptions / browser validation still needed**

- Confirm expected behavior with portrait, landscape, transparent and high-color source images.
- Confirm whether the current palette's nearest-color behavior is acceptable as a default. Do not silently change the color-distance or transparency policy in the UI task.

**Exact proposed behavior**

1. Selecting a file opens an **Image to pixel art** dialog; file selection alone never mutates project pixels.
2. Show source preview and an exact target-grid preview at the current project dimensions.
3. Offer explicit fit modes: **Contain** (default), **Cover/Crop**, and **Stretch**. Any crop position must be visible in the preview.
4. Show the active palette and the transparency policy. Explain that the v2 project model stores opaque HEX pixels plus transparency, not partial per-pixel alpha.
5. Default destination to **New layer**. Offer **Replace active cel** as an explicit destructive option; disable it for hidden/locked layers.
6. Confirm the target layer/frame and number of colors before applying. Commit the full import as one undoable action.
7. Keep import local to the browser; do not upload the image or add a backend dependency.

**Acceptance criteria**

- The project model is unchanged until the user presses Import/Apply.
- Preview dimensions and final dimensions exactly match the selected target.
- Contain/Cover/Stretch results are deterministic and documented.
- Palette mapping and alpha-to-transparency policy are identical between preview and commit.
- New-layer import preserves every existing layer/frame cel.
- Replace-active-cel import requires explicit confirmation and is blocked for hidden/locked layers.
- Cancel, invalid file and decode failure leave the project unchanged and release object URLs.
- Undo restores the original project; redo restores the imported result.
- The operation remains browser-local and works without network access after the page is loaded.

**Affected files**

- \`index.html\` — import entry point, preview dialog and commit wiring.
- Proposed \`js/image-import.js\` — pure fit/quantization helpers, only if extracting these helpers keeps the main page's existing plain-JavaScript loading pattern simple.
- \`tests/editor-interactions.test.js\` and/or new \`tests/image-import.test.js\`.
- Browser regression coverage in the agreed Playwright suite after current E2E file ownership is released.

**Dependencies / ownership**

- Reuse Task UX-01's active-layer target rules.
- Coordinate \`index.html\` edits after Agent 4 releases the shared UI file.
- No need to change the project schema for the first implementation. If a conversion requirement needs new persisted metadata, write a separate proposal before altering \`js/project-model.js\`.

**Test plan**

- Unit: exact contain/cover/stretch placement; alpha below/above threshold; nearest-palette mapping; transparent source; malformed source; deterministic result.
- Interaction: preview does not mutate; target selection is respected; new-layer import preserves prior cels; locked/hidden replace is blocked; cancel is no-op.
- Browser: import a known PNG fixture with transparency and at least four colors; compare preview pixels to committed cel pixels; undo/redo; refresh and reopen the project.

---

### Task UX-03 — Integrate the validated Canvas 2D renderer

**Priority:** P1 · High  
**Scope:** L  
**Audit references:** UX-04  
**User problem and current workflow**

The active main-branch renderer creates one DOM element per pixel and rebuilds the grid on full render paths. The 512×512 maximum implies 262,144 elements. The user needs the supported canvas sizes to remain editable without the display surface becoming dominated by DOM overhead.

**Source-verified facts**

- Main \`index.html\` uses a CSS grid of \`.pixel-cell\` elements; \`renderGrid()\` creates the elements in a loop and calls \`replaceChildren()\`.
- The \`agent/canvas-renderer\` branch contains an isolated \`CanvasPixelRenderer\` prototype with a dirty-rectangle parameter, nearest-neighbor drawing and a separate overlay surface.
- Its existing Node tests use fake canvas/context objects. The coordination board says reliable Chromium timings were not obtained. No speedup is established.

**Assumptions / browser validation still needed**

- Actual browser rendering cost and memory use at each supported dimension.
- Whether the prototype's overlay, resize and device-pixel-ratio paths behave identically in target browsers.
- Whether the accessible keyboard interaction can be preserved without restoring a DOM element for every pixel.

**Exact proposed behavior**

1. Review and accept AC-010 correctness work before integrating the renderer.
2. Keep the renderer as an isolated module; do not merge the project model, rendering and input logic into a new monolith.
3. Replace the visual pixel-cell grid with a Canvas 2D surface for artwork, while preserving independent grid/selection/onion overlays.
4. Keep pointer hit testing based on logical pixel coordinates, not CSS cell elements.
5. Preserve keyboard navigation and a usable accessible description/coordinate status without creating one DOM node per logical pixel.
6. Use dirty rectangles for localized drawing updates; force a full redraw when dimensions, display scale or composite state requires it.
7. Keep the previous renderer available until browser correctness checks pass and the coordinator explicitly approves switching the live editor.

**Acceptance criteria**

- Renderer output matches the current DOM renderer pixel-for-pixel for transparent and opaque fixtures.
- Layer composites, grid visibility, selection marquee, onion skin and playback preview are preserved.
- No blur or interpolation appears at integer and fractional display sizes.
- Dirty updates do not clear or corrupt pixels outside the dirty rectangle.
- Canvas resizing and device-pixel-ratio changes force a correct full redraw.
- Pointer mapping reaches the exact logical pixel at all supported dimensions.
- Keyboard users can focus/navigate pixels and receive an accessible coordinate/value description.
- Browser validation covers 32×32, 64×64, 128×128, 256×256 and 512×512.
- Performance is reported only from actual measurements with a documented browser/device; if Chromium cannot run, mark measurements unavailable.

**Affected files**

- \`js/canvas-renderer.js\` — existing AC-010 module, owned by Agent 2 until its handoff.
- \`tests/canvas-renderer.test.js\` — existing correctness suite, owned by Agent 2.
- \`index.html\` — renderer initialization, canvas surface and input wiring.
- New browser integration tests in a Playwright test file agreed with the coordinator after Agent 1/4 release their E2E files.
- \`benchmarks/*\` and \`docs/rendering-architecture.md\` — remain Agent 2's AC-010 scope; the integration task should consume, not rewrite, that evidence.

**Dependencies / ownership**

- Hard gate: AC-010 / PR #6 reviewed and renderer contract accepted.
- Agent 2 must release \`js/canvas-renderer.js\` and related test ownership before changes.
- Coordinate the live \`index.html\` swap after Agent 4's bridge-related UI handoff. Agent 5 must not perform this integration as part of AC-009.

**Test plan**

- Node correctness: exact RGBA comparison, dirty-rectangle boundaries, transparent pixels, crisp scaling, selection overlay isolation, onion-skin composition and pointer coordinate mapping.
- Browser: compare the new renderer against a reference pixel output for a fixture at all five dimensions; test resize/DPR; verify pointer input and keyboard access.
- Benchmark: warm-up runs and multiple samples; report median and p95 for initial render, dirty edit, frame switch and playback. Do not gate a merge on a fabricated or unavailable number; do gate it on correctness and disclose unavailable measurement.
- Regression: export PNG from a known project before/after renderer integration and compare bytes or decoded pixel arrays.

---

### Task UX-04 — Add pan, useful zoom and reliable canvas edge access

**Priority:** P1 · High  
**Scope:** M  
**Audit references:** UX-03  
**User problem and current workflow**

The user can zoom with buttons and keyboard shortcuts, but zoom stops at 200%. The viewport clips overflow and offers no pan interaction. On large canvases, zooming in can make parts of the image unreachable.

**Source-verified facts**

- The viewport is styled with \`overflow:hidden\`.
- \`applyZoom()\` sizes the grid from the fitted view and \`setZoom()\` clamps the zoom range to 0.5–2.
- The inspected event handlers contain no Space-drag, middle-mouse pan or cursor-centered wheel zoom interaction.

**Assumptions / browser validation still needed**

- Best default zoom step and upper bound on common desktop displays.
- Touch gesture behavior on phones/tablets.
- Whether users prefer a dedicated Hand tool, Space-drag, or both. This plan recommends both Space-drag and middle mouse, with visible Fit/100% controls.

**Exact proposed behavior**

1. Add **Fit**, **100%**, zoom-in and zoom-out controls with a wider, documented zoom range.
2. Add Space + primary-button drag and middle-button drag to pan without painting.
3. Add wheel zoom centered on the pointer. Keep the logical pixel under the pointer stationary while zoom changes.
4. Add a Hand/Pan tool as a discoverable alternative to shortcuts.
5. Show the current zoom and logical \`x,y\` coordinate under the pointer.
6. Keep checkerboard and pixel boundaries independent from pan/zoom.
7. Keep touch behavior deliberate: one-finger draw when a drawing tool is active; two-finger pan/zoom where supported; do not steal normal page scroll outside the canvas.

**Acceptance criteria**

- Every corner and edge pixel of a 512×512 canvas can be brought into the viewport and edited.
- Fit and 100% are one-action commands.
- Wheel zoom is centered around the pointer within a defined rounding tolerance.
- Pan never changes project pixels, layer order, frame selection or undo history.
- Space-drag temporarily pans and returns to the previous tool after release.
- Middle mouse pans without starting a drawing stroke.
- Hand tool and all zoom controls have accessible names and visible focus.
- Pixel edges remain crisp and the pointer always maps to the correct logical cell.
- At 375px viewport width, controls remain reachable without forcing horizontal page scrolling.

**Affected files**

- New \`js/canvas-navigation.js\` — pan/zoom math and pointer-state handling, if it can be kept separate from app state.
- \`index.html\` — viewport markup, zoom controls and event hookup.
- New \`tests/canvas-navigation.test.js\` — coordinate/zoom/pan math.
- Existing interaction suite and a browser workflow test for actual pointer behavior.

**Dependencies / ownership**

- Prefer implementation after Task UX-03 establishes the final canvas surface and coordinate adapter.
- Coordinate the \`index.html\` integration window with Agent 4. Do not edit the renderer module; Agent 2 owns it.
- No change to project data or Agent API is required.

**Test plan**

- Unit: zoom clamp, fit scale, cursor-anchored zoom transform, pan bounds and inverse screen-to-pixel mapping.
- Browser: pan to all four corners at 512×512; paint one pixel on each edge; zoom around a selected cell and confirm its logical coordinate remains under the pointer.
- Regression: compare project JSON before and after a sequence of pan/zoom-only actions; it must be unchanged.
- Responsive: test 375px, 700px, 1024px and desktop viewport widths.

---

### Task UX-05 — Complete the production animation export workflow

**Priority:** P1 · High  
**Scope:** L  
**Audit references:** UX-05  
**User problem and current workflow**

Users can create frames, set durations and preview loop/once/ping-pong playback, but the main UI only exports a single selected-frame PNG/SVG or an editable JSON project. The animation cannot yet be handed to a game engine or shared as an animated file.

**Source-verified facts**

- The main export panel has PNG 1×, PNG 16×, SVG, Project JSON and Open JSON controls.
- PR #3 contains a separate sprite-sheet PNG and JSON-metadata exporter on \`agent/animation-export\`; it is not in main.
- AC-011 assigns a separate \`js/gif-export.js\` browser-compatible encoder on \`agent/gif-export\`; its output and browser-decoding evidence are still pending.
- The v2 model stores frame order and per-frame \`durationMs\`.

**Assumptions / browser validation still needed**

- Preferred default sprite-sheet layout and export presets.
- Whether GIF transparency threshold/one-bit transparency is acceptable for the intended art style; the UI must disclose the encoder's documented policy.
- Whether a user needs selected-frame ranges or named animation clips in the first export dialog. Frame tags are not in the current project model and should not be assumed.

**Exact proposed behavior**

1. Add an **Animation export** action separate from single-frame PNG/SVG.
2. Let users select all frames or an explicit ordered subset.
3. For sprite sheets, expose horizontal, vertical and grid layouts, columns, margin, spacing, transparent background and visible-composite/selected-layer choice.
4. Show a preview with exact output dimensions and frame rectangles before download.
5. Download a companion JSON metadata file with filename, layout, frame ID/name, order, rectangle and original \`durationMs\`.
6. Add GIF export only through the reviewed AC-011 module. Expose loop/forever choice and report color quantization and binary transparency limitations.
7. Keep export modules pure: they accept a project snapshot and options and return Blob + metadata/diagnostics. UI owns downloads and object-URL cleanup.
8. Do not add Agent API or MCP export tools in this task; bridge exposure requires a separate coordinator decision after AC-004.

**Acceptance criteria**

- Sprite sheet preserves native frame dimensions, exact RGB values and transparent cells; no scaling or smoothing.
- Selected frame order is reflected in both pixel placement and metadata order.
- JSON rectangles exactly match the downloaded image's layout.
- Frame durations in metadata equal the stored source durations.
- GIF plays with the requested loop behavior and documented delay conversion.
- GIF transparency follows the chosen one-bit policy; palette overflow uses a documented quantization strategy, and tests include more than 256 source colors.
- The export preview matches the produced asset.
- Invalid/oversized projects fail with actionable errors and do not mutate the source project.
- Browser test decodes/inspects the actual downloaded GIF and PNG; a mocked Blob alone is insufficient.

**Affected files**

- Existing \`js/sprite-sheet-export.js\` from PR #3 — consume after review; do not duplicate its layout/compositor.
- New \`js/gif-export.js\` from AC-011 — consume after review; do not change Agent 3's implementation within this integration task.
- New \`js/animation-export-ui.js\` — options, preview and download lifecycle.
- \`index.html\` — add one entry point and load/wire the UI module.
- New \`tests/animation-export-ui.test.js\` plus real browser export/decode coverage.
- \`ANIMATION_EXPORT.md\` / \`GIF_EXPORT.md\` — update only if the UI adds user-facing behavior not already documented by the module owners.

**Dependencies / ownership**

- Hard dependency: PR #3 sprite-sheet contract reviewed and accepted.
- Hard dependency: AC-011 GIF module reviewed with browser decode evidence.
- Coordinate \`index.html\` with Agent 4; keep the export modules independent of \`js/agent-api.js\` and \`agent-bridge/*\`.
- Do not wait for either module to merge to draft the dialog/test contract, but do not wire unreviewed module code into main.

**Test plan**

- Unit: option validation, frame order, margins/spacing, transparency, metadata rectangles and frame durations.
- GIF: parse signature, logical dimensions, frame count, GCE delays, loop extension, transparent index and quantized palette; include >256 colors.
- Browser: trigger export from a multi-frame project; decode actual PNG/GIF output; inspect pixels and timing; verify object URLs are revoked.
- Workflow: cancel preview, export, reopen source project and confirm no source state changed.

---

### Task UX-06 — Make the timeline visual and expose layer/frame cels

**Priority:** P1 · High  
**Scope:** L  
**Audit references:** UX-06  
**User problem and current workflow**

The current timeline is a row of frame cards containing number, name, duration and reorder arrows. A user has to select each frame to see its artwork. Layers are listed separately in the inspector, so the interface does not show which layer/frame cels contain content.

**Source-verified facts**

- The project model stores independent cels for layer/frame pairs.
- The current \`renderTimeline()\` creates cards with text and duration inputs, not thumbnails.
- The current layer list is rendered separately by \`renderLayers()\`.
- The browser Agent API has frame and layer operations, but the visual timeline has no cel-copy/paste affordance.

**Assumptions / browser validation still needed**

- Whether the default timeline should always show every layer or begin in a compact frame-strip mode.
- Maximum number of visible layer rows on a typical desktop.
- Thumbnail dimensions that remain legible without making a long animation timeline too tall.

**Exact proposed behavior**

1. Add a composite thumbnail to each frame card. Render it from the frame's visible-layer composite; do not include selection borders or onion-skin overlays.
2. Make active editing frame and transient playback-preview frame visibly distinct.
3. Add an optional **Layer/Cel view**: layers form rows and frames form columns; each cell shows empty/content and active state.
4. Clicking a cel selects its layer and frame. It must not silently create a new cel unless the user begins an edit or explicitly chooses Add blank cel.
5. Add Copy cel / Paste cel for the same layer across frames, with paste as one undoable operation. Preserve other layer/frame pairs.
6. Keep current simple frame strip available on narrow screens; allow the timeline to collapse for static-art work.

**Acceptance criteria**

- Every frame thumbnail equals its visible composite at the time it is rendered.
- Thumbnail refreshes after drawing, layer visibility/order change, frame reorder and undo/redo.
- Thumbnails exclude selection and onion-skin UI overlays.
- Timeline distinguishes active editing frame from paused preview frame.
- Cel view shows layer/frame relationships and empty vs populated cels.
- Copy/paste cel affects only the destination layer/frame cel and preserves every other cel.
- Undo/redo round-trips cel paste exactly.
- Frame reorder moves the associated cels with the frame identity, not with the old column index.
- Timeline remains usable with 1, 4, 16 and 64 frames and does not force page-wide horizontal overflow.

**Affected files**

- \`index.html\` — timeline structure and interactions.
- Proposed \`js/timeline-view.js\` — thumbnail rendering and cel-grid view if extraction is practical.
- Proposed \`js/cel-clipboard.js\` or focused helpers in a new timeline module — copy/paste operations.
- New \`tests/timeline-view.test.js\` and/or additions to \`tests/editor-interactions.test.js\`.
- Browser timeline workflow test after E2E file ownership is released.

**Dependencies / ownership**

- The v2 project model already represents layer/frame cels; do not redesign the schema for thumbnails.
- Coordinate with Agent 3 because cel-copy/paste and animation export touch related frame workflows, but keep GIF encoding and sheet encoding out of the timeline module.
- Wait for the renderer surface to stabilize if thumbnails reuse the Canvas 2D renderer.
- Coordinate \`index.html\` changes after Agent 4's UI handoff; do not edit bridge/API files.

**Test plan**

- Unit: composite thumbnail uses visible layers in stack order; hidden layers excluded; transparent pixels remain transparent; overlays are excluded.
- Model/interaction: copy from frame A to B on one layer, prove other layers/frames unchanged, then undo/redo.
- Browser: create two layers and four different frames; verify thumbnails, select a cel, copy/paste, reorder frames and reload.
- Responsive: verify frame strip on phone-width viewport and layer/cel view on desktop/tablet.

---

### Task UX-07 — Make local AI-agent access discoverable and explain project handoff

**Priority:** P2 · Medium/High if agent drawing remains a public product promise  
**Scope:** M  
**Audit references:** UX-07  
**User problem and current workflow**

The browser Agent API and local MCP bridge are meaningful differentiators, but the editor has no in-app Agent Access entry. Users must locate repository documentation, install Node/Playwright, configure an MCP client and understand that the bridge launches a dedicated Chromium profile with a separate local project library.

**Source-verified facts**

- \`AGENT_API.md\` documents the page-scoped API and requires waiting for \`window.OnePixelStudioReady\`.
- \`agent-bridge/README.md\` documents local installation, MCP client configuration and a dedicated browser profile.
- The app itself has no visible Agent Access/onboarding button in the current main UI.

**Assumptions / browser validation still needed**

- Which MCP clients should be illustrated first. Keep the initial help content generic and link to maintained client-specific setup only when available.
- Whether a user expects to transfer projects between the everyday browser and the dedicated agent profile. The UI should explain the separation before implying that the libraries are shared.

**Exact proposed behavior**

1. Add a visible **AI agent access** or **Connect an agent** help entry. It is informational; it must not start a server or ask for credentials.
2. Explain that the static GitHub Pages site does not accept arbitrary remote commands. The optional bridge runs locally over stdio.
3. Present requirements and a short setup sequence, then link to the authoritative bridge README and Agent API reference.
4. State prominently that the bridge uses a dedicated Chromium profile and its own local project library.
5. Explain the safe handoff: export editable Project JSON from one profile and open it in the other; export/inspect PNG previews; use undo to reverse an agent batch.
6. Explain that a connected agent can edit, import, export or delete projects through enabled tools. Preserve the local-first/no-account architecture.

**Acceptance criteria**

- A new user can find Agent Access without searching GitHub.
- UI guidance matches actual Node/Playwright/MCP setup instructions.
- Separate browser profile and separate project library are explained before setup.
- No text implies GitHub Pages hosts the MCP server or that projects automatically sync between profiles.
- Links point to the actual \`AGENT_API.md\` and \`agent-bridge/README.md\`.
- The user can identify how to export a project, import it into the agent profile, inspect a preview and undo work.
- Help content remains available without a bridge installed or network access to a paid service.

**Affected files**

- New \`AGENT_SETUP.md\` — canonical, concise user-facing walkthrough, if it is not duplicative of the bridge README.
- \`index.html\` — visible Help/Agent Access entry and dialog.
- \`agent-bridge/README.md\` — only if Agent 4 agrees to update it or releases ownership.
- New \`tests/agent-onboarding.test.js\` or existing editor interaction tests for link/content checks.

**Dependencies / ownership**

- Hard content dependency: Agent 4's AC-004 bridge/API contract reviewed so setup instructions match final tool behavior.
- Agent 4 owns bridge docs and bridge files during AC-004; do not change those files concurrently.
- Coordinate the in-app entry point in \`index.html\` after Agent 4 releases the shared UI file.

**Test plan**

- Documentation/link test: required setup steps and exact paths are present; local profile separation is stated.
- Browser: help entry opens with keyboard and pointer; links resolve; close returns focus to the invoking control.
- Product review: ask a first-time user to find the setup steps and explain where agent-created projects are stored. Record whether they understand the separate profile before proceeding.

---

### Task UX-08 — Close smaller editing feedback and discoverability gaps

**Priority:** P2 · Medium  
**Scope:** M  
**Audit references:** UX-08, UX-09, UX-10, UX-11 and related feedback concerns  
**User problem and current workflow**

Several existing actions are available but difficult to discover or ambiguous across platforms. Playback exposes a Play/Pause toggle but no visible Stop control, layer/frame rename depends on double-click, palette removal depends on right-click, the shortcut legend displays Apple Command symbols even though the implementation accepts Ctrl or Meta, and the mobile breakpoint hides the existing-canvas resize controls.

**Source-verified facts**

- The timeline has Play/Pause, playback mode and Onion controls but no visible Stop button.
- The Agent API exposes stop playback; the UI does not expose it.
- Layer and frame rename are triggered by double-click; palette removal is bound to contextmenu/right-click.
- The shortcut handler accepts Ctrl or Meta, while the on-screen legend displays Command symbols.
- At the 700px breakpoint, \`.size-area\` is hidden, removing the existing-project custom resize entry point.

**Assumptions / browser validation still needed**

- Confirm these issues with keyboard-only and touch users before finalizing exact button placement.
- Validate the 700px breakpoint on real devices and with browser zoom, not only a responsive emulator.

**Exact proposed behavior**

1. Add a visible Stop action next to Play/Pause. When paused on a preview frame, label it **Paused preview**; Stop returns to the selected editing frame.
2. Add a visible rename/menu affordance for layers and frames. Double-click may remain as a shortcut but must not be the only discoverable path.
3. Provide a click/tap/keyboard palette menu with Remove and Duplicate; explain that removing a swatch does not recolor existing pixels.
4. Use platform-aware Ctrl/Command shortcut labels or neutral Ctrl/Cmd wording; list implemented zoom shortcuts.
5. Keep a Canvas size action available at phone widths so a user can resize the current project without starting a new one.
6. Add concise status feedback for active layer/frame/tool and failed operations; disabled actions should explain why they are disabled.

**Acceptance criteria**

- Pause and Stop are separate actions; paused preview and selected editing frame are visually distinguishable.
- Stop always returns the canvas to the selected editing frame.
- Rename is discoverable by mouse, keyboard and touch.
- Palette removal and duplication are available without right-click.
- Shortcut labels match platform behavior and every displayed shortcut is implemented.
- On a 375px viewport, current-project resize is reachable and the dialog is usable without horizontal page scrolling.
- Keyboard focus is visible and returns to the correct control after dialogs/menus close.
- Error and disabled states explain the next useful action without falsely reporting success.

**Affected files**

- \`index.html\` — playback controls, layer/frame menus, palette interaction, shortcut labels, mobile Canvas size entry and status text.
- New \`js/editor-menus.js\` only if context menus/rename behavior are extracted without creating unnecessary modules.
- New \`tests/editor-feedback.test.js\` or additions to existing interaction tests.
- Browser responsive/keyboard test in the agreed Playwright suite after file ownership is released.

**Dependencies / ownership**

- No model/API redesign required.
- Must be serialized with Agent 4's \`index.html\` ownership and any other UI integration task.
- Keep this task behind Tasks 1–6; do not let polish displace correctness, navigation or animation export.

**Test plan**

- Unit/interaction: playback state transitions, focus restoration, shortcut-label mapping, rename menu actions and palette remove/duplicate behavior.
- Browser keyboard-only: navigate all primary controls, open/close dialogs, rename, stop preview and return focus predictably.
- Responsive: 375px, 600px, 700px and 1024px; verify resize, timeline, palette and canvas remain reachable.
- Touch: rename and palette actions must be possible without contextmenu/right-click.

---

## 5. Cross-task definition of done

A UI or workflow task is ready for coordinator acceptance only when:

- The task's exact scope and acceptance criteria are implemented; no unrelated redesign has been mixed in.
- Pixel edits preserve integer boundaries and exact colors. Any export or preview overlay remains separate from the artwork data.
- Undo/redo behavior is tested for every operation that mutates pixels or document structure.
- Save/reopen tests prove the project model is not silently changed or truncated.
- Keyboard access, focus state and disabled/error feedback are covered for any new controls.
- The relevant unit/interaction tests pass, plus a real-browser test for workflows involving rendering, pointer input, downloads, responsive layout or browser storage.
- Browser/performance claims include actual browser, viewport, test dimensions, warm-up/sample method and measurements. If unavailable, state that explicitly.
- The implementer checks current branch ownership and gets the coordinator's serialized edit window for shared \`index.html\` or E2E files.
- The PR report separates implementation, local tests, browser tests, CI and integration status. A module or PR is not the same as a feature being integrated.

## 6. Coordinator sequencing and suggested assignment slices

This table is a planning recommendation, not an assignment. Only the coordinator may create or change task ownership.

| Slice | Suggested deliverable | Gate before starting shared UI integration |
|---|---|---|
| A | UX-01 Clear semantics and tests | Agent 4 releases relevant \`index.html\` area |
| B | UX-02 Image import preview and safe target | UX-01 rules accepted; Agent 4 releases relevant UI area |
| C | UX-03 renderer integration | AC-010 accepted; Agent 2 releases module; Agent 4 releases UI area |
| D | UX-04 pan/zoom | UX-03 surface/coordinate contract stable |
| E | UX-05 animation export UI | PR #3 and AC-011 module contracts accepted; Agent 4 releases UI area |
| F | UX-06 timeline/cel UX | renderer and timeline contract stable; Agent 4 releases UI area |
| G | UX-07 Agent Access onboarding | AC-004 docs/API behavior accepted; Agent 4 releases docs/UI |
| H | UX-08 feedback polish | Core tasks prioritized above complete or explicitly deferred |

Tasks A/B and the renderer/animation module reviews can proceed as independent work where files do not overlap. Do not put multiple workers on \`index.html\` simultaneously. If the coordinator chooses a single UI integration owner, that owner should apply reviewed modules in small, isolated commits and request specialist review from the agent who produced each module.

## 7. Explicit non-goals for this roadmap

Do not add these ahead of the tasks above:

- Symmetry, dithering, automatic shading, tile-map editing or reference-image systems.
- Cloud sync, remote collaboration, mandatory sign-in or a hosted backend.
- Arbitrary JavaScript or remote HTTP access for AI agents.
- GIF/sprite-sheet implementation duplicated inside the UI layer.
- Renderer replacement based only on a mocked unit test or an unrun benchmark.
- A complete project-format redesign for thumbnails or cel copy/paste unless a reproducible requirement proves it necessary.

The intended result is a trustworthy, navigable pixel-art editor with a complete animation handoff path—not a larger collection of disconnected controls.
