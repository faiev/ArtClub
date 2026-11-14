# Status — Agent 3

- **Task:** AC-011 — Implement standalone animated GIF export
- **Status:** IN_PROGRESS — AC-011 accepted; syncing branch with latest main and revalidating current head
- **Branch:** `agent/gif-export`
- **Latest main incorporated:** `220c2b5033ccd8752dd8e3e357be3fcd8bfc7b7a`
- **Latest code/merge commit:** `1f5c7427d35fb2b09e10cb054dfaa5c637a56426`
- **PR:** https://github.com/faiev/ArtClub/pull/11
- **Changed files:** `js/gif-export.js`, `tests/gif-export.test.js`, `tests/gif-export.browser.html`, `tests/gif-export.browser.mjs`, `GIF_EXPORT.md`, `.github/workflows/project-tests.yml`.
- **PR #11 current verification:** PR remains open, draft and mergeable. Latest head `da81f74ecccf2d74d8a1033e9eee42c98b7845b5`; PR targets `main`. The latest PR workflow run https://github.com/faiev/ArtClub/actions/runs/43605119104 (run #119) completed **success**: Node/model/editor suite **48 passed, 0 failed**; real-browser editor E2E passed; GIF Chromium `ImageDecoder` test passed with native 2×2 dimensions and every RGBA byte matched for both frames (including transparency/disposal overlap); MCP client E2E passed. No merge performed.
- **GIF test evidence:** Latest CI includes the GIF-specific and repository Node tests: 48/48 passed. The seeded quantization regression and 1,048,576-pixel stress test passed; Chromium checked full-frame RGBA for both frames. Earlier FFmpeg and ImageMagick local inspection of the original 2×2 GIF also passed.

## Coordinator-directed read-only review — PR #6

Reviewed PR https://github.com/faiev/ArtClub/pull/6 at head `77d425c9d2d01c56f7703cf2d68a035a8be44ba5`, base `fe66725f7d010beca7ca60f497778d419e753d7b`. No files on Agent 2's branch were changed.

### Findings

1. **Malformed pixel entries can be silently hidden as transparency (confirmed, low/medium severity).** In `js/canvas-renderer.js` around lines 21–23, `rgba()` uses `color == null`, which treats both explicit `null` and `undefined` as transparent. `render()` checks dimensions and array length but does not validate every entry. A sparse array or an explicit `undefined` therefore renders as a transparent pixel instead of rejecting malformed/corrupt frame data. Suggested correction: distinguish `null` explicitly and reject `undefined`; add sparse-array/undefined tests.

2. **No project canvas-size ceiling in renderer input validation (confirmed safety gap).** `render()` around lines 253–266 accepts any positive integer width/height when an equally long JS array is supplied. It does not enforce ProjectModel's 512×512 per-side limit or a renderer allocation budget before `_resize()` creates ImageData/surfaces. A direct caller can request much larger buffers than the project model can produce. Suggested correction: enforce the project limit or a documented renderer memory budget and test 513×1 plus large-area rejection.

3. **Frame/cel isolation is entirely a caller responsibility (contract limitation / test gap).** The renderer API accepts only `{width,height,pixels,onionBefore,onionAfter,...}`; it has no frame ID, cel ID, layer IDs or project validation. It cannot verify that pixels/masks belong to the same active frame or that a caller recomposited visible cels correctly. The architecture doc correctly says frame/layer/visibility changes require a full render. If a caller changes to another frame but supplies only a small dirty rectangle, unchanged regions remain from the previous frame in the cached ImageData/surface. Suggested correction: preserve the full-redraw contract explicitly in integration, optionally accept a frame/composite revision key that forces full invalidation, and add a two-frame switch regression test.

4. **Onion-skin mask changes are not tracked by invalidation (conditional stale-render hazard).** `_writePixels()` around lines 171–189 folds before/after masks into the raster buffer. However, `_overlaySignature()` around lines 162–169 tracks grid/selection only, not onion masks. If a caller changes `onionBefore`/`onionAfter` and submits a partial dirty rect that does not cover all changed mask positions, stale tints remain elsewhere. The caller can avoid this with a full redraw or a dirty rectangle covering the full changed mask bounds, but the contract is not explicit and no regression test covers it. Suggested correction: explicitly force full redraw on onion-state/frame-neighbor changes or track mask revisions; test enabling/disabling and changing neighboring frames with partial pixel updates.

5. **DPR below 1 is silently clamped to 1 (minor behavior/coverage gap).** `_resize()` around line 116 uses `Math.max(1, dprCandidate)`. If a browser reports a devicePixelRatio below 1, the renderer allocates at 1× and reports 1 rather than the reported ratio. This may over-allocate backing stores and makes stats inaccurate. Either document a deliberate 1× minimum or support sub-1 DPR; add a 0.75 test.

### Areas that look correct in current code

- Transparent source pixels map to RGBA alpha 0; active opaque pixels correctly take precedence over onion tint.
- Before/after onion tints are alpha-composited when both masks overlap.
- Grid and selection are rendered on a separate overlay surface; tests confirm they do not enter the ImageData artwork buffer.
- Grid/selection signature changes trigger a full redraw, and logical/display-size/DPR/backing-store changes also force a full redraw.
- Pointer mapping uses CSS client bounds and floor-maps into logical pixel coordinates, rejecting outside positions and invalid bounds.

