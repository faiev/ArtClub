# Project Inspector CLI

The project inspector is an offline, read-only diagnostic for One Pixel Studio project JSON. It uses the existing CommonJS project model in js/project-model.js as the source of truth for validation and legacy migration.

## Usage

Run from the repository root:

    node tools/project-inspector.mjs path/to/project.json

For machine-readable output:

    node tools/project-inspector.mjs --json path/to/project.json

Show command help:

    node tools/project-inspector.mjs --help

The command accepts one file path. It does not write, repair, reformat, or replace the input file.

## Report contents

A valid report includes:

- Source format and version, plus normalized format/version after inspection.
- Project name and ID when the source document has one.
- Canvas width and height, palette size, layer count and frame count.
- Active layer and frame.
- Visible, hidden and locked layer summaries.
- Cel count, expected pixels per cel, expected total pixels and actual total pixels.
- Occupied and transparent pixel counts across every cel.
- Frame durations and total animation duration.

Pixel coverage counts every pixel slot in every cel, including hidden layers and non-active frames. It is not a flattened composite-image count. A pixel is occupied when it contains a valid color; null is transparent.

For a legacy single-canvas file, the original format/version is reported as legacy. The project model migrates it to the v2 shape in memory so that the same report fields can be calculated. Synthetic IDs created during migration are not presented as source IDs.

## Validation and safety

- Validation and migration rules come from Project.deserializeProject() and Project.validateProject() in js/project-model.js.
- Files are opened read-only. The inspector never serializes a migrated project back to disk.
- Input files larger than 64 MiB are rejected before parsing. The limit also guards against a file that grows while it is being read.
- Malformed JSON, unsupported versions, invalid cels, missing references and over-limit documents produce an actionable error and a nonzero exit code.
- With --json, failures are JSON objects with ok: false and a stable error code. Without it, diagnostics are written to stderr.
- The tool uses Node built-in modules only. It does not require a service, network access, package installation or account.

The 64 MiB input cap is an inspector safety limit; a file above that size is rejected even if it might otherwise fit the project model's structural limits.

## Tests

Run the dedicated test suite:

    node --test tests/project-inspector.test.js

The tests execute the CLI in child Node processes against temporary copies of fixtures. They cover valid v2 and legacy documents, deterministic legacy output, source-file immutability, malformed JSON, invalid cels, missing references, over-limit documents, file-size rejection and argument handling.
