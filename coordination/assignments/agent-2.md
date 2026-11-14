# Assignment — Agent 2: Canvas rendering / performance

## Current task
**AC-003 — Canvas performance audit and prototype**

- State: `HANDOFF_REQUIRED`
- Branch: `agent/canvas-renderer`
- Current branch is 2 commits ahead of `main` (and 2 commits behind the latest main).
- Committed artifacts are now visible: `js/canvas-renderer.js` and `tests/canvas-renderer.test.js`.
- No PR or benchmark report was found at the latest coordinator snapshot.

## Required handoff
1. Open a draft PR from the existing branch. Do not create a second branch for the same task.
2. Provide measured benchmark results for the old renderer and prototype at 32×32, 64×64, 128×128, 256×256 and 512×512.
3. Record browser/runtime, hardware context if available, method, warm-up, repetitions, and exact timings. Separate measured results from estimates.
4. Explain whether this module is a prototype or integrated renderer; it is not integrated merely because the module exists.
5. Run the module tests and relevant browser tests. Clearly state what was and was not tested.
6. Identify overlay, selection, onion skin, resize, zoom, and pointer-coordinate integration requirements.

## File boundaries
Keep the renderer isolated. Do not edit `index.html`, project model, Agent API, or MCP bridge without coordinator approval. Coordinate any integration with the coordinator.