### PR #6 test / evidence gaps

- The 17 renderer tests use fake Canvas contexts. They verify buffer bytes and call arguments but do not verify final browser-composited pixels or actual overlay alignment.
- No renderer-specific real-browser correctness test exists in this PR; the workflow's browser E2E fails at the unrelated persistence assertion before the MCP step.
- No test covers a two-frame switch, wrong-frame onion mask, sparse/undefined pixel entry, over-512 input, onion-mask changes during dirty rendering, DPR <1, or fractional CSS display dimensions/border mapping.
- Benchmark page is a static full-frame microbenchmark (DOM grid vs Canvas full render), not an animation benchmark. PR #6 explicitly reports no timing run and no measured speedup; no performance conclusion is supported yet.

- **Review disposition:** Recommend addressing findings 1 and 2 before integration. Findings 3 and 4 need an explicit, tested frame/onion invalidation contract before animation use. Finding 5 is lower priority but should be documented/tested. This is a review report only, not a code change or merge recommendation.
- **Last updated:** 2026-11-14 — verified PR #11 and completed read-only review of PR #6.


## Coordinator-directed PR #11 corrections

- Coordinator comment requires: (1) replace midpoint-only 5-bit bucket mapping with nearest-palette lookup for the actual source RGB and add Agent 2's deterministic pixel-58 regression; (2) extend Chromium decoding checks to assert dimensions and every RGBA pixel for every frame, including transparent/disposal overlap; (3) reduce peak memory or lower/document the practical export budget and add a stress test.
- Authorized scope: revise only `agent/gif-export` owned GIF exporter files/tests/docs and the existing GIF browser CI test step. Keep UI/API/MCP integration deferred; do not touch Agent 2 files or PR #3.
- Starting handoff head: `b4f552f38e3a4557e10d61401af9420843227aae` (6 commits ahead, 0 behind `main`).
- Latest pre-correction workflow: Node test job passed; GIF browser verification passed; overall workflow failed at the separate pre-existing editor persistence E2E assertion (`agent-bridge/e2e-test.mjs:229`), with MCP skipped.


## Coordinator-directed AC-011 corrections — completed

- Replaced 5-bit bucket-midpoint lookup with actual-RGB nearest-palette lookup using a palette k-d tree and a bounded 65,536-entry exact-RGB cache. Added the deterministic Agent 2 LCG regression: the source pixel at index 58 is `#D2384E`, remains in the median-cut palette, and is decoded back as that exact pixel.
- Expanded the Chromium `ImageDecoder` test to assert every frame's native dimensions and compare the complete RGBA raster for every frame. The second-frame transparency at the prior-frame green pixel verifies disposal clears the previous image; CI reported both rasters equal to the expected values.
- Reduced maximum selected output from 16,777,216 to 1,048,576 frame pixels and maximum encoded output from 64 MiB to 16 MiB. Kept project source-cel validation separate at 16,777,216 pixels. Added a stress test that encodes four 512×512 frames (exactly the output budget) and rejects a fifth before frame composition. Documented buffer budgeting and exclusions in `GIF_EXPORT.md`.
- Updated PR #11 description with the corrections and current CI evidence. PR remains draft pending coordinator re-review.
- Branch is now 10 commits ahead of current `main` and 1 behind because Agent 1's AC-006 recovery fix advanced `main` to `57b4da3cf9be2a9a4b1c98fea942729e42314d54`. No rebase/merge was performed; the successful PR workflow tested the current PR merge context.
- No UI/API/MCP integration; AC-007 remains queued and was not started.
- **Last updated:** 2026-11-14 — completed coordinator corrections and verified PR workflow run #119.


## AC-011 post-acceptance branch synchronization

- Coordinator accepted AC-011 as an isolated module in PR #11; no UI/API/MCP wiring was authorized.
- Merged latest `main` into `agent/gif-export` with non-force, expected-head updates. The synchronization preserved the six PR #11 files and brought in main changes. Branch comparison after the last sync: 14 commits ahead, 0 behind; merge base equals current main.
- Latest main at last verification: `220c2b5033ccd8752dd8e3e357be3fcd8bfc7b7a`.
- Latest branch head: `1f5c7427d35fb2b09e10cb054dfaa5c637a56426` (merge commit).
- PR #11 remains open, unmerged and mergeable. It is no longer marked draft by GitHub.
- Full PR workflow run #138 was created for this exact head: https://github.com/faiev/ArtClub/actions/runs/43606334973. At status update time the run was in progress. Required gates: Node tests, Chromium editor E2E, complete GIF ImageDecoder raster test, MCP E2E.
- **Next assignment:** AC-027, existing sprite-sheet PR #3 on `agent/animation-export`, begins after this AC-011 current-head workflow completes successfully. Requirements: Chromium decode deterministic PNG fixture, compare full RGBA raster, dimensions, spacing/margins, transparency, frame order and JSON metadata. Keep workflow file locked; prepare page/runner/docs only and do not edit `.github/workflows/project-tests.yml` until coordinator releases it.
- No AC-007 UI/API integration. No changes to Agent 2 or Agent 4 files.
- **Last updated:** 2026-11-14 — latest-main sync commit created and current-head workflow #138 started.
