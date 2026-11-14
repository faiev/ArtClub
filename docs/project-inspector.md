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

Run supplemental deep diagnostics and risk scoring:

    node tools/project-inspector.mjs --diagnostics project.json

Print machine-readable deep diagnostics:

    node tools/project-inspector.mjs --diagnostics --json project.json

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

## Deep diagnostics and risk scoring

Run `--diagnostics` for supplemental structural and risk checks on one project file. The mode parses the source once, runs the existing project model's validation, and separately emits additional findings. It never repairs, rewrites, fills, removes or normalizes source data.

The JSON output keeps authoritative model validation separate:

- `ok`: whether the input could be read and parsed and a diagnostic report was produced.
- `schema.checked`: whether the project model was able to evaluate the document.
- `schema.valid`: the result from `Project.validateProject()` (or the model's legacy deserializer followed by validation); null when reading/parsing prevented validation.
- `schema.errors`: exact model validation messages. These remain the authority for whether the project conforms to the current project format.
- `diagnostics`: supplemental checks with stable `code`, `severity`, JSON-style `path`, `message` and `source: "supplemental"`.
- `summary`: total diagnostics by severity.
- `risk`: a 0–100 score and level (`low`, `moderate`, `high` or `critical`).

Current supplemental checks include:

| Diagnostic code | What it detects |
|---|---|
| `UNSUPPORTED_FORMAT`, `UNSUPPORTED_VERSION` | Format/version values not supported by the current project model |
| `CANVAS_WIDTH_INVALID`, `CANVAS_HEIGHT_INVALID` | Non-integer, zero, negative or over-limit dimensions |
| `LAYER_ID_DUPLICATE`, `FRAME_ID_DUPLICATE` | Duplicate identifiers within their respective collections |
| `CEL_LAYER_REFERENCE_INVALID`, `CEL_FRAME_REFERENCE_INVALID` | Cel references to a missing layer or frame |
| `CEL_PAIR_DUPLICATE` | Multiple cels for the same layer/frame pair |
| `ACTIVE_LAYER_MISSING`, `ACTIVE_FRAME_MISSING` | Active identifiers that do not resolve to a current layer/frame |
| `PIXEL_ARRAY_NOT_ARRAY`, `PIXEL_ARRAY_SHORT`, `PIXEL_ARRAY_LONG`, `PIXEL_ARRAY_HOLE` | Missing, malformed, truncated or overlong cel pixel arrays |
| `PIXEL_COLOR_INVALID` | Pixel values that are neither null nor six-digit HEX |
| `DOCUMENT_BYTE_LIMIT`, `DOCUMENT_PIXEL_BUDGET_EXCEEDED`, `DOCUMENT_EXPECTED_PIXEL_BUDGET_EXCEEDED` | Input byte size or actual/expected pixel-slot budgets beyond inspector/model limits |
| `PALETTE_COLOR_DUPLICATE`, `PALETTE_ENTRY_UNUSED` | Duplicate case-insensitive HEX entries or palette entries not found in cel pixels |
| `PIXEL_COLOR_NOT_IN_PALETTE` | Valid HEX pixel colors absent from the declared palette |

An explicit JSON `null` pixel is transparent and is not a sparse-array hole. JSON text cannot directly encode JavaScript array holes; a shortened pixel array is reported as `PIXEL_ARRAY_SHORT`, while a hole check remains in place for any sparse array representation encountered by the diagnostic code. No missing values are filled.

Severity contributes to the risk score using fixed weights: critical 60, high 25, medium 10, low 3, info 0. Scores are capped at 100. A single critical diagnostic therefore raises the risk level to critical. Palette anomalies are warnings and do not, by themselves, make a model-valid document schema-invalid.

The command exits nonzero when the input cannot be read/parsed or when `schema.valid` is false. Supplemental warnings do not override the model's schema result. A project can therefore be model-valid while still carrying medium/low risk findings. Conversely, an invalid project stays schema-invalid even if a supplemental check does not identify the same issue.

An oversized file is rejected before parsing and returns a structured report with `schema.checked: false`, `schema.valid: null`, and a `DOCUMENT_BYTE_LIMIT` diagnostic. Unsupported versions and malformed structures that can still be parsed return both the model's schema errors and independent supplemental findings.

## Deterministic migration preview

Run `--migration-preview` for a legacy single-canvas source file:

    node tools/project-inspector.mjs --migration-preview old-project.json

Use `--json` to receive the full normalized v2 preview payload:

    node tools/project-inspector.mjs --json --migration-preview old-project.json

The command is a preview only. It calls the existing `Project.deserializeProject()` / legacy migration logic and `Project.validateProject()`, then presents the resulting v2 representation together with a structured migration report. It never writes the normalized representation to disk and never edits the source.

The report contains:

- `source.file`, `source.byteCount`, and `source.sha256`: path, exact original byte count and SHA-256 calculated from source bytes (including a UTF-8 BOM, if present).
- `source.format` and `source.version`: original legacy format/version.
- `migration.fromVersion` / `migration.toVersion`.
- `migration.transformedFields`: source-to-target mappings for width/height, name, selected palette index, pixel data and version upgrade.
- `migration.preservedFields`: values copied without reordering, including palette order.
- `migration.generatedFields`: v2 fields supplied by the project model or represented by preview-only values.
- `migration.discardedFields`: legacy-only markers and unrecognized top-level source fields that the current model migration does not consume. These are named explicitly rather than silently disappearing from the migration report.
- `migration.warnings`: defaults applied by the model and preview-only metadata policy.
- `normalizedPreview`: the full normalized project object, with deterministic placeholders for fields that the legacy source never contained.
- `normalizedJsonBytes`: compact JSON byte length of the normalized preview.

The project model normally creates IDs and timestamps during legacy migration. To keep previews deterministic, this command replaces those generated values in the *preview object only*:
- Project/layer/frame IDs use stable placeholders derived from the SHA-256 of the source bytes.
- Metadata timestamps use the fixed epoch marker `1970-01-01T00:00:00.000Z`.
- The report explicitly marks these IDs/timestamps as preview-only and not source identities or source timestamps. Do not persist these placeholders as though they were part of the original legacy file.

Legacy `projectName` and `selected` defaulting are surfaced in `transformedFields` and `warnings`; unrecognized top-level fields are listed in `discardedFields` with a warning. The actual model's migration result remains authoritative. A legacy source with invalid dimensions, palette or pixel data is rejected; the preview does not repair missing values.

Migration preview accepts legacy single-canvas inputs only. A v2 source returns `NOT_LEGACY_PROJECT` rather than pretending to perform a migration. Malformed and oversized inputs return structured errors. Input files larger than 64 MiB are rejected before parsing; the rejected-input report includes the measured file size, but cannot include a source hash because the file was not read. A 16 MiB normalized-preview JSON cap prevents excessively large output payloads.

The command returns a nonzero exit code for unreadable, malformed, unsupported or invalid legacy input. Successful preview returns zero even when the report contains explanatory warnings. The source is always left unchanged.



## Versioned CI artifact report

Run `--ci-report` to emit one versioned JSON document suitable for saving as a CI artifact:

    node tools/project-inspector.mjs --ci-report path/to/project.json > project-report.json

The command always emits JSON; `--json` is accepted as a harmless explicit-output flag but is not required. The report is deterministic for a given input and inspector version: it contains no generation timestamp.

The artifact contract is identified by:

- `artifactType: "application/vnd.one-pixel-studio.project-inspection+json"`
- `artifactSchemaVersion: 1`

Top-level fields:

- `status`: `valid`, `invalid`, or `incomplete`. Incomplete means the source could not be read or parsed, so model validation was not completed.
- `input`: source path, measured byte count, source format and version. Values are null when unavailable.
- `projectSummary`: the normal inspector project summary for model-valid input. It is null for invalid or unreadable input. Legacy projects are identified as migrated in memory only; synthetic model IDs are not reported as source IDs.
- `validation`: `checked`, `valid`, and authoritative model `errors`.
- `diagnostics`: supplemental diagnostic records with stable code, severity, JSONPath-like source path, message and optional details. These findings do not overwrite model validation.
- `counts`: total diagnostics, severity counts, model-validation error count and combined finding count.
- `risk`: the same bounded 0–100 supplemental risk score as deep diagnostics.
- `exitCode` and `exitCodePolicy`: the exact CLI result and its documented meaning.
- `readOnly`: confirms that no input or output file was modified or written by the command.

Exit-code policy:

| Code | Meaning |
|---|---|
| 0 | Source was read and parsed and authoritative project-model validation passed. Supplemental findings remain visible in the artifact but do not independently fail the command. |
| 1 | Source could not be read or parsed, or authoritative model validation failed. A JSON artifact is still emitted whenever the CLI could construct a report. |
| 2 | CLI arguments are invalid. No project artifact is produced. |

Example outline:

    {
      "artifactType": "application/vnd.one-pixel-studio.project-inspection+json",
      "artifactSchemaVersion": 1,
      "tool": {
        "name": "one-pixel-studio-project-inspector",
        "mode": "ci-report"
      },
      "status": "valid",
      "input": {
        "path": "project.json",
        "byteCount": 2048,
        "sourceFormat": "one-pixel-studio",
        "sourceVersion": 2
      },
      "projectSummary": {
        "name": "Example",
        "canvas": { "width": 32, "height": 32 },
        "layerCount": 2,
        "frameCount": 4
      },
      "validation": {
        "checked": true,
        "valid": true,
        "errors": []
      },
      "diagnostics": [],
      "counts": {
        "diagnostics": 0,
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0,
        "info": 0,
        "modelValidationErrors": 0,
        "totalFindings": 0
      },
      "risk": { "score": 0, "level": "low" },
      "exitCode": 0,
      "readOnly": {
        "inputModified": false,
        "outputWritten": false
      }
    }

SARIF output is intentionally not emitted. The inspector currently reports project JSON paths, custom diagnostic codes and its own severity/risk model; claiming SARIF compatibility without a reviewed rule/result mapping would create a misleading artifact contract. The versioned native JSON report has no external dependency and can be uploaded directly by CI systems.

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
