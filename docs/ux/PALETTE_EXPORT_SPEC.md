# Palette and Export User-Journey Specification

**Task:** AC-051 — Palette and export user-journey specification  
**Owner:** Agent 5 — UX / interaction design / accessibility  
**Branch:** `agent/palette-export-spec`  
**Status:** Specification only; no production UI, application implementation or format module changes are included.

---

## 1. Product outcome

Users should be able to bring a palette into a project, understand exactly what will be kept or lost, edit it safely, and export a named asset without guessing about frame order, transparency, timing, dimensions or output limits.

The palette and export flows should be organized around completed jobs:

- **Palette import:** choose a local file → detect and validate its format → review colors, names, duplicates and diagnostics → choose replace/merge behavior → explicitly apply or cancel.
- **Palette editing:** select, add, remove, rename where supported, reorder and analyze colors → preview impact → commit one undoable change.
- **Palette export:** choose format → review format-specific information loss → choose filename → download and confirm success.
- **Image export:** choose current frame/composite or layer → choose dimensions/scale and transparency/background → preview → validate → download.
- **Animation export:** choose frames/order/layers → choose GIF or sprite sheet → review timing/transparency/layout/budget → preflight → preview metadata/size → encode and download files.

This specification uses the current source and the independent module contracts already submitted by Agents 3 and 8. It distinguishes implemented behavior from proposed UI work and does not edit their modules.

## 2. Current behavior verified in source

### 2.1 Palette UI on main

The current editor has a palette panel with:

- A swatch grid; clicking a swatch selects the color.
- A preset selector for Studio, Arcade, Ember, Monochrome and Custom.
- A native color picker and a HEX text field.
- An Add Color button.
- Right-click/context-menu removal with confirmation.
- A rule that prevents removing the final palette swatch.
- Removing a swatch does not change existing artwork pixels; current source explicitly says existing pixels keep that color.
- Adding a color already present selects the existing swatch instead of inserting a duplicate.
- Changing presets is an undoable palette change and autosaves.
- ProjectModel stores palette colors as HEX strings. It does not store palette name or per-color names in its v2 palette array.

There are no current GPL/JASC-PAL/JSON import/export controls on main. Agent 8's parser is on its feature branch and PR #16, not yet integrated. There is also no import preview, merge/replace chooser, duplicate report, file validation dialog, color-name editor or palette analysis panel in the production UI.

### 2.2 Current export controls on main

The current Export panel exposes:

- PNG at 1× (native logical canvas dimensions).
- PNG at 16×.
- SVG vector output with crisp edges.
- Editable Project JSON export.
- Open Project JSON import.

The PNG path builds a native composite from the active frame and draws at the selected integer scale with smoothing disabled. The SVG path emits one rectangle per non-transparent logical pixel. The JSON path serializes the project snapshot. The current UI derives filenames from the project name and dimensions; it does not offer a general filename editor.

There are no current palette file downloads, GIF controls, sprite-sheet controls, export frame selectors, output profiles, output preview, metadata preview, size estimate or export cancellation controls in the production UI.

### 2.3 Local-first behavior

Art Club is intended to remain a static/local-first app. Palette and artwork files are processed in the browser. Import/export must not require accounts, network uploads, paid services or remote APIs. Browser download and local file selection are the normal routes.

## 3. Palette format contract and limitations

Agent 8's `js/palette-formats.js` and `docs/palette-formats.md` define the current parser/export contract. PR #16 remains a separate module submission; the format module is not yet wired into the main editor.

### 3.1 Supported palette formats

| Format | Recognized input | Preserves | Does not preserve |
|---|---|---|---|
| GIMP GPL | `.gpl`, GIMP Palette header | Palette name, optional Columns metadata, color names, order and duplicate entries | Alpha channel; palette format is RGB-only |
| JASC-PAL 0100 | `.pal`, JASC-PAL header/version 0100 | RGB values, order and duplicate entries | Palette name and color names; the format has no fields for them |
| One Pixel Studio JSON | `.json`, versioned app palette schema | Palette name, color names, order and duplicate entries | Unknown future fields are rejected by the strict v1 parser |

The app palette JSON schema uses format identifier `one-pixel-studio-palette`, version 1, a palette name and an ordered colors array containing `hex` plus optional `name`.

### 3.2 Parser normalization and validation

