# Agent 7 — Tile and seamless-texture workflow engineering

## Continuous workstream: build a complete deterministic tile-authoring subsystem

You own tile preview, seam diagnostics and renderer-independent tile data utilities. Do not stop after PR #13.

### Phase 0 — AC-016: Refresh and validate tile preview
PR #13: https://github.com/faiev/ArtClub/pull/13
Sync with latest main, preserve exact row-major preview and diagnostics, and rerun complete Node/Chromium/MCP CI on the new head.

### Phase 1 — AC-061: Tile transforms and offset preview
Create js/tile-transform.js and tests:
- exact integer-pixel quarter-turn rotations and horizontal/vertical flips;
- wrap-around pixel offsets in X/Y for seamless inspection;
- deterministic toroidal scroll/offset preview;
- crop/pad validation and exact edge/corner coordinate reporting;
- preserve transparency and never interpolate.
Include corner-wrap diagnostics in addition to opposing-edge checks.

### Phase 2 — AC-062: Tile-map data model
Create js/tile-map.js and tests for a bounded row-major tile map:
- create/resize map grids;
- validate tile references and dimensions;
- place, erase, move and duplicate tile cells;
- multi-cell selection copy/paste;
- deterministic map serialization and validation;
- no UI or project-model mutation.
All operations return new buffers and enforce allocation limits.

### Phase 3 — AC-063: Seam diagnostics and suggestions
Expand diagnostics to identify horizontal, vertical and corner discontinuities, transparent-border mismatches, one-pixel edge shifts and repeated-block alignment. Suggestions may describe the mismatched coordinates/values but must not silently repair pixels. Provide structured JSON and human-readable reports.

### Phase 4 — AC-064: Atlas/layout planning
Build a pure tile-atlas planner: stable tile ordering, grid placement, margins, spacing, padding and metadata rectangles. Do not implement PNG encoding (Agent 3 owns exporters); output only layout plans and bounded dimensions that the exporter can consume.

### Phase 5 — AC-065: Tile workflow fixtures and validation suite
Add fixture sets for seamless/non-seamless tiles, rectangular and non-square patterns, alpha/transparency, edge wrap, map stamping and maximum allocation. Add exact deterministic output tests and a browser-independent example runner.

### Phase 6 — AC-066: Integration-ready tiled canvas contract
Write docs/TILE_WORKFLOW_INTEGRATION.md explaining how a later UI can toggle repeat preview, drag offsets, paint across wrapped edges, stamp map cells and request atlas export without writing preview pixels into project cels. Add a keyboard/mouse interaction test matrix. Do not edit index.html or Canvas renderer.

## Ownership
- js/tile-preview.js and tests/tile-preview.test.js
- js/tile-transform.js and tests/tile-transform.test.js
- js/tile-map.js and tests/tile-map.test.js
- tile fixtures and docs under docs/tile-* and tests/fixtures/tiles/

Do not touch renderer, exporter, palette, project model/storage, Agent API, bridge or index.html.

## Working rules
All phases are pre-authorized. PR #13 review/CI is not a reason to stop. Complete one coherent PR then continue on a new branch for the next item. No silent seam correction or source pixel mutation.

## Handoff
Update only coordination/status/agent-7.md with active phase, commits/PRs, exact tests and the next 3–5 tasks. Do not merge or self-accept.
