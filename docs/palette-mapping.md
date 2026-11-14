# Palette extraction and project mapping

js/palette-mapping.js provides deterministic read-only color extraction, palette matching, preview and copy-on-apply utilities for version 2 One Pixel Studio project data. It exposes CommonJS and the browser global ArtClubPaletteMapping. It does not edit a project in place and contains no editor UI or Agent API wiring.

## API

- extractUsedColors(project, options) walks selected stored cels in project layer order, then frame order, then row-major pixel order. It returns first-seen unique HEX colors with use counts, palette index (or null when absent), first-occurrence layer/frame/cel/pixel coordinates, scope, per-cel counts and total/transparent/opaque pixel statistics.
- createPaletteMapping(sourcePalette, targetPalette, options) creates an ordered map from source entries to target entries. options.policy is exact (default), nearest, or reject-if-no-match.
- previewProjectPaletteMapping(project, mapping, options) calculates the number of mapped, changed, unchanged, transparent and unmapped pixel samples and reports changed bounds/counts per cel. It performs no writes.
- applyProjectPaletteMapping(project, mapping, options) returns a new project copy with the selected cel pixels and declared palette entries mapped. The original project is unchanged. It throws without returning a new project if the mapping's accepted flag is false.

## Mapping policies

- exact maps a source color only when the target palette contains the same normalized HEX. Colors without an exact target are listed as unmatched. The policy permits a partial map; unmapped pixels remain unchanged when the returned mapping is applied.
- nearest always maps each source entry to the target with the smallest squared Euclidean distance in encoded 8-bit RGB. Equal-distance ties resolve to the first target palette index. This is deterministic, not perceptually uniform.
- reject-if-no-match behaves like exact matching but marks the entire mapping rejected if any source entry lacks an exact target. applyProjectPaletteMapping refuses a rejected mapping, so callers can preview and cancel without partial replacement.

Each mapping includes source/target indices and HEX values, exact/nearest match type, squared RGB distance, unmatched source entries, target collision groups and a summary. When multiple source colors map to the same target, the collision is explicitly reported; mapping does not silently deduplicate the target palette.

## Extraction order and scope

Extraction order is deterministic: project layer order, project frame order, and pixel array order within each stored cel. Hidden layers are excluded by default; includeHiddenLayers: true includes them. frameId or frameIds can scope frames, and layerIds can restrict layers. When an array of IDs is supplied, results still follow project document order.

Only existing stored cels are sampled. Missing layer/frame cels are counted separately, not expanded into synthetic transparent pixel arrays. A stored null pixel counts as transparent; HEX pixels count as opaque. Used colors absent from the project's declared palette have paletteIndex: null and contribute to the unlisted-color count.

## Preview before apply

Call previewProjectPaletteMapping before applyProjectPaletteMapping. The preview reports total samples, transparent pixels, mapped pixels, changed pixels, unchanged pixels and unmapped pixels. Each affected cel includes changed-pixel bounds in canvas coordinates, and colors not represented in the mapping are listed with their frequency. Unmapped pixels are left unchanged by the copy-on-apply operation; a reject-if-no-match policy is all-or-nothing and blocks apply when any source palette entry lacks a target.

Apply returns a separate project object. It replaces matching HEX values in selected stored cels and declared project palette entries, preserves null transparency and unrelated metadata, and never changes the supplied project. Callers remain responsible for deciding whether to adopt the returned project after reviewing the report.

## Validation and bounds

The module accepts version 2 One Pixel Studio projects with canvas dimensions from 1–512, 1–32 uniquely identified layers, 1–256 uniquely identified frames, a 1–256 color project palette, dense cel pixel arrays matching canvas dimensions, valid layer/frame references and at most 16,777,216 stored pixel samples. Mapping palettes are bounded to 256 colors. Malformed HEX, sparse arrays, duplicate cels, unknown scope IDs and invalid dimensions are rejected before analysis.

No source project or palette is mutated. This phase does not implement UI preview screens, file loading, project storage or Agent API integration.
