# Project Diagnostics — Operator and CI Guide

One Pixel Studio includes a local, read-only project inspector. It can inspect one project, inspect a batch, compare two project files, run supplemental diagnostics, preview a legacy migration, or emit a versioned JSON artifact for CI.

The inspector is an offline Node CLI. It uses Node built-ins and the existing `js/project-model.js` as the authority for project migration and validation. It does not require a service, network access, credentials, a backend, or an editor session.

## Quick start

Run commands from the repository root:

```sh
# Human summary for one project
node tools/project-inspector.mjs path/to/project.json

# Stable JSON inspection summary
node tools/project-inspector.mjs --json path/to/project.json

# Inspect multiple files and directories
node tools/project-inspector.mjs --batch --json path/to/project-a.json path/to/project-folder

# Include nested directories
node tools/project-inspector.mjs --batch --recursive --json path/to/project-folder

# Compare two project files
node tools/project-inspector.mjs --compare --json before.json after.json

# Run supplemental structural diagnostics
node tools/project-inspector.mjs --diagnostics --json path/to/project.json

# Preview a legacy-to-v2 migration without writing a converted file
node tools/project-inspector.mjs --migration-preview --json legacy-project.json

# Produce a versioned JSON artifact suitable for CI
node tools/project-inspector.mjs --ci-report path/to/project.json > project-report.json

# Run the inspector test suite
node --test tests/project-inspector.test.js
```

All commands are read-only. JSON modes write reports to standard output; they never write back to project files. The migration preview is the only mode that returns a normalized project object, and that object is an in-memory preview only.

## Single-file inspection

The default command validates one v2 or legacy single-canvas project using the project model. Human output is intended for an operator; `--json` returns a machine-readable summary.

A successful single-file report includes:

- Source format/version and normalized format/version.
- Whether legacy migration occurred in memory.
- Project name and source ID (legacy-generated IDs are represented as null).
- Canvas, palette size, layer/frame/cel counts and active targets.
- Layer visibility/locking/opacity and frame durations.
- Expected/actual pixel totals, occupied/transparent counts and total animation duration.

Invalid JSON, invalid project structure, inaccessible paths and oversized files return a stable error code and a nonzero process exit code.

## Batch inspection

Use `--batch` followed by one or more files and/or directory paths. Directories are non-recursive unless `--recursive` is present.

Batch behavior is deterministic:

- Inputs are normalized and processed in lexical path order.
- Duplicate file paths are de-duplicated and reported as warnings.
- A per-file failure does not prevent the remaining files from being inspected.
- Directory-discovery failures are reported separately from file inspection failures.
- Symbolic links are not followed, including symlinks discovered inside a directory.

Safety limits:

| Limit | Value |
|---|---:|
| Unique files per batch | 500 |
| Aggregate bytes read per batch | 32 MiB |
| Maximum size of one input file | 64 MiB |
| Directory entries visited | 10,000 |
| Recursive directory depth | 32 levels |

The aggregate batch budget is enforced while reading, not only from an initial file-size estimate. If the file-count limit is exceeded, the inspector does not return a misleading partial batch.

With `--json`, a batch report identifies each inspected file, its result/error and the batch-level summary. Without `--json`, the same results are rendered as a concise human report.

## Structural comparison

Use `--compare left.json right.json` to compare two projects without modifying either source.

The report covers canvas/background, palette entries by index, project fields, metadata, layers, frames, cels and pixel-index changes. It does not infer identity from matching names:

- v2 layers/frames match only on exact source IDs.
- Cels match only on exact `layerId + frameId`.
- Two legacy files compare by normalized position, ignoring IDs generated during in-memory migration.
- Mixed legacy/v2 records are not cross-matched and are reported as unmatchable rather than falsely removed or added.

The report distinguishes a missing cel from a present cel containing transparent `null` pixels. Pixel changes are row-major and bounded to 100 samples per modified cel; full pixel buffers are never emitted. Comparison reads at most 64 MiB per input (128 MiB combined).

## Deep diagnostics and risk scoring

Use `--diagnostics [--json] project.json` for additional structural checks.

Model validation remains authoritative. The output separates:

- `schema.checked`, `schema.valid` and `schema.errors`: the result from the existing project model.
- `diagnostics[]`: supplemental findings, each with a stable code, severity, source path, message and optional details.
- `summary`: severity counts.
- `risk`: a deterministic 0–100 score calculated from supplemental findings only.

Diagnostic coverage includes:

| Finding family | Representative codes | Severity |
|---|---|---|
| Root, file and format | `PROJECT_ROOT_INVALID`, `DOCUMENT_BYTE_LIMIT`, `UNSUPPORTED_FORMAT`, `UNSUPPORTED_VERSION` | Critical |
| Canvas | `CANVAS_WIDTH_INVALID`, `CANVAS_HEIGHT_INVALID` | High |
| Identifiers and active targets | `LAYER_ID_DUPLICATE`, `FRAME_ID_DUPLICATE`, `ACTIVE_LAYER_MISSING`, `ACTIVE_FRAME_MISSING` | High |
| Cel structure and references | `CELS_NOT_ARRAY`, `CEL_ENTRY_INVALID`, `CEL_LAYER_REFERENCE_INVALID`, `CEL_FRAME_REFERENCE_INVALID`, `CEL_PAIR_DUPLICATE` | High |
| Pixel arrays | `PIXEL_ARRAY_NOT_ARRAY`, `PIXEL_ARRAY_SHORT`, `PIXEL_ARRAY_LONG`, `PIXEL_ARRAY_HOLE` | Critical |
| Pixel values | `PIXEL_COLOR_INVALID`, `PIXEL_COLOR_NOT_IN_PALETTE` | High / medium |
| Palette | `PALETTE_COLOR_DUPLICATE`, `PALETTE_ENTRY_UNUSED` | Low |
| Pixel budgets | `DOCUMENT_PIXEL_BUDGET_EXCEEDED`, `DOCUMENT_EXPECTED_PIXEL_BUDGET_EXCEEDED` | Critical / high |

