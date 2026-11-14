# Layer, Frame and Timeline Workflow Specification

**Task:** AC-050 — Layer, frame and timeline workflow specification  
**Owner:** Agent 5 — UX / interaction design / accessibility  
**Branch:** `agent/layer-timeline-spec`  
**Production source rechecked:** `main` `index.html` blob `4645281c1aad8580529e7feb99cd299a88543913` (merged UI-01 workstation shell)  
**Status:** Specification only; no production UI or application implementation is included.

---

## 1. Product outcome

Users should be able to understand and edit an animation as a structured set of layers, frames and cels—not as unrelated layer buttons beside a strip of anonymous frame cards.

The timeline is the visual map of the project:

- **Rows are layers**, ordered bottom-to-top in the document and shown top-to-bottom in the workspace.
- **Columns are frames**, ordered left-to-right in playback order.
- **Each intersection is a cel**, the pixel buffer for one layer in one frame.
- **The active cel** is the unique layer/frame target for ordinary drawing and cel-specific commands.

This document defines behavior, safety rules, accessibility and acceptance criteria for later implementation. It aligns with Agent 6's safe-target/transaction work and Agent 3's frame-order/export contracts without editing their modules.

### Goals

- Make layer and frame order, selection and cel occupancy immediately understandable.
- Provide predictable add, rename, reorder, duplicate, delete, visibility, lock, opacity, duration and playback workflows.
- Make copy/paste and clear operate on a clearly identified cel and remain undoable.
- Preserve every unrelated cel and stable layer/frame identity during structural changes.
- Make empty/unallocated cels distinct from allocated-but-transparent cels.
- Make playback, onion skin and export order agree with the visible timeline.
- Keep every operation usable by keyboard and assistive technology.

### Non-goals

- No layer groups, blend modes, linked cels or nested timelines.
- No production UI, HTML, CSS, JavaScript, tests, bridge or workflow edits in AC-050.
- No changes to GIF/sprite-sheet exporter implementation or Agent API.
- No assumption that a cel is allocated merely because a layer or frame exists.

## 2. Current project model and UI behavior verified in main

The source review was performed against the current v2 project model and editor source on `main`.

### 2.1 v2 document structure

The v2 ProjectModel uses:

- `layers[]`: ordered layer records with stable `id`, `name`, `visible`, `locked` and `opacity`.
- `frames[]`: ordered frame records with stable `id`, `name` and `durationMs`.
- `cels[]`: pixel buffers associated by `layerId` and `frameId`.
- `activeLayerId` and `activeFrameId`: the currently selected editing target.
- `canvas.width` and `canvas.height`: shared logical dimensions for all cels.

Current ProjectModel limits include 32 layers, 256 frames, 512 pixels per canvas dimension, 256 palette colors and 16,777,216 pixels per cel.

The layer array is ordered bottom-to-top. The visual layer list reverses that array so the topmost layer appears first. The frame array is ordered left-to-right and defines animation order.

A cel is a flat pixel array found by the layer/frame ID pair. A layer/frame pair may have no cel record yet. `getCompositePixels()` skips a missing cel, so the pair contributes no pixels to the composite. `ensureCel()` creates a transparent pixel buffer when explicitly called by current editor paths.

### 2.2 Existing layer UI

The current layer list (`index.html` around lines 1077–1147):

- Displays layers top-to-bottom by reversing the project model order.
- Selects a layer by clicking its name; double-click opens rename.
- Provides visibility and lock toggles.
- Provides up/down buttons for layer order.
- Provides Add, Duplicate and Delete actions outside the list.
- Disables Add/Duplicate at the 32-layer limit and Delete when only one layer remains.
- Uses a confirmation before deleting the active layer; the operation removes all cels belonging to that layer and selects a neighboring layer.
- Duplicating a layer copies its existing cel buffers across frames, copies visibility and opacity, and creates a new unlocked layer.
- Adding a layer creates a cel for the current active frame; other frame cels are left unallocated until needed.
- The model has an opacity field, but the current layer UI has no opacity control.

The current composite routine checks visibility and overlays non-transparent pixels in bottom-to-top order. It does **not** apply stored layer opacity. Thus the opacity field is not yet a complete visible opacity workflow.

### 2.3 Existing frame/timeline UI

The current timeline (`index.html` around lines 856–905 and 995–1075):

