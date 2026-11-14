# Palette analysis tools

\`js/palette-tools.js\` provides deterministic, read-only analysis for One Pixel Studio project documents. It has no dependencies, exposes CommonJS and the browser global \`ArtClubPaletteTools\`, and never mutates the supplied project.

## API

- \`countColorUsage(project, options)\` returns normalized color counts, palette indices, in-palette flags and pixel/cel totals.
- \`analyzePalette(project, options)\` adds unused palette colors, duplicate palette groups, case-variant duplicate detection and colors used by cels but absent from the palette.
- \`summarizePalette(project, options)\` returns palette length, unique/duplicate/used/unused color counts, palette color coverage, transparency and selected-cel statistics.
- \`findNearestColor(targetHex, palette)\` finds the closest entry by squared Euclidean distance in the three encoded 8-bit RGB channels. Equal-distance ties always choose the earliest palette index.
- \`estimateReplacementImpact(project, fromHex, toHex, options)\` estimates matching pixels, affected cels/layers/frames and per-cel pixel bounds. It does not replace pixels or change the palette.
- \`normalizeHex(hex)\` validates and uppercases a six-digit HEX color.

## Analysis scope

By default, only visible layers and all project frames are included. Pass \`includeHiddenLayers: true\` to include hidden layers, \`frameId\` or \`frameIds\` to restrict frames, and \`layerIds\` to choose a layer subset. Frame/layer result order follows the project document, not the order of IDs in the options.

Missing layer/frame cels are valid in the project model. They are not treated as stored pixel samples: results report \`missingCelCount\` separately, and \`totalPixels\` counts pixels only in stored cels selected by the scope. Within those cels, \`null\` pixels count as transparent. An empty scope produces zero samples and \`null\` transparency ratios rather than a division-by-zero value.

## Counting and duplicates

Color comparisons are case-insensitive and results are normalized to uppercase \`#RRGGBB\`. Each unique normalized palette color has one usage record with all source palette indices. Unused colors are reported by unique normalized color, with their palette indices attached. Duplicate groups report the extra entry count and whether the original palette entries differ only by HEX letter case. Colors in cel data that do not appear in the project palette are listed separately as \`unlistedColors\`.

\`colorCoverage\` is the fraction of unique normalized palette colors used by the selected stored cels. \`transparencyRatio\` is the fraction of sampled stored-cel pixels whose value is \`null\`. The summary also includes percentage forms and raw counts.

## Replacement impact

Replacement impact is an estimate over the same layer/frame scope as usage analysis. \`matchedPixels\` counts every matching pixel. Each affected cel includes a bounding rectangle in canvas pixel coordinates. The report lists source and target palette indices and whether the target color already exists in the declared palette. \`fromHex\` and \`toHex\` equality after normalization is reported as a no-op (\`matchedPixels\` may still be positive, but \`changedPixels\` is zero).

## Validation and bounds

The input must follow the v2 project data shape: a canvas from 1–512 pixels per side, 1–32 uniquely identified layers, 1–256 uniquely identified frames, a 1–256 entry palette and cels whose dense pixel arrays exactly match the canvas dimensions. Stored cel data is capped at 16,777,216 pixel samples. Pixel values must be \`null\` or six-digit HEX; sparse arrays and duplicate layer/frame cels are rejected before analysis.

RGB Euclidean distance is intentionally simple and deterministic, not perceptually uniform. It should not be presented as a perceptual color-difference score. Color-space conversion, perceptual distance, palette transformations and accessibility diagnostics are separate workstream phases.
