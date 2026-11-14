# Palette workflow contract

This document defines an integration-ready, local-first contract for importing, previewing, transforming, mapping and exporting palettes in One Pixel Studio. It is a specification and adapter example, not a claim that palette controls are already wired into the editor. Production UI and Agent API changes require separate coordinator-issued file locks.

## 1. Design boundaries

- Parsing, analysis and transformation are pure local operations. They must not require a network service, account, API key or backend.
- A successful parse is a preview candidate, not permission to mutate the active project.
- The UI or caller must request an explicit user decision before replacing, merging, reordering or applying mapped colors.
- Cancellation, parse failure and rejected mapping leave the current project byte-for-byte unchanged.
- Color order and duplicates are meaningful. Never silently sort, deduplicate, clamp or discard entries.
- All HEX values are normalized to uppercase #RRGGBB in reports and transformed outputs.
- Bound memory and input before parsing; validate all selected indices and project references before constructing a changed project.
- Keep parse diagnostics, transformation summaries and project-impact reports structured so both UI and optional Agent API adapters can reuse the same behavior.

## 2. Supported file formats and loss matrix

| Format | Reads | Writes | Palette name | Color names | Columns | Order / duplicates |
|---|---|---|---|---|---|---|
| GIMP Palette (.gpl) | Yes | Yes | Preserved | Preserved | Preserved when present | Preserved |
| JASC-PAL 0100 (.pal) | Yes | Yes | Not represented | Not represented | Not represented | Preserved |
| One Pixel Studio JSON | Yes | Yes | Preserved | Preserved | Not represented in the v1 JSON schema | Preserved |

JASC-PAL is an RGB row format. Exporting to it necessarily loses palette-level and per-color names and any application-specific metadata. An export preview must show that loss before download; it must not silently imply that the exported PAL file is a full-fidelity backup.

GPL supports the optional palette name and Columns metadata as well as per-color labels. JSON v1 carries a palette name and optional per-color names with a strict format identifier and version.

## 3. Import pipeline

The recommended import pipeline has these stages:

1. **Acquire text locally.** The future file picker accepts one user-selected file. Reject an empty selection, unsupported extension/format and files larger than 1 MiB before parsing.
2. **Detect format.** Use file extension as a hint and content detection as the source of truth. If the hint and detected header conflict, show the conflict and require the user to choose or cancel; do not guess silently.
3. **Parse without mutation.** Call the palette-format parser and keep the result detached from the current project. A failed parse returns structured diagnostics and no palette.
4. **Build preview.** Show source format, palette name where available, color count, ordered swatches, names where supported, duplicate count and any format loss. Preserve the original sequence.
5. **Choose an operation.** The caller explicitly chooses create/replace, merge, or cancel. If merge is selected, display the source and resulting counts, duplicate behavior and metadata loss.
6. **Commit only after confirmation.** Produce a new palette or project copy and hand that copy to the existing project-state transaction. Never mutate the active palette during file parsing or preview.
7. **Report the result.** Return the committed palette/project revision and a structured summary. If the state transaction fails, preserve the original state and surface the error.

### Parser result shape

The parser result contract is:

```js
{
  ok: true,
  palette: {
    name: "Warm study",
    columns: 3, // GPL only when supplied
    colors: [
      { hex: "#FF2010", name: "Ember" },
      { hex: "#DC6028", name: "Clay" }
    ]
  },
  errors: [],
  warnings: []
}
```

On failure, `ok` is false, `palette` is null, and `errors` contains stable diagnostic codes, human-readable messages, one-based source line numbers and JSON paths where relevant. UI copy should be written from these codes, not by parsing error message strings.

### Browser file-picker adapter example

This is an illustrative adapter only; it is not wired to the editor UI.

```js
async function readPaletteFile(file, explicitFormat) {
  if (!file || typeof file.text !== "function") {
    throw new Error("Choose a local palette file.");
  }
  if (file.size > PaletteFormats.MAX_FILE_BYTES) {
    throw new Error("Palette file exceeds the 1 MiB limit.");
  }

  const text = await file.text();
  const detected = PaletteFormats.detectFormat(text);
  const format = explicitFormat || detected;

  if (!format || (detected && explicitFormat && detected !== explicitFormat)) {
    return {
      ok: false,
      requiresFormatChoice: true,
      detectedFormat: detected,
      palette: null,
      errors: []
    };
  }

  const parsed = PaletteFormats.parse(text, format);
  return {
    ok: parsed.ok,
    format: format,
    palette: parsed.palette,
    errors: parsed.errors,
    warnings: parsed.warnings
  };
}
```

The adapter returns a detached preview value. It must not update the project, selected color, palette panel or undo stack.

## 4. Import preview and user decisions

The preview should clearly distinguish these decisions:

### Create or replace
- Create a new palette entry or replace the current palette only after explicit confirmation.
- Show source and destination names, color counts and whether the operation changes the selected palette.
- Keep duplicate colors unless the user separately chooses a deduplication action.
- Replacing the declared palette must not recolor existing project pixels automatically. Pixels may continue using colors outside the new palette; show the unlisted-color count.

### Merge
- Concatenate palette entries in the chosen source order.
- Do not deduplicate implicitly. Duplicate values can carry different names and intentional ordering.
- Show resulting count, duplicate count and metadata that cannot be represented in the merged object.
- If the resulting count exceeds the supported project palette limit, reject before commit and explain the bound.

### Replace color
- Preview the source HEX, target HEX, matching palette indices and matching project pixels.
- Preserve entry order and names/custom metadata, but warn when a retained name may no longer describe the replacement HEX.
- Require an impact preview and an explicit apply decision before returning a new project copy.

