# Asynchronous export operations

The GIF and sprite-sheet modules retain their synchronous APIs. They also expose cooperative asynchronous entry points for long-running callers that need to keep the browser event loop responsive and cancel between bounded work chunks.

The async APIs do not change the project model, download UI, Agent API or MCP surface.

## API reference

### GIF

```js
const result = await window.ArtClubGIFExporter.exportGIFAsync(project, {
  frameIds: ["contact", "step", "idle"],
  loopCount: 0,
  signal: controller.signal,
  yieldEvery: 8192,
  onProgress(event) {
    renderProgress(event);
  }
});
```

- `encodeGIFAsync(project, options)` resolves to the same `{bytes, metadata, diagnostics}` shape as `encodeGIF`.
- `exportGIFAsync(project, options)` resolves to the same `{blob, metadata, diagnostics}` shape as `exportGIF`.

### Sprite-sheet PNG

```js
const result = await window.ArtClubSpriteSheetExporter.exportSpriteSheetAsync(project, {
  layout: "grid",
  columns: 4,
  margin: 1,
  spacing: 1,
  signal: controller.signal,
  yieldEvery: 8192,
  onProgress(event) {
    renderProgress(event);
  }
});
```

- `buildSpriteSheetAsync(project, options)` resolves to the same RGBA sheet shape as `buildSpriteSheet`.
- `renderSpriteSheetPNGAsync(sheet, options)` resolves to a PNG Blob.
- `exportSpriteSheetAsync(project, options)` resolves to the same `{blob, metadata, sheet}` shape as `exportSpriteSheet`.

## Shared options and progress contract

| Option | Default | Meaning |
|---|---:|---|
| `signal` | none | A native AbortSignal or compatible object with an `aborted` boolean |
| `onProgress` | none | Optional synchronous callback receiving progress objects |
| `yieldEvery` | 8192 | Work units between cooperative event-loop yields; valid range 1–65,536 |

Each progress event has this shape:

```json
{
  "phase": "composition",
  "progress": 42.5,
  "completed": 8192,
  "total": 16384
}
```

`progress` is a monotonic percentage from 0 through 100 for one operation. The phase names are stable:
- GIF: `validation`, `composition`, `palette`, `indexing`, `encoding`, `finalizing`, `completed`.
- Sprite sheet: `validation`, `composition`, `render`, `encoding`, `completed`.

`completed` and `total` are phase work units, not elapsed time or a promise of remaining wall-clock duration. The operation yields to the host between chunks using a zero-delay task, then polls the signal again. Callback exceptions reject the operation and do not produce a success result.

## Cancellation and errors

An aborted operation rejects with an `ExportAbortError`:

| Field | Value |
|---|---|
| `name` | `ExportAbortError` |
| `code` | `EXPORT_ABORTED` |
| `stage` | `before-start`, `composition`, `encoding` or `finalization` |

The exporter checks cancellation before starting, at work-chunk boundaries, before finalization and after the PNG codec resolves. A cancellation rejection contains no bytes, Blob, sheet, metadata or success result. The encoder may have allocated private working buffers before an abort; those buffers are not returned to the caller.

The implementation polls `signal.aborted` and does not register an abort event listener. There is therefore no listener to detach on success or failure. Cancellation is cooperative: if the caller aborts between checkpoints, the operation stops at the next checkpoint.

## Browser codec limitation

PNG rendering copies the RGBA bytes into ImageData in chunks. The following browser operations are still single platform calls:
- `putImageData`, which copies the prepared ImageData into the canvas.
- `toBlob` or `OffscreenCanvas.convertToBlob`, which encodes the PNG.

The browser does not expose an interruptible form of these calls through this API. Cancellation during the cooperative ImageData preparation is reported at `encoding`. A signal raised while PNG encoding is in progress is observed immediately after the codec resolves; the Blob is then discarded and the operation rejects at `finalization`. This is not mid-codec cancellation.

GIF LZW byte generation is implemented in JavaScript and yields between chunks. Small bounded operations such as median-cut splitting, construction of the palette search tree, final GIF headers and the final PNG metadata mapping are synchronous.

## Memory and output limits

The async APIs use the same hard output limits as the synchronous APIs:
- GIF: 1,048,576 selected frame pixels and 16 MiB encoded output; project cel validation has its separate source-data ceiling.
- Sprite sheet: 16,777,216 output pixels and 32,767 pixels per side; project canvas sides remain limited to 512 pixels and the project to 256 frames.

Async execution does not reduce the output allocation required by the chosen format. GIF still holds composed/indexed working data and bounded encoder buffers; sprite-sheet generation still holds its final RGBA sheet and the browser's ImageData/canvas buffers. Use lower `maxTotalPixels` / `maxPixels` values for constrained devices. The chunk size controls responsiveness, not the hard memory ceilings.

## Compatibility

The existing synchronous `encodeGIF`, `exportGIF`, `buildSpriteSheet`, `renderSpriteSheetPNG` and `exportSpriteSheet` entry points are unchanged.

For identical project data and format options, the async tests compare:
- GIF bytes, metadata and diagnostics against the synchronous encoder.
- Sprite-sheet RGBA pixels, metadata and encoded PNG output against the synchronous exporter.

Node tests cover early, mid-composition, mid-LZW, render-preparation and finalization cancellation. The real-browser GIF and PNG test pages verify async output parity, progress ordering and the PNG post-codec abort behavior.