- Renders a horizontal list of frame cards with frame number, frame name, duration input and left/right reorder buttons.
- Selects a frame by clicking its name/number; double-click opens rename.
- Edits duration in milliseconds, constrained to 10–60,000 ms in 10 ms steps.
- Adds a blank frame immediately after the active frame and uses the active frame duration by default.
- A newly added frame creates a cel for the active layer; other layers may remain unallocated on that frame.
- Duplicates a frame immediately after its source, copies the source duration and every existing layer cel buffer, and selects the duplicate.
- Deletes a frame with confirmation, removes its cels and selects a neighboring frame. The only remaining frame cannot be deleted.
- Reorders frames by moving the frame record in the ordered array; cel associations continue to use stable IDs.
- Shows Play/Pause, Loop/Once/Ping-pong mode and a global Onion checkbox. Play is disabled when fewer than two frames exist.
- Does not render frame artwork thumbnails or a layer-by-frame cel matrix.
- Has no dedicated Copy Cel / Paste Cel workflow.

### 2.4 Active target and mutation behavior

- Ordinary drawing operates on the active layer in the active editing frame.
- Layer/frame changes are blocked while a pointer stroke is active.
- Selecting a frame resets the current selection geometry; selecting a layer currently retains the selection geometry.
- Hidden/locked layers can remain selected, but ordinary drawing is blocked by the current editor guard.
- Selecting a layer/frame currently calls `ensureCel()`, so an unallocated pair becomes a blank cel as part of that selection path.
- Playback uses a separate preview frame ID; editing is blocked while playback is running, and preview state must not be confused with the active editing frame.
- Layer/frame navigation currently calls the history snapshot function in some paths. The target workflow should distinguish navigation from document edits so Undo is not polluted by ordinary selection changes.

### 2.5 Confirmed gaps to resolve

- No unified layer×frame view of cels.
- No cel thumbnails or visual indication of allocated, blank and missing cels.
- No opacity editor, and opacity is not currently applied by the composite routine.
- No direct cel copy/paste, clear-cell action or explicit create-cel affordance.
- Current visibility/lock/active-target feedback is limited to icons and a selected-row style.
- Current frame order is stable in the model, but export tools need to consume that order and preserve explicit selected-frame order.

## 3. Recommended workspace information architecture

### 3.1 Timeline matrix

Use a single timeline matrix as the authoritative layer/frame/cel surface:

- **Top header:** ordered frame columns, frame number/name, thumbnail of the frame composite, duration and frame actions.
- **Left row header:** ordered layer rows, layer name, active/hidden/locked state, visibility, lock, opacity and layer actions.
- **Matrix body:** one cell for each visible layer/frame pair. A populated cel shows a tiny thumbnail of that layer's own pixels. Empty allocated cels show a transparent checkerboard. Unallocated cels show a clear “Add cel” affordance.
- **Active cel:** strongest selection treatment; its row and column headers also show active state.
- **Playback preview:** a separate preview marker on the currently displayed frame. It must not look like the active editing target.

The matrix is the primary way to select the editing layer/frame and navigate the project. It should replace duplicate layer/frame selection controls where possible rather than introducing two inconsistent sources of truth.

### 3.2 Canvas and inspector relationship

- Keep the canvas as the primary work surface.
- Selecting a row/cell updates the active layer/frame context and the canvas composite.
- The inspector may show properties for the active layer or frame, but it must not create an alternate order or selection state.
- Keep structural actions near the item they affect: Add Layer near row headers, Add Frame near column headers, cel actions in the selected cell context menu/toolbar.
- The timeline is collapsible for static-image work. Collapse/expand must not change layer/frame/cel state.
- The matrix must support horizontal scrolling for frames and vertical scrolling for layers. Keep frame headers and layer headers visible while scrolling through the matrix.

### 3.3 Scale and performance

At the model limits, a project can contain up to 32 × 256 = 8,192 layer/frame intersections. Do not render a large expensive artwork thumbnail for every cell on every update.

- Render only the visible matrix region or use low-cost, cached thumbnails.
- Keep row/column header interactions responsive even when the matrix is large.
- A thumbnail is derived view data, not another cel buffer and not an independently editable image.
- Invalidate only thumbnails affected by the changed cel or composite; reorder changes header positions but must not rewrite cel content.
- If virtualization is used, focus movement must scroll the target cell into view before moving DOM focus.
- A project with no allocated cel at a matrix intersection must not allocate thousands of blank arrays merely to draw the timeline.

## 4. Layer workflows

### 4.1 Select and edit a layer

