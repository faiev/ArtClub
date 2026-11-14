# Art Club MCP bridge

This optional local bridge lets compatible AI agents edit the real One Pixel Studio canvas through structured MCP tools. It opens a dedicated Chromium window, loads the GitHub Pages editor, and calls the editor's documented browser Agent API.

It does **not** control your everyday Chrome profile, use screen coordinates, or run a server on the public internet.

## Requirements

- Node.js 20 or newer
- A desktop session if you want to watch the agent draw (the default)
- The ability to install Chromium through Playwright

## Install

From this directory:

```bash
npm install
npx playwright install chromium
```

## Run manually

```bash
npm start
```

The first launch opens a dedicated Chromium profile in `~/.artclub-agent-browser`. The active project library and autosaves are stored in that profile's browser storage. The MCP process stays running while the client is connected. The bridge serializes tool operations, requires a fresh document revision for writes, and reconnects its dedicated editor page after a recoverable browser-page failure. Each request has a deadline and the outstanding-operation queue is bounded.

Environment options:

- `ARTCLUB_URL`: editor URL; defaults to `https://faiev.github.io/ArtClub/`.
- `ARTCLUB_HEADLESS=1`: run Chromium without a visible window.
- `ARTCLUB_PROFILE_DIR`: choose a different persistent browser profile directory.
- `ARTCLUB_DEFAULT_TOOL_DEADLINE_MS`: default deadline for tools without a specific override (default 30,000 ms).
- `ARTCLUB_MAX_TOOL_DEADLINE_MS`: maximum configured tool deadline (default 120,000 ms).
- `ARTCLUB_MAX_PENDING_OPERATIONS`: maximum active plus queued operations (default 64).
- `ARTCLUB_MAX_TOOL_INPUT_BYTES` / `ARTCLUB_MAX_TOOL_OUTPUT_BYTES`: serialized JSON payload limits (defaults 8 MiB and 16 MiB).

`ARTCLUB_URL` must use HTTPS, except that plain HTTP is accepted for loopback development URLs (`localhost`, `127.0.0.1` or `::1`). URLs containing embedded credentials are rejected. Only point it at an Art Club deployment you trust: the bridge calls the `window.onePixelStudio` API exposed by that page, so a custom HTTPS origin is part of your local trust boundary.

## Connect an MCP client

Register the following server command in your MCP client. Use the absolute path to this repository on your machine.

Generic MCP configuration:

```json
{
  "mcpServers": {
    "artclub": {
      "command": "node",
      "args": ["/absolute/path/to/ArtClub/agent-bridge/server.mjs"]
    }
  }
}
```

Restart or reload the MCP client after adding the server. The server should expose tools with the `artclub_` prefix.

## Available tools

| Tool | Purpose |
|---|---|
| `artclub_get_status` | Read project, dimensions, palette, revision and undo state |
| `artclub_get_canvas` | Read all pixels in row-major order |
| `artclub_get_pixel` | Inspect one coordinate |
| `artclub_get_palette` | Read available colors |
| `artclub_draw_pixel` | Paint one exact grid cell |
| `artclub_draw_line` | Draw a hard-edged line |
| `artclub_draw_rectangle` | Draw outlined or filled rectangles |
| `artclub_draw_ellipse` | Draw outlined or filled ellipses |
| `artclub_fill` | Flood-fill a contiguous area |
| `artclub_erase_pixel` / `artclub_erase_rectangle` | Erase to transparency |
| `artclub_set_color` | Select or add a palette color |
| `artclub_execute` | Run up to 1,000 commands as one undo step |
| `artclub_undo` / `artclub_redo` | Restore edit history |
| `artclub_save` | Save immediately |
| `artclub_list_projects` / `artclub_open_project` | Switch local projects |
| `artclub_export_project` / `artclub_import_project` | Transfer editable project JSON |
| `artclub_export_png` | Return a PNG preview image |
| `artclub_list_layers` | Read the layer stack and active layer |
| `artclub_add_layer` / `artclub_select_layer` | Create and select layers |
| `artclub_set_layer_visibility` / `artclub_set_layer_locked` | Show/hide and protect layers |
| `artclub_rename_layer` / `artclub_move_layer` | Rename and reorder layers |
| `artclub_duplicate_layer` / `artclub_delete_layer` | Duplicate or remove layers |
| `artclub_set_selection` / `artclub_select_all` | Create a marquee selection |
| `artclub_copy_selection` / `artclub_cut_selection` / `artclub_paste_selection` | Copy, cut and paste selected pixels |
| `artclub_move_selection` / `artclub_clear_selection` / `artclub_deselect` | Move, clear or remove the selection |
| `artclub_transform_selection` | Flip horizontally/vertically or rotate 90° |
| `artclub_list_frames` | Read timeline order, names, durations and active frame |
| `artclub_add_frame` / `artclub_duplicate_frame` | Add blank frames or copy every layer cel |
| `artclub_select_frame` / `artclub_delete_frame` | Switch or delete a frame |
| `artclub_move_frame` / `artclub_set_frame_duration` | Reorder frames and set playback timing |
| `artclub_rename_frame` | Rename a frame |
| `artclub_play_animation` / `artclub_pause_animation` | Preview and pause a sprite sequence |
| `artclub_stop_animation_preview` | Return to the selected editing frame |
| `artclub_set_playback_mode` | Choose loop, once or ping-pong playback |
| `artclub_set_onion_skin` | Toggle previous/next frame guides |

