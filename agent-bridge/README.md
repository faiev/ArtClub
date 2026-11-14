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

The first launch opens a dedicated Chromium profile in `~/.artclub-agent-browser`. The active project library and autosaves are stored in that profile's browser storage. The MCP process stays running while the client is connected.

Environment options:

- `ARTCLUB_URL`: editor URL; defaults to `https://faiev.github.io/ArtClub/`.
- `ARTCLUB_HEADLESS=1`: run Chromium without a visible window.
- `ARTCLUB_PROFILE_DIR`: choose a different persistent browser profile directory.

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

Example batch:

```json
{
  "label": "Simple flower",
  "commands": [
    { "type": "draw_line", "x1": 11, "y1": 8, "x2": 11, "y2": 15, "color": "#53717a" },
    { "type": "draw_line", "x1": 7, "y1": 10, "x2": 11, "y2": 7, "color": "#87a7a0" },
    { "type": "draw_line", "x1": 11, "y1": 7, "x2": 15, "y2": 10, "color": "#87a7a0" },
    { "type": "draw_rectangle", "x1": 9, "y1": 3, "x2": 13, "y2": 6, "filled": true, "color": "#e96f55" },
    { "type": "draw_ellipse", "x1": 4, "y1": 4, "x2": 16, "y2": 13, "filled": false, "color": "#87a7a0" }
  ]
}
```

For safe collaborative work, call `artclub_get_status` before editing and pass its `revision` as `expected_revision`. If the human or another operation changed the canvas since that read, Art Club rejects the stale batch instead of silently overwriting the newer edit. A batch is one undoable transaction.

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
