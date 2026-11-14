# Export formats: PNG atlas, JSON metadata and animated GIF

Art Club keeps editable animation in its v2 project document. Export files are derived outputs: the PNG atlas preserves source pixels, its JSON companion maps source frames into the atlas, and animated GIF trades timing precision and color range for a widely supported animation file.

The synthetic [Tiny Robot walk-cycle gallery](../examples/exports/index.html) includes the source project and small sample exports. It contains no third-party or copyrighted artwork.

## At a glance

| Format | What it contains | Fidelity / trade-offs |
|---|---|---|
| v2 project JSON | Canvas, palette, layers, frames, durations and cels | Editable source of truth; retains frame/cel relationships |
| Sprite-sheet PNG | One lossless RGBA image containing frame rectangles | Exact RGB values and binary transparency; no scaling or interpolation |
| Sprite-sheet metadata JSON | Versioned layout plus source frame identity, timing and output rectangles | Plain JSON; required to recover frame-to-rectangle mapping and source durations |
| Animated GIF | A timed sequence of indexed-color frames | 10ms timing units; binary transparency; palette quantization can change colors |

## Tiny Robot example

The source is an 8×8 project with four frames in timeline order:

| Frame | Source duration |
|---|---:|
| Idle | 100ms |
| Left step | 145ms |
| Contact | 155ms |
| Right step | 250ms |

The [PNG atlas](../examples/exports/walk-cycle.png) is 19×19 pixels. It uses a two-column, two-row grid, a 1px outer margin and a 1px gap between frames. Each frame is 8×8. The companion [atlas metadata](../examples/exports/walk-cycle.metadata.json) records the top-left coordinates:

| Frame | x | y | width | height | durationMs |
|---|---:|---:|---:|---:|---:|
| Idle | 1 | 1 | 8 | 8 | 100 |
| Left step | 10 | 1 | 8 | 8 | 145 |
| Contact | 1 | 10 | 8 | 8 | 155 |
| Right step | 10 | 10 | 8 | 8 | 250 |

The [animated GIF](../examples/exports/walk-cycle.gif) is 8×8 and loops indefinitely. GIF delays are measured in centiseconds (10ms units), so source durations 145ms and 155ms are represented as 150ms and 160ms. The [GIF metadata example](../examples/exports/walk-cycle.gif.metadata.json) keeps source and effective encoded durations visible.

The sample GIF binary is a deterministic format illustration generated independently from the same synthetic project pixels. It demonstrates 10ms delay units, transparent index and disposal behavior; it is not claimed to be byte-identical to Art Club's GIF89a encoder output. Use the project's exporter and browser decoder test for encoder acceptance.

## Sprite-sheet PNG and metadata contract

The sprite-sheet exporter builds an RGBA buffer at native source dimensions, then writes it to a PNG canvas with `putImageData`. It does not scale frames or apply smoothing. Opaque source colors remain exact 8-bit RGB values; explicit `null` pixels remain fully transparent.

Supported layouts are horizontal, vertical and grid. A grid may use a fixed number of columns, a fixed number of rows, or both. When both are supplied, the cell capacity must fit the selected frames. Margins, spacing and unused cells are part of the output canvas. Unless `backgroundColor` is supplied, unused cells, gutters and margins remain transparent.

Metadata schema `one-pixel-studio-sprite-sheet`, version 1, records:
- Output image filename and dimensions.
- Source frame width and height.
- Layout type, row/column count, margin and spacing.
- Frame count and ordered frame records containing output index, source frame ID/name, exact integer `x`/`y`/`width`/`height` rectangle and original `durationMs`.

The order of the `frames` array is the requested export order, not necessarily source timeline order. Keep metadata beside its PNG; pixels alone do not encode frame names, IDs, durations or rectangle semantics.

## Animated GIF timing, palette and transparency

The GIF exporter emits GIF89a at the project canvas dimensions. It supports timeline order or explicit frame ID order, infinite looping by default, a finite repeat count, or no looping extension for play-once output.

GIF frame delays use 10ms centisecond units. The encoder rounds source durations to the nearest centisecond and reports both:
- `durationMs`: source project timing.
- `encodedDelayCentiseconds` and `effectiveDurationMs`: GIF delay and resulting time.

For example, 145ms becomes 15 centiseconds / 150ms, and 155ms becomes 16 centiseconds / 160ms. The source project is not modified.

GIF transparency is binary: a pixel is either transparent or opaque. It cannot represent partial alpha. Art Club reserves a palette index for transparent pixels and uses disposal-to-background to clear prior frame pixels where needed.

GIF uses an indexed palette. When selected frames fit the palette, RGB values are represented exactly. When they exceed the available palette capacity (255 opaque entries when transparency is present, otherwise 256), the encoder uses a 5-bit RGB histogram and weighted median-cut quantization, then maps each actual source RGB to its nearest palette entry. There is no dithering; color shifts are possible in overflow cases. Diagnostics disclose whether the palette is exact or quantized.

## Reproduce the examples

The checked-in source fixture, sample PNG/GIF and companion metadata are under `examples/exports/`. To regenerate all four derived sample files (PNG, GIF and both JSON metadata files), install the optional Pillow authoring dependency and run:

```bash
python3 -m pip install Pillow
python3 examples/exports/generate_examples.py
```

Pillow is used only to generate this documentation gallery. The application GIF and sprite-sheet exporters remain dependency-free JavaScript; the sample GIF is explicitly a format illustration, not a byte-for-byte copy of the application encoder output.

To inspect the checked-in sample structure:

```bash
file examples/exports/walk-cycle.project.json \
  examples/exports/walk-cycle.png examples/exports/walk-cycle.gif
jq '.frames[] | {id, name, durationMs}' examples/exports/walk-cycle.project.json
jq '.layout, .frames[]' examples/exports/walk-cycle.metadata.json
jq '.frames[] | {frameId, durationMs, encodedDelayCentiseconds, effectiveDurationMs}' \
  examples/exports/walk-cycle.gif.metadata.json
```

With ImageMagick and FFmpeg installed:

```bash
identify -format '%f %wx%h %[channels]\\n' examples/exports/walk-cycle.png
identify -format 'frame=%p size=%wx%h delay=%Tcs dispose=%D\\n' \
  examples/exports/walk-cycle.gif
ffprobe -v error -select_streams v:0 \
  -show_entries stream=codec_name,width,height,nb_frames,duration \
  -of json examples/exports/walk-cycle.gif
```

To run exporter tests and independent Chromium decoders:

```bash
node --test tests/gif-export.test.js tests/sprite-sheet-export.test.js \
  tests/export-compatibility.test.js tests/export-gallery.test.js
node tests/gif-export.browser.mjs
node tests/sprite-sheet-export.browser.mjs
```

The browser runners use Chromium `ImageDecoder` for GIF and `createImageBitmap` plus `OffscreenCanvas` for PNG. They compare decoded pixels against independent expected rasters; encoder output buffers are not the only correctness oracle.

## Safety limits and scope

- Project source canvas: at most 512×512; at most 256 frames.
- GIF: at most 1,048,576 selected frame pixels and 16MiB encoded output.
- Sprite sheet: at most 16,777,216 output pixels and 32,767px per side.
- User-supplied limits can lower, but cannot raise, exporter hard limits.
- Sparse/undefined pixel entries and malformed frame/cel/metadata structures are rejected rather than silently interpreted as transparent.
- Exporters are standalone modules. This documentation and gallery do not add editor buttons, Agent API/MCP methods, bridge behavior or network requirements.