The submitted parser contract:

- Normalizes valid colors to uppercase six-digit `#RRGGBB`.
- Expands three-digit HEX to six-digit HEX where the format supports it.
- Requires RGB channels to be decimal integers from 0 through 255; it never clamps invalid values.
- Preserves order and duplicates rather than silently sorting or deduplicating.
- Limits source files to 1 MiB UTF-8 and palettes to 1–4,096 colors.
- Limits palette and color names to 256 characters, single-line and non-empty where supplied.
- Removes a leading UTF-8 BOM.
- Returns a structured parse result: `ok`, `palette`, `errors` and `warnings`.
- Returns a null palette when parsing fails. Diagnostics contain a stable code, message and 1-based line; JSON schema diagnostics also provide a path where available.
- Rejects unknown JSON top-level fields and unknown color-entry fields.
- Requires JASC-PAL header `JASC-PAL`, version `0100`, declared count and exactly that many RGB rows (trailing blank lines are permitted).
- Requires GPL to start with `GIMP Palette`; accepts blank lines and hash comments, and validates optional Name/Columns metadata.
- Exposes explicit per-format and unified parse/export functions. Export validation throws descriptive errors rather than silently dropping malformed values.

These limits and diagnostics are part of the product contract. The UI must not silently truncate a file, clamp RGB, drop duplicate entries or turn parse errors into partial imports.

### 3.3 Name-loss boundary in the current project model

The current v2 project model stores palette entries as HEX strings only. It does not persist palette name, color names or GPL Columns metadata.

Therefore:

- Import preview can show the full parsed name/metadata before application.
- Applying a palette to a v2 project cannot claim that imported color names are saved in the project.
- If imported color names or palette metadata would be discarded, the UI must disclose that before applying. Provide a user decision to continue with HEX-only project palette data or cancel.
- GPL and JSON export from a v2 project can only include names that exist in a supported palette metadata source; they must not invent names. A later model extension or a dedicated palette-library feature may persist names, but that is outside AC-051.
- JASC-PAL export always warns that palette/color names are not representable.

### 3.4 Duplicate-color policy

The parser preserves duplicate entries and order. The UI must preserve that behavior by default.

For an import preview, report:
- Total entries.
- Unique normalized HEX colors.
- Duplicate count and duplicate positions.
- Case-only duplicates after normalization.
- Named versus unnamed entries.

Offer explicit apply modes:

1. **Preserve as imported** (default): keep all entries in source order, including duplicates.
2. **Add unique colors** (optional merge mode): skip colors already in the current palette and skip duplicate HEX entries in the imported file; display exactly which entries will be skipped before apply.
3. **Keep first / Keep last** (optional cleanup operation): only offered as an explicit palette-cleanup action, never applied silently on import.

The parser's order and duplicate preservation remains the source truth; the UI can offer optional transformation only after preview and user choice.

## 4. Palette import journey

### Step A — Choose a local file

- Provide a visible Import Palette action in the palette panel.
- Accept GPL, PAL and JSON file extensions, but detect/validate file contents rather than trusting the extension.
- Allow the user to explicitly select a format when auto-detection is ambiguous.
- Explain that the file is read locally in the browser and is not uploaded.
- Canceling the file picker or closing the flow makes no project change.

### Step B — Parse and validate

Before the user sees an Apply action:

- Read the source as text and enforce the 1 MiB UTF-8 byte limit.
- Detect GPL/JASC-PAL/JSON by content or use the explicitly selected parser.
- Validate the entire file. Do not partially import valid rows while ignoring malformed rows.
- Keep the current project palette unchanged on any parser error.
- Show format name and source filename.
- Return all available line/path diagnostics with stable error codes and human-readable messages.
- Never pass malformed input into project state.

### Step C — Review import preview

The preview must show:

- Detected format and source filename.
- Palette name when available.
- Total and unique color counts.
- Duplicate entry count and locations.
- Names-preserved / names-not-supported explanation.
- A visual swatch list in original source order.
- Invalid/error rows, with line number or JSON path.
- Whether the current project palette will be replaced, appended or merged.
- Whether any current artwork colors will be missing from the incoming swatch set after replace.

The preview must be responsive for up to 4,096 colors: virtualize or paginate large swatch lists while preserving a count and source-order reference. Do not render thousands of high-cost controls at once.