- Selecting a layer row makes it the active layer for the currently active frame.
- The active layer is identified in both the row header and canvas status.
- Selection of a hidden or locked layer is allowed for inspection and property changes, but pixel-edit commands are disabled and explain why.
- At zero opacity, the layer is not visible and pixel editing is disabled with a clear explanation. Changing opacity back above zero re-enables editing only if the layer is also visible and unlocked.
- If a stroke is in progress, switching layers is rejected with a clear “finish the current stroke” message. Never switch the editing target halfway through a stroke.
- A layer switch preserves the user's selection rectangle as a geometric selection on the canvas, but the selection's pixels are read from the newly active layer. Safety checks apply to the newly active layer before any mutation.

### 4.2 Add a layer

- Add a new layer above the current active layer (topmost in the visual stack), with a unique ID and a default name such as “Layer N”.
- New layer defaults: visible, unlocked, opacity 100%.
- Create a blank cel only for the currently active frame. Other frame intersections remain unallocated until the user creates or edits them.
- Select the new layer and show an empty/transparent cel state.
- Disable Add at the 32-layer limit and explain the limit.
- Add is one undoable structural operation. Undo removes the new layer and its new cel; redo restores the same ID/order/state.

### 4.3 Rename a layer

- Rename inline in the row header or inspector; double-click may remain a convenience but must not be the only route.
- Trim surrounding whitespace; require a non-empty name; maximum 60 characters.
- Enter commits; Escape cancels; focus returns to the layer row.
- Rename does not change layer ID, cel associations, order or artwork.
- Rename is undoable as one metadata operation.

### 4.4 Reorder layers

- Drag a layer row to move it; also provide explicit Move Up/Move Down controls and keyboard alternatives.
- Display top-to-bottom order consistent with visual stacking. The bottommost layer is composited first; later/top layers cover it.
- Reordering changes only the ordered layer array. It must not rewrite, copy or delete cel buffers.
- Keep the active layer identity stable after a reorder; the highlight follows its ID.
- Reordering is undoable and must immediately update the canvas composite and export composite.
- Disable or no-op movement at the first/last boundary and announce that there is no further movement in that direction.

### 4.5 Visibility

- Visibility toggle controls whether a layer contributes to the composite; it does not delete or clear any cel data.
- Hidden layers remain in the matrix and may remain active for inspection, but pixel edits to them are denied.
- Show a persistent hidden indicator and a clear disabled-edit state when the active layer is hidden.
- Visibility changes update the canvas and frame thumbnails but do not alter cel buffers.
- Visibility changes are undoable metadata changes.
- Exported composite output omits hidden layers. A separate “export selected layer” feature is outside AC-050.

### 4.6 Lock

- Lock prevents pixel/cel mutation but does not remove the layer from the composite or prevent selection/inspection.
- Lock state is visible in the row and conveyed accessibly.
- A locked active layer shows a clear “Layer locked” message and disables edit actions. Unlocking does not itself change pixels.
- Lock/unlock is undoable metadata state.
- A lock denial must preserve cel data, selection, history and saved project state.

### 4.7 Opacity

- Expose opacity as a 0–100% slider/number control, default 100%.
- The stored model value remains normalized 0–1.
- Opacity is applied during compositing as alpha multiplication followed by source-over blending from bottom to top. Raw cel pixel colors remain unchanged.
- Opacity updates the canvas, frame thumbnails and all composite exports. It must not rewrite every cel pixel to approximate the appearance.
- Opacity 0% is treated as non-editable (in addition to being invisible) so a user cannot paint onto a visually absent layer. Values above 0% may be edited when visible and unlocked.
- Show the numeric percentage; do not rely on slider position or color alone.
- Opacity changes are undoable metadata changes. Dragging the slider should produce one history operation per completed adjustment, not dozens of separate entries.

### 4.8 Duplicate and delete a layer

**Duplicate**

- Duplicate the selected layer immediately above the source.
- Copy every existing cel buffer for that layer across all frames; preserve holes/unallocated intersections as unallocated rather than silently creating a full matrix of blank cels.
- Copy visibility and opacity; the duplicate starts unlocked.
- Give the duplicate a unique “copy” name; select the duplicate.
- Duplicate is one undoable structural transaction and must not share mutable pixel arrays with the source.

**Delete**

- Confirm with the layer name and state that all its cels will be removed; state that Undo can restore it.
- Disable Delete when only one layer remains.
- On confirmation, remove the layer and all cels associated with its ID atomically.
- Select the nearest remaining layer in the visual stack; preserve the active frame.
- Undo restores layer ID, order, metadata and every cel exactly. Redo removes the same layer/cels.
- Cancel leaves all state and focus unchanged.

## 5. Cel lifecycle and editing

### 5.1 Distinguish three cel states

The matrix must visually distinguish:

