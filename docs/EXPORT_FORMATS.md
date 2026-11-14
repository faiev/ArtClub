# Animation export formats

This guide describes the isolated GIF and sprite-sheet exporters and their file contracts. The exporters are not yet wired into the production editor's download controls; UI/API integration is a separate coordinator-owned milestone.

## Choose a format

| Requirement | Sprite-sheet PNG + JSON | Animated GIF |
|---|---|---|
| Best for | Game engines, animation tools and frame-by-frame editing | Quick previews and broadly viewable looping animation |
| Color fidelity | Exact source RGB values | Exact while the selected frames fit the GIF palette; quantized above it |
| Transparency | Full per-pixel alpha in the PNG | Binary transparent palette index |
| Timing | Original frame durations in JSON metadata | Delays rounded to 10 ms units |
| Frame layout | Horizontal, vertical or configurable grid | Sequential animation frames |
| Companion data | Versioned JSON atlas metadata | Frame timing and encoder diagnostics in returned metadata |

Prefer PNG when exact colors, transparent gutters, arbitrary frame rectangles or original millisecond timing are important. Prefer GIF when one self-contained animated preview is more useful than a companion atlas and metadata file.

## Shared project input

Both exporters accept a plain version 2 One Pixel Studio project snapshot:

- format is "one-pixel-studio" and version is 2;
- source canvas width and height are integers from 1 through 512;
- frame IDs and layer IDs are present and unique;
- each frame has a non-empty name and an integer duration from 10 through 60,000 ms;
- each cel refers to an existing layer and frame and contains exactly width × height entries;
- each source pixel is either null (transparent) or an opaque #RRGGBB string.

An absent cel and an all-null cel both export as transparent pixels. A missing or malformed array entry is not treated as transparency: sparse arrays and undefined pixel values are invalid. The exporters do not modify the source project.

By default, only visible layers are composited, in the document's bottom-to-top order. An explicit layer selection can include hidden layers. An explicit frameIds array determines output order and must contain valid, unique frame IDs.

## Sprite-sheet PNG and atlas JSON

The PNG exporter writes native-resolution RGBA pixels with ImageData and putImageData. It does not scale, smooth, interpolate or remap palette colors. Opaque source RGB bytes are preserved exactly; null pixels are alpha 0.

Supported layouts:

- horizontal: one row, with one column per selected frame;
- vertical: one column, with one row per selected frame;
- grid: configurable rows and/or columns. When only one is supplied, the other is derived. When both are supplied, their capacity must contain every selected frame.

For a grid with frame width W, frame height H, C columns, R rows, outer margin M and inter-cell spacing S:

    sheetWidth  = 2 × M + C × W + max(0, C − 1) × S
    sheetHeight = 2 × M + R × H + max(0, R − 1) × S

Frame rectangles use integer pixel coordinates measured from the PNG's top-left corner. Frame-array order is export order, not necessarily source timeline order. Unused cells in an explicitly oversized grid remain transparent, or use the configured opaque background color.

The JSON sidecar uses format "one-pixel-studio-sprite-sheet", schema version 1. It contains:

- image filename, width and height;
- source frame width and height;
- layout type, rows, columns, margin and spacing;
- frame count and an ordered frame list;
- each frame's zero-based index, source frameId, name, x, y, width, height and original durationMs.

Coordinates describe each frame's rectangle in the PNG. They do not describe trimmed content bounds. The sidecar is ordinary JSON and survives a JSON.stringify / JSON.parse round trip without changing its schema.

Default output limits are 16,777,216 sheet pixels and 32,767 pixels per side. The limit can be lowered per export, but not raised above the module ceiling. Source frames remain at their native project dimensions.

## Animated GIF

The GIF exporter writes GIF89a and returns a Blob with MIME type image/gif, plus metadata and diagnostics.

### Palette and color behavior

- GIF has at most 256 palette entries.
- If the selected frames contain no transparency, up to 256 distinct opaque RGB colors can be represented exactly.
- If transparency is present, one palette entry is reserved for it, leaving up to 255 opaque colors for exact representation.
- When the selected colors exceed the available opaque palette slots, the exporter builds a 5-bit-per-channel RGB histogram, applies weighted median-cut, then maps each original RGB value to its nearest palette entry using squared RGB distance. A bounded cache and k-d tree make repeated lookups practical. Dithering is not applied.
- Therefore, palette overflow can change source RGB values. The returned diagnostics identify exact versus median-cut mode and describe the quantization strategy.