## Drawing coordinates

The origin is the top-left pixel. `x` increases to the right and `y` increases downward. Coordinates are integers and refer to logical grid cells, never CSS pixels or screen coordinates. A 24×24 canvas has valid coordinates 0–23 on both axes.

Transparent cells are returned as `null`. A color is a six-digit `#RRGGBB` value.

## Revision safety and multiple agents

Every MCP tool that changes the document requires `expected_revision`. Call `artclub_get_status` immediately before editing and pass the returned `revision` with the write. Read status again after each successful write; the revision changes as the document changes.

The bridge serializes requests within one MCP server process and checks the revision in the browser immediately before the operation. When two clients send writes through the same server against one revision, only the first can proceed; later stale calls return an error asking the client to read status again. The bridge never silently retries a stale edit. This is a single-writer model for one editor session, not a distributed lock.

The bridge owns one persistent Chromium profile. Do not start two bridge processes with the same `ARTCLUB_PROFILE_DIR`; use one bridge process for one editor session. Separate profile directories are separate local project libraries, not shared concurrent workspaces. Multiple independent bridge processes do not coordinate their write queues.

If the editor tab is closed, crashes or navigates away, the next tool call attempts to reopen the editor automatically. If the browser disconnects during an operation, its outcome may be uncertain: call `artclub_get_status` before retrying so an already-completed edit is not duplicated.

Each MCP request receives a request ID and per-tool deadline. Timeout/cancellation errors carry a machine-readable code, request ID and `outcome_uncertain` flag. A request cancelled before execution is removed from the queue and never runs. When an active browser evaluation times out or is cancelled, the bridge closes the editor page to interrupt it but **does not release the serial queue slot until Playwright reports that the evaluation has unwound**. A later mutation therefore cannot overtake an operation that may already have committed. Read status and inspect the project before retrying.

The queue is bounded; a full queue rejects new work with `QUEUE_FULL` rather than growing without limit. Input and output limits are measured from their serialized JSON representation in UTF-8 bytes. During shutdown, queued requests are rejected, active work is cancelled and drained, and only then are the browser context and MCP server closed. A browser evaluation that fails to settle after page teardown can still delay shutdown; the bridge does not claim rollback for an uncertain write.

Tool-handler failures include text content and structured error details: `{ ok: false, error: { tool, name, message } }`. Invalid arguments rejected by the MCP SDK's input-schema validation may use the SDK's own error response instead.

Read-only array results are returned in object envelopes for structured MCP clients: `{ palette }`, `{ layers }` and `{ projects }`. Project JSON export returns `{ project_json }`; PNG export includes MIME type and dimensions in structured content alongside the image block.

Example batch:

```json
{
  "label": "Simple flower",
  "expected_revision": 42,
  "commands": [
    { "type": "draw_line", "x1": 11, "y1": 8, "x2": 11, "y2": 15, "color": "#53717a" },
    { "type": "draw_line", "x1": 7, "y1": 10, "x2": 11, "y2": 7, "color": "#87a7a0" },
    { "type": "draw_line", "x1": 11, "y1": 7, "x2": 15, "y2": 10, "color": "#87a7a0" },
    { "type": "draw_rectangle", "x1": 9, "y1": 3, "x2": 13, "y2": 6, "filled": true, "color": "#e96f55" },
    { "type": "draw_ellipse", "x1": 4, "y1": 4, "x2": 16, "y2": 13, "filled": false, "color": "#87a7a0" }
  ]
}
```

For safe collaborative work, call `artclub_get_status` before editing and pass its `revision` as `expected_revision`. The `42` in the sample is illustrative; always use the current revision returned by your own status read. If the human or another operation changed the canvas since that read, Art Club rejects the stale batch instead of silently overwriting the newer edit. A batch is one undoable transaction.

## Future export integration

Sprite-sheet and GIF encoders should remain standalone JavaScript modules that consume the versioned project data. Add browser Agent API methods that call those shared encoders, then expose thin MCP wrappers that return their generated output. Do not duplicate encoding or frame-processing logic inside `server.mjs`.

## Agent workflow recommendation

1. Read status and canvas.
2. Plan a small sprite in logical pixel coordinates.
3. Submit one labeled batch at a time.
4. Read back the changed canvas or request a PNG preview.
5. Correct the result with another batch.
6. Save and export the editable project when finished.

Keep batches small enough to inspect. The editor exposes multiple editable layers, rectangular selection/edit transforms and a multi-frame timeline. Agents can manage layers and frames, set selections, constrain edits, transform selected pixels and set frame timing through MCP tools. Playback, loop/once/ping-pong modes and onion skin are implemented. Sprite-sheet/GIF export and advanced onion controls remain future work.

## Privacy and permissions

- The MCP transport is **stdio**: the MCP client launches this local process. It does not open a public HTTP endpoint.
- The browser profile is dedicated to Art Club, not your main browser profile.
- The browser API exposes declared pixel/project operations only; it does not expose arbitrary JavaScript execution, shell access or general file-system access.
- Project data stays in the browser profile unless an agent exports it or the connected AI client includes tool results in a model request. Review the connected client's data policy when using hosted models.
- Only connect MCP clients you trust. A connected agent can edit, import, export and delete projects through the tools you enable.

The editor remains a static GitHub Pages app. This bridge is optional and runs only on the machine where you install it.
