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

## Drawing operations

```js
const status = studio.get_status();

await studio.draw_pixel({
  x: 4, y: 7, color: "#e96f55",
  expected_revision: status.revision
});

await studio.draw_line({
  x1: 2, y1: 2, x2: 9, y2: 2,
  color: "#ffffff"
});

await studio.draw_rectangle({
  x1: 3, y1: 4, x2: 10, y2: 12,
  color: "#53717a", filled: true
});

await studio.fill({ x: 0, y: 0, color: "#172b3a" });
await studio.erase_pixel({ x: 4, y: 7 });
await studio.erase_rectangle({ x1: 2, y1: 2, x2: 5, y2: 5 });
await studio.set_color({ color: "#ffcc66" });
```

All drawing commands use the same pixel buffer as the on-screen editor. They therefore appear immediately in the canvas and participate in its undo/redo and autosave workflow.

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

Supported command types: `draw_pixel`, `erase_pixel`, `draw_line`, `draw_rectangle`, `erase_rectangle`, `fill`, `clear_canvas`, and `set_color`.

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
studio.undo();
studio.redo();
await studio.save();

const projectJson = studio.export_project();
await studio.import_project({ project_json: projectJson });

const savedProjects = await studio.list_projects();
await studio.open_project({ project_id: savedProjects[0].id });

const png = await studio.export_png();
// { mime_type, width, height, data_base64 }
```

The project library uses browser-local IndexedDB. JSON export is the portable backup. PNG preview export returns base64 data for an agent to inspect.

## Current limits

The current editor UI still exposes one editable layer and one frame. The project schema can store multiple layers and frames, but layer and timeline editing are not yet implemented. Agent commands currently target the visible active canvas cel. The drawing API will be extended as those editing features become real UI capabilities.
