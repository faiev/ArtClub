# Status — Agent 2

- **Task:** AC-010 — Validate and harden the Canvas 2D renderer prototype
- **Status:** REVIEW — coordinator-requested AC-010 corrections implemented; awaiting review
- **Branch:** `agent/canvas-renderer`
- **Base:** latest main incorporated at `57b4da3cf9be2a9a4b1c98fea942729e42314d54`
- **Branch head:** `17fc03c5cfbba3fea4fb176dde60a27ce4f27d7f`
- **Branch comparison:** 12 commits ahead, 0 behind main at handoff.
- **PR:** #6 — https://github.com/faiev/ArtClub/pull/6 (open, draft, mergeable; not merged)
- **Merge commit:** `1e7cf7821d726287a146de5780b37649bb03dd23` (latest main merged into the existing feature branch without force-push)
- **Validation commits:** `3a7c76818d52173b32c0a6ddcb6928d6adba5b35` (correction implementation), `17fc03c5cfbba3fea4fb176dde60a27ce4f27d7f` (latest-main merge head)

## Changes

- Hardened dirty rendering: changes to grid/selection state force a full visible blit, preventing stale overlay pixels after a pixel-only dirty update.
- Logical dimensions, display dimensions, DPR and backing-store mismatches force a safe full redraw. Surface buffers are recreated only when logical dimensions require it.
- Dirty rectangles are clipped to raster bounds and invalid rectangles/selections are rejected before render-buffer mutation.
- Pointer-to-pixel mapping returns null before first render and for invalid bounds or out-of-canvas coordinates.
- Expanded the mocked-context suite to cover crisp scaling, transparency, overlapping onion tints, dirty crop/clipping, invalid input, DPR/display resize, overlay isolation/invalidation, pointer mapping, 512×512 and cleanup.
- Upgraded the benchmark page with alternating sample order, configurable warm-ups/samples, median, nearest-rank p95, raw samples, environment metadata and downloadable JSON.
- Updated the rendering architecture and benchmark instructions. No changes to index.html, project model, Agent API or MCP bridge; renderer remains isolated.

## Earlier test evidence (superseded)

- Initial pre-correction run #43602659855 had a persistence E2E failure before Agent 1's recovery fix was merged. This result is historical and is superseded by the green final merged-head run recorded below.
- Renderer benchmark timings remain **not measured**; no performance gain is claimed. To collect results, run `python3 -m http.server 8000` and open `http://localhost:8000/benchmarks/renderer-benchmark.html`.

## Risks / handoff

- The tests use fake Canvas 2D contexts; they verify renderer calls and buffer state, not final browser raster output.
- Browser benchmark measurements and interactive visual inspection remain outstanding. Keep the benchmark's raw JSON and browser/hardware details with any future performance claims.
- The existing app still uses the DOM renderer. No UI integration or accessibility parity is claimed.
- No blockers for coordinator review of the isolated code and unit evidence. Browser measurement is still needed before claiming a speedup or proceeding to AC-012 integration.


## Coordinator-directed independent review — PR #11

