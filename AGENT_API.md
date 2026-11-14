# One Pixel Studio Agent API

The browser editor exposes a small, versioned API for drawing agents and browser automation.

## Connect

After the page loads, wait for the app to finish restoring its project:

```js
await window.OnePixelStudioReady;
const studio = window.onePixelStudio;
```

This API is page-scoped. It is not an unauthenticated HTTP endpoint and is not available to an unrelated website through normal browser origin boundaries. A browser automation tool such as Playwright can call it with `page.evaluate`; the optional local MCP bridge in `agent-bridge/` does that for MCP clients.

## Coordinate system

- Origin: top-left.
- `x` increases to the right; `y` increases downward.
- Coordinates are zero-based integer **canvas pixels**, not CSS or screen coordinates.
- Pixel arrays are flat and row-major: index = `y * width + x`.
- `null` represents transparency; opaque colors use `#RRGGBB`.

## Read operations

```js
const status = studio.get_status();
const canvas = studio.get_canvas(); // { width, height, pixels, revision, ... }
const pixel = studio.get_pixel({ x: 4, y: 7 });
const palette = studio.get_palette();
const projects = await studio.list_projects();
```

`get_canvas({ include_pixels: false })` returns metadata without the pixel array. The status includes a monotonically increasing `revision`, undo/redo availability and whether a human pointer stroke is in progress.

## MCP protocol and capability discovery

The browser Agent API reports `protocol` and `protocol_version` in status. The local MCP bridge also provides `artclub_get_capabilities`, a versioned machine-readable contract covering supported client protocol versions, read-only/document/session/storage tool classes, revision requirements, maximum canvas/project/batch sizes, configured tool deadlines, cancellation semantics and available exports/diagnostics.

Clients should query capabilities before using optional tools and pass their protocol version as `client_protocol_version`. A mismatch returns `PROTOCOL_VERSION_UNSUPPORTED` with an actionable compatibility message. Protocol version 1 is currently supported.

A stale document write returns the stable error code `STALE_REVISION`. Re-read status, inspect the current project and make a new decision; the bridge never replays a conflicting operation automatically. The capability document distinguishes document writes from session controls and local-library persistence, so clients must not assume every mutating tool has the same revision requirement.

## Revision and concurrency safety

Every state-changing MCP tool requires an `expected_revision` value. Read `get_status` immediately before an edit and pass its `revision`:

```js
let status = studio.get_status();
await studio.draw_pixel({
  x: 4, y: 7,
  color: "#e96f55",
  expected_revision: status.revision
});
status = studio.get_status(); // use the new revision for the next edit
```

The direct browser API keeps `expected_revision` optional for backward compatibility, but omitting it removes stale-write protection. The local MCP bridge requires it for every document-changing tool, including layer, selection, frame, undo/redo and project-switch operations.

The bridge acquires an exclusive filesystem lock for the canonical browser profile before launching Chromium. A second process using the same `ARTCLUB_PROFILE_DIR` is refused, preventing independent process-local queues from mutating the same IndexedDB project library. If a same-host lock belongs to a dead PID, startup fails with `STALE_PROFILE_LOCK`; an operator must first verify the old process is gone, then run `node agent-bridge/server.mjs --recover-stale-profile-lock` with the same `ARTCLUB_PROFILE_DIR` environment value, if configured. Foreign-host, malformed, symlink and abandoned-recovery-marker cases fail closed and require manual inspection; the bridge does not guess that an owner is dead.

Within one bridge process, calls are also serialized. If two clients send edits through that same server using the same revision, the first accepted edit advances the document revision and the later stale edit is rejected. The rejected client must read the new status, inspect the current artwork and decide whether its planned change is still appropriate; the bridge does not automatically replay edits.

MCP tool inputs use strict object schemas. Unknown top-level fields and unknown fields inside drawing batch commands are rejected. Batch command types are discriminated and each has a bounded field set; selection dimensions/offsets, IDs, names, batch counts and serialized UTF-8 input/output bytes are bounded. Imported project JSON is checked for valid syntax and an object root before the browser model validates the full document before persistence or replacement.

