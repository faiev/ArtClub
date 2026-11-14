# Synthetic pixel-effect fixtures

This directory contains original, hand-authored synthetic fixtures. No existing game art, third-party sprites or user artwork is included.

The current corpus is stored in golden-corpus.json and uses dense row-major #RRGGBB/null source buffers. Static cases include:
- 4×4 checkerboard for exact flips and quarter-turns;
- 5×5 diagonal line for 4/8 connectivity, border and flood-fill results;
- 5×5 transparent-hole ring for region selection and fill without closing transparency;
- 4×1 grayscale ramp for posterization and luminance ramp mapping;
- 5×5 symmetric sprite for reflection and rotation invariants;
- generated 512×512 checkerboard recipe for maximum-dimension counts without storing a large repetitive JSON array.

tests/pixel-effects-fixtures.test.js validates the manifest, dimensions, dense pixel data, expected output buffer lengths, coordinate uniqueness/bounds, reference transform invariants and generated stress counts.

## Current limitation

The fixture corpus is a preparation tranche of AC-085. The algorithm modules for AC-019 and AC-080 through AC-084 are currently isolated in their own review PRs and have not yet landed on main. This branch intentionally does not duplicate those modules or create a stacked PR that would mix several already-submitted deliverables. Once the module PRs are merged, the next AC-085 tranche will wire each fixture to the real API and compare full raw output buffers, then add runtime/allocation and repeated-run stress guards.

Until that integration tranche lands, these tests validate fixture data integrity and the independently computed fixture invariants; they do not claim end-to-end golden execution against every algorithm.