### Step D — Choose how to apply

Provide distinct choices:

**Replace palette**
- Replaces the project's palette swatch list with the imported HEX entries in source order.
- Does not recolor existing cel pixels. Project pixels store literal HEX colors, not palette indices.
- Warn if any currently used artwork colors are absent from the new palette. They remain in the artwork but cannot be selected from the palette until re-added.
- Show name-loss disclosure if imported color names/metadata cannot be stored in the project v2 palette model.

**Merge palette**
- Preserve current swatch order, then append imported entries according to the selected duplicate policy.
- Provide both “Append all” (preserve imported duplicates) and “Add unique colors” (explicit skip report) modes.
- Do not recolor artwork pixels.
- Do not move the current selected color silently if the existing selected swatch remains present.

**Cancel**
- Discard preview and keep the current project, active color, history and saved state unchanged.

A future Replace-and-Map workflow may use Agent 8's palette mapping/impact-report tools (AC-070), but must remain separate from ordinary palette import. Never silently map existing pixels to nearest colors during Replace or Merge.

### Step E — Apply and confirm

- Validate the final proposed palette length and values before mutation.
- Commit palette changes as one undoable operation.
- Preserve existing cel buffers exactly.
- Preserve selected color by HEX if that color remains; otherwise select a clearly indicated fallback (recommended first imported color) and announce the selection change.
- Schedule local save and report the imported format, number of colors applied/skipped and any metadata limitations.
- If save fails, leave the user informed that the change may not be persisted; do not claim it is safely saved.
- If any validation or application step fails, preserve the original palette/project state (atomic apply).

## 5. Palette editing journey

### 5.1 Select and add colors

- Selecting a swatch sets the active drawing color and updates its HEX label.
- Adding a color validates normalized HEX. If it already exists, select the existing swatch and explain that no duplicate was added.
- A newly added color is appended in order and becomes the selected color.
- Keep the current color picker and HEX entry behavior, but surface validation inline rather than relying only on a toast.
- A color change should not rewrite existing cel pixels.

### 5.2 Remove a color

The current source exposes right-click removal. The target workflow must provide a discoverable control for mouse, touch and keyboard users.

- Offer Remove Color in a swatch context menu or selected-color inspector; do not make right-click the only path.
- Confirm removal with the HEX value and explain that existing artwork pixels keep that color.
- Prevent removal of the final palette entry.
- If the removed swatch was selected, select a deterministic neighboring swatch and announce the change.
- Undo restores the exact palette order and selected color.
- Removing a swatch must not mutate cel pixels or project dimensions.

### 5.3 Rename, reorder, duplicate and cleanup

These operations require color-name persistence beyond the current v2 HEX-only palette array. Until the project format supports names:

- Keep imported names in preview/temporary palette-library context; do not display a Rename control that appears to persist while it cannot be saved.
- Reordering swatches, if added, must change only palette order; cel pixels remain unchanged.
- Duplicate swatch, if explicitly offered, must warn that duplicate HEX entries are allowed and will not create a distinct drawing color.
- Duplicate removal/merge and global replace must be separate, previewed transformations using Agent 8 AC-069/AC-070 utilities after their contracts are accepted.
- Every destructive cleanup shows before/after counts and exact impact; no silent deduplication.

### 5.4 Palette analysis

Agent 8's AC-067/AC-070 workstream plans utilities for color usage, unused/duplicate colors, nearest-color matching, replacement impact and deterministic project mapping. Once accepted:

- Provide a read-only analysis panel showing used colors, unused swatches, duplicate HEX values and coverage.
- Show color usage counts across project cels, with optional hidden-layer/frame scope clearly labelled.
- Any Replace/Merge/Remap action must display an impact report before commit.
- A nearest-color suggestion is not an automatic edit; users explicitly accept the mapping.
- Analysis does not mutate the source project.

## 6. Palette export journey

### Step A — Choose format

Offer GPL, JASC-PAL (.pal) and One Pixel Studio JSON.

Before export, show a format capability summary:

- GPL: palette name, Columns metadata and color names can be represented.
- JASC-PAL 0100: only RGB values, order and duplicates; palette name and color names cannot be represented.
- JSON v1: palette name, HEX colors, color names when available, order and duplicates.

### Step B — Review metadata and loss

