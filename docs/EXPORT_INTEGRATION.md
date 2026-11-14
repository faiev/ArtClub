# Export integration contract

**Status:** implementation-readiness proposal. This document does not add production UI, download controls or Agent API/MCP methods. The exporter phases are still open draft PRs, and the Agent 4 capability contract is not yet accepted.

## 1. Integration principles

Art Club must have one implementation of each export algorithm. The editor and the optional local Agent API/MCP bridge should be thin callers of the shared JavaScript modules:

- GIF encoding and timing: \`js/gif-export.js\`.
- Sprite-sheet raster, PNG encoding and atlas metadata: \`js/sprite-sheet-export.js\`.

Do not copy palette mapping, GIF LZW, pixel composition, atlas packing or metadata generation into the UI or bridge. Pass a validated project snapshot and export options to the existing module, then handle presentation or file delivery around its result.

Keep the core export path local-first and offline-capable. No account, backend, remote conversion service or network call is needed to create a GIF or PNG.

## 2. Shared module entry points

The following asynchronous entry points are implemented on the Agent 3 AC-089 branch and are pending integration through its PR chain:

| Use | Entry point | Result |
|---|---|---|
| GIF bytes without Blob wrapper | \`ArtClubGIFExporter.encodeGIFAsync(project, options)\` | \`{ bytes, metadata, diagnostics }\` |
| GIF ready for browser download | \`ArtClubGIFExporter.exportGIFAsync(project, options)\` | \`{ blob, metadata, diagnostics }\` |
| Build sprite-sheet RGBA buffer | \`ArtClubSpriteSheetExporter.buildSpriteSheetAsync(project, options)\` | Versioned sheet with RGBA pixels and frame rectangles |
| Encode a prepared sheet as PNG | \`ArtClubSpriteSheetExporter.renderSpriteSheetPNGAsync(sheet, options)\` | PNG Blob |
| Build and encode a sprite sheet | \`ArtClubSpriteSheetExporter.exportSpriteSheetAsync(project, options)\` | \`{ blob, metadata, sheet }\` |

For a typical editor download, use \`exportGIFAsync\` or \`exportSpriteSheetAsync\`. Use the lower-level methods only when a caller genuinely needs to inspect or reuse the intermediate bytes/sheet.

The browser modules expose \`window.ArtClubGIFExporter\` and \`window.ArtClubSpriteSheetExporter\`; their CommonJS exports support Node tests. The synchronous methods remain available and must continue to produce the same outputs as before. UI and bridge integrations should use async methods for potentially long exports so they can expose progress and cancellation.

### Shared async options

- \`signal\`: optional native \`AbortSignal\`.
- \`onProgress(event)\`: optional callback receiving \`{ phase, progress, completed, total }\`.
- \`yieldEvery\`: optional work-unit interval from 1 to 65,536; default 8,192.

Percentages are monotonic and complete at 100 on success. Phase names are stable within each exporter but are not identical between GIF and PNG; consumers should display the supplied phase rather than assume a single cross-format phase list.

Cancellation rejects with \`ExportAbortError\`, code \`EXPORT_ABORTED\`, and a \`stage\`. Callers must handle this as cancellation, not as success or an ordinary encoder failure. No partial Blob, bytes, metadata or successful export result is returned after cancellation.

A browser PNG codec call such as \`toBlob\` / \`convertToBlob\` cannot be interrupted while the browser is inside that single platform operation. If the signal is aborted during the codec call, the exporter checks it after the call resolves and discards the Blob. A UI must not promise instantaneous cancellation during that interval.

See [EXPORT_ASYNC.md](../EXPORT_ASYNC.md) for the complete progress, cancellation, responsiveness and memory contract.

## 3. Editor download UI contract

The UI remains coordinator-owned. When production UI authorization is granted, the editor integration should provide:

### Format and frame selection

- Format selection: animated GIF or sprite-sheet PNG plus JSON sidecar.
- Frame selection: all frames by default, or a validated subset/range with deterministic output order.
- If custom order is supported, preserve the user's order in the exported frames and the atlas metadata.
- Layer selection defaults to visible layers. Explicitly selected hidden layers may be included only where the exporter contract allows it.
- Show a clear format-specific summary before export: selected frame count, source dimensions, and relevant timing/layout settings.

### Sprite-sheet settings

- Layout: horizontal, vertical or grid.
- Grid: rows, columns, or both; reject insufficient cell capacity before allocation.
- Outer margin, inter-frame spacing and optional background color.
- Show the resulting dimensions before starting:
  
  \`\`\`text
  sheetWidth  = 2 × margin + columns × frameWidth
                + max(0, columns − 1) × spacing
  sheetHeight = 2 × margin + rows × frameHeight
                + max(0, rows − 1) × spacing
  \`\`\`

- The PNG and metadata JSON are a pair. Keep their filename stem together (for example, \`walk-cycle.png\` and \`walk-cycle.json\`). Do not silently discard the metadata sidecar.

### GIF settings

- Loop: infinite (\`loopCount: 0\`), finite repeats (positive integer) or play once (\`loopCount: null\`).
- Explain centisecond timing: source millisecond durations are rounded to 10 ms GIF units. The returned metadata reports both source and effective encoded timing.
- Explain that GIF has binary transparency and a maximum of 256 palette entries; palette overflow can quantize colors. Prefer PNG when exact RGB values or full RGBA output are required.

### Progress, cancellation and accessibility

- Create one \`AbortController\` per active export and pass its signal to the exporter.
- Display progress from \`onProgress\`, including phase and percentage. Use a visible status message and an accessible live announcement; do not rely on color or a spinner alone.
- Provide a real Cancel action that calls \`controller.abort()\`.
- Disable conflicting export controls while the operation is active, but keep the Cancel action available.
- On success, begin the download only after the async method resolves. Release the Blob URL after the browser has consumed it.
- On cancellation, explain that no file was produced. During a PNG codec call, indicate that the browser is finishing the current encoding step if cancellation is not yet observable.
- On validation/limit/codec errors, keep the dialog open, preserve the project, focus an actionable error message and allow the user to adjust the settings. Do not display a success toast or trigger a partial download.

## 4. Preflight and output safety

Validate selections and estimate output dimensions before allocating or encoding. The shared exporters remain the final authority and must reject inputs outside their limits; UI estimates are guidance, not a replacement for module validation.

Current module limits:

| Limit | GIF | Sprite-sheet PNG |
|---|---:|---:|
| Source canvas side | 512 px | 512 px |
| Frame count | 256 | 256 |
| Layers | 32 | Module/project validation |
| Selected output pixels | 1,048,576 frame-pixels total | 16,777,216 sheet pixels |
| Encoded output bytes | 16 MiB | Browser PNG codec output; no exact compressed-size prediction |
| Output side | Source canvas dimensions | 32,767 px |

Source cel data also has a bounded project limit. Caller-provided maximums may lower these ceilings but must never raise the module's hard limit.

The GIF pixel budget is \`canvasWidth × canvasHeight × selectedFrameCount\`. It is not an estimate of compressed GIF bytes. A final file-size estimate cannot be known exactly before encoding; catch and explain the encoder's 16 MiB limit rather than promising a precise estimate.

For PNG, calculate the exact sheet width, height and pixel count from the selected frame count/layout/margin/spacing before export. Reject the request before canvas allocation when it exceeds the hard limit. The browser codec is a single platform operation and is not cancellable mid-call.

Never mutate the current project to prepare an export. Work from a snapshot; a failed or cancelled export must leave project pixels, history, selection and persistence unchanged.

## 5. Optional local Agent API/MCP adapter

The bridge adapter is not part of this PR and must not be implemented until Agent 4's capability/API contract has been reviewed and accepted and the coordinator grants the relevant API file lock.

When authorized, the bridge should be an adapter only:

1. Validate the request against the accepted Agent 4 schema, capability version, input/output bounds and revision/conflict rules.
2. Resolve the target project snapshot through the existing safe read path; do not add a second exporter-specific project loader.
3. Call the same async exporter functions listed in section 2.
4. Forward or normalize progress using the accepted bridge event/notification contract. Do not invent a second progress protocol.
5. On cancellation/deadline, respect the bridge's accepted queue-fencing semantics. An aborted export must not be followed by a stale queued file write or mutation.
6. Deliver output using the accepted local-file result contract. A browser \`Blob\` or typed byte array is not itself a JSON-friendly MCP response; do not base64-encode arbitrarily large files into tool text.
7. Return the PNG atlas and its JSON sidecar as a coherent pair. Keep source project data and file paths out of diagnostics unless the accepted contract explicitly permits a sanitized representation.

The bridge must not reimplement GIF palettes, timing, LZW, sprite-sheet layouts or metadata. It must not claim that export is available in the capability document until the adapter and its tests are integrated.

### Contract dependencies

- Agent 3 export modules: PR #3 → #21 → #55 → #74. AC-042 guide/gallery is PR #68, stacked on #55.
- Agent 4 bridge capability contract: PR #86 is currently open/draft. This integration design intentionally does not specify MCP method names, parameter schemas, file-transfer response shapes or notification names before that contract is accepted.
- Production download UI: coordinator-owned. Agent 3 has no \`index.html\`, production UI, bridge or API write authority.

## 6. Verification gates

Before enabling an editor download control:

- Run the focused Node exporter suites and the complete project test workflow on the exact integrated commit.
- In Chromium, decode the resulting GIF with \`ImageDecoder\` and PNG with \`createImageBitmap\`; compare every relevant pixel, frame order, timing and transparency.
- Test early, mid-operation and late cancellation, including the post-codec PNG cancellation boundary.
- Check monotonic progress, 100% only on success, no partial download and no project/history/persistence mutation on failure.
- Exercise maximum canvas/frame/pixel budgets and malformed/sparse selections.
- Test desktop and mobile dialog layouts, keyboard-only operation, focus restoration, accessible progress/error announcements and reduced-motion behavior.

Before enabling an Agent API/MCP export tool:

- Confirm Agent 4's accepted capability/version and request/response contract.
- Add adapter-level tests for authorization, revision handling, deadlines, cancellation fencing, local file delivery and payload bounds.
- Run real MCP-client E2E against actual generated output files and verify that the bridge does not duplicate or bypass the shared exporter.
- Keep browser and bridge tests separate in reports; one does not substitute for the other.

## 7. Current delivery state

This is an integration-readiness document only. The exporter modules and their tests/docs are in open draft PRs and are not yet a production editor feature. No editor control, Agent API/MCP export method, bridge adapter or deployment change is included here. A merge of these documents or exporter PRs alone must not be described as a live export workflow.
