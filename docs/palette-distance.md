# Palette distance metrics

`js/palette-distance.js` provides deterministic color-difference and palette-selection helpers. It is dependency-free, exposes CommonJS and the browser global `ArtClubPaletteDistance`, and does not mutate input palettes or pixel arrays.

## Metrics and default behavior

- `ciede2000(labA, labB, options)` computes CIEDE2000 (ΔE00) from CIELAB triplets or objects.
- `hexToLab(hex)` converts sRGB HEX to CIELAB using D65 reference white.
- `deltaE00Hex(hexA, hexB, options)` converts both HEX values to Lab and returns ΔE00.
- `findNearestColor(targetHex, palette, options)` selects the nearest palette item using the requested metric.
- `mapToPalette(pixels, palette, options)` maps a dense pixel array to nearest palette colors and preserves `null` transparency.

RGB Euclidean remains the default metric (`rgb-euclidean`) so current callers and outputs are not silently reinterpreted. CIEDE2000 is opt-in with `{ metric: "ciede2000" }`. The result reports the metric name, selected palette index, distance and tie count. Exact ties always keep the first palette index.

## Color conversion conventions

HEX inputs must be six-digit `#RRGGBB`. Conversion to CIELAB uses the sRGB transfer function, sRGB-to-XYZ matrix and D65 reference white. Lab inputs may be arrays `[L*, a*, b*]` or objects `{l, a, b}`; L* is validated from 0–100 and all components must be finite. CIEDE2000 parametric factors `kL`, `kC`, and `kH` default to 1 and may be set from greater than 0 to 10.

The implementation follows Sharma, Wu and Dalal's CIEDE2000 formula and is checked against all 34 pairs in their published test data. Formula details and supplementary conformance data:

- Sharma, G., Wu, W. and Dalal, E. N. (2005), *The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations*, Color Research & Application 30(1), 21–30, DOI: 10.1002/col.20070.
- Official author-hosted 34-pair test data: https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
- Author's implementation notes and test-data page: https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/

The reference data fixture is retained in `tests/fixtures/ciede2000-reference-pairs.tsv` with its original values and attribution.

## Nearest-color selection and transparency

`findNearestColor` supports:
- `rgb-euclidean`: the existing default, measured in encoded 8-bit RGB channel space.
- `ciede2000`: opt-in perceptual difference in CIELAB.

The nearest search is deterministic. It walks the target palette in original order and changes the selected index only when a strictly smaller distance is found; exact ties resolve to the first index. Palettes are bounded to 256 colors.

A target color of `null` returns `null` and is not compared to black or any other palette color. `mapToPalette` preserves null entries and their positions. It returns a new pixel array plus match details and a summary; it never mutates the supplied pixels or palette.

## Bounds and limitations

- Palette length: 1–256 entries.
- Pixel array length: at most 16,777,216 samples.
- Palette/pixel arrays must be dense; invalid HEX and non-finite Lab/options are rejected.
- CIEDE2000 is a perceptual color-difference model, not a universal guarantee of visual sameness. Results depend on Lab conversion assumptions, reference white and viewing conditions.
- No editor UI, project mutation, Agent API, MCP or change to existing RGB defaults is included.
