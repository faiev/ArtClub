# Project Inspector CLI

The project inspector is an offline, read-only diagnostic for One Pixel Studio project JSON. It uses the existing CommonJS project model in `js/project-model.js` as the source of truth for validation and legacy migration.

## Usage

Run from the repository root.

Inspect one file:

    node tools/project-inspector.mjs path/to/project.json

Print a machine-readable single-file report:

    node tools/project-inspector.mjs --json path/to/project.json

Inspect several explicit files and the immediate files in a directory:

    node tools/project-inspector.mjs --batch path/to/one.json path/to/two.json path/to/projects/

Recursively inspect directories:

    node tools/project-inspector.mjs --batch --recursive --json path/to/projects/

Compare two project documents:

    node tools/project-inspector.mjs --compare before.json after.json

Print a machine-readable comparison:

    node tools/project-inspector.mjs --compare --json before.json after.json

Show command help:

    node tools/project-inspector.mjs --help

Single-file mode accepts exactly one file. Batch mode accepts multiple file and directory inputs. Compare mode accepts exactly two project file paths and cannot be combined with batch or recursive mode.

## Single-file report

A valid single-file report includes:

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

## Batch report

Batch JSON output has this stable top-level shape:

- `ok`: true only when there are no per-file or discovery failures.
- `mode`: `"batch"`.
- `recursive`: whether child directories were traversed.
- `inputCount`, `fileCount`, `successCount`, `failureCount`.
- `bytesRead`: bytes actually read for inspected files.
- `limits`: the fixed safety limits used for this run.
- `warnings`: non-fatal duplicate-path notices.
- `discoveryErrors`: path-level errors encountered while expanding inputs.
- `results`: successful single-file reports and per-file failure objects, in lexical path order.

Directory scanning is non-recursive by default; `--recursive` opts into child directories. Discovered file paths are normalized and sorted lexically before inspection so output ordering does not depend on filesystem enumeration order.

Repeated file paths are inspected once and reported in the batch `warnings` array as `DUPLICATE_PATH`. If a directory and explicit file input overlap, the duplicate file is likewise inspected only once.

Invalid or unreadable files do not abort the rest of a batch. Discovery errors (for example a missing root path or a symlink) are listed separately because those paths were not accepted as regular project files. The command returns a nonzero exit code if any file or discovery error occurred; warnings alone do not make the batch fail. Human output provides the same validity and count summary plus one line per result.

## Structural comparison

Compare mode validates both inputs independently with the real project model. It does not rewrite either input and does not attempt an automatic repair.

The JSON result includes:

- `mode: "compare"`, `ok`, `identical`, and `totalChanges`.
- `left` and `right` source summaries: path, byte count, source format/version, migration state, project ID when stored in the source, project name and canvas dimensions.
- `matchPolicy`, which describes the identity rules used.
- `changes.canvas`: changed canvas fields and before/after dimensions/background.
- `changes.palette`: palette entries changed by index, including additions/removals.
- `changes.project` and `changes.metadata`: changed scalar fields with compact before/after previews.
- `changes.layers` and `changes.frames`: records added, removed or modified.
- `changes.cels`: cels added, removed or modified, pixel-index change counts, and bounded samples.
- `changes.summary`: aggregate counts by change family.

Identity matching is deliberately conservative:

- Two v2 documents match layers and frames only by exact source IDs; cels match only by exact `layerId + frameId`. Different IDs are not treated as the same object merely because names or positions happen to match.
- Two legacy single-canvas documents have no source layer/frame IDs, so their normalized one-layer/one-frame structures are compared by position. Generated IDs are ignored.
- A mixed legacy/v2 comparison does not cross-match entities or cels because legacy source identifiers never existed. These records are reported as unmatched with `source-identifiers-not-comparable`.

Pixel arrays are compared by linear row-major index. A present transparent slot (`null`) is different from a missing cel. A missing cel is represented as a cel record with a reason such as `cel-missing`, `layer-removed`, or `frame-removed`; it is not converted into a full array of transparent pixels. Pixel-index samples are capped at 100 per modified cel and include a `truncated` indicator and before/after array lengths. Out-of-range indexes are distinguished from present transparent pixels. Full pixel buffers are never copied into the diff report.

Canvas dimensions may change while a cel remains matched by IDs. The comparison reports canvas-field changes and compares the overlapping/missing row-major pixel indexes; it does not attempt to resample or align artwork.

A valid identical comparison returns exit code 0 and `identical: true`. Differences are informational and also return exit code 0. Invalid inputs or comparison failures return a nonzero exit code and a stable error code. The human report presents the same major counts without printing large buffers.

## Validation and safety

- Validation and migration rules come from `Project.deserializeProject()` and `Project.validateProject()` in `js/project-model.js`.
- Files are opened read-only. The inspector never serializes a migrated project back to disk.
- Input files larger than 64 MiB are rejected before parsing. The limit also guards against a file that grows while it is being read.
- Batch mode is capped at 500 unique files and 32 MiB total input bytes per invocation.
- Directory traversal is capped at 10,000 entries and 32 directory levels.
- Compare mode reads two inputs of at most 64 MiB each (128 MiB combined maximum).
- Symbolic links are not followed, including symlinks discovered inside directories. There is no follow-symlinks override.
- Directory inputs are scanned non-recursively unless `--recursive` is supplied.
- Duplicate batch file paths are de-duplicated; the first normalized occurrence is retained.
- Malformed JSON, unsupported versions, invalid cels, missing references, inaccessible paths and limit violations produce actionable errors and a nonzero exit code.
- With `--json`, failures are JSON objects with `ok: false` and stable error codes. Without it, diagnostics are rendered as human-readable output.
- The tool uses Node built-in modules only. It does not require a service, network access, package installation or account.

The 64 MiB per-file cap and 32 MiB batch aggregate cap are inspector safety limits; a project above an applicable limit is rejected even if it might otherwise fit the project model's structural limits.

## Tests

Run the dedicated test suite:

    node --test tests/project-inspector.test.js

The tests execute the CLI in child Node processes against temporary copies of fixtures. They cover valid v2 and legacy documents, deterministic legacy output, source-file immutability, malformed JSON, invalid cels, missing references, over-limit documents, file-size rejection, argument handling, BOM input, stable batch ordering, recursive scans, per-file failures, duplicate paths, symlink handling, batch file-count/byte limits, v2 structural matching, legacy positional comparison, mixed-format identity boundaries, canvas/palette/layer/frame/cel/metadata changes, missing-cel versus transparent-pixel semantics and bounded pixel-diff samples.