- Show palette name and the exact ordered swatch list.
- If exporting from the current v2 project without stored color names, state that color names are unavailable and will not be invented.
- JASC-PAL must show an explicit metadata-loss note before download.
- Preserve duplicates and source order unless the user first performs an explicit cleanup operation.
- Validate the entire output before creating a download.

### Step C — Filename and download

- Suggest a safe filename derived from the palette name or project name, with the correct extension.
- Preserve the chosen format extension; sanitize path separators and unsafe characters.
- Provide an editable filename field if the export UI supports it.
- Create a local Blob and download it; revoke object URLs after use.
- Confirm format, filename and color count after successful download.
- If encoding/validation fails, show the error and keep the current palette untouched.

## 7. Image export journey

The current main UI has PNG 1×, PNG 16× and SVG. The expanded workflow should make output intent and transparency explicit.

### 7.1 PNG / SVG output choices

- **Current frame composite:** default choice; visible layers composited in document order.
- **Current layer:** later feature, only after a verified layer-only composition contract.
- **Integer scale:** show native 1× and selected integer scale; never use smoothing/interpolation.
- **Background:** transparent by default; optional explicit HEX background.
- **SVG:** keep crisp edges and disclose that output uses vector rectangles for non-transparent pixels; file size grows with painted-pixel count.

Before export show:
- Logical canvas dimensions.
- Output dimensions after scale.
- Frame/layer scope.
- Transparency/background choice.
- Suggested filename.
- Any output-size or format limitations.

### 7.2 Project JSON backup

Project JSON is an editable project backup, not a flattened image.

- Name the file with project name and a clear `-project.json` suffix.
- Preserve all layers, frames, cels, palette and stable IDs.
- Do not include viewport state or transient editor overlays in artwork.
- Project import remains a separate file-opening journey with project validation and recovery behavior. It must not be confused with palette JSON import.

## 8. Animation export journey

### 8.1 Shared frame/layer selection

Agent 3's export planner (AC-040) defines:
- All frames in timeline order.
- Inclusive zero-based frame range.
- Explicit unique frame ID list; the supplied order becomes export order.

The future export UI should offer:
- All frames.
- Current frame only.
- Contiguous range (start/end).
- Explicit custom frame selection/order.

Rules:
- Frame names and stable IDs are used in preview/metadata; array positions are used only for range selection.
- Selection order must be visible and must be preserved. Do not silently sort an explicit custom order back to timeline order.
- For sprite sheets and GIFs, visible layers are selected by default; advanced explicit layer selection is a later option and must disclose if it includes hidden layers.
- The planner validates v2 project structure, unique IDs, cel associations, pixel buffers, dimensions, durations and budgets before an encoder allocates output buffers.
- If no frame is selected or an ID is stale, stop with a specific diagnostic and return to selection.

### 8.2 Sprite-sheet PNG

Agent 3's sprite-sheet module and AC-039/AC-040 contracts define native-resolution output.

UI options:
- Layout: horizontal, vertical or grid.
- Grid rows and/or columns.
- Outer margin and inter-frame spacing in logical output pixels.
- Transparent padding by default or explicit opaque HEX background.
- Selected frame order.
- Preview of the output sheet and metadata rectangles.

Required disclosures:
- Each source frame remains native logical dimensions; the exporter does not scale or smooth.
- PNG output is a single atlas; companion JSON metadata describes exact frame rectangles.
- Metadata includes stable frame ID, frame name, order index, x/y/width/height and source duration.
- Unused grid cells remain transparent unless a background was requested.
- The sheet may contain transparent margins/gutters; these are part of the sheet dimensions but not inside frame rectangles.
- The current project model stores opaque HEX pixels or null transparency; it does not support partial per-pixel alpha.
- Per-layer opacity is not applied by the current project composite routine; an implementation must either resolve that composition gap before claiming final appearance or clearly disclose it.

Budget and validation:
- Canvas sides are 1–512; project frames up to 256.
- Default sprite-sheet output limit: 16,777,216 pixels and 32,767 pixels per side.
- User may lower but not raise the module hard output budget.
- Validate the planned dimensions and allocation budget before allocating the RGBA output buffer.
- Any malformed cel, invalid frame/layer ID, invalid color or excessive output rejects the entire export before partial file creation.