Use the PNG atlas when palette overflow would be unacceptable.

### Transparency and compositing

The project model stores opaque RGB pixels or null; it does not store partial per-pixel alpha. GIF transparency is also binary. If any selected pixel is transparent, the encoder reserves one transparent palette index and uses disposal-to-background for frames so transparent pixels do not reveal stale pixels from the preceding frame. This is a format-level transparency policy, not an alpha blend.

If no selected frame contains transparency, no transparent palette index is needed. PNG remains the better choice for downstream workflows that require a full RGBA raster or exact transparent gutters.

### Timing and looping

Art Club stores durations in integer milliseconds. GIF frame delays are centiseconds, so the exporter rounds each source duration to the nearest 10 ms and enforces a 10 ms minimum. The returned frame metadata keeps both the original durationMs and the encodedDelayCentiseconds / effectiveDurationMs values.

Examples:

| Source duration | Encoded delay | Effective GIF duration |
|---:|---:|---:|
| 100 ms | 10 cs | 100 ms |
| 145 ms | 15 cs | 150 ms |
| 155 ms | 16 cs | 160 ms |

A duration such as 145 ms cannot be represented exactly by GIF. Keep the PNG sidecar when the original timing values matter.

Loop behavior is controlled by loopCount: 0 means infinite looping, a positive integer means that many repeats, and null omits the looping extension (play once).

### Output limits

The current GIF encoder accepts up to 256 frames and 32 layers, with source canvas dimensions up to 512 × 512. Its default selected-output budget is 1,048,576 frame pixels across all selected frames (for example, four full 512 × 512 frames), and the encoded GIF is limited to 16 MiB. The source cel data is separately bounded at 16,777,216 pixels. Per-export ceilings may be lowered but not raised above the module's hard limits. These bounds limit encoder work; they do not predict the final compressed file size.

## Reproduce the small example

The checked-in example files are:

- examples/export/walk-cycle-v2.json — a two-frame, 2 × 2 v2 project;
- examples/export/expected-atlas-metadata.json — expected metadata for a reordered 7 × 4 grid atlas;
- examples/export/expected-gif-timing.json — expected source and encoded GIF timings plus transparency/loop behavior.

From the repository root, serve the example over HTTP:

    python3 -m http.server 8080

Open http://127.0.0.1:8080/ in a browser. Load js/gif-export.js and js/sprite-sheet-export.js on the page (the normal editor page does not currently wire these modules into its download UI), then run this in the browser console:

    const project = await fetch("/examples/export/walk-cycle-v2.json").then(response => response.json());

    const atlas = await window.ArtClubSpriteSheetExporter.exportSpriteSheet(project, {
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

    function download(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }

    download(atlas.blob, "walk-cycle-atlas.png");
    download(new Blob([JSON.stringify(atlas.metadata, null, 2)], {
      type: "application/json"
    }), "walk-cycle-atlas.json");
    download(gif.blob, "walk-cycle.gif");

The example is synthetic and deliberately tiny. It does not contain copyrighted artwork or generated binary assets.

## Verification and inspection commands

Run the fixture-to-export contract test and the existing focused suites:

    node --test tests/export-format-examples.test.js
    node --test tests/gif-export.test.js tests/sprite-sheet-export.test.js tests/export-compatibility.test.js

Run the independent browser decoders after installing the existing Playwright dependency:

    cd agent-bridge && npm install --ignore-scripts && cd ..
    node tests/gif-export.browser.mjs
    node tests/sprite-sheet-export.browser.mjs

The GIF runner uses Chromium ImageDecoder; the PNG runner uses Chromium createImageBitmap and OffscreenCanvas. These tests decode actual exported files independently of the encoders' own writers.

Optional command-line inspection when the tools are installed:

    magick identify -format '%f %wx%h %[channels]\n' walk-cycle-atlas.png walk-cycle.gif
    ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height,nb_frames -show_entries frame=pkt_duration_time -of json walk-cycle.gif

The PNG image and its JSON sidecar are separate files. The GIF is self-contained but its centisecond timing and palette limitations mean it is not a lossless substitute for the atlas plus metadata.