Tool-handler failures return text and structured content with a stable code, request ID and `outcome_uncertain` flag. Error messages are sanitized, capped and redacted for local filesystem paths and URLs. Input-schema failures may be rejected by the MCP SDK before the handler runs, so their error shape is SDK-controlled.

Each MCP request has a request ID, a per-tool deadline and cancellation support from the MCP request signal. Timeout/cancellation errors include a machine-readable code and an `outcome_uncertain` flag. Work cancelled while still queued is removed and never runs. For an active browser evaluation, the bridge closes the editor page to interrupt it and keeps the serial queue slot occupied until Playwright confirms the evaluation has unwound; later operations cannot overtake a potentially committed mutation. Clients must call `get_status` and inspect the project before deciding whether to retry.

The outstanding-operation queue is bounded. Serialized JSON input and output are limited by configurable UTF-8 byte caps. During graceful shutdown, the bridge rejects queued calls, aborts and drains active work, closes the browser context, releases its profile lock and closes the MCP stdio handle. A page evaluation that does not settle after page teardown can still delay final shutdown; the bridge does not claim to roll back an in-flight mutation.

## Drawing operations

```js
const status = studio.get_status();

await studio.draw_pixel({
  x: 4, y: 7, color: "#e96f55",
  expected_revision: status.revision
});

await studio.draw_line({
  x1: 2, y1: 2, x2: 9, y2: 2,
  color: "#ffffff",
  expected_revision: studio.get_status().revision
});

await studio.draw_rectangle({
  x1: 3, y1: 4, x2: 10, y2: 12,
  color: "#53717a", filled: true,
  expected_revision: studio.get_status().revision
});

await studio.draw_ellipse({
  x1: 5, y1: 5, x2: 13, y2: 12,
  color: "#87a7a0", filled: false,
  expected_revision: studio.get_status().revision
});

await studio.fill({
  x: 0, y: 0, color: "#172b3a",
  expected_revision: studio.get_status().revision
});
await studio.erase_pixel({
  x: 4, y: 7,
  expected_revision: studio.get_status().revision
});
await studio.erase_rectangle({
  x1: 2, y1: 2, x2: 5, y2: 5,
  expected_revision: studio.get_status().revision
});
await studio.set_color({
  color: "#ffcc66",
  expected_revision: studio.get_status().revision
});
```

All drawing commands use the same pixel buffer as the on-screen editor. They therefore appear immediately in the canvas and participate in its undo/redo and autosave workflow.

## Layer operations

Agents can also organize their work into editable layers. The status response returns the layer IDs, names, visibility, lock state and active layer.

```js
let status = studio.get_status();
const baseLayerId = status.active_layer.id;

status = await studio.add_layer({ name: "Highlights", expected_revision: status.revision });
const highlightLayerId = status.active_layer.id;

await studio.draw_pixel({
  x: 8, y: 8, color: "#f5c66d",
  expected_revision: studio.get_status().revision
});

status = await studio.select_layer({ layer_id: baseLayerId, expected_revision: status.revision });
await studio.draw_line({
  x1: 5, y1: 5, x2: 12, y2: 5, color: "#172b3a",
  expected_revision: studio.get_status().revision
});

// Read the visible result after all visible layers are composited.
const visiblePixel = studio.get_pixel({ x: 8, y: 8 });

await studio.set_layer_visibility({
  layer_id: highlightLayerId, visible: false,
  expected_revision: studio.get_status().revision
});
await studio.set_layer_locked({
  layer_id: baseLayerId, locked: true,
  expected_revision: studio.get_status().revision
});
await studio.rename_layer({
  layer_id: highlightLayerId, name: "Warm highlights",
  expected_revision: studio.get_status().revision
});
await studio.move_layer({
  layer_id: highlightLayerId, direction: "down",
  expected_revision: studio.get_status().revision
});
```

Available layer methods: `list_layers`, `add_layer`, `select_layer`, `set_layer_visibility`, `set_layer_locked`, `rename_layer`, `move_layer`, `duplicate_layer` and `delete_layer`.

