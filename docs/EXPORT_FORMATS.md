# Animation export formats

Art Club keeps editable animation in its version 2 project document. Export files are derived outputs: a sprite-sheet PNG preserves source pixels, its JSON companion maps source frames into the atlas, and animated GIF trades timing precision and color range for a widely supported animation file.

This guide covers both the file formats and the standalone JavaScript exporters. The exporters are not wired into the production editor's download controls; UI/API integration remains a separate coordinator-owned task.

## At a glance

| Format | What it contains | Fidelity / trade-offs |
|---|---|---|
| v2 project JSON | Canvas, palette, layers, frames, durations and cels | Editable source of truth; retains frame/cel relationships |
| Sprite-sheet PNG | One lossless RGBA image containing frame rectangles | Exact RGB values and transparency; no scaling or interpolation |
| Sprite-sheet metadata JSON | Versioned layout plus source frame identity, timing and output rectangles | Plain JSON; needed to recover frame-to-rectangle mapping and source durations |
| Animated GIF | A timed sequence of indexed-color frames | 10 ms timing units; binary transparency; palette quantization can change colors |

Prefer PNG plus JSON when exact colors, transparent gutters, custom frame rectangles or original millisecond timing matter. Prefer GIF when a single self-contained animated preview is more useful than a companion atlas and metadata file.

## Shared project input

The JavaScript exporters accept a version 2 One Pixel Studio project snapshot:

