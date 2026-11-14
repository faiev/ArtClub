# Agent 3 — Animation / export engineering

## Continuous workstream: deliver a complete, independently verifiable export subsystem

You own GIF and sprite-sheet export. Work through every phase below. Do not stop after PR #11 is accepted or after PR #3's browser test is submitted.

### Phase 0 — AC-011: Reconcile accepted GIF exporter
PR #11: https://github.com/faiev/ArtClub/pull/11
Sync agent/gif-export with latest main without force-pushing. Preserve the actual-RGB nearest palette lookup, full-raster ImageDecoder test and 1,048,576-pixel output budget. Rerun Node 24, Chromium editor E2E, GIF decoder and MCP E2E on the new head. Update the PR description/status. Do not merge.

### Phase 1 — AC-027: Real-browser sprite-sheet PNG verification
PR #3: https://github.com/faiev/ArtClub/pull/3
Sync agent/animation-export with latest main. Add Chromium PNG decode verification that compares every RGBA pixel and checks:
- exact dimensions, frame order and per-frame rectangles;
- horizontal/vertical/grid layouts if supported;
- spacing, margins, transparent padding and background behavior;
- JSON metadata frame names, durations and rectangle coordinates;
- malformed and oversized projects rejected before large allocation.
Keep PR #3 independent from PR #11.

### Phase 2 — AC-039: Expand sprite-sheet layout and metadata contract
Extend the sprite-sheet module with deterministic configurable layouts: horizontal strip, vertical strip and bounded grid; explicit margin, spacing, row/column packing and optional frame ordering. Define a versioned metadata schema with source frame IDs/names/durations and exact output rectangles. Preserve nearest-neighbor pixel fidelity and input immutability. Add round-trip/contract tests and docs. Do not add UI.

### Phase 3 — AC-040: Export profiles and selection planning
Create a pure export-planning helper for selected frame ranges, custom frame order, loop settings, timing policy, layout dimensions and output-size estimates. Validate all limits before encoding. Provide stable diagnostics and JSON manifest generation. Keep this helper separate from the editor UI and API.

### Phase 4 — AC-041: Export compatibility and stress suite
Add deterministic fixtures for transparent/opaque projects, maximum dimensions, empty/missing cels, palette overflow, odd frame durations, long animations and malformed metadata. Add stress tests around the documented pixel/byte limits and ensure rejection happens before expensive composition where practical. Add independent decoder checks for output files; never rely only on the encoder's own parser.

### Phase 5 — AC-042: Export developer documentation and example gallery
Create docs/EXPORT_FORMATS.md and small synthetic example files/fixtures documenting PNG atlas, JSON metadata and GIF timing/transparency trade-offs. Include exact commands to decode/inspect outputs with browser or standard tools. Do not check in copyrighted art or huge binary artifacts.

### Phase 6 — Future integration readiness
Prepare docs/EXPORT_INTEGRATION.md describing a single exporter contract usable by download UI and Agent API/MCP without duplicating encoding logic. List required UI controls, progress/error feedback, cancellation and output size guards. Do not edit index.html or bridge/API files until the coordinator grants locks and Agent 4's contract is accepted.

## Ownership and lock
Own js/gif-export.js, js/sprite-sheet-export.js, exporter-specific tests, browser export harnesses and export documentation. You currently own .github/workflows/project-tests.yml changes for PR #11 reconciliation. Release that lock explicitly in your status when done; until then no other agent may edit the workflow. Do not edit bridge files or index.html.

## Working rules
Every phase is pre-authorized. Opening one PR does not end the workstream. Keep PRs narrow and start the next independent phase while review/merge is pending. Use separate branches for PR #11, PR #3 and later helper modules as necessary.

## Handoff
Update only coordination/status/agent-3.md. Track phases, branch/PR links, tested SHAs, CI runs, workflow lock state and next 3–5 tasks. Do not merge or self-accept.
