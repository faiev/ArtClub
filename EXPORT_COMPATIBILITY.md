# Export compatibility and stress coverage

The export modules share a deterministic v2 project input contract but produce different output formats and have different bounded-output policies. This document records the compatibility matrix and the independent-decoder checks kept with the modules.

## Compatibility matrix

| Input / behavior | GIF | Sprite-sheet PNG |
|---|---|---|
| Opaque RGB cel | Encoded through the global palette; exact while the palette remains within its color limit | Copied as exact 8-bit RGB |
| Transparent cel pixel | Uses one reserved binary transparent palette index; disposal-to-background clears earlier pixels | Encoded as alpha 0 |
| Empty cel | Produces a fully transparent frame region | Produces a fully transparent frame rectangle |
| Missing layer/frame cel | Treated as transparent; no implicit fill or source mutation | Treated as transparent; no implicit fill or source mutation |
| More than 256 opaque RGB colors | 5-bit histogram + weighted median-cut and actual-RGB nearest-palette lookup; no dithering | Exact RGB; no palette remapping |
| Odd frame duration | Rounded to nearest 10 ms GIF centisecond, with source/effective values in metadata | Original `durationMs` preserved in metadata |
| Frame order | Source timeline or explicit `frameIds` order | Source timeline or explicit `frameIds` order |
| Maximum source canvas | 512 × 512 | 512 × 512 |
| Maximum frame count | 256 | 256 |
| Output budget | 1,048,576 selected frame pixels; 16 MiB encoded GIF | 16,777,216 complete sheet pixels; 32,767 px per side |
| Independent decoder | Chromium `ImageDecoder` | Chromium `createImageBitmap` + `OffscreenCanvas` |

## Validation and malformed-data policy

Both exporters validate project dimensions, v2 document fields, frame and layer identities, cel references, cel pixel-array lengths and color values before composition. Sparse frame, layer, cel and pixel arrays are invalid: a missing array slot is not the same as an explicit `null` transparent pixel.

Sprite-sheet metadata and PNG rendering also validate the built sheet before use. The RGBA buffer length must equal `width × height × 4`; dimensions must match the documented layout; row/column capacity must contain all frames; every frame identity, duration and rectangle must match its expected grid position and remain inside the sheet. Invalid metadata is rejected before invoking a canvas factory.

## Stress and boundary fixtures

Run the focused compatibility corpus:

```bash
node --check js/gif-export.js
node --check js/sprite-sheet-export.js
node --check tests/export-compatibility.test.js
node --test tests/export-compatibility.test.js
```

The suite covers:
- Transparent, empty and missing cels across GIF and PNG.
- 512 × 512 native-resolution source boundary.
- 256 frames, including odd 145 ms and 155 ms source durations.
- 257-color median-cut palette overflow and the deterministic exact-RGB regression at pixel 58.
- GIF selection above 1,048,576 pixels and sprite-sheet grid output above 16,777,216 pixels; both reject before output raster allocation.
- A caller-lowered 1 KiB GIF byte ceiling.
- Sparse frame, layer, cel and pixel arrays.
- Malformed RGBA sheet buffers, frame rectangles and frame identities.

## Independent browser decoding

The existing browser runners execute as separate steps in `.github/workflows/project-tests.yml`:

```bash
node tests/gif-export.browser.mjs
node tests/sprite-sheet-export.browser.mjs
```

The GIF runner uses Chromium `ImageDecoder` to check:
- Full RGBA output of both ordinary transparent animation frames, including disposal overlap.
- A 257-color median-cut GIF, including the exact decoded RGB at pixel 58 (`#D2384E`).
- The frame count and sampled frame order of a 256-frame GIF.

The PNG runner uses Chromium `createImageBitmap` and `OffscreenCanvas` to decode:
- Transparent grid, horizontal strip, vertical strip and explicit-background grid outputs.
- Every RGBA byte of a 512 × 512 PNG (262,144 pixels), including the two opaque boundary pixels and all transparent pixels between them.

These decoders are independent of the exporters' own byte writers. Node unit tests and encoder self-checks are supplementary, not substitutes for the browser decode assertions.

## Scope

These are standalone export modules, tests and documentation. This phase does not add editor controls, project mutations, Agent API/MCP methods, remote services or workflow changes. The existing browser runners are reused by the current workflow.