Download:
- Download PNG and companion JSON metadata with coordinated base filenames.
- If one output fails, disclose which file succeeded/failed; do not report complete success if metadata was not produced.
- Preserve both files in the browser download flow; no ZIP/container format is assumed by this spec.

### 8.3 Animated GIF

The GIF exporter is merged on main as an isolated module. It returns an image/gif Blob, metadata and diagnostics; it does not create download UI or call the Agent API.

UI options:
- Frame selection: all, inclusive range or explicit frame IDs/order.
- Layer selection: visible layers by default; explicit selection only with a clear hidden-layer disclosure.
- Loop: infinite, finite repeat count or play once.
- Preview native dimensions, selected frame count, timing and estimated size.
- Show palette/quantization and transparency warnings before encoding.

Required disclosures:
- GIF frames stay at native dimensions; no scaling or smoothing.
- GIF delay is in 10 ms centisecond units. Source duration is rounded to the nearest 10 ms with a 10 ms minimum; show original and effective timings where they differ.
- GIF supports binary transparency, not partial alpha.
- When opaque colors exceed palette capacity, colors may be quantized. The exporter reports exact-palette versus quantized mode; no dithering is currently applied.
- Transparency uses a reserved palette index and disposal-to-background so transparent pixels do not reveal pixels from a previous frame.
- Layer compositing is bottom-to-top and follows the exporter's current pixel model; layer opacity is not applied.
- Loop count 0 means infinite loop; positive values are finite repeats; null means omit loop extension/play once.

Safety budgets:
- Selected GIF frame pixels are limited to 1,048,576 total (e.g. four 512×512 frames).
- Encoded output is limited to 16 MiB.
- Project source cel data has a separate 16,777,216-pixel validation budget.
- User-configured limits may be lower but may not exceed the hard module limits.
- Preflight rejects before composition where possible; final encoder must enforce actual encoded byte count.

### 8.4 Export progress and failure recovery

- Before encoding, show a summary of selected frames/order, layers, output dimensions, timing, transparency, layout and estimated allocation/bytes.
- Disable duplicate submit while an export is running.
- Keep the project editable state and saved state unchanged by export.
- Show progress where the encoder can provide meaningful progress; do not invent percentage progress for synchronous work that cannot report it.
- Provide Cancel only after a cancellable worker/streaming contract exists. Until then, do not display a non-functional Cancel button.
- On failure, show a stable error/diagnostic and preserve selection/options so the user can adjust and retry.
- On success, report every delivered filename, frame count/dimensions and metadata companion. Do not claim success if Blob creation or download setup failed.
- If a large export is rejected by budget, recommend reducing selected frames/layout/output scope; never silently downscale or drop frames.

## 9. Export profiles and presets

Profiles should be named parameter presets, not hidden transformations:

| Preset | Format | Suggested settings | Key disclosure |
|---|---|---|---|
| Pixel-perfect still | PNG | Current composite, 1×, transparent | Native dimensions, exact hard pixels |
| Game-engine enlarged sprite | PNG | Current composite, integer scale selected by user | Output dimensions are scaled; nearest-neighbor only |
| Frame strip | Sprite sheet | Horizontal, all frames, zero margin/spacing | Order follows timeline; metadata file required for timing |
| Compact atlas | Sprite sheet | Grid with explicit rows/columns and small margin/spacing | Sheet has unused/transparent cells if grid capacity exceeds frame count |
| Transparent animation | GIF | Selected frames, infinite loop by default | Centisecond timing, binary transparency, quantization/budget limits |
| One-shot preview | GIF | Selected frames, loopCount null | No loop extension; plays once |
| Palette backup | GPL or JSON | Preserve order and duplicates | Choose GPL/JSON to preserve names; JASC-PAL drops names |

A preset must display all effective options before export. Users can change the options and should see that the preset is now modified/custom.

## 10. Naming and file delivery

Suggested names:
- Palette: `<palette-name>.gpl`, `<palette-name>.pal`, `<palette-name>.json`.
- Current still image: `<project>-<width>x<height>-<scale>x.png` or `.svg`.
- Project backup: `<project>-project.json`.
- Sprite sheet: `<project>-spritesheet.png` plus `<project>-spritesheet.json`.
- GIF: `<project>-<frame-range>.gif`.