### Cancel
- Cancel is a normal successful user decision, not an error.
- It discards the preview candidate and leaves project data and undo history unchanged.

## 5. Transformation and diagnostics contract

All transformation functions return new data plus a report. The input remains unchanged.

Recommended operation result:

```js
{
  palette: { name: "Combined", colors: [] },
  report: {
    operation: "merge",
    discardedMetadata: [],
    // operation-specific counts and source indices
  }
}
```

The palette utilities currently provide these building blocks:

- `ArtClubPaletteTools.analyzePalette(project, options)`: usage counts, unused/duplicate/unlisted color reports and coverage.
- `ArtClubPaletteTools.estimateReplacementImpact(project, from, to, options)`: matching pixels and bounds without modifying project data.
- `ArtClubPaletteTransformations.reorderPalette / renamePalette / mergePalettes / splitPalette`: palette structure operations with metadata preservation/reporting.
- `ArtClubPaletteTransformations.removeDuplicateColors`: explicit keep-first or keep-last policy with removed-entry report.
- `ArtClubPaletteTransformations.replaceColor / replaceColorInBuffers`: replacement on copies, preserving buffer metadata and null transparency.
- `ArtClubPaletteMapping.extractUsedColors`: deterministic project traversal and first-occurrence mapping.
- `ArtClubPaletteMapping.createPaletteMapping`: exact, nearest RGB and reject-if-no-match policies.
- `ArtClubPaletteMapping.previewProjectPaletteMapping`: per-cel changed/unmapped/transparent counts and changed-pixel bounds.
- `ArtClubPaletteMapping.applyProjectPaletteMapping`: returns a separate project copy, preserving unmapped pixels and null transparency.

Nearest RGB is deterministic but not perceptually uniform. Exact mapping may be partial. Reject-if-no-match is all-or-nothing: do not call apply when the mapping is rejected. Mapping collisions must be shown because several source colors may converge on one target color.

## 6. Export preview and format loss

Before exporting, show:

- selected output format and version;
- palette name and number of colors;
- whether color names, columns or other metadata will be lost;
- whether order and duplicate entries are preserved;
- any validation error or application size/count bound.

For JASC-PAL, explicitly state that palette and color names are not represented and will be lost. Do not offer PAL as a full-fidelity round-trip or backup format.

### Export adapter example

Illustrative only; caller decides how a future download link is presented.

```js
function preparePaletteExport(palette, format) {
  const normalized = PaletteFormats.normalizePalette(palette);
  const content = PaletteFormats.export(normalized, format);
  const loss = format === "pal" || format === "jasc-pal"
    ? ["palette name", "color names", "application metadata"]
    : [];

  return {
    format: format,
    content: content,
    colorCount: normalized.colors.length,
    warnings: loss.length
      ? [{ code: "format-metadata-loss", fields: loss }]
      : []
  };
}
```

The adapter creates text only. A file picker, Blob download or file-system write is a separate UI concern and must not be added to the parser module.

## 7. Project safety and validation

- Project application is copy-on-write: create a validated new project object, then hand it to the existing project transaction/undo system.
- Do not change active layer/frame, selected color, timeline, cel data or palette during preview.
- Null pixels remain null. Never treat them as black or as an indexed palette entry.
- Preserve project layer/frame order and sparse/missing cels according to the project-model contract; do not materialize absent cels simply to make a mapping convenient.
- Enforce current canvas and allocation limits before allocating arrays or copies.
- Reject malformed HEX, unknown IDs, duplicate cel references, sparse arrays and unsupported project versions before apply.
- Keep unlisted project colors visible in reports. Do not silently add/remove palette entries or clamp invalid color channels.
- UI adapters must call a single transaction boundary so the user gets one undoable operation, not a sequence of partially applied cell edits.

## 8. Optional Agent API adapter contract

The existing Agent API/MCP work is owned by Agent 4. This section is a future interface proposal only; it does not modify or claim to implement those endpoints.

A future palette import method should accept:
- an explicit format from `gpl`, `jasc-pal` or `json`;
- local text content or an already validated parsed palette;
- an operation choice `preview`, `create`, `replace` or `merge`;
- a project revision/expected revision when a project operation is requested.

It should return:
- structured parse diagnostics and format warnings;
- a detached preview and operation impact report;
- explicit `accepted`, `applied` and `cancelled` states;
- the resulting palette/project revision only after an accepted transaction.

An Agent API adapter must not bypass the same parser, bounds, mapping policy or project transaction used by the browser UI. It must not accept arbitrary filesystem paths, remote URLs or network fetch instructions. If request cancellation or revision protection is unavailable in the API contract, do not advertise those guarantees.

## 9. Acceptance matrix for future UI/API integration

| Scenario | Expected result |
|---|---|
| Valid GPL with names and columns | Preview retains name, columns, color names and order |
| Valid JASC-PAL | Preview has RGB entries and an explicit no-name-fields note |
| Valid JSON v1 | Preview retains names, version, order and duplicates |
| BOM/CRLF input | Detected and parsed without changing order |
| Invalid header/count/channel/schema | No palette mutation; structured diagnostic |
| Oversized input | Rejected before expensive parsing |
| Merge palettes | Preview shows output count, duplicates and metadata loss |
| Replace a color | Shows palette indices and project pixel impact before apply |
| Exact mapping with unmatched colors | Unmatched values are reported and left unchanged |
| Reject-if-no-match mapping | Apply is blocked for the entire operation |
| Cancel import/mapping | No project or undo-state change |
| Export to JASC-PAL | Name loss shown before file creation |
| Apply accepted project mapping | One copy-on-write transaction and one undo step |
| Agent API and browser path | Same validation, diagnostics, reports and deterministic output |

No production UI, exporter, project-model or Agent API work is authorized by this document alone.
