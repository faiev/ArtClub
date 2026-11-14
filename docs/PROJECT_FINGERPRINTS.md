# Project Fingerprints — Exact and Semantic Duplicate Detection

The project fingerprint tool creates two different SHA-256 values for each supported project:

- **Source-byte fingerprint:** hashes the original file bytes exactly. Whitespace, key order, a byte-order mark, project identity fields and timestamps all affect this hash.
- **Semantic content fingerprint:** hashes a documented, versioned canonical projection of the validated artwork. It ignores selected identity/editor metadata while preserving the artwork structure and pixel data described below.

The tool is local and read-only. It never rewrites, repairs, migrates or normalizes a source file on disk. Legacy projects are migrated only in memory through the existing project model so their artwork can be projected without treating generated IDs as source IDs.

## Quick start

Run from the repository root:

~~~sh
# Fingerprint one project; JSON is recommended for automation
node tools/project-fingerprint.mjs --json path/to/project.json

# Fingerprint a directory recursively and report exact/content-equivalent groups
node tools/project-fingerprint.mjs --batch --recursive --json path/to/projects/

# Human-readable output
node tools/project-fingerprint.mjs path/to/project.json

# CLI help
node tools/project-fingerprint.mjs --help
~~~

Run the focused tests with:

~~~sh
node --test tests/project-fingerprint.test.js
~~~

## Fingerprint schema

A successful single-file JSON report contains:

- `input`: source path, byte count, source format and source version.
- `projectIdentity`: the source project ID and name, reported separately from content identity. Legacy v1 has no source project ID; any IDs created during in-memory migration are not reported.
- `fingerprints.sourceBytes`: SHA-256 over the exact original bytes.
- `fingerprints.semanticContent`: SHA-256 over the canonical projection and its `canonicalVersion`.
- `semanticPolicy`: included/excluded fields and the rule that only equal canonical versions are comparable.
- `readOnly`: explicit input/output write flags, both false.

The source-byte digest is calculated from the original buffer before UTF-8 decoding or JSON parsing. It therefore preserves differences in whitespace, property order, encoding markers and metadata.

## Semantic canonicalization version 1

Version 1 accepts the current One Pixel Studio v2 document format and legacy single-canvas v1 documents. Both are validated through `js/project-model.js`. Legacy documents are migrated in memory using the actual model migration path. The canonical projection removes IDs and uses ordered layer/frame positions to associate cels.

**Included artwork semantics:**

- Canvas width, height and background.
- Palette entries in their original order. Valid HEX strings are lowercased before hashing because HEX letter case does not change the represented RGB value.
- Layer order, layer names, visibility, lock state and opacity.
- Frame order, frame names and durations.
- Cel presence and the cel's layer/frame position.
- Every pixel in each present cel, including explicit transparent `null` values. Pixel HEX strings are lowercased before hashing.

**Excluded identity/editor metadata:**

- Project ID and project name.
- Layer and frame IDs. Cel references are represented by layer/frame positions instead.
- Project metadata, including creation/update timestamps.
- Selected palette index.
- Active layer and active frame selection.
- Unknown top-level extension fields that the current v2 project model does not interpret.

Layer and frame names remain included because they are meaningful labels within the artwork structure; changing them changes the semantic fingerprint. Palette order, layer order and frame order are significant. A missing cel is different from a present cel whose pixels are all transparent. A one-pixel change changes the semantic fingerprint.

Legacy-generated project/layer/frame IDs are intentionally discarded from the projection and never returned as source identities. The same legacy source therefore receives a stable semantic fingerprint even though the model may create fresh IDs during each in-memory migration.

## Comparability and duplicate rules

The semantic fingerprint carries a `canonicalVersion`. Compare or group semantic fingerprints **only when their canonical versions match**. Batch mode includes the canonical version in the semantic grouping key, so a future version cannot accidentally be grouped with version 1.

- **Byte-identical group:** all files have the same source-byte SHA-256. This is exact source-file identity under SHA-256.
- **Semantic content-equivalent group:** all files have the same semantic SHA-256 for the same canonical version. They may differ in project ID/name, timestamps, JSON formatting, editor selection or other excluded fields.
- **Not a duplicate:** similar-looking artwork, approximate color matches, perceptual similarity, or shared thumbnails are never inferred. No fuzzy or approximate matching is performed.

A semantic match means exact equality under this canonical projection, not proof that two files have the same project identity or that every future/unknown extension field is equivalent.

## Batch behavior and safety limits

Batch mode accepts explicit files and directories. Directory traversal is non-recursive by default; use `--recursive` to include nested directories. Paths are normalized and processed in deterministic lexical order. Repeated paths are de-duplicated. Each file error is reported without discarding successful results from other inputs.

| Bound | Limit |
|---|---:|
| Maximum files per batch | 500 |
| Aggregate bytes read per batch | 32 MiB |
| Maximum one-file input | 64 MiB |
| Directory entries visited | 10,000 |
| Recursive directory depth | 32 levels |

Symbolic links are not followed, including links found inside scanned directories. Inputs must be regular files containing valid UTF-8 JSON and a supported project document. The tool rejects malformed JSON, invalid UTF-8, unsupported formats/versions, model-invalid projects and oversized inputs with stable error codes.

Batch JSON contains ordered per-file results, discovery errors, warnings, exact-byte duplicate groups, semantic content-equivalent groups, summary counts and the applied limits. A failed file does not prevent inspection of remaining files, subject to the aggregate byte budget.

## Exit behavior

| Exit code | Meaning |
|---|---|
| 0 | Single-file fingerprint completed, or every batch file/discovery operation completed without errors. |
| 1 | A file was unreadable, malformed, oversized, unsupported or invalid; or batch discovery found an error. |
| 2 | Command-line arguments are invalid. |

The tool writes human or JSON reports to standard output as requested. It does not create report files; redirect standard output explicitly when an artifact is needed.

## Maintenance policy

Any future change to the canonical projection that can change semantic equivalence must increment `SEMANTIC_CANONICAL_VERSION`. Do not silently reinterpret old hashes. A consumer comparing stored fingerprints must reject cross-version comparisons or recompute both inputs with the same canonicalizer. Exact source-byte fingerprints remain independent of the semantic canonicalization version.
