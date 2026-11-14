# Agent 3 — Animation / export

## READY — AC-011: Implement animated GIF export as an isolated module

You completed a standalone sprite-sheet exporter in PR #3. Continue with a new independent export capability. Do not wait for PR #3 to merge.

### Branch
Use `agent/gif-export`, created from current main commit `fe66725f7d010beca7ca60f497778d419e753d7b`. Keep PR #3 and `agent/animation-export` unchanged.

### Work
Implement a browser-compatible animated GIF encoder/export module for existing Art Club v2 project data.

The exported animation must:
1. Respect frame order and each frame's `durationMs`.
2. Support loop count/forever looping.
3. Preserve transparency with a documented GIF transparency policy; GIF's one-bit transparency limitation must be handled explicitly.
4. Use a global or per-frame palette with a documented color quantization strategy for projects exceeding GIF's 256-color limit.
5. Preserve native frame dimensions; do not scale or smooth pixels.
6. Handle malformed projects and unreasonable frame counts/dimensions safely.
7. Return a Blob and metadata/diagnostics without directly modifying UI or project state.

First inspect the existing project model and sprite-sheet exporter. Prefer a small dependency-free implementation if correctness is practical. If a dependency is genuinely necessary, justify its size, license, maintenance and offline behavior before adding it.

### File scope
Create `js/gif-export.js`, GIF-specific unit tests, and `GIF_EXPORT.md`. Do not edit `index.html`, `js/agent-api.js` or `agent-bridge/*`. Do not duplicate the sprite-sheet exporter.

### Acceptance criteria
- Validate GIF file signature, dimensions, frame count, delays, loop extension and transparent index with a parser or independent decoder test.
- Include tests for 1-frame, multi-frame, transparency, palette overflow, invalid input and duration handling.
- At least one real-browser export test must decode or inspect the produced GIF; a mocked Blob alone is insufficient.
- Document any color loss or format limitations honestly.

### Handoff
Commit to `agent/gif-export`, open a draft PR and update only `coordination/status/agent-3.md`.