Rules:
- Sanitize path separators, control characters and unsafe filename characters.
- Preserve the required extension and avoid duplicate extensions.
- Allow users to edit the basename before download.
- Keep related atlas and metadata names aligned.
- Display the exact output filenames and format before the user commits.
- Browser download prompts and duplicate-name handling are browser-owned; do not promise overwrite behavior that the browser does not guarantee.

## 11. Errors, warnings and recovery states

| Condition | Expected UI response | Project effect |
|---|---|---|
| File picker canceled | Close/return to prior panel | None |
| Unsupported format | Ask user to choose a supported format or cancel | None |
| File exceeds 1 MiB palette limit | Show file-too-large error and limit | None |
| Invalid GPL/JASC-PAL/JSON | Show format, line/path, stable code and message | None |
| JASC-PAL name loss | Show metadata-loss disclosure before apply/export | No silent loss |
| Duplicate palette colors | Show count and exact preserve/unique choices | No automatic dedupe |
| Imported palette names not stored in v2 | Warn before apply; allow cancel | No silent metadata discard |
| Replace palette omits colors used by artwork | List missing used HEX values; pixels remain unchanged | None to cels |
| Palette contains >4,096 entries | Reject before apply | None |
| No frames selected | Keep selection UI open and explain selection requirement | None |
| Invalid frame ID/order | Report stale/invalid selection; refresh frame list | None |
| Sprite-sheet budget exceeded | Show estimated dimensions/pixels and limit; offer narrower selection/layout | None |
| GIF timing rounds source ms | Show original vs encoded duration warning | None |
| GIF palette overflow | Show quantization warning before export | No project mutation |
| GIF output exceeds 16 MiB | Reject and recommend reducing frames | No partial success |
| Encoder/Blob failure | Preserve options; show retry guidance | Project unchanged |
| Download starts | Show filename(s), format and output dimensions | No project mutation |

## 12. Accessibility and interaction requirements

- Import and export actions are keyboard reachable and have visible focus.
- File-format choices, merge/replace options and export options use labelled native controls.
- Preview diagnostics are grouped by severity; errors are announced to assistive technology without dumping hundreds of messages at once.
- A color swatch has an accessible name with HEX and optional color name; do not rely on color alone.
- Duplicate colors are distinguishable by list position and name/HEX, not only visually.
- Import preview exposes counts and a text-readable ordered list, not only a grid of colored boxes.
- Export preview exposes frame order, dimensions, duration, layout and warnings in text as well as visual preview.
- Dialog focus is contained and restored after Cancel/Apply/Download.
- Keyboard users can reach Replace, Merge, Append all, Add unique, Cancel, Preview and Export without context-menu-only gestures.
- Preserve the existing project when canceling or when validation fails.
- Do not require color discrimination to understand error states; show text diagnostics and numerical HEX values.
- Reduced-motion preferences apply to any preview animation; playback has explicit Pause/Stop and respects the user's reduced-motion setting.

## 13. Acceptance criteria

AC-051 is ready for implementation review when:

1. GPL, JASC-PAL and JSON behavior and limitations match the parser contract.
2. Parser errors never partially replace the current palette.
3. Palette import preview preserves original order, duplicates and names where the source supports them.
4. Replace/Merge/Cancel behavior is explicit and atomic.
5. Current v2 palette name-loss limitations are disclosed before apply/export.
6. Removing a swatch does not recolor existing artwork; the final swatch cannot be removed.
7. Palette duplicates are never silently deduplicated.
8. Import/export controls remain local-only and no network upload is introduced.
9. PNG/SVG/Project JSON current behavior is distinguished from future GIF/sprite-sheet UI.
10. GIF UI discloses timing rounding, loop behavior, binary transparency, quantization and output budgets.
11. Sprite-sheet UI discloses frame order, native dimensions, layout, margins, spacing, transparency, metadata and output budgets.
12. Explicit frame ID order is preserved through preflight and encoding.
13. Filenames and companion metadata names are clear and consistent.
14. Preflight validation precedes large allocation, no output is silently downscaled or truncated, and failure leaves the project unchanged.
15. Every success/error path provides accurate feedback without claiming unsupported progress/cancellation.
16. Keyboard and screen-reader users can complete the same palette/import/export journeys.

## 14. Acceptance-test matrix