1. **Populated cel:** an allocated pixel buffer containing at least one non-null pixel.
2. **Blank cel:** an allocated, valid pixel buffer containing only transparent `null` pixels.
3. **Unallocated cel:** no cel record exists for this layer/frame pair yet.

A blank cel and a missing cel both look transparent on the canvas, but they are different project states and must not be mislabeled. A missing cel must not be treated as a malformed cel.

### 5.2 Create a cel

- Clicking an unallocated intersection shows a clear “Create blank cel” action; a plus icon alone is insufficient without an accessible name.
- Creating a cel is an explicit structural operation that allocates a correctly sized transparent buffer for the chosen layer/frame pair.
- Validate the layer/frame IDs and dimensions before allocating.
- The user may create an empty cel on a hidden or locked layer for structure, but cannot paint into it until the target is visible, unlocked and above zero opacity.
- Ordinary edit paths must not silently create a missing cel. Agent 6's AC-055 guard returns `CEL_NOT_FOUND` for an absent cel; an explicit structural create action must happen before pixel mutation.
- Creating a cel is undoable. Undo removes only the new cel; redo restores the same pair and buffer.

### 5.3 Select a cel

- Selecting a populated or blank cel sets both `activeLayerId` and `activeFrameId` to the row/column pair.
- The canvas displays the composite for the active frame, with the active layer indicated in the workspace.
- If the cel is hidden/locked/zero-opacity, it can still be selected but the canvas/status must explain why editing is unavailable.
- Selecting a cel must not mutate its pixels.
- Focus follows stable layer/frame IDs across reorders, not stale row/column indices.

### 5.4 Clear, copy and paste a cel

- **Clear Cel** sets the target cel's pixels to explicit `null` values, preserving the cel record and its layer/frame association.
- Clear Cel is distinct from Delete Cel (remove the cel record) and Clear Selection (clear only selected pixels).
- **Copy Cel** captures an immutable copy of the selected cel's full pixel buffer and source dimensions. Copy does not change project state.
- **Paste Cel** replaces the target cel's complete pixel buffer in one validated, undoable transaction. The target must pass visibility/lock/opacity/active-target and revision checks.
- Within one project, all cels share canvas dimensions; if a clipboard buffer has incompatible dimensions (for example, copied from another project), do not silently stretch or crop it. Reject with a clear message or route to a separate explicit import/resize workflow.
- Paste into an unallocated intersection first requires explicit cel creation or a single atomic “create and paste” operation that validates the target and creates the cel as part of the same transaction.
- Copy/paste must deep-copy arrays. Editing the pasted cel must never mutate the source cel.
- A failed copy/paste/clear changes no pixels, revisions, history, autosave state or export output.

### 5.5 Cel context menu and status

Recommended cel actions: Select, Create blank cel (if missing), Copy, Paste, Clear, and Delete Cel (only if a future workflow justifies removing the record). Disable actions that are not applicable and explain why.

The status/tooltip should include layer name, frame name, cel state (missing/blank/populated), visibility, lock and opacity. Do not force users to infer the target from a small highlight alone.

## 6. Frame and timeline workflows

### 6.1 Select a frame

- Selecting a frame column changes the active editing frame while keeping the active layer ID stable where possible.
- The canvas switches to the selected frame composite and updates the active cel target.
- Switching frames clears the current pixel selection geometry to prevent an old-frame selection from unexpectedly applying to a different pose. Announce the new frame and active layer.
- If the active layer/frame cel is unallocated, show the missing-cel state and require explicit cel creation before pixel mutation.
- Do not change cel pixels, frame order or frame duration when selecting a frame.
- Pure frame/layer navigation is not a content edit and should not create an undo entry. Structural changes, timing changes and cel mutations are undoable.

### 6.2 Add a blank frame

- Insert the new frame immediately after the active frame in timeline order.
- Give it a new stable frame ID and default name “Frame N”.
- Default duration inherits the active frame duration; a later global default-duration preference may override this.
- Create a blank cel for the active layer only. Other layer intersections remain unallocated until explicitly created or populated.
- Select the new frame, keep the active layer, clear selection geometry and show a blank canvas if the active cel is blank.
- Disable Add at 256 frames and explain the limit.
- Add Frame is one undoable structural transaction.

### 6.3 Duplicate a frame

- Insert the duplicate immediately after the source frame.
- Copy the source duration and name with a “copy” suffix.
- Deep-copy every allocated source cel across all layers; preserve missing cels as missing.
- Preserve layer visibility, lock and opacity metadata because those belong to layers, not frames.
- Assign a new frame ID and new cel associations; do not share mutable pixel buffers.
- Select the duplicate and keep the active layer ID.
- Duplicate Frame is one undoable transaction. A duplicated frame must look identical to the source at creation.