The layer panel and agent API share one project stack. Drawing commands target the active visible, unlocked layer. Pixel and canvas read operations return the composite of visible layers. Layer actions participate in undo/redo and autosave; pass `expected_revision` when you need stale-write protection. Deleting the final remaining layer is rejected.

## Rectangular selection and transforms

Selections use canvas-pixel coordinates and apply to the active layer. The selection border is an editor overlay; it is not part of the pixel data or exported image.

```js
let status = studio.get_status();
status = await studio.set_selection({
  x: 5, y: 4, width: 8, height: 6,
  expected_revision: status.revision
});

// Copy/cut/paste are local editor clipboard operations.
await studio.copy_selection({ expected_revision: studio.get_status().revision });
await studio.cut_selection({ expected_revision: studio.get_status().revision });
await studio.paste_selection({ expected_revision: studio.get_status().revision });

// Pixel edits and fills are constrained to the selected rectangle.
await studio.draw_pixel({
  x: 6, y: 5, color: "#f5c66d",
  expected_revision: studio.get_status().revision
});
await studio.move_selection({
  dx: 2, dy: 0,
  expected_revision: studio.get_status().revision
});

// Exact transforms of the selected active-layer pixels.
await studio.transform_selection({
  operation: "flip_h",
  expected_revision: studio.get_status().revision
});
await studio.transform_selection({
  operation: "flip_v",
  expected_revision: studio.get_status().revision
});
await studio.transform_selection({
  operation: "rotate_cw",
  expected_revision: studio.get_status().revision
});
// or "rotate_ccw"

await studio.clear_selection({ expected_revision: studio.get_status().revision });
await studio.deselect({ expected_revision: studio.get_status().revision });
```

Available selection methods: `set_selection`, `select_all`, `copy_selection`, `cut_selection`, `paste_selection`, `clear_selection`, `deselect`, `move_selection` and `transform_selection`.

The rectangle must be a positive integer size fully inside the canvas. A quarter-turn swaps selection width and height; the API rejects the operation if the rotated rectangle would extend beyond the canvas. Selection changes increment the document revision so agents can reject stale operations. The clipboard is local to the open editor page and is not stored in the project file.

## Animation frames and timing

Each frame has its own cel for every layer. Switching frames preserves the other frames, and all visible layers are composited for the active frame.

```js
const status = studio.get_status();
const originalFrameId = status.active_frame.id;

const added = await studio.add_frame({
  name: "Walk 2",
  duration_ms: 120,
  expected_revision: status.revision
});
const walkFrameId = added.active_frame.id;

await studio.draw_pixel({
  x: 8, y: 8, color: "#f5c66d",
  expected_revision: studio.get_status().revision
});

await studio.select_frame({
  frame_id: originalFrameId,
  expected_revision: studio.get_status().revision
});
await studio.select_frame({
  frame_id: walkFrameId,
  expected_revision: studio.get_status().revision
});

// Duplicate the frame and all of its layer cels.
const copy = await studio.duplicate_frame({
  frame_id: walkFrameId,
  name: "Walk 2 copy",
  expected_revision: studio.get_status().revision
});

await studio.set_frame_duration({
  frame_id: copy.active_frame.id,
  duration_ms: 180,
  expected_revision: studio.get_status().revision
});
await studio.rename_frame({
  frame_id: copy.active_frame.id,
  name: "Walk 2 contact pose",
  expected_revision: studio.get_status().revision
});
await studio.move_frame({
  frame_id: copy.active_frame.id,
  direction: "up",
  expected_revision: studio.get_status().revision
});
await studio.delete_frame({
  frame_id: copy.active_frame.id,
  expected_revision: studio.get_status().revision
});

const frames = studio.list_frames();
```

Frame methods: `list_frames`, `add_frame`, `duplicate_frame`, `select_frame`, `delete_frame`, `move_frame`, `set_frame_duration` and `rename_frame`. Durations are integer milliseconds from 10 to 60,000. A project must retain at least one frame. Frame switching and frame edits participate in undo/redo, autosave and revision protection.

