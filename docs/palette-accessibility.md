# Palette accessibility diagnostics

js/palette-accessibility.js provides deterministic, data-only contrast reports, near-duplicate color diagnostics and approximate color-vision simulation transforms. It is dependency-free, exposes CommonJS and the browser global ArtClubPaletteAccessibility, and does not mutate project or palette data.

## API

- analyzeContrastPairs(palette, options) returns every pairwise contrast ratio and pass flags for normal text, large text and non-text graphics. Optional backgrounds checks each palette color against each supplied background.
- findNearDuplicateColors(palette, options) identifies pairs within a configurable CIE76 Lab distance threshold. The default threshold is 5.
- rgbToLab(hex) converts sRGB HEX into CIE Lab using a D65 reference white.
- deltaE76(firstHex, secondHex) returns Euclidean distance in Lab.
- simulateColorVision(hex, type) transforms one HEX color using a named simulation.
- simulatePalette(palette, type) returns transformed HEX values in the original order.
- auditPaletteAccessibility(palette, options) combines pairwise contrast, near-duplicate findings and all supported simulation palettes.

Accepted simulation types are normal, protanopia, deuteranopia, tritanopia and achromatopsia. Palettes are bounded to 1–256 colors; optional backgrounds are bounded to 16 entries.

## Contrast and readability

Relative luminance uses the WCAG sRGB linearization threshold and coefficients. Contrast ratio is (lighter + 0.05) / (darker + 0.05). Defaults are 4.5:1 for normal text, 3:1 for large text and 3:1 for non-text graphics. Thresholds are configurable from 1 to 21.

The pairwise report evaluates every pair of palette colors. Use the backgrounds option to check palette colors against known surfaces. Reports contain ratios and flags; they do not decide what role a color is used for. A palette color pair with sufficient contrast does not prove that an entire user interface is accessible: font size, weight, placement, surrounding colors, states, focus indicators and non-color cues also matter.

## Near-duplicate colors

Near-duplicate detection converts sRGB colors through XYZ D65 into CIE Lab and calculates CIE76 Euclidean distance (ΔE*ab). It returns pairs at or below the selected threshold, sorted by distance and then source indices. Exact duplicates and case-only HEX duplicates are explicitly identified.

The default threshold of 5 is a review heuristic, not a universal perceptual boundary. CIE76 is a simple baseline; perception varies by hue, lightness, display, viewing conditions and observer. Results should be treated as suggestions for inspection, not automatic deletion or proof that two colors look the same.

## Color-vision simulations

protanopia, deuteranopia and tritanopia use approximate linear-RGB matrix transforms; achromatopsia produces a luminance-based grayscale preview. Transforms return HEX data only. They do not assess an individual's vision, diagnose a condition, predict every real-world viewing outcome or replace testing with people who use the intended design.

The simulation outputs preserve palette ordering but may contain duplicate colors after transformation. No source palette values are overwritten.

## Limitations and bounds

- Input must be six-digit #RRGGBB.
- Analysis is bounded to 256 colors and 16 optional background colors.
- CIE76 is a near-duplicate heuristic, not CIEDE2000 or a perfect perceptual model.
- Color-vision transforms are approximations, not medical tests.
- WCAG contrast ratio is one accessibility signal, not a full accessibility audit.
- This package contains no UI, file loading, project mutation, export, Agent API or MCP integration.