### 6.4 Delete a frame

- Disable Delete when only one frame remains.
- Confirm with the frame name/number and state that its cels will be removed; state that Undo can restore it.
- On confirmation, remove the frame and every cel associated with its frame ID atomically.
- If the active frame is deleted, select the frame now occupying the deleted index, or the previous last frame when deleting the final column.
- Keep active layer ID if it still exists. If its cel in the new frame is missing, show the missing-cel state.
- Undo restores frame ID, order, name, duration and all cels exactly. Redo removes the same frame/cels.

### 6.5 Reorder frames

- Drag a frame header or use explicit Move Earlier / Move Later controls and keyboard navigation.
- Reordering changes only the ordered `frames[]` list. Stable frame IDs and cel associations do not change.
- The active frame remains active by ID after reordering; focus follows the same frame.
- Frame order is the source of truth for normal playback and for “all frames” export.
- Explicit export selections may provide a custom order; the export planner must preserve the requested frame-ID sequence rather than silently sorting it. This aligns with Agent 3's AC-040 explicit ordered frame selection.
- Reordering is undoable and must update playback order and export order immediately.

### 6.6 Rename a frame and set duration

- Rename inline in the column header; require a non-empty name up to 60 characters. Enter commits; Escape cancels.
- Duration is an integer number of milliseconds from 10 to 60,000, in 10 ms steps.
- Label the duration with units; do not make users infer whether the field is FPS, seconds or milliseconds.
- Invalid duration is rejected and the last valid value remains displayed.
- Duration changes are undoable as one metadata operation; they do not alter cel pixels.
- Frame name and duration remain associated with the stable frame ID when reordering.

## 7. Playback and onion skin

### 7.1 Playback state

Expose clearly distinct states:

- **Stopped:** the selected editing frame is displayed.
- **Playing:** the preview advances through timeline order using each frame's duration override.
- **Paused:** preview is frozen at its current frame and visibly labelled as preview, not as the editing target.
- **Stopped after playback:** the selected editing frame is restored.

Use the existing Loop, Once and Ping-pong modes. Play is disabled for a single-frame project. Stop returns to the active editing frame. Pausing must not change active layer/frame selection or cel data.

While playback is playing, pixel-edit operations are disabled. A user must pause or stop before drawing. Agent API/MCP state should not silently redirect edits to the preview frame.

### 7.2 Onion skin

- Onion skin previews neighboring frame composites relative to the selected editing frame.
- Previous and next frame tints must be visually distinct and configurable in opacity.
- Onion skin is an overlay only. It never writes into a cel, undo snapshot, saved pixel buffer, PNG/GIF/sprite-sheet output or export metadata.
- Missing neighboring cels are treated as transparent contributions.
- Hidden layers are omitted from the neighboring frame composite; layer lock state does not affect display.
- Toggling onion skin is view state, not a cel edit. It must not create an undo entry.
- Playback preview and onion skin must not be combined ambiguously; during playback either suspend onion overlays or define a clear preview-specific policy.

## 8. Undo, redo, safety and revision behavior

### 8.1 History classification

**Document changes (undoable):** create/delete/duplicate/reorder/rename layer; visibility/lock/opacity changes; create/delete/clear/paste cel; create/duplicate/delete/reorder frame; rename frame; change duration; pixel edits.

**Navigation/view changes (not undoable):** select a layer, select a frame/cel, move focus, collapse timeline, scroll, expand panels, toggle playback preview, toggle onion skin.

A structural operation that also changes selection (for example, Duplicate Layer selects the copy) remains one undo step. Undo must restore the prior active target.

### 8.2 Fail-closed edit rules

The later implementation must consume Agent 6's safety contract rather than duplicate a parallel target checker.

Before any cel mutation, validate:

- Project/canvas dimensions and the selected layer/frame IDs.
- The target layer exists uniquely and is the intended active layer.
- Layer metadata is valid, visible, unlocked and opacity above zero.
- Target frame exists uniquely and is the active editing frame, not merely the playback preview.
- The cel exists and its pixel buffer has every expected own index, each explicit `null` or valid HEX.
- Optional selection bounds and project/frame/composite revisions are current.

Agent 6's AC-055 guard exposes specific denial reasons such as `LAYER_NOT_ACTIVE`, `LAYER_HIDDEN`, `LAYER_LOCKED`, `LAYER_ZERO_OPACITY`, `FRAME_NOT_ACTIVE`, `CEL_NOT_FOUND`, `CEL_INVALID` and stale revision codes. These denials must remain machine-readable and non-mutating.