- **PR:** https://github.com/faiev/ArtClub/pull/11 — open draft at head `b4f552f38e3a4557e10d61401af9420843227aae`.
- **Scope respected:** no changes to Agent 3's branch, PR or files; no renderer integration and no `index.html` changes.
- **CI run:** https://github.com/faiev/ArtClub/actions/runs/43603137011. Node 24 test job passed **45/45** (includes the 10 GIF unit tests). Chromium/ImageDecoder GIF verification step passed and reported 2 frames, red then blue first pixels, transparent sampled pixels, `image/gif` Blob, 105 bytes. Overall workflow is **failure**, not success: the separate existing editor E2E step failed at `agent-bridge/e2e-test.mjs:229` (refresh persistence expected `#ff0000`, actual `null`); the MCP step was skipped. This matches the unrelated persistence failure also seen in PR #6.
- **Positive review:** native logical-screen and image-descriptor dimensions are written from the project canvas dimensions; each frame is a full-canvas image descriptor; default and explicit frame ordering are preserved by `frameIds`; delays are rounded to GIF centiseconds; loop extension values and transparency flag/disposal are present. Unit tests cover one/two frames, explicit order, timing, loop, basic transparency, LZW dictionary reset and palette overflow.
- **Finding — quantization lookup can choose a non-nearest palette color (P2):** `js/gif-export.js` builds one palette lookup per 5-bit RGB bucket using the bucket midpoint in `buildPalette()` (around lines 324–347), then uses that same bucket entry for every pixel in `toIndexedFrames()` (around lines 382–390). A bucket midpoint can be closer to a neighbouring palette entry than the actual pixel is. This can alter a pixel even when that exact source RGB is itself present in the generated median-cut palette, contrary to the documented nearest-palette mapping. Reproduction fixture: a 257×1 opaque frame beginning with `#222799`; generate further unique 5-bit buckets with LCG seed 13: `state = (Math.imul(state, 1664525) + 1013904223) >>> 0`, take RGB from state bytes 31–24, 23–16 and 15–8, and skip already-seen `(r>>3,g>>3,b>>3)` buckets until 257 pixels exist. In this deterministic fixture, source pixel 58 is `#D2384E`; its bucket midpoint is `#D43C4C`, which selects `#D63B50` instead of the exact `#D2384E` palette entry. This reproduction is a source-level algorithm trace; it was not run against a local decoded GIF in this environment. Suggested correction: select by actual RGB (or by each occupied bucket's histogram mean, and document that approximation), then add a regression test that checks decoded pixel 58.
- **Browser decoder test gap:** `tests/gif-export.browser.html` checks frame count, only the top-left opaque pixel per frame, and alpha at byte offset 7 (x=1,y=0). It does not compare every decoded pixel, assert each decoded frame's dimensions, or inspect the second-row overlap where frame 1 has green at (1,1) and frame 2 is transparent there. A corruption/ghost at that location could pass this browser test. The Node parser tests also check selected pixels rather than full-raster equality.
- **Large-frame memory risk:** the default 16,777,216-pixel ceiling permits about 64 MiB of composed `Uint32Array` frame buffers (`composeFrames()`) plus about 16 MiB of indexed frame buffers (`toIndexedFrames()`) retained simultaneously, before project arrays, encoded writer/copy and Blob storage. The flow is synchronous and non-streaming; there is no near-limit memory/stress test. The limits bound the work, but constrained browsers may still hit high peak memory. Consider indexing/encoding one frame at a time and validating `maxBytes` before expensive composition/quantization.
- **No PR action taken:** findings are recorded for coordinator/Agent 3 review only. Agent 2's AC-010 remains submitted as REVIEW; AC-012 remains unstarted and requires coordinator approval.


## Coordinator-requested AC-010 corrections — completed

- Only explicit `null` is transparent. Empty strings, `"transparent"`, sparse array slots and `undefined` are rejected.
- Every pixel and supplied onion-mask entry is validated before resizing or writing render buffers, even outside a requested dirty rectangle.
- Enforces 1–512 width and height (maximum 262,144 pixels) before allocating ImageData/surfaces.
- Snapshots onion masks and forces full redraws for any mask-content change, including in-place edits.
- Changes to `frameId` or `compositeRevision` force full redraws even if a dirty rectangle is passed. The documentation requires callers to advance `compositeRevision` for layer/order/visibility composite changes, or issue a full render when no revision is supplied.
- Added five regression tests for sparse/undefined pixels, malformed onion masks, over-limit dimensions, frame/revision switching and onion-mask in-place mutation.
- PR #6 description now documents all corrections and the full caller invalidation contract.

## Updated test evidence

- CI run for correction commit `3a7c76818d52173b32c0a6ddcb6928d6adba5b35`: 58 passed, 0 failed; browser E2E and MCP client tests passed.
- Final merged-head CI run: https://github.com/faiev/ArtClub/actions/runs/43605014989 — **success**.
- Node 24: 58 passed, 0 failed (22 Canvas renderer tests); syntax check passed.
- Chromium browser E2E passed, including mouse drawing, undo/redo, agent batch, layers, custom canvas, animation playback, onion skin, PNG, IndexedDB library and reload recovery.
- MCP client E2E passed, including drawing, layers, selections, animation frames/playback, onion skin, pixel readback, PNG preview, save and input validation.
- Renderer benchmark timings remain **not measured**; no speedup is claimed.
- No UI integration, `index.html` changes or AC-012 work performed. PR #6 remains draft/open and awaits coordinator review.
