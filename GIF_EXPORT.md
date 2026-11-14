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
| \`maxTotalPixels\` | 1,048,576 | Safety limit for selected frame count × native frame dimensions. Cannot exceed the module's hard limit. |
| \`maxBytes\` | 16,777,216 | Encoded output size ceiling (16 MiB). Cannot exceed the module's hard limit. |

## Pixel, palette and transparency policy

- Frames retain their native width and height. No scaling, interpolation or smoothing is performed.
- Visible layer cels are composited bottom-to-top, matching the current project model's opaque-pixel compositing behavior.
- Project pixels are either \`null\` or opaque \`#RRGGBB\`. \`null\` is encoded using one reserved transparent palette index. GIF transparency is binary; partial alpha is not supported by either the current project pixel model or GIF.
- When the selected frames contain at most 256 opaque colors (255 when transparency is present), the exporter writes an exact global palette.
- If the color count exceeds the available palette slots, it builds a 5-bit-per-channel RGB histogram, averages each occupied bin, then uses weighted median-cut to produce at most 256 colors (255 opaque colors when one transparent index is needed). Each original pixel RGB is then mapped to its actual nearest palette entry by squared RGB distance using a palette k-d tree; a bounded cache reuses results for repeated exact RGB values. The histogram bucket midpoint is not used as a substitute for the source color. Dithering is not applied.
- Therefore, palette overflow can change colors. \`diagnostics.paletteMode\`, \`diagnostics.quantization\` and \`diagnostics.opaquePaletteColors\` report which path was used.
- Transparent GIF frames use disposal-to-background so transparent pixels do not reveal opaque pixels from the previous frame. The logical screen background index is set to the reserved transparent index.

## Timing

GIF stores delays in centiseconds (10 ms units), while Art Club stores integer milliseconds. Each source \`durationMs\` is rounded to the nearest 10 ms, with a 10 ms minimum. Metadata preserves the original \`durationMs\` and also reports \`encodedDelayCentiseconds\` and \`effectiveDurationMs\`; a 145 ms source frame is therefore encoded as 150 ms.

## Validation and safety

The encoder accepts v2 projects only and validates unique frame/layer/cel references, dimensions (1–512), frame count (1–256), layer count (1–32), durations (10–60,000 ms), cel pixel counts and HEX values. Source project cel data is separately bounded at 16,777,216 pixels across all cels. To bound synchronous working memory, selected output is limited to 1,048,576 frame pixels (for example, four 512×512 frames) and encoded output to 16 MiB; neither limit can be raised above the module's hard ceiling. The composed Uint32Array buffers and indexed-frame buffers therefore use at most about 5 MiB together, excluding the caller-owned project, palette/LZW temporaries, encoded writer, final byte copy and Blob storage. Malformed projects and invalid options throw descriptive errors before a Blob is returned.

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

The browser harness uses \`ImageDecoder\` to assert native dimensions and compare every RGBA pixel in every decoded frame, including transparent pixels and disposal overlap. Its fallback uses the browser's native \`HTMLImageElement.decode()\` to inspect the complete first-frame raster only; parser-based unit tests independently validate the full frame sequence, delays, loop extension, transparency index and LZW image data.

## Practical memory budget

The default selected-output budget is 1,048,576 frame pixels. This is equivalent to four full-size 512×512 frames, or more frames when their combined pixel count is lower. The two retained raster representations (32-bit composed pixels and 8-bit palette indexes) are bounded to roughly 5 MiB in aggregate at that ceiling. Palette, LZW, writer, output-byte copy and Blob allocations are additional; the 16 MiB encoded-byte ceiling bounds the encoded side. The stress test encodes the full 1,048,576-pixel budget and verifies that a fifth 512×512 frame is rejected before frame composition. Actual process peak memory also includes the input project already held by the caller and JavaScript engine overhead.

## Limits / non-goals

This task is the isolated encoder only. GIF download controls, Agent API/MCP tools, GIF import, frame trimming, local palettes per frame and dithering are not included. Those require separately assigned integration work. The module does not add a runtime dependency or make any network requests.