- \`format\` is \`one-pixel-studio\` and \`version\` is \`2\`.
- Canvas width and height are integers from 1 through 512.
- Frame IDs and layer IDs are present and unique.
- Every frame has a non-empty name and an integer duration from 10 through 60,000 ms.
- Each cel references an existing layer and frame and contains exactly width × height entries.
- Every source pixel is either \`null\` (transparent) or an opaque \`#RRGGBB\` string.

An absent cel and an all-null cel both export as transparent pixels. A missing or malformed array entry is not transparency: sparse arrays and \`undefined\` pixel values are invalid. The exporters do not modify the source project.

By default, only visible layers are composited, in document bottom-to-top order. An explicit layer selection can include hidden layers. An explicit \`frameIds\` array determines output order and must contain valid, unique frame IDs.

## Sprite-sheet PNG and atlas JSON

The sprite-sheet exporter builds an RGBA buffer at native source dimensions, then writes it to a PNG canvas with ImageData and \`putImageData\`. It does not scale, smooth, interpolate or remap palette colors. Opaque source RGB bytes are preserved exactly; \`null\` pixels have alpha 0.

Supported layouts are horizontal, vertical and grid. A grid may use a fixed number of columns, a fixed number of rows, or both. When only one is supplied, the other is derived. When both are supplied, their cell capacity must fit every selected frame. Margins, spacing and unused cells are part of the output canvas. Unless \`backgroundColor\` is supplied, unused cells, gutters and margins remain transparent.

For frame width \(W\), frame height \(H\), \(C\) columns, \(R\) rows, outer margin \(M\), and inter-cell spacing \(S\):

\`\`\`text
sheetWidth  = 2 × M + C × W + max(0, C − 1) × S
sheetHeight = 2 × M + R × H + max(0, R − 1) × S
\`\`\`

Metadata schema \`one-pixel-studio-sprite-sheet\`, version 1, records:
- Output image filename and dimensions.
- Source frame width and height.
- Layout type, row/column count, margin and spacing.
- Frame count and ordered frame records containing output index, source frame ID/name, exact integer \`x\`/\`y\`/\`width\`/\`height\` rectangle and original \`durationMs\`.

The order of the \`frames\` array is the requested export order, not necessarily source timeline order. Keep metadata beside its PNG; pixels alone do not encode frame names, IDs, durations or rectangle semantics. The sidecar is ordinary JSON and survives a JSON stringify/parse round trip without changing its schema.

## Animated GIF timing, palette and transparency

The GIF exporter writes GIF89a at project canvas dimensions. It supports timeline order or explicit frame ID order, infinite looping by default, a finite repeat count, or no looping extension for play-once output.

GIF frame delays use centisecond units (10 ms). The encoder rounds source durations to the nearest centisecond and enforces a 10 ms minimum. Frame metadata preserves both the original \`durationMs\` and the encoded \`encodedDelayCentiseconds\` / \`effectiveDurationMs\` values.

| Source duration | Encoded delay | Effective GIF duration |
|---:|---:|---:|
| 100 ms | 10 cs | 100 ms |
| 145 ms | 15 cs | 150 ms |
| 155 ms | 16 cs | 160 ms |

A duration such as 145 ms cannot be represented exactly by GIF. Keep the source project or PNG atlas metadata when original timing values matter.

GIF has at most 256 palette entries. If selected frames contain no transparency, up to 256 distinct opaque RGB colors can be represented exactly. If transparency is present, one palette entry is reserved for it, leaving up to 255 opaque colors.

When selected colors exceed that capacity, the encoder builds a 5-bit-per-channel RGB histogram, applies weighted median-cut, then maps each original RGB value to its nearest palette entry by squared RGB distance. A bounded cache and k-d tree accelerate repeated lookups. Dithering is not applied, so palette overflow can change source colors; returned diagnostics identify exact versus median-cut mode.

The project model supports opaque RGB pixels or \`null\`, not partial alpha. GIF transparency is binary. If any selected pixel is transparent, the encoder reserves one transparent palette index and uses disposal-to-background so transparent pixels do not reveal stale pixels from a preceding frame. PNG remains preferable for full per-pixel alpha and exact transparent gutters.

The \`loopCount\` option controls looping: \`0\` means infinite looping, a positive integer means that many repeats, and \`null\` omits the looping extension (play once).

## Tiny Robot visual gallery

The synthetic [Tiny Robot walk-cycle gallery](../examples/exports/index.html) includes an original 8×8 four-frame source project and small sample exports. The [PNG atlas](../examples/exports/walk-cycle.png) is 19×19 pixels: four 8×8 frames, two columns by two rows, with a 1 px outer margin and 1 px spacing. Its [JSON metadata](../examples/exports/walk-cycle.metadata.json) records each rectangle and source duration.

The [animated GIF](../examples/exports/walk-cycle.gif) loops four frames. The source durations 145 ms and 155 ms are represented as 150 ms and 160 ms. The companion [GIF metadata](../examples/exports/walk-cycle.gif.metadata.json) keeps source and effective encoded durations visible.

The checked-in GIF is a format illustration generated independently from the synthetic project pixels. It demonstrates timing, transparency and disposal behavior; it is not claimed to be byte-identical to the Art Club GIF89a encoder output. The project exporter itself is tested separately by the Node and Chromium checks described below.

To regenerate the Tiny Robot PNG/GIF examples and metadata, install the optional Pillow authoring dependency and run:

\`\`\`bash
python3 -m pip install Pillow
python3 examples/exports/generate_examples.py
\`\`\`

Pillow is only for rebuilding this documentation gallery. The application exporters remain dependency-free JavaScript.

## Minimal exporter-generated fixture

A second, deliberately tiny two-frame 2×2 fixture under \`examples/export/\` is exercised by the actual JavaScript exporters, rather than by an independent image generator:

- \`walk-cycle-v2.json\` — v2 source project with transparent and opaque pixels.
- \`expected-atlas-metadata.json\` — expected metadata for a reordered 7×4 grid atlas.
- \`expected-gif-timing.json\` — expected source/effective GIF timing, loop and transparency diagnostics.

Run the fixture-to-export regression test:

\`\`\`bash
node --test tests/export-format-examples.test.js
\`\`\`

It invokes \`Sprite.buildSpriteSheet\` and \`GIF.encodeGIF\`, checks exact atlas metadata and selected RGBA pixel bytes, verifies transparent margin/gutter pixels and confirms the source project is unchanged. It also checks GIF frame order/timing, loop behavior and transparency diagnostics against the expected JSON.

For a browser-console demonstration, serve the repository root with \`python3 -m http.server 8080\`, open \`http://127.0.0.1:8080/\`, load \`js/gif-export.js\` and \`js/sprite-sheet-export.js\`, then:

\`\`\`js
const project = await fetch("/examples/export/walk-cycle-v2.json").then(r => r.json());

const atlas = window.ArtClubSpriteSheetExporter.exportSpriteSheet(project, {
  frameIds: ["contact", "idle"],
  layout: "grid",
  columns: 2,
  margin: 1,
  spacing: 1,
  imageFilename: "walk-cycle-atlas.png"
});

const gif = window.ArtClubGIFExporter.exportGIF(project, {
  frameIds: ["idle", "contact"],
  loopCount: 0
});
\`\`\`

The returned objects contain the PNG/GIF Blobs and metadata. The normal editor UI does not currently expose these exporter modules as download controls.

## Output limits and validation

The current project/export contract includes these upper bounds:

- Project source canvas: at most 512×512; at most 256 frames.
- GIF: at most 32 layers, 1,048,576 selected frame pixels and 16 MiB encoded output. Source cel data has a separate bounded limit.
- Sprite sheet: at most 16,777,216 output pixels and 32,767 pixels per side.
- Per-export limits can lower, but cannot raise, the module's hard limits.
- Sparse/undefined pixel entries and malformed frame/cel/metadata structures are rejected rather than silently interpreted as transparent.

Run the focused exporter, compatibility and gallery tests:

\`\`\`bash
node --test tests/gif-export.test.js tests/sprite-sheet-export.test.js \\
  tests/export-compatibility.test.js tests/export-gallery.test.js \\
  tests/export-format-examples.test.js
\`\`\`

Run the independent Chromium decoders after installing the repository's existing Playwright dependency:

\`\`\`bash
cd agent-bridge && npm install --ignore-scripts && cd ..
node tests/gif-export.browser.mjs
node tests/sprite-sheet-export.browser.mjs
\`\`\`

The GIF runner uses Chromium \`ImageDecoder\`; the PNG runner uses Chromium \`createImageBitmap\` and \`OffscreenCanvas\`. They decode actual exported files independently of the encoders' own writers.

Optional command-line inspection, when the tools are installed:

\`\`\`bash
file examples/exports/walk-cycle.project.json \\
  examples/exports/walk-cycle.png examples/exports/walk-cycle.gif
jq '.frames[] | {id, name, durationMs}' examples/exports/walk-cycle.project.json
jq '.layout, .frames[]' examples/exports/walk-cycle.metadata.json
identify -format '%f %wx%h %[channels]\\n' examples/exports/walk-cycle.png
identify -format 'frame=%p size=%wx%h delay=%Tcs dispose=%D\\n' \\
  examples/exports/walk-cycle.gif
ffprobe -v error -select_streams v:0 \\
  -show_entries stream=codec_name,width,height,nb_frames,duration \\
  -of json examples/exports/walk-cycle.gif
\`\`\`

The atlas PNG and JSON sidecar are separate files. GIF is self-contained, but its centisecond timing, binary transparency and palette limits mean it is not a lossless substitute for the PNG atlas plus metadata.

## Product boundary

The exporters, fixtures, tests and static gallery are standalone developer assets. They do not add editor buttons, production download dialogs, Agent API/MCP methods, bridge behavior, network requirements or a deployment dependency.
