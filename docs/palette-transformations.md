# Palette transformations

js/palette-transformations.js provides immutable palette and supplied-buffer operations. It is dependency-free, exposes CommonJS and the browser global ArtClubPaletteTransformations, and does not mutate project state.

## Palette data shape

A palette is an object with a colors array containing 1–4,096 six-digit HEX strings or color objects with a hex field. A color object may also contain name and other JSON-compatible metadata; these fields are preserved when an entry is moved or its HEX value changes. Palette-level metadata other than name and colors is retained by operations that produce one palette. All HEX values are normalized to uppercase #RRGGBB in returned data.

The module rejects sparse arrays, malformed HEX, duplicate/repeated index instructions, circular references and non-JSON-compatible metadata. Operations return new objects and reports; the supplied palette and pixel buffers are never edited.

## API

- reorderPalette(palette, order) uses a complete permutation of source indices. Entry order and per-color metadata are retained.
- renamePalette(palette, name) changes the palette name only.
- mergePalettes(palettes, options) concatenates colors in source palette order and keeps duplicates. Use options.name to choose an output name. Palette-level metadata from source palettes is not copied into the merged palette; every discarded field/value is listed in report.discardedMetadata. Per-color metadata is preserved.
- splitPalette(palette, groups, options) partitions source indices into two or more non-empty groups. Every original index must occur exactly once. Each group preserves entry metadata and palette-level metadata. Use options.names to set explicit output names.
- removeDuplicateColors(palette, options) removes case-normalized duplicate HEX entries. options.keep is first (default) or last. The retained entry keeps its metadata. All removed entries, indices and associated metadata are included in report.removedEntries and report.discardedMetadata.
- replaceColor(palette, fromHex, toHex) replaces every matching palette entry, case-insensitively, without changing order or color names/metadata. The report lists every changed index.
- replaceColorInBuffers(buffers, fromHex, toHex) returns copies of supplied {pixels, ...metadata} buffers, replacing matching pixel values while preserving null transparency and other buffer metadata. It reports matching pixels by buffer. This function edits only the returned copies; applying them to a project is a separate decision.
- harmonySuggestions(baseHex, type, options) supports complementary, analogous, triadic and monochrome. Hue is derived in HSL; generated suggestions are uppercase HEX with duplicate/base results removed.
- buildRampFromTwoColors(fromHex, toHex, steps) creates 2–64 evenly spaced encoded-sRGB samples, including exact endpoints.

Every operation includes a report naming the operation and its changes. Duplicate removal reports complete discarded entries. Merging reports all palette-level metadata not represented in the combined output. No transformation silently mutates an original palette or cel buffer.

## Deterministic behavior and limits

Color identity for duplicate detection and replacement is case-insensitive normalized HEX. Existing duplicates are preserved by merge, reorder, split and replacement; only removeDuplicateColors removes them. Keep-first and keep-last are explicit, stable policies. Replacement preserves the source entry's name and custom metadata even if the new HEX no longer semantically matches that label; callers should review or rename such labels deliberately.

Harmony suggestions use standard HSL hue offsets: complementary +180°, analogous −30°/+30°, triadic +120°/+240°. Monochrome suggestions vary HSL lightness while retaining hue and saturation. These are suggestions, not perceptual color-distance rankings. Ramp interpolation occurs in encoded sRGB channel values and uses Math.round (half ties upward); it is not linear-light interpolation.

Input palettes are limited to 4,096 colors, merge accepts up to 256 source palettes, and ramps are limited to 64 entries. All metadata must be JSON-compatible. No project, editor UI, file picker, Agent API or MCP integration is included.