Structural operations (creating a layer/frame/cel) may establish a new valid target, but pixel-edit operations may not silently create a missing cel. If creation and paste are combined, they must be one validated atomic transaction.

### 8.3 Atomicity and history

- Validate the entire operation before mutating project state.
- A failed operation leaves project data, cel buffers, revisions, history, active target, autosave state and export output unchanged.
- Undo/redo restores exact cel arrays, layer/frame IDs, order, names, visibility, lock, opacity and duration.
- A single user action is one history transaction; dragging a row or slider must not create a stack entry per pointer event.
- If autosave fails after a structural action, report the save failure; do not silently discard the edit or claim it is persisted.

## 9. Responsive behavior and empty states

### Desktop

- The layer×frame matrix is visible below the canvas and can be collapsed.
- Frame headers remain visible while scrolling down the layer rows; layer headers remain visible while scrolling horizontally through frame columns.
- Keep row labels and cel state readable without making every cell a large card.

### Tablet and phone

- Preserve the canvas as the primary work surface; timeline may open as a bottom sheet/drawer.
- Horizontal frame scrolling and vertical layer scrolling must remain independent and discoverable.
- The currently active row/column must be brought into view after selecting a frame/layer or restoring a project.
- Keep essential add/select/playback actions reachable without a desktop hover interaction.
- Do not rely on drag-and-drop as the only reorder method; explicit buttons and keyboard alternatives remain available.

### Empty and limit states

- A project always has at least one layer and one frame. The final layer/frame delete control is disabled with an explanation.
- A new project starts with one allocated blank cel.
- A new layer/new frame may have unallocated intersections; show their state rather than implying they are populated.
- A valid all-transparent cel remains allocated and distinct from a missing cel.
- Show limits for 32 layers and 256 frames before the user attempts to exceed them.
- If a frame has no visible pixels, keep its thumbnail/checkerboard and cel structure visible; do not collapse or hide it.
- If a layer is hidden, locked or zero-opacity, show a state label and keep its controls accessible.
- Empty-state copy should guide the next action (Create cel, Add layer, Add frame) rather than display a blank unexplained rectangle.

## 10. Keyboard and accessibility

The matrix is a two-dimensional interactive component and needs a deliberate keyboard model.

- Use one roving tab stop for the matrix. Arrow Left/Right moves across frames; Arrow Up/Down moves across layers.
- Enter selects the focused cel as the active layer/frame target. If the cel is missing, the focused cell offers an explicit Create Cel action before editing.
- Home/End move to the first/last frame in the current row. Focus is preserved by stable IDs after reorder.
- Tab moves out of the matrix to row/column actions and controls; it must not require tabbing through every one of the 8,192 cells.
- Layer visibility, lock, opacity, frame duration, add/duplicate/delete and playback controls are native buttons/inputs with clear accessible names.
- Row names include layer name, visibility, lock, opacity and active state. Frame headers include frame name/number, duration and active/preview state.
- Each cel has an accessible name containing layer and frame and a state description (unallocated, blank or populated).
- Screen-reader announcements are concise and throttled: announce active target changes, structural additions/deletions and operation denials, not every thumbnail refresh or timeline scroll event.
- Visible focus must remain obvious on row, column, cel and action controls. Do not rely on color alone for active, preview, hidden or locked states.
- Keyboard paths must not trigger destructive operations when focus is inside a name/duration input. Inputs retain native text editing and arrow-key behavior.
- This two-dimensional matrix changes the simpler separate Layer-list/Timeline arrow-key contexts described in AC-026; reconcile the shortcut map and tests as part of AC-054 before implementation.

## 11. Acceptance criteria

AC-050 is ready for implementation review when:

1. The matrix presents layers as rows, frames as columns and cels as intersections.
2. Top-to-bottom layer display matches bottom-to-top compositing semantics and left-to-right frame display matches playback order.
3. Populated, blank and unallocated cels are distinguishable.
4. Selecting a cel sets both active IDs and never changes its pixels.
5. Hidden, locked or zero-opacity layers can be inspected but cannot receive pixel edits.
6. Add/duplicate/delete/reorder/rename layer operations preserve stable IDs and unrelated cels.
7. Add/duplicate/delete/reorder/rename frame operations preserve stable IDs, durations and unrelated cels.
8. Duplicate frame deep-copies all existing source cels; missing cels remain missing.
9. Duplicate layer deep-copies its existing cels across frames; no mutable pixel buffers are shared.
10. Clear, copy and paste operate on a clearly identified cel and are atomic/undoable.
11. Opacity is applied to compositing and composite exports without rewriting cel pixel colors.
12. Frame order and per-frame duration are the source of truth for playback and “all frames” export; explicit export selection order is preserved.
13. Onion skin and playback preview never contaminate cel pixels or exported artwork.
14. The final layer/frame cannot be deleted; destructive confirmation and Undo restore exact structure.
15. The workflow is keyboard-operable, accessible and responsive at desktop, tablet and phone widths.
16. The project remains within the model's documented layer/frame/canvas/cel limits without eagerly allocating every possible cel.

