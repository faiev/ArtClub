# Export planning

`js/export-plan.js` is a pure, dependency-free preflight planner for Art Club v2 export operations. It does not encode files, mutate project state, create Blob objects, read from the DOM or call the editor/Agent API. It produces a deterministic versioned plan and JSON manifest for the existing GIF and sprite-sheet exporters.

## Browser / Node usage

Load the module or require it in Node:

```js
const Planner = window.OnePixelStudioExportPlanner;
// or: const Planner = require("./js/export-plan.js");

const project = JSON.parse(window.onePixelStudio.export_project());
const plan = Planner.buildExportPlan(project, {
  format: "gif",
  frameRange: { startIndex: 0, endIndex: 7 },
  loopCount: 0
});

const manifest = Planner.serializeExportPlan(plan);
console.log(plan.diagnostics, manifest);
```

The returned manifest is a JSON string. The planner is synchronous and completes validation, selection, layout, timing and budget calculations before any downstream encoder begins allocating export buffers.

## Shared options

| Option | Meaning |
|---|---|
| `format` | Required: `gif` or `sprite-sheet` |
| `frameIds` | Optional, non-empty unique frame IDs. Supplied order becomes export order. |
| `frameRange` | Optional inclusive, zero-based `{startIndex, endIndex}`. Mutually exclusive with `frameIds`. |
| `timingPolicy` | GIF: `nearest-centisecond`. Sprite sheet: `preserve-source-ms`. |
| `layout` | Sprite sheet only: `horizontal`, `vertical` or `grid`. |

If neither selection option is supplied, all project frames are planned in timeline order. The helper validates the v2 document shape, unique frame/layer IDs, cel references, cel dimensions, pixel values and source cel data before planning.

## GIF planning

```js
const plan = Planner.buildExportPlan(project, {
  format: "gif",
  frameIds: ["contact", "step", "idle"],
  loopCount: 3,
  maxTotalFramePixels: 1_048_576,
  maxBytes: 16 * 1024 * 1024
});
```

| Option | Default | Meaning |
|---|---:|---|
| `loopCount` | `0` | `0` = infinite loop; positive integer = finite repeat count; `null` = omit loop extension/play once |
| `maxTotalFramePixels` | 1,048,576 | Selected frames × native canvas pixels. Cannot exceed the module hard limit. |
| `maxBytes` | 16,777,216 | Encoded output byte ceiling. Cannot exceed 16 MiB. |

Each planned frame records source duration, encoded centisecond delay and effective duration rounded to the nearest 10 ms. The output section reports native dimensions, frame/pixel counts, 32-bit composed and 8-bit indexed buffer estimates, and a conservative encoded-byte upper-bound estimate. Actual LZW output depends on pixel repetition and must still be checked by the encoder against its byte ceiling.

Sprite-sheet layout options (rows, columns, margin, spacing, background and maxPixels) are rejected for GIF plans.

## Sprite-sheet planning

```js
const plan = Planner.buildExportPlan(project, {
  format: "sprite-sheet",
  frameRange: { startIndex: 0, endIndex: 5 },
  layout: "grid",
  columns: 3,
  rows: 2,
  margin: 1,
  spacing: 1,
  backgroundColor: null,
  maxPixels: 16 * 1024 * 1024
});
```

| Option | Default | Meaning |
|---|---:|---|
| `layout` | `horizontal` | Horizontal strip, vertical strip or grid |
| `columns` | Derived | Grid columns; valid only for grid layout |
| `rows` | Derived | Grid rows; valid only for grid layout |
| `margin` | `0` | Outer margin in output pixels |
| `spacing` | `0` | Gap between cells in output pixels |
| `backgroundColor` | `null` | Transparent padding or opaque #RRGGBB fill |
| `maxPixels` | 16,777,216 | Complete PNG sheet width × height; cannot exceed module hard limit |

Grid packing is deterministic. Supplying only columns derives rows; supplying only rows derives columns; supplying both fixes the grid and requires capacity for every selected frame. Unused cells remain empty (transparent unless a background color was requested). The planner returns each frame's zero-based output index, ID/name, original duration and exact top-left PNG rectangle.

The output section distinguishes total source-frame pixels from complete sheet pixels, reports output dimensions and estimates the RGBA allocation before PNG encoding. GIF-only loop and encoded-byte options are rejected for sprite-sheet plans.

## Manifest contract

`serializeExportPlan(plan)` produces JSON for the versioned `one-pixel-studio-export-plan` contract (schema version 1). Top-level fields are:

- `format`, `version`, `outputFormat`, `projectId`
- `selection`: selection mode, source range (when applicable) and ordered frame IDs
- `timing`: policy and loop semantics
- `layout`: grid/layout parameters for sprite sheets, otherwise `null`
- `output`: dimensions, frame/pixel counts, estimated buffers/bytes and applied limits
- `frames`: ordered per-frame identity, duration/timing and rectangles
- `diagnostics`: stable `code`, `severity` and human-readable message entries

Diagnostics include selection mode, GIF timing rounding and loop mode, estimated GIF size, sprite-sheet unused grid cells and RGBA buffer estimate. Consumers should use diagnostic codes for programmatic behavior and messages for display.

## Safety and limitations

- Only v2 project documents are accepted. Canvas sides are limited to 512 px; frame count to 256; layer count to 32.
- Project source cel data is limited to 16,777,216 pixels across supplied cels. Missing/sparse/undefined pixel slots, malformed colors, invalid IDs, duplicate layer/frame cels and invalid durations are rejected.
- GIF selected frame pixels are limited to 1,048,576; GIF encoded bytes are limited to 16 MiB.
- Sprite-sheet output is limited to 16,777,216 pixels and 32,767 px on either side.
- User-supplied limits may lower but cannot raise the module hard limits.
- The GIF byte figure is an estimate, not the final encoder's measured byte count. Downstream encoders must perform their own final-size validation.
- The planner does not composite cels, quantize palettes, encode GIF/PNG, trigger downloads, track progress or cancel work. It is a preflight and manifest helper, not an export encoder.
- No UI, project mutation, network call, Agent API or MCP integration is included.

## Tests

Run:

```bash
node --check js/export-plan.js
node --check tests/export-plan.test.js
node --test tests/export-plan.test.js
```

Coverage includes all-frame, inclusive-range and custom-order selection; GIF centisecond timing and loop semantics; horizontal/vertical/grid layout estimates; exact frame rectangles; diagnostics; JSON round trips; project immutability; malformed/sparse inputs; invalid cross-format options; and output budget rejection.
