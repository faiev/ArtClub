# Tile workflow integration contract

**Status:** integration-ready specification; not a production implementation. This document defines a future UI boundary for the isolated tile preview, transform, map, seam-diagnostics and atlas-layout modules. It does not authorize edits to `index.html`, production CSS/JS, renderer, exporter, project model or storage.

## 1. Goals and non-goals

A future tiled-canvas workflow may let an artist:

1. toggle a repeated preview;
2. drag or nudge the repeat offset to inspect seams;
3. paint across wrapped tile edges;
4. stamp a selected tile-map region;
5. request an atlas layout/export.

Preview rendering is a view of existing source pixels, not a new artwork layer. Preview-only actions must never write repeated copies, shifted copies, diagnostics, selection overlays or atlas padding into project cels. Only explicit editing commands may mutate artwork, through the editor's existing safe mutation and undo boundary.

This contract does not prescribe toolbar placement, colors, production components, renderer implementation, PNG encoding or storage schema.

## 2. Ownership and data flow

Keep these responsibilities separate:

- **Project cels:** canonical artwork source. Read by preview; changed only by an explicit edit transaction.
- **Tile view state:** repeat enabled, normalized integer offsets, repeat count and active tool. Ephemeral UI state; not pixel data.
- **Preview projection:** computed view over source pixels using toroidal coordinates. It is never serialized as artwork.
- **Tile-map data:** a detached row-major grid of tile IDs. Map operations return new buffers; the editor decides when and how a user commits a map edit.
- **Seam diagnostics:** read-only analysis and advisory suggestions. No auto-repair.
- **Atlas plan:** deterministic metadata rectangles from AC-064. Pixel composition/PNG encoding belongs to the exporter boundary, not this workflow contract.

Suggested flow:

`project cel → read-only repeated projection → viewport display`

`explicit wrapped paint → coordinate normalization → safe edit transaction → undoable source-cel change → refreshed projection`

`tile selection → detached map stamp → validated map result → explicit map commit`

`tile IDs + dimensions + layout options → atlas planner → metadata plan → exporter request`

## 3. Repeat-preview toggle and offsets

The repeat-preview toggle changes only view state. Turning it off restores the ordinary single-tile view without changing the source cel, project dirty state or undo stack.

Offsets are signed integer pixels. Positive X moves the visible artwork right; positive Y moves it down. Normalize coordinates with positive modulo:

`wrappedX = ((x % width) + width) % width`

`wrappedY = ((y % height) + height) % height`

For a preview sample at `(x, y)` with view offset `(offsetX, offsetY)`, read source `(x - offsetX, y - offsetY)` after modulo normalization. Use integer pixel boundaries only; do not interpolate or smooth artwork.

A drag gesture updates transient view state. Pointer movement must not draw, alter cel bytes, mark the document dirty or create undo entries. Pointer cancel, Escape or loss of pointer capture restores the offset to the drag-start value. On pointer-up, the final preview offset may be retained as view state; it still must not be written into the cel.

## 4. Painting across wrapped edges

When wrapped painting is enabled, map each intended canvas pixel to one canonical source coordinate using positive modulo. All repeated copies display the same source pixel; there is one source location, not multiple independently edited preview copies.

- Convert pointer coordinates to integer canvas pixels before modulo normalization.
- Apply the existing edit guard and safe mutation transaction before changing source pixels.
- Treat one pointer gesture as one undoable edit transaction, even when it crosses a visible repeat boundary multiple times.
- Deduplicate canonical coordinates within one gesture so repeated preview copies cannot apply the same brush sample more than once.
- Preserve exact source color/alpha values and current brush semantics; no interpolation or implicit seam repair.
- If validation or the edit guard rejects the operation, leave the source cel and undo history unchanged and report the rejection through the existing editor feedback path.
- Diagnostics may be refreshed after the edit, but must remain read-only.

## 5. Tile-map stamping

A stamp is a detached rectangular selection with explicit width, height and row-major tile IDs. Before a stamp is committed, validate dimensions, buffer length, tile references and destination bounds. A rejected stamp has no side effects.