## 12. Acceptance-test matrix

| Area | Setup / action | Expected result |
|---|---|---|
| Layer order | Create three layers and move the top layer down | UI order and composite stacking agree; cels stay attached to IDs |
| Add layer | Add at active frame | New active layer; blank cel exists for active frame; other frames remain unallocated |
| Duplicate layer | Duplicate layer with cels in several frames | All existing cels deep-copied; missing cels remain missing; duplicate unlocked |
| Delete layer | Delete a layer with multiple cels, then Undo/Redo | Entire layer/cels removed/restored atomically; neighboring active layer selected |
| Last layer | Attempt to delete only layer | Control disabled or action rejected with explanation |
| Rename layer | Empty name, whitespace, 60 chars and 61 chars | Invalid names rejected; valid name trimmed; ID/cels unchanged |
| Visibility | Hide/show a layer with non-empty cels | Composite and thumbnails update; raw pixels unchanged; hidden target denies edits |
| Lock | Lock active layer and attempt draw/paste/clear | Denial is clear and non-mutating; unlock restores editability |
| Opacity | Set 100%, 50%, 0% | Correct blended composite; raw cel pixels unchanged; 0% target non-editable |
| Frame order | Reorder frames around | IDs/cels/timing stable; playback and default export order follow new timeline order |
| Add frame | Add after middle frame | Blank frame inserted after current; duration inherited; active layer blank cel created |
| Duplicate frame | Duplicate a frame containing multiple layer cels | Frame appears adjacent; duration copied; every existing cel deep-copied; missing cels remain absent |
| Delete frame | Delete middle and final frame | Cels for deleted ID removed; nearest valid active frame selected; final frame protected |
| Frame duration | Set 10, 100, 250, 60000 and invalid values | Valid values stored in ms; invalid values rejected without losing last valid value |
| Frame rename | Rename then reorder | Name remains associated with frame ID and correct position |
| Missing cel | Select unallocated layer/frame intersection | UI shows missing state and explicit create action; edit guard denies before creation |
| Blank cel | Create an all-null cel | Matrix shows allocated transparent cel, distinct from missing |
| Copy/paste cel | Copy one cel to another layer/frame | Target matches source; source unchanged; one undo step; no shared array alias |
| Paste denied | Paste to hidden/locked/zero-opacity/stale target | Structured denial; no partial pixel write/history/save change |
| Clear Cel | Clear populated cel | Cel remains allocated and all pixels become explicit null; Undo restores exact buffer |
| Playback | Play with uneven frame durations in Loop/Once/Ping-pong | Order/timing matches timeline; preview marker distinct from editing target |
| Playback edit lock | Attempt drawing during playback | Edit blocked; no pixels or history mutated |
| Onion skin | Toggle onion while inspecting neighboring frames | Tints match neighbor composites; no cel/export pixels change |
| Export order | Reorder frames and export all; then explicit custom frame order | All-frame order follows timeline; explicit order follows selected frame IDs |
| Undo/redo | Perform each structural operation then undo/redo | Exact IDs, order, cels, metadata and active target restored |
| Accessibility | Navigate matrix and actions using keyboard and screen reader | Stable focus, clear row/column/cel names and state; no color-only cues |
| Responsive | Open matrix at desktop, tablet and phone widths | Canvas remains primary; matrix scrolls predictably; active cell remains visible |
| Limits | Attempt 33rd layer and 257th frame | Action disabled/rejected with a clear limit message; project unchanged |

### Test layers

**Pure model/transaction tests**

- Validate stable IDs and cel associations through reorder, duplicate and delete.
- Test missing versus blank cels and explicit create semantics.
- Test duplicate operations do not share mutable pixel arrays.
- Test opacity composition against known RGBA results and export composite.
- Test guards and safe transactions for hidden/locked/zero-opacity/non-active/stale/missing/invalid targets.
- Test all failure paths preserve the full input project and revision tokens.

**Browser interaction tests**

