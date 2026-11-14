# UI-04 palette parser and import acceptance contract

**Scope:** documentation and Node tests only. This contract prepares the palette parser/import portion of UI-04. It does not implement or claim production editor UI, a file picker, project mutation, persistence, or Agent API integration.

The production parser currently available on `main` is `js/palette-formats.js` (`ArtClubPaletteFormats`). It supports GIMP GPL, JASC-PAL 0100 and One Pixel Studio JSON palettes. The contract below defines how a future editor workflow should consume its parse results safely.

## 1. Preview before applying

Selecting a file must create a preview, not immediately mutate the active palette or project.

The preview should show:

- Detected or explicitly selected format and source filename.
- Palette name and columns when the format supplies them.
- Color count, ordered swatches, normalized HEX values and color names when available.
- Duplicate HEX groups, with the original preview positions and names.
- Format limitations and metadata-loss warnings.

Parser calls use `parse(input, format?)`. A successful result has `ok: true` and a normalized `palette`; a failed result has `ok: false`, `palette: null` and structured `errors`. Each error has a stable `code`, user-displayable `message` and 1-based `line`; JSON diagnostics may also have a `path`.

Do not convert a failed parse into an empty palette. Do not clamp RGB values, silently repair malformed files, or discard unknown schema properties.

## 2. Duplicate policy

The parser preserves duplicate entries and source order. Preview must not deduplicate them.

- Compare canonical uppercase `#RRGGBB` values for duplicate detection.
- Report every duplicate group and all preview positions involved.
- Preserve duplicate entries from the source in the preview, even when the user later chooses Replace.
- Existing duplicates in the current palette are not silently cleaned up by an import.

The future Merge decision uses an explicit, deterministic policy: existing colors win. Append imported colors in source order only when their canonical HEX value is not already present in the destination or earlier in the same import. Return/report every skipped imported entry with its source position and HEX value. If nothing is appended, treat Merge as a no-op: do not create a history entry or save.

This policy is intentionally different from Replace. Replace adopts the imported color list exactly, including duplicate entries and order. It must not silently deduplicate imported content.

## 3. User decisions

| Decision | Required behavior |
|---|---|
| **Merge** | After explicit confirmation, retain current palette metadata and existing entries; append only first-seen imported HEX values; report skipped duplicates. |
| **Replace** | After explicit confirmation, replace the target palette with the parsed import, preserving imported order, names and duplicate entries. Show metadata-loss warnings before confirmation. |
| **Cancel** | Close the preview without changing the project, palette, active target, undo history or saved state. |

The UI must not treat closing the preview, pressing Escape, choosing another file, or a parse failure as an implicit Merge or Replace.

## 4. Format-specific metadata

- **GPL:** retains palette name, optional columns, color names, order and duplicate entries.
- **JASC-PAL:** carries RGB rows only. It cannot supply a palette name or color names. The preview must disclose this. Replace must warn that existing names/metadata may be lost; Merge must retain the current palette's metadata.
- **One Pixel Studio JSON:** retains palette name, color names, order and duplicates, subject to the version 1 schema.

All imported colors are normalized to uppercase `#RRGGBB`. JASC-PAL values are RGB data and are not clamped.

## 5. Error and stale-target behavior

- Unknown format, malformed JSON, invalid headers/version/counts, invalid channels, truncated rows, unsupported fields and size-limit violations remain visible diagnostics.
- Keep source line and JSON path information in the error presentation whenever supplied.
- Disable Merge and Replace while the preview is invalid; Cancel remains available.
- Capture the intended project/palette target when the preview begins. Before applying a confirmed choice, revalidate that the same target is still active and valid. If the target changed or disappeared, block the operation and require a new preview.
- Never apply an import to a different project, frame, layer or palette because the user changed selection while a file was being read.

## 6. Immutability and commit boundary

- Parsing and preview are read-only. They must not mutate the current project, palette, file text or parser result.
- Cancel and every parse/validation/stale-target error leave project content unchanged.
- Merge and Replace must build a new palette value rather than mutate the existing project or parsed source object.
- Apply a confirmed decision as one atomic editor operation using the existing undo/save mechanisms. Do not save partial results or create undo entries for preview, Cancel, invalid input or a no-op Merge.
- If application or persistence fails, preserve the previous usable project state; do not silently report success.

No new project counters or schema fields are implied by this contract.

## 7. Acceptance tests and verification boundary

Run:

```sh
node --test tests/palette-import-contract.test.js
node --test tests/*.test.js
```

`tests/palette-import-contract.test.js` exercises the real production palette parser and uses a clearly labelled test-only reference decision model for Merge/Replace/Cancel semantics. It covers preview normalization, duplicate reporting, merge skip reporting, exact Replace behavior, Cancel/no-op immutability, parser errors and JASC-PAL metadata disclosure.

**Important limitation:** the decision model in the Node test is not editor code and does not prove a UI, undo integration, persistence rollback, async target revalidation or Chromium behavior exists. When the coordinator authorizes production UI work, add real Chromium tests against the editor workflow for those gates. Production `index.html` and UI wiring remain coordinator-owned.