| Area | Setup / action | Expected result |
|---|---|---|
| GPL import | Valid GPL with Name, Columns, comments, color names and duplicates | Exact order, HEX values, names and duplicates shown in preview |
| GPL legacy | GPL without Name/Columns | Accepted with default metadata and no false error |
| JASC-PAL import | Valid header/version/count and RGB rows | RGB/HEX order and duplicates preserved |
| JASC-PAL invalid | Wrong header/version, malformed count, missing/extra rows, channel outside 0–255 | Stable line errors; current palette unchanged |
| JSON import | Valid v1 schema with color names | Palette name, HEX, names, order and duplicates shown |
| JSON strictness | Unknown top-level/color property, unsupported version, malformed HEX | Reject entire file with line/path diagnostics |
| BOM/line endings | UTF-8 BOM, LF, CRLF and CR variants | Supported parser normalizes input without changing RGB |
| Input size | File just below and above 1 MiB | Below parsed; above rejected before parser/application |
| Color cap | 4,096 and 4,097 entries | Maximum accepted; excess rejected |
| Name length | Valid/empty/overlong palette and color names | Valid accepted; invalid rejected with source location |
| Duplicate preview | Same HEX repeated and case-only repeated | Duplicate count/positions visible; preserve/unique choice explicit |
| Replace palette | Imported colors omit colors used in cels | Warn with missing HEX values; cels remain byte-for-byte unchanged |
| Merge append | Current + imported colors with duplicates | Appends in deterministic order; duplicate policy is honored |
| Merge unique | Incoming repeats current and itself | Unique-only report lists skipped entries; final order deterministic |
| Cancel | Cancel preview or close dialog | Palette, selected swatch, history and saved state unchanged |
| Apply undo | Replace/merge then Undo/Redo | Exact palette order/selection restored; cel buffers unchanged |
| Remove swatch | Remove used and unused swatches; attempt last swatch | Existing pixels keep HEX; last swatch protected |
| Format name loss | Export JSON/GPL/JASC-PAL from HEX-only model | No invented names; JASC limitation disclosed; name fields absent unless real metadata exists |
| GPL export | Named palette metadata available | Name/Columns/color names/order emitted correctly |
| JASC-PAL export | Palette has name and color names | RGB/order/duplicates emitted; names/name explicitly warned as lost |
| JSON export | Palette name/colors with names available | Strict v1 JSON round trip preserves available metadata/order/duplicates |
| Still PNG | 1× and 16× export | Exact expected dimensions; hard edges; transparency preserved |
| SVG | Export artwork with transparent and opaque pixels | Crisp rectangle geometry; transparent cells omitted |
| Project JSON | Export and reopen project | Editable v2 structure retained; distinct from palette JSON |
| Frame selection | All, one frame, inclusive range and explicit custom order | Correct ordered frame IDs in export preview/manifest |
| Sprite-sheet layout | Horizontal, vertical and grid with rows/columns | Exact dimensions and rectangles shown before export |
| Sprite-sheet spacing | Margin/spacing and unused cells | Transparent or background-filled padding matches preview/metadata |
| Sprite-sheet budget | Over 16,777,216 output pixels or 32,767 side | Rejected before RGBA allocation |
| GIF loop | Infinite, finite and play once | Loop metadata matches selected behavior |
| GIF timing | 145 ms, 100 ms, 10 ms source frames | Effective 150/100/10 ms reported and encoded as centiseconds |
| GIF transparency | Transparent pixel after an opaque prior frame | Decoder verifies transparent pixel/disposal behavior |
| GIF quantization | At or above palette capacity | Exact-palette/quantization mode disclosed; source project unchanged |
| GIF budget | 1,048,576 and over-budget frame pixels / >16 MiB | At budget accepted if actual encoded output fits; over-budget plan rejected |
| Failure recovery | Encoder fails or Blob creation returns null | Options preserved; clear error; no false success message |
| Filename safety | Project/palette name includes slashes, emoji, punctuation or empty text | Sanitized name with correct extension; project name unchanged |
| Companion files | Sprite sheet + JSON metadata | Coordinated base filenames; both results reported |
| Accessibility | Keyboard-only import/export; screen-reader diagnostics | All choices reachable, states and errors announced meaningfully |

### Test layers

**Pure parser/format tests (Agent 8 / AC-017 and AC-072)**