## Playback preview and onion skin

Agents can preview a multi-frame sequence without changing the selected editing frame.

```js
await studio.set_playback_mode({ mode: "pingpong" }); // "loop", "once" or "pingpong"
await studio.set_onion_skin({ enabled: true });

const playing = await studio.play();
console.log(playing.playback);
// { playing: true, previewing: true, preview_frame_id, mode, onion_skin }

await studio.pause();          // keep the preview frame visible
await studio.stop_playback();  // return to the selected editing frame
```

The editor also exposes MCP tools `artclub_play_animation`, `artclub_pause_animation`, `artclub_stop_animation_preview`, `artclub_set_playback_mode` and `artclub_set_onion_skin`.

While playback is running, drawing and structural edit commands are rejected. Once paused, an edit safely returns to the selected editing frame first. `get_status`, `get_canvas` and `get_pixel` continue to report the selected editing frame, not a transient preview frame. Onion-skin overlays are tinted visual guides only; they never change cel pixels or exports.

**Still outstanding:** adjustable onion-skin opacity/range, frame thumbnails, sprite-sheet export, PNG sequences and animated GIF export.

## Batches and transactions

For sprite construction, batch related operations so the artist can undo the whole pass:

```js
const before = studio.get_status();
const result = await studio.execute({
  label: "Sprite outline",
  expected_revision: before.revision,
  commands: [
    { type: "draw_line", x1: 8, y1: 4, x2: 15, y2: 4, color: "#172b3a" },
    { type: "draw_line", x1: 7, y1: 5, x2: 7, y2: 12, color: "#172b3a" },
    { type: "draw_line", x1: 16, y1: 5, x2: 16, y2: 12, color: "#172b3a" },
    { type: "draw_line", x1: 8, y1: 13, x2: 15, y2: 13, color: "#172b3a" }
  ]
});
```

Supported command types: `draw_pixel`, `erase_pixel`, `draw_line`, `draw_rectangle`, `draw_ellipse`, `erase_rectangle`, `fill`, `clear_canvas`, and `set_color`.

Safety rules:
- One batch contains at most 1,000 commands.
- Canvas dimensions are checked against the project model's 512-pixel maximum.
- Coordinates outside the canvas and malformed colors are rejected before the batch starts.
- A batch is one undo step.
- `expected_revision` rejects stale edits when the human or another agent has changed the document since the last read.
- Agent edits are rejected while a human pointer stroke is in progress.
- The API exposes explicit drawing and project operations; it does not expose `eval`, arbitrary JavaScript, shell commands or file-system access.

## History, projects and export

```js
let historyStatus = studio.get_status();
studio.undo({ expected_revision: historyStatus.revision });
historyStatus = studio.get_status();
studio.redo({ expected_revision: historyStatus.revision });
await studio.save();

const projectJson = studio.export_project();
const beforeImport = studio.get_status();
await studio.import_project({
  project_json: projectJson,
  expected_revision: beforeImport.revision
});

const savedProjects = await studio.list_projects();
await studio.open_project({
  project_id: savedProjects[0].id,
  expected_revision: studio.get_status().revision
});

const png = await studio.export_png();
// { mime_type, width, height, data_base64 }
```

The project library uses browser-local IndexedDB. JSON export is the portable backup. PNG preview export returns base64 data for an agent to inspect.

## Future animation-export integration

Keep sprite-sheet and GIF encoders in standalone JavaScript modules that accept the versioned project document (or a validated project object) and return export bytes plus metadata. The browser UI and Agent API should call those same modules; the MCP bridge should expose thin wrappers around Agent API methods and return the bytes as image/resource content. Do not reimplement palette quantization, frame timing, transparency or encoding in the MCP server. This keeps one encoder implementation and avoids coupling the encoder to DOM state or MCP transport.

## Current limits

The editor exposes editable layers, rectangular selection/transforms and a multi-frame timeline. Frame-aware agent commands edit the active frame's cel; real-time playback and onion skin are available. Sprite-sheet and animated GIF export are not yet exposed through the Agent API or MCP bridge.
