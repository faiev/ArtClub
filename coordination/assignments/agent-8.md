# Agent 8 — Palette formats / color science / palette workflows

## Continuous workstream: build a robust palette interoperability and editing subsystem

You own file-format handling and pure palette-analysis/transformation utilities. The current PR is only the first phase.

### Phase 0 — AC-017: Refresh and validate palette formats
PR #16: https://github.com/faiev/ArtClub/pull/16
Sync with latest main without force-pushing and rerun complete Node 24, syntax, Chromium and MCP CI on the updated head. Keep GPL, JASC-PAL and JSON parsers strict and preserve documented JASC-PAL limitations.

### Phase 1 — AC-067: Palette analysis utilities
Create js/palette-tools.js and tests:
- count color usage across project cels with optional hidden-layer/frame scopes;
- report unused colors, duplicate HEX entries and case-normalized duplicates;
- find nearest palette color using deterministic RGB distance with stable tie-breaking;
- estimate replacement impacts without mutating the source;
- summarize palette length, color coverage and transparency.
Return structured reports.

### Phase 2 — AC-068: Color conversion and ramp utilities
Add deterministic conversion helpers for HEX/RGB/HSL/HSV and WCAG relative luminance/contrast calculations. Generate light/dark ramps, intermediate colors and bounded shade steps. Define rounding and hue wrap behavior. Test black/white, grayscale, wrap boundaries and exact known values.

### Phase 3 — AC-069: Palette transformations
Implement pure immutable operations:
- reorder, rename, merge and split;
- remove duplicates with explicit keep-first/keep-last policy;
- replace a color across a palette or supplied cel buffers;
- generate complementary, analogous, triadic and monochrome suggestions;
- build ramps from two selected colors;
- preserve names/order where possible and report discarded metadata.
Never silently alter a project; transformation reports must show the changes.

### Phase 4 — AC-070: Palette extraction and project mapping
Create utilities to extract used colors from a project in deterministic order and map a source palette to a target palette. Support exact, nearest and explicit reject-if-no-match policies. Provide an impact report before any replacement and enforce canvas limits.

### Phase 5 — AC-071: Accessibility and palette diagnostics
Add contrast/readability checks for palette pairs, near-duplicate detection and color-vision simulation previews as data transforms (not medical claims). Document limitations: contrast ratios are only one accessibility signal and palette contrast does not guarantee UI accessibility.

### Phase 6 — AC-072: Palette interoperability test corpus
Add representative GPL/JASC-PAL/JSON fixtures: comments, BOM/newline variations, names, duplicates, maximum counts, malformed headers, truncated rows, invalid channels, large files and round-trip cases. Add deterministic fuzz/property-style tests using seeded generators and bounded iteration.

### Phase 7 — AC-073: Integration-ready palette contract
Document import preview, diagnostics, merge/replace/cancel decisions, export format loss, and safe application to a project. Provide examples for a future file picker and Agent API adapter without editing UI/API files.

## Ownership
- js/palette-formats.js and tests/palette-formats.test.js
- js/palette-tools.js and tests/palette-tools.test.js
- palette fixtures and docs/palette-* / docs/PALETTE_WORKFLOW.md

Do not edit index.html, project model, exporter, Agent API, bridge or another agent's files.

## Working rules
All phases are pre-authorized. The PR #16 base refresh is not the end of your workstream. After submitting the refreshed PR, start palette-analysis work on a separate branch without waiting for a merge. Keep color math deterministic and inputs immutable.

## Handoff
Update only coordination/status/agent-8.md with phase state, branches/PRs, tests, supported formats, limitations and next 3–5 tasks. Do not merge or self-accept.

## Coordinator-added extension — AC-094: Perceptual palette distance and color matching

After AC-073, extend palette color matching with a documented perceptual metric while keeping existing RGB behavior stable and explicit.

### Deliverable
- Add `js/palette-distance.js` and `tests/palette-distance.test.js`.
- Implement deterministic sRGB-to-Lab conversion and CIEDE2000 (ΔE00) distance with documented reference-white, gamma, rounding and finite-value policy.
- Provide nearest-color selection with selectable metrics (existing squared RGB, CIE76 and CIEDE2000), stable tie-breaking by original palette order, and structured diagnostics.
- Keep transparency/null handling explicit; never treat null as an ordinary RGB color.
- Validate palette size and HEX input bounds before computation. Add fast-path behavior only when proven equivalent and tested.
- Use published reference pairs for the CIEDE2000 conformance tests, plus grayscale, hue-wrap, near-neutral, duplicate and tie cases.
- Document perceptual matching's limitations and keep all operations pure and non-mutating.
- Do not silently change Agent 8's existing nearest-color defaults or Agent 10's quantization behavior. Any adoption of the new metric must be opt-in and separately documented.

**Allowed files:** `js/palette-distance.js`, `tests/palette-distance.test.js` and palette distance documentation only. Do not change palette-format parsing, project model, Agent 10 pixel algorithms, index.html, Agent API, bridge or other agents' files.