- Valid/invalid GPL/JASC-PAL/JSON fixtures, BOM/newline variants, count/name/channel limits and strict JSON schema.
- Parser error code, line and path stability.
- Order, duplicates, name preservation and JASC metadata limitations.
- Round-trip behavior for each format and explicit loss cases.

**Palette-analysis and transformation tests (Agent 8 / AC-067–073)**

- Color usage/duplicate/nearest-color/impact reports.
- Deterministic color conversions, ramps and transformations.
- Source immutability, explicit mapping policy and seeded fuzz corpus.

**Export planner/encoder tests (Agent 3 / AC-039–042)**

- All/range/custom frame selection, stable order and timing.
- Sprite-sheet dimensions/rectangles/layout/metadata.
- GIF timing, loop, transparency/disposal, quantization and budgets.
- Real browser decoding of PNG/GIF output and comparison against independent expected rasters.
- Malformed/sparse cels, invalid IDs, oversized input/output rejection before allocation.

**Browser journey tests (future UI owner)**

- Local file selection, preview, apply/cancel/undo, error recovery and download filename behavior.
- Verify parser/encoder Blob outputs, browser download initiation and companion metadata delivery.
- Confirm project pixels, cels and history are unchanged by export and by canceled/failed import.

## 15. Files, dependencies and ownership

AC-051 changes documentation only. No implementation file is changed by this task.

| File / area | Role | Owner / constraint |
|---|---|---|
| `docs/ux/PALETTE_EXPORT_SPEC.md` | Canonical journeys/acceptance specification | Agent 5 / AC-051 |
| `js/palette-formats.js`, `tests/palette-formats.test.js`, `docs/palette-formats.md` | GPL/JASC-PAL/JSON parsers and serializers | Agent 8 / AC-017; do not edit |
| `js/palette-tools.js`, palette analysis tests | Usage, duplicate, nearest-color and impact reports | Agent 8 / AC-067+; not assumed integrated |
| `js/gif-export.js`, `GIF_EXPORT.md` | GIF encoding/metadata/diagnostics | Agent 3; PR #11 merged as isolated module |
| `js/sprite-sheet-export.js`, `ANIMATION_EXPORT.md` | PNG atlas and JSON frame metadata | Agent 3 / AC-027/039; keep separate from UI |
| `js/export-plan.js`, `EXPORT_PLAN.md` | Frame selection, layout/timing preflight and manifest | Agent 3 / AC-040; validates before encoder allocation |
| `index.html` | Palette import/export dialogs, preset controls, export preview/download UI | Coordinator-controlled; no UI lock granted |
| `js/project-model.js` | Current palette as HEX strings; future metadata persistence would need a separate schema decision | Shared project foundation; Agent 5 does not edit |
| Proposed focused browser tests | Import preview, export preview, downloads and error recovery | Coordinator assigns future implementation owner; don't edit bridge E2E or shared workflow |

### Dependencies and coordination

- AC-051 can be specified while Agent 8/3 modules are under review; do not wait for PR merges.
- Before UI implementation, coordinator must accept/merge the underlying module contracts and grant a serialized `index.html` lock.
- Palette name persistence requires a separate project-model/versioning decision; AC-051 must not assume that the v2 HEX-only palette stores names.
- Export controls must call the accepted preflight planner and encoder modules; do not duplicate encoding logic in UI handlers.
- GIF and sprite-sheet downloads do not yet exist in the production editor UI; no user-facing integration is claimed.
- No changes to modules, project model, Agent API, bridge, workflow or another worker's tests are permitted in this phase.

## 16. Definition of done

AC-051 is ready for coordinator review when:

- Current palette UI and export UI are source-audited and clearly distinguished from future workflows.
- GPL/JASC-PAL/JSON contracts, limits, diagnostics and format-loss behavior are accurately specified.
- Import preview/replace/merge/cancel behavior is atomic and preserves artwork pixels.
- Name persistence limitations and duplicate-color behavior are explicit.
- Still-image, Project JSON, sprite-sheet and GIF export journeys include selection, options, preview, naming, preflight, budgets, feedback and failure recovery.
- Agent 8 palette tools and Agent 3 export planner/encoders are cited as dependencies, not falsely described as integrated.
- The acceptance-test matrix includes format, error, budget, browser, accessibility and no-mutation coverage.
- Only this UX specification is delivered; no production UI or module implementation is claimed.