- Exercise the full matrix with pointer, keyboard, name/duration inputs and screen-reader labels.
- Verify focus after reorder, duplicate, delete, switching and undo/redo.
- Verify layer/frame operations never mutate unrelated cels.
- Verify max-count virtualization and responsive scroll behavior.

**Manual accessibility and product validation**

- Keyboard-only creation/edit/duplicate/reorder/delete workflow.
- Screen-reader inspection of the matrix, row actions, frame duration and playback states.
- Verify visible and non-color-only state cues for hidden, locked, active and preview cells.

## 13. Files, dependencies and ownership

This is a documentation task; no implementation file is changed by AC-050.

| File / area | Later implementation role | Ownership / constraint |
|---|---|---|
| `docs/ux/LAYER_TIMELINE_SPEC.md` | Canonical UX workflow and acceptance spec | Agent 5 / AC-050 |
| `js/project-model.js` | v2 layer/frame/cel document semantics | Shared project foundation; Agent 5 does not edit |
| `js/layer-edit-guard.js` | Fail-closed active target/revision/cel validation | Agent 6 / AC-055; use accepted contract, do not duplicate |
| `js/safe-edit-operations.js` | Immutable cel/structural edit transactions | Agent 6 / AC-056 |
| `js/gif-export.js`, `js/sprite-sheet-export.js`, export planner | Consume ordered frame IDs, durations and selected-frame order | Agent 3 / AC-011, AC-039–041; no edits by Agent 5 |
| `index.html` | Production layer×frame matrix, controls, thumbnails, focus and responsive behavior | Coordinator-controlled; no UI lock granted |
| Proposed focused model/browser tests | Matrix navigation, structural operations, guard/transaction and accessibility coverage | Coordinator assigns an implementation owner; avoid shared bridge E2E |

### Dependencies and coordination

- AC-050 is a specification and can proceed while Agent 6 and Agent 3's PRs are under review.
- The edit guard/transaction API should be finalized by Agent 6 before production mutation paths are wired.
- The timeline must preserve stable frame IDs and ordered frame-ID export requests accepted by Agent 3's contract.
- Any opacity feature requires a tested composite/render/export contract; the current composite does not apply opacity.
- Production integration requires a separate coordinator-issued UI lock for `index.html`.
- No changes to the project model, Agent API, bridge, exporter files, test workflow or another worker's tests are permitted in this phase.

## 14. Definition of done

AC-050 is ready for coordinator review when:

- Current v2 model and UI behavior are accurately documented.
- The layer×frame matrix, cel lifecycle, selection and active-target rules are explicit.
- Layer operations, frame operations, cel operations, playback and onion-skin semantics are fully specified.
- Opacity and the current composition gap are clearly called out.
- Agent 6's guard/transaction dependencies and Agent 3's frame-order export contract are identified.
- Undo/redo, safety, empty states, accessibility, responsive behavior and acceptance tests are included.
- Only this UX specification is delivered; no production UI or implementation is claimed.


## Post UI-01 production-source recheck — 2026-11-15

This specification was prepared before the UI-01 workstation shell was merged. The current production `index.html` blob is `4645281c1aad8580529e7feb99cd299a88543913`. UI-01 reorganized the existing controls but did not implement the proposed layer×frame matrix or change the underlying editing workflow.

- The layer list is now presented in the right inspector within the graphite workstation. Existing layer selection, add, duplicate, delete, visibility, lock and reorder commands remain the production behavior; the inspector is not a cel matrix.
- The frame strip and playback controls are positioned in the bottom timeline. Existing frame selection, add/duplicate/delete/reorder, duration, playback mode and onion-skin controls remain separate from the layer list.
- The production UI still does not expose a combined layer-row × frame-column matrix. Missing/unallocated cels are not represented as explicit matrix cells; the AC-050 matrix remains a future interaction model.
- The current rendering/adapter work does not authorize a production opacity control unless the active composition and export paths apply the same opacity semantics. Keep the current read-only/limited opacity treatment explicit.
- The merged safety modules and current ProjectModel contracts are implementation dependencies, not proof that every production mutation has been routed through guard/transaction APIs. UI-02 must verify each actual production mutation path before this spec's destructive cel operations are wired.
- The exported frame-order contract must be consumed by timeline selection and export planning; the timeline must not silently sort explicit frame-ID selections.
- The AC-091 workstation design system is the approved visual language for later production matrix controls: graphite surfaces, olive selection, amber focus, compact separators and readable 9–12 px text. The matrix must still preserve sticky layer/frame headers, internal horizontal scrolling and no body overflow at phone widths.

This is a source and module-state recheck only. No production UI changes, browser interaction tests or screen-reader tests are claimed by this specification.
