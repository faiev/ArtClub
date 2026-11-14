# Sprite-sheet export

Art Club's v2 project document already stores animation frames, per-frame durations, layers and independent cels. The standalone module at js/sprite-sheet-export.js adds sprite-sheet PNG generation and JSON metadata without changing the project model or renderer.

## Capabilities

- Export all frames or an explicit ordered subset of frame IDs.
- Export the visible composite by default, or an explicit set of layer IDs (including hidden layers).
- Preserve the document's bottom-to-top layer order when compositing.
- Arrange frames horizontally, vertically or in a grid.
- Configure grid columns, outer margin and inter-frame spacing.
- Keep transparency by default, or specify an opaque #RRGGBB background.
- Preserve every frame's original duration in JSON metadata.
- Write PNG pixels with ImageData and putImageData at native resolution. No scaling, smoothing, palette remapping or interpolation is performed.

Transparent pixels remain alpha 0. Source colors are copied as exact 8-bit RGB values; the project format stores opaque #RRGGBB pixels rather than per-pixel alpha.

## Browser setup

Load the exporter after the app's normal project model script:

    <script src="js/project-model.js"></script>
    <script src="js/sprite-sheet-export.js"></script>

The current Agent API can provide a portable project snapshot:

    await window.OnePixelStudioReady;
    const project = JSON.parse(window.onePixelStudio.export_project());
    const result = await window.ArtClubSpriteSheetExporter.exportSpriteSheet(project, {
      layout: "grid",
      columns: 4,
      margin: 1,
      spacing: 1,
      imageFilename: "walk-cycle.png"
    });

result.blob is the PNG file, and result.metadata is the companion metadata object. A UI can save the two outputs separately:

    function downloadBlob(blob, filename) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }

    downloadBlob(result.blob, "walk-cycle.png");
    downloadBlob(
      new Blob([JSON.stringify(result.metadata, null, 2)], { type: "application/json" }),
      "walk-cycle.json"
    );

The module uses OffscreenCanvas when available and otherwise creates a normal browser canvas. It does not create object URLs or trigger downloads itself; callers own that UI behavior and URL lifecycle.

## API

### buildSpriteSheet(project, options)

Builds a native-resolution RGBA buffer and frame rectangle list. This is useful for tests, previews and custom encoders.

| Option | Default | Meaning |
|---|---|---|
| frameIds | all frames in project order | Non-empty, unique frame ID array; supplied order becomes export order |
| layerIds | visible layers | Non-empty, unique layer ID array; chosen layers are composited in document order |
| layout | horizontal | horizontal, vertical or grid |
| columns | ceil(sqrt(frameCount)) for grid | Grid column count; horizontal and vertical layouts determine columns automatically |
| margin | 0 | Transparent/filled outer margin in pixels |
| spacing | 0 | Gap between frame cells in pixels |
| backgroundColor | null | Transparent background, or a valid #RRGGBB fill |
| maxPixels | 16,777,216 | Safety budget for the complete output image |

The returned sheet contains width, height, frameWidth, frameHeight, layout information, frames and an RGBA Uint8ClampedArray named rgba.

### buildMetadata(sheet, imageFilename)

Creates JSON-compatible metadata in the one-pixel-studio-sprite-sheet format, version 1. Each entry in frames contains index, frameId, name, x, y, width, height and durationMs. Coordinates describe the top-left corner of that frame's rectangle in the PNG.

Example output (illustrative IDs, names and timings):

    {
      "format": "one-pixel-studio-sprite-sheet",
      "version": 1,
      "image": { "filename": "walk-cycle.png", "width": 130, "height": 67 },
      "canvas": { "frameWidth": 32, "frameHeight": 32 },
      "layout": { "type": "grid", "columns": 4, "rows": 2, "margin": 1, "spacing": 1 },
      "frameCount": 6,
      "frames": [
        { "index": 0, "frameId": "frame-id-1", "name": "Idle", "x": 1, "y": 1, "width": 32, "height": 32, "durationMs": 100 }
      ]
    }

Actual frame IDs, positions and durations are taken from the project document.

### renderSpriteSheetPNG(sheet, options)

Renders the sheet into a browser canvas and resolves to a PNG Blob. options.canvasFactory(width, height) may be supplied for tests or host-specific canvas implementations.

### exportSpriteSheet(project, options)

Convenience method returning { blob, metadata, sheet }.

## Safety and limitations

- Project dimensions must be 1–512 pixels per side; projects must use the v2 document shape.
- At most 256 project frames are supported by the project model.
- The default exporter rejects sheets above 16,777,216 output pixels or 32,767 pixels on either side before allocating the RGBA buffer. The pixel limit can be lowered for constrained devices; it cannot be raised above the module's hard ceiling.
- A selected frame/layer ID that does not exist, duplicate IDs, malformed cels, invalid colors, bad layout settings and invalid dimensions produce errors instead of partial output.
- The exporter writes one opaque RGB color or full transparency per pixel because this is the current document model. Per-layer opacity is not applied by the current project composite model.
- GIF export, trimming transparent bounds, frame thumbnails and UI controls are not included. They need separate product/UI work and, for GIF, a carefully chosen and bundled encoder.
- The module does not alter the current PNG/SVG export buttons or the Agent API. The coordinator can integrate the two download actions after reviewing the module and deciding the preferred UI surface.

## Tests

Run the isolated exporter tests:

    node --test tests/sprite-sheet-export.test.js

The tests cover exact RGBA output, visible/selected layer compositing, frame ordering and durations, all three layouts, margin/spacing metadata, transparency/background color, validation and the canvas PNG encoding path.