An explicit `null` pixel is transparent and valid. A sparse JavaScript array hole is not the same thing as `null`; JSON text cannot encode an array hole, so `PIXEL_ARRAY_HOLE` is a defensive diagnostic rather than a fixture that can be represented in a JSON file.

The risk score uses fixed weights: critical 60, high 25, medium 10, low 3, info 0. The score is capped at 100. Supplemental findings do not rewrite or override the model's validation result. The diagnostics command exits nonzero when the input cannot be read/parsed or when model validation is invalid; supplemental warnings alone do not fail an otherwise model-valid document.

## Deterministic migration preview

Use `--migration-preview [--json] legacy-project.json` for a legacy single-canvas file only.

The command calls the real `Project.deserializeProject()` migration path and validates the normalized v2 object with `Project.validateProject()`. It does not repair invalid source data or write a converted file.

The JSON report contains:

- `source.file`, `source.byteCount`, `source.sha256`, original format and version.
- `migration.fromVersion` / `migration.toVersion`.
- `transformedFields`, `preservedFields`, `generatedFields`, `discardedFields` and `warnings`.
- `normalizedPreview`: the complete in-memory v2 preview, and `normalizedJsonBytes`.

To keep the output deterministic, generated project/layer/frame identifiers are replaced in the preview with source-hash-derived placeholders. They are explicitly not source identities. Migration timestamps use the fixed epoch marker `1970-01-01T00:00:00.000Z`; they are not source timestamps. Unrecognized top-level legacy fields are listed in `discardedFields` with a warning instead of silently disappearing from the report.

The input limit is 64 MiB. The normalized JSON preview is capped at 16 MiB. Oversized, malformed, non-legacy and model-invalid input returns a structured error. A v2 project is rejected with `NOT_LEGACY_PROJECT`.

## CI artifact report

Use `--ci-report project.json` to emit a single versioned JSON artifact. The command always writes JSON to standard output; `--json` is accepted but not required.

Artifact identity:

- `artifactType`: `application/vnd.one-pixel-studio.project-inspection+json`
- `artifactSchemaVersion`: `1`

The report includes:

- `status`: `valid`, `invalid` or `incomplete`.
- `input`: path, byte count, source format and source version.
- `projectSummary`: the regular inspector summary for valid projects, otherwise null.
- `validation`: authoritative model-validation result and errors.
- `diagnostics`: supplemental findings with severity and source paths.
- `counts`: per-severity diagnostics, model errors and total findings.
- `risk`: supplemental risk score.
- `exitCode` and `exitCodePolicy`.
- `readOnly`: explicit input/output write flags.

Exit codes are stable:

| Code | Meaning |
|---|---|
| 0 | The file was read and parsed and model validation passed. Supplemental findings are still included in the report. |
| 1 | The file could not be read/parsed or model validation failed. A JSON artifact is emitted whenever the command could construct one. |
| 2 | Command-line arguments are invalid; no project artifact is emitted. |

The report has no generation timestamp, so it is deterministic for an unchanged file and inspector version. SARIF is deliberately not emitted: the native diagnostic codes, JSONPath-like paths and severity model have not been mapped to a reviewed SARIF rule/result contract. The versioned native JSON format avoids a misleading compatibility claim and requires no dependency.

## Diagnostic fixture matrix and test coverage

The checked-in fixture corpus includes:

| Fixture | Primary diagnostic coverage |
|---|---|
| `diag-root-not-object.json` | Root is not a project object |
| `diag-unsupported-format-version.json` | Unsupported format and version |
| `diag-invalid-dimensions.json` | Invalid canvas width and height |
| `diag-duplicate-identifiers-active-targets.json` | Duplicate layer/frame IDs and missing active targets |
| `diag-cel-entry-and-reference-errors.json` | Invalid cel entry/references and duplicate layer/frame pair |
| `diag-cels-not-array.json` | Cel collection is not an array |
| `diag-pixel-array-shape-errors.json` | Non-array, short and long pixel arrays |
| `diag-invalid-pixels-and-palette.json` | Invalid/out-of-palette colors, duplicate and unused palette entries |
| `diag-expected-pixel-budget.json` | Expected pixel-data budget exceeded |

The 64 MiB byte-limit test truncates a temporary copy rather than checking a 64 MiB file into the repository. Malformed JSON, legacy and v2 valid documents, invalid cels, missing references and oversized pixel input also have dedicated fixtures. Tests compare source bytes before/after inspection, batch scanning, comparison, diagnostics, migration preview and CI reporting.

Run the focused suite:

```sh
node --test tests/project-inspector.test.js
```

The test suite runs child Node processes against temporary copies of fixtures. Browser editor tests, GIF ImageDecoder verification and MCP integration run separately in the repository's GitHub Actions project-test workflow.

## Safety and integration boundaries

- The inspector never writes, repairs, normalizes or migrates source files on disk.
- Legacy normalization is in memory only and only where explicitly requested by inspection/comparison/preview.
- Symbolic links are never followed; there is no follow-symlinks override.
- File and directory limits are enforced before unbounded reads/traversal.
- Project model validation remains the acceptance authority; supplemental diagnostics are labelled separately.
- The CLI is an offline developer tool. It is not wired into the editor UI, storage layer, Agent API or bridge by these PRs. A downstream integration must explicitly decide when and where to invoke it.
- All report modes write to stdout; redirect stdout to an artifact file in CI. Do not redirect error output into the JSON artifact.
