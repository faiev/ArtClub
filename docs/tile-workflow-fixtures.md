# Tile workflow fixture corpus and examples

Seven deterministic, browser-independent examples live under tests/fixtures/tiles/. Each uses schema artclub.tile-fixture.v1, an ID matching its filename, a kind, a description and exact expected output. Tile pixel buffers are flat row-major arrays; strings are exact opaque tokens and null denotes transparency. These are test fixtures, not a runtime project format.

## Cases
- seamless-square: matching opposing edges and diagonal corners.
- non-seamless-square: deliberate edge and corner mismatches.
- rectangular-pattern: non-square 5-by-3 row-major indexing.
- alpha-transparency: transparent-versus-opaque edge cases.
- edge-wrap: exact positive and negative toroidal X/Y offsets.
- map-stamping: bounded 2-by-2 stamp into a 4-by-3 map, preserving the source.
- maximum-allocation: descriptor for the 4,194,304-pixel ceiling; runner materializes one bounded 4 MiB Uint8Array and checks its first and last bytes.

## Browser-independent runner
From the repository root:
- node tests/run-tile-examples.js emits stable JSON summaries for every fixture.
- node --test tests/tile-workflow-fixtures.test.js runs exact assertions across the corpus.

No browser, renderer, canvas, exporter, third-party package, network or project storage is required. The runner validates dimensions and buffer lengths before reading pixel values, applies wrap/stamp operations to detached arrays, and only allocates the explicitly bounded maximum fixture.

## Scope boundary
These fixtures do not wire a UI, paint project cels, encode PNGs or integrate isolated tile modules. Future UI requirements are specified separately in TILE_WORKFLOW_INTEGRATION.md.
