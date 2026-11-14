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

## Coordinator-added extension — AC-089: Abortable, progress-reporting export operations

After AC-042 documentation, add an asynchronous export contract suitable for long animations and future download/API consumers, without wiring it into the UI or bridge.

### Deliverable
- Preserve existing synchronous exporter APIs and outputs.
- Add asynchronous GIF and sprite-sheet entry points that accept an optional `AbortSignal`, yield at bounded work intervals so cancellation can be observed, and report structured monotonic progress phases.
- Define stable cancellation errors and distinguish cancellation before work, during composition/encoding, and immediately before finalization.
- Never expose a partial GIF, PNG, metadata object or success result after cancellation/failure.
- For identical inputs/options, prove async output bytes/pixels/metadata are identical to the synchronous output.
- Add deterministic tests for early/mid/late cancellation, progress ordering, listener cleanup, malformed input, budget limits and source immutability; add real-browser verification for browser-only encoding paths.
- Document responsiveness and memory limits honestly. Do not promise cancellation of a single non-yielding platform codec call.

**Allowed files:** GIF/sprite-sheet exporter modules, exporter-specific Node/browser tests and export documentation owned by Agent 3. Do not edit index.html, Agent API/bridge, shared workflow or another agent's files. The existing workflow lock remains with Agent 3 only for AC-027 wiring and must be explicitly released when that work is complete.


## Coordinator restart directive — 2026-11-15
Reconcile #3/#21/#22/#55/#68/#74 and their parent chain. Complete AC-027 real Chromium sprite-sheet PNG verification (frame order, pixel RGBA, rectangles, transparency, metadata, malformed/oversized cases) and exact-head CI. Release the project-tests workflow lock explicitly only after proof. No UI/export-dialog work, no self-merge.
