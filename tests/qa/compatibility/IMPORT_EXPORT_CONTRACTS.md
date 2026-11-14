# Import/export acceptance contracts

This file tracks the QA acceptance surface for isolated import/export modules. Executable tests in this directory should depend only on implementations already merged to `main`; pending PR contracts are documented here until their modules land.

## GIF export — available on main

QA contract tests live in `gif-export-contract.test.js`.

| Contract | Expected evidence |
|---|---|
| Frame ordering | Default export follows timeline order; explicit `frameIds` becomes playback/metadata order. |
| Source timing | Metadata retains each original `durationMs`. |
| Encoded timing | GIF delay uses centiseconds, rounded to nearest 10 ms with a 10 ms minimum; metadata reports encoded delay and effective duration. |
| Loop policy | Default `loopCount: 0` means infinite looping; positive values are finite repeat counts; `null` means play once without a looping extension. |
| Transparency | `null` is binary transparency via one reserved index; transparent pixels are counted; transparent frames use disposal-to-background. |
| Layer selection | Default composition uses visible layers; explicit selection can include hidden layers and respects document stacking order. |
| Export result | `exportGIF` returns an `image/gif` Blob and metadata/diagnostics. |
| Safety / purity | Malformed and oversized selections throw; source project contents remain unchanged. |

Focused command:
```bash
node --test tests/qa/compatibility/gif-export-contract.test.js
```

## Sprite-sheet PNG — pending PR #3 / AC-027

Do not import or test the unmerged branch as though it were the released main implementation. Once the exporter is merged, add QA-level assertions for:

1. Default timeline order and an explicitly selected/reordered `frameIds` sequence.
2. Frame rectangle metadata: `frameId`, name, `durationMs`, x/y, width and height.
3. Exact output dimensions for horizontal/vertical/grid layouts, including margin and inter-frame spacing.
4. Native-resolution color equality and alpha equality for every output pixel, including transparent gaps/margins.
5. Visible-layer defaults, explicit hidden-layer selection, and document stacking precedence.
6. Source project immutability and early rejection of malformed project data, invalid color values and output-pixel/canvas limits.
7. Real Chromium PNG decode with a complete RGBA raster comparison; a canvas test double or PNG signature check is not sufficient.

The open PR #3 advertises a standalone browser harness and a complete raster fixture, but its own handoff says real-browser PNG decode is not yet verified in the PR workflow. Keep that distinction in the acceptance evidence.

## GPL / JASC-PAL / JSON palette formats — pending PR #16

After the palette parser/exporter lands on main, add QA-level round trips for:

1. Preserve color order and duplicate entries in all three formats.
2. Preserve palette name and color names in GPL and the versioned JSON format where supported.
3. Confirm JASC-PAL 0100 does not claim to preserve palette or per-color names; its format does not carry those fields.
4. Validate exact RGB channel values, uppercase #RRGGBB normalization, supported shorthand expansion, counts, format/version headers and deterministic diagnostics.
5. Reject malformed headers, invalid channel values, malformed names/schema, excess colors and input over the 1 MiB limit without silently clamping or mutating the source palette.
6. Verify serialized text can be parsed back to the same supported logical palette fields, including duplicate/order preservation.

The open PR #16 documents a 4,096-color cap and a 1 MiB UTF-8 input cap. Treat its proposed API/schema as provisional until merged; do not make the QA suite depend on another worker's branch.

## Project JSON import / deserialization

The project model already has separate compatibility coverage in `project-compatibility.test.js`. Keep import acceptance separate from export encoding:

- malformed JSON, wrong format/version, invalid refs, invalid dimensions and unsafe cel data fail with stable diagnostics;
- v1 migration creates a valid v2 document, preserves logical content and does not overwrite the original source object/string;
- parsing/validation failure must occur before any editor/project state replacement in a future integration test.

## Execution note

The standard workflow currently runs `node --test tests/*.test.js`, which does not discover these nested QA files. Do not treat general project CI as execution evidence for nested QA contracts unless the job log includes their exact paths. The focused commands above must be run explicitly or added by the workflow owner in a separately authorized integration change.