The stamp operation returns a new map buffer. It does not mutate the source map, tile catalog or artwork pixels. A future UI should show the target footprint as an overlay, provide an explicit commit/cancel boundary, and route an accepted map change through the editor's normal safe mutation/undo mechanism. Null map cells remain empty; missing tile IDs are errors, not implicit replacements.

## 6. Atlas layout and export request

The atlas planner consumes stable tile IDs, shared tile dimensions and integer layout options (columns, margins, spacing and padding). It returns immutable metadata: atlas bounds and per-tile cell and artwork rectangles. The plan is deterministic for the same IDs and options.

The UI may present a plan preview and send the plan plus canonical source tiles to the existing exporter interface. It must not treat the repeated preview buffer, selection overlay, seam report or atlas-plan rectangles as image pixels. PNG encoding, transparency handling in encoded output, file naming and download behavior remain exporter responsibilities. Planner validation failure must be shown before export starts; no partial project mutation is permitted.

## 7. Input and interaction test matrix

The following is an acceptance matrix for a future UI implementation. It is not evidence that the interactions already exist.

| Area | Input | Expected behavior | Required assertion |
|---|---|---|---|
| Repeat preview | Toggle on/off | Repeated projection appears/disappears | Source cel bytes, dirty state and undo depth remain unchanged |
| Offset drag | Pointer down, move, up | Preview offset follows integer pointer delta | No cel writes or undo entries during drag or on release |
| Offset cancel | Escape, pointer cancel or lost capture | Offset returns to drag-start state | No mutation and no stuck drag state |
| Offset nudge | Arrow keys while preview focused | Offset changes by exactly one pixel per key | Positive X/Y moves visible art right/down; values remain integers |
| Negative wrap | Nudge/drag past top or left boundary | Offset wraps deterministically | Coordinates normalize to `[0, dimension)` |
| Wrapped painting | Brush stroke crosses right/left edge | Canonical source edge pixels update and all repeated copies match | One safe transaction; one undo restores exact prior bytes |
| Wrapped corner | Brush stroke crosses both axes near a corner | Four-way preview junction maps to one canonical source region | No duplicate application to the same canonical pixel |
| Edit rejection | Locked layer, invalid target or guard denial | Stroke is rejected without partial changes | Source bytes, dirty state and undo history unchanged |
| Seam diagnostics | Request report | Mismatches/suggestions are displayed read-only | Report generation does not mutate source pixels |
| Map stamp preview | Move selection over map | Detached stamp footprint follows integer cells | Source map remains unchanged before commit |
| Map stamp commit | Confirm valid stamp | New row-major map replaces old state through safe edit boundary | Undo restores old map exactly |
| Map stamp cancel | Escape/cancel | Preview disappears | Source map and project dirty state unchanged |
| Invalid stamp | Missing tile ID or out-of-bounds footprint | Commit is refused with actionable feedback | No partial map writes |
| Atlas plan | Change columns/margins/spacing/padding | Metadata preview recomputes deterministically | Tile rectangles are integer, bounded and non-overlapping by construction |
| Atlas export | Request export from valid plan | Existing exporter receives canonical source and plan metadata | No preview pixels or overlay pixels enter exported artwork |
| Keyboard access | Tab, Enter/Space, Escape and arrow keys | Every operation is reachable and cancellable without a pointer | Focus remains visible; shortcuts do not trigger while typing in text fields |
| High zoom | Paint/drag at integer and fractional CSS positions | Input snaps to intended integer canvas pixel | No fractional artwork coordinates or smoothing |

## 8. Failure handling and invariants

- Validate all dimensions, buffers, IDs and bounds before mutation.
- Keep repeat offsets and paint coordinates integer-valued.
- Treat view-state changes separately from project edit transactions.
- Never silently repair seams, replace missing tile IDs, clip stamps or discard invalid cells.
- A failure leaves the pre-operation project state unchanged.
- Undo/redo operates on committed artwork/map commands, not ephemeral preview movement.
- Tests must inspect exact pixel/map buffers and dirty/undo state; screenshots alone are not sufficient evidence.

## 9. Integration gate

This document is an interface contract only. Production integration requires a separate coordinator-issued ownership/lock for UI and renderer files, agreement on the existing safe-edit transaction entry point, and browser tests that prove both the visible interactions and the no-preview-write invariants. Until then, the tile modules and this contract remain isolated, local-first utilities.
