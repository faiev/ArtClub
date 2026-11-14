# Animated GIF export

\`js/gif-export.js\` is a dependency-free GIF89a encoder for Art Club's version 2 project documents. It does not change project state, the canvas renderer, the editor UI or the Agent API. It returns an \`image/gif\` Blob, per-frame metadata and export diagnostics.

## Browser usage

Load the module after the existing project model:

\`\`\`html
<script src="js/project-model.js"></script>
<script src="js/gif-export.js"></script>
\`\`\`

Export the current document snapshot:

\`\`\`js
await window.OnePixelStudioReady;
const project = JSON.parse(window.onePixelStudio.export_project());
const result = window.ArtClubGIFExporter.exportGIF(project, {
  loopCount: 0 // 0 = infinite loop
});

const url = URL.createObjectURL(result.blob);
const link = document.createElement("a");
link.href = url;
link.download = "animation.gif";
link.click();
URL.revokeObjectURL(url);
console.log(result.metadata, result.diagnostics);
\`\`\`

The exporter does not trigger a download. The caller owns UI, filename selection and object-URL lifecycle.

## API

### \`exportGIF(project, options)\`

Returns synchronously:

\`\`\`js
{
  blob,        // Blob with type image/gif
  metadata,    // format, dimensions, frame IDs/order, original and encoded durations
  diagnostics  // palette strategy, transparency policy, loop behavior and byte count
}
\`\`\`

### \`encodeGIF(project, options)\`

Returns \`{ bytes, metadata, diagnostics }\`, where \`bytes\` is a \`Uint8Array\`. This is useful for tests and integrations that need direct access to the encoded data.

### Options

| Option | Default | Behavior |
|---|---:|---|
| \`frameIds\` | All project frames in timeline order | Non-empty unique IDs. The supplied order becomes the GIF playback order. |
| \`layerIds\` | All visible layers | Non-empty unique IDs. Selected layers are composited in the document's bottom-to-top order; this can explicitly include a hidden layer. |
| \`loopCount\` | \`0\` | \`0\` adds the Netscape extension for infinite looping; a positive integer sets the extension's repeat count (up to 65,535); \`null\` omits the extension and plays once. |
| \`maxTotalPixels\` | 16,777,216 | Safety limit for selected frame count × native frame dimensions. Cannot exceed the module's hard limit. |
| \`maxBytes\` | 67,108,864 | Encoded output size ceiling. Cannot exceed the module's hard limit. |

## Pixel, palette and transparency policy

- Frames retain their native width and height. No scaling, interpolation or smoothing is performed.
- Visible layer cels are composited bottom-to-top, matching the current project model's opaque-pixel compositing behavior.
- Project pixels are either \`null\` or opaque \`#RRGGBB\`. \`null\` is encoded using one reserved transparent palette index. GIF transparency is binary; partial alpha is not supported by either the current project pixel model or GIF.
- When the selected frames contain at most 256 opaque colors (255 when transparency is present), the exporter writes an exact global palette.
- If the color count exceeds the available palette slots, it builds a 5-bit-per-channel RGB histogram, averages each occupied bin, then uses weighted median-cut to produce at most 256 colors (255 opaque colors when one transparent index is needed). Pixels map to the nearest palette color using squared RGB distance. Dithering is not applied.
- Therefore, palette overflow can change colors. \`diagnostics.paletteMode\`, \`diagnostics.quantization\` and \`diagnostics.opaquePaletteColors\` report which path was used.
- Transparent GIF frames use disposal-to-background so transparent pixels do not reveal opaque pixels from the previous frame. The logical screen background index is set to the reserved transparent index.

## Timing

GIF stores delays in centiseconds (10 ms units), while Art Club stores integer milliseconds. Each source \`durationMs\` is rounded to the nearest 10 ms, with a 10 ms minimum. Metadata preserves the original \`durationMs\` and also reports \`encodedDelayCentiseconds\` and \`effectiveDurationMs\`; a 145 ms source frame is therefore encoded as 150 ms.

## Validation and safety

The encoder accepts v2 projects only and validates unique frame/layer/cel references, dimensions (1–512), frame count (1–256), layer count (1–32), durations (10–60,000 ms), cel pixel counts and HEX values. Selected output is limited to 16,777,216 frame pixels and 64 MiB of encoded data by default/hard ceiling. Malformed projects and invalid options throw descriptive errors before a Blob is returned.

## Tests

Run format, LZW decode, transparency, looping, timing and quantization tests:

\`\`\`bash
node --test tests/gif-export.test.js
node --check js/gif-export.js
\`\`\`

The real-browser test uses the Playwright dependency installed by the existing \`agent-bridge\` CI job:

\`\`\`bash
node tests/gif-export.browser.mjs
\`\`\`

The browser harness uses \`ImageDecoder\` to inspect both decoded frames and their pixel colors/transparency when the browser supports it. Its fallback uses the browser's native \`HTMLImageElement.decode()\` to inspect the first frame; parser-based unit tests independently validate the full frame sequence, delays, loop extension, transparency index and LZW image data.

## Limits / non-goals

This task is the isolated encoder only. GIF download controls, Agent API/MCP tools, GIF import, frame trimming, local palettes per frame and dithering are not included. Those require separately assigned integration work. The module does not add a runtime dependency or make any network requests.