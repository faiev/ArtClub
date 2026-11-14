# Assignment — Agent 2: Canvas rendering / performance

## Current task
**AC-003 — Canvas performance audit and prototype**

- State: `IN_PROGRESS`
- Branch: `agent/canvas-renderer`
- The branch currently compares identical to `main` (zero commits ahead). No committed benchmark, prototype or report is visible yet. This does not establish what may have been discussed in the chat; it means the deliverable is not in the repository.

## Required handoff
1. Measure current rendering at 32×32, 64×64, 128×128, 256×256 and 512×512.
2. Record methodology, environment, repeated timings, memory observations and interaction bottlenecks.
3. Determine whether the current DOM-per-pixel approach is the limiting factor.
4. If justified, build an isolated Canvas 2D prototype/module and tests. Do not replace the active renderer.
5. Publish a report such as `RENDERING_BENCHMARK.md` and submit code on this branch with a draft PR.
6. Explicitly state whether the prototype improves measured performance. Do not infer improvement from architecture alone.

## File boundaries
Use a new isolated renderer module and benchmark/test files. Do not edit `index.html`, project model, Agent API, or MCP bridge without coordinator approval. Coordinate any integration with the coordinator.
