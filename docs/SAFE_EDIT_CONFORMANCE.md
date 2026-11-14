# Safe-edit conformance tests

## AC-092 — Seeded adversarial/property-style conformance

The conformance suite is a dependency-free Node test file:

~~~sh
node --test tests/safe-edit-conformance.test.js
~~~

By default it runs five fixed 32-bit seeds with bounded iteration counts. A single seed can be replayed with:

~~~sh
SAFE_EDIT_SEED=12648430 node --test tests/safe-edit-conformance.test.js
~~~

The generator uses a bounded canvas (1–8 pixels per side), 2–3 layers, 2–3 frames, dense own-slot pixel arrays and a fixed color vocabulary. No external property-test or fuzzing dependency is introduced.

## Properties covered

- Valid generated targets always resolve without mutating the source project.
- Generated invalid targets cover hidden/locked/zero-opacity layers, missing/duplicate layer/frame/cel targets, sparse holes, explicit undefined, malformed HEX, stale revisions and invalid selections. Every denial is checked against a complete structural snapshot, including array own-slot presence and a derived active-frame raster.
- Successful safe-edit patches return detached project state, preserve every unrelated layer/frame cel, leave the source unchanged, and produce deterministic output for repeated seed/input.
- Denied transaction sequences leave the original project unchanged and do not expose a partial project result.
- Composed sequences cover project staging → guard resolution → immutable patch, selection clear → patch, and cel replacement → stale follow-up rejection.
- Image staging is deterministic for the same seed/input, keeps caller-owned RGBA bytes untouched, and returns only null/valid palette values.
- Invalid project candidates (sparse, undefined, malformed HEX, oversized canvas, duplicate layer IDs) produce diagnostics and no commit object.

## Replay/minimization

Every property assertion includes a compact replay description:
- unsigned seed;
- iteration;
- operation/mutation label;
- generated canvas dimensions;
- a minimized one-pixel/one-layer/one-frame mutation description;
- reproducible Node command.

This intentionally avoids logging full project or raster buffers. For a failure, rerun the reported seed and test name; the same generator order recreates the same fixture and mutation. The seed and iteration are stable and no timing/random system source is used.

## Boundaries and assumptions

- Iterations, canvas dimensions, layer/frame counts and all allocations are hard-bounded.
- Pixel state is tested at the project/cel level; composed raster comparison uses a deterministic top-visible-layer projection (not browser interpolation).
- The suite tests pure guard/transaction/staging modules only. It does not claim live editor, IndexedDB, PNG download or MCP UI integration.
- AC-058's dedicated browser page remains a separate browser harness and is not replaced by these Node properties.
