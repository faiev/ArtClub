# Palette distance metrics

`js/palette-distance.js` provides deterministic color-difference and palette-selection helpers. It is dependency-free, exposes CommonJS and the browser global `ArtClubPaletteDistance`, and never mutates palettes or pixel arrays.

## Metrics and default behavior

- `hexToLab(hex)` converts sRGB HEX to CIELAB using the D65 reference white.
- `deltaE76Lab(a, b)` and `deltaE76Hex(a, b)` calculate CIE76 distance.
- `ciede2000(labA, labB, options)` calculates CIEDE2000 (ΔE00) from CIELAB arrays or objects.
- `deltaE00Hex(hexA, hexB, options)` converts both HEX values to Lab and calculates ΔE00.
- `findNearestColor(targetHex, palette, options)` selects one palette entry with a structured match and diagnostics.
- `mapToPalette(pixels, palette, options)` maps a dense pixel array and preserves `null` transparency.

The default metric is **`rgb-squared`**, matching the existing squared Euclidean RGB selection behavior. Other explicit options are `rgb-euclidean` (legacy unsquared distance), `cie76`, and `ciede2000`. Existing RGB-based workflows must not silently switch to a perceptual metric.

Nearest-color iteration follows original palette order and only changes the selected item when a strictly smaller distance is found. Exact ties therefore select the first palette index; a tie produces an `equal-distance-tie` diagnostic. A transparent target (`null`) returns `ok: false`, no match and a `transparent-target` diagnostic. A null entry in a palette is invalid. Mapping keeps null pixels at the same positions.

## Conversion conventions

HEX inputs must be six-digit `#RRGGBB`. Conversion uses the IEC sRGB transfer function, the standard sRGB-to-XYZ matrix, and D65 reference white (Xn = 0.95047, Yn = 1.00000, Zn = 1.08883). Lab values are retained as JavaScript double-precision numbers; no intermediate decimal rounding is applied. The converted L* output is bounded to [0, 100] to absorb floating-point overshoot from rounded matrix coefficients at the white endpoint. Caller-supplied Lab L* must be finite and within [0, 100]; a* and b* must be finite.

CIEDE2000 parametric factors `kL`, `kC` and `kH` default to 1 and must be greater than 0 and at most 10. The color-matching API validates the palette and options before iterating candidates.

## CIEDE2000 conformance

The formula follows Sharma, Wu and Dalal and is tested against all 34 pairs in their published supplemental dataset. The conformance values are embedded in the test file to keep the approved phase file list narrow.

- Sharma, G., Wu, W. and Dalal, E. N. (2005), *The CIEDE2000 Color-Difference Formula: Implementation Notes, Supplementary Test Data, and Mathematical Observations*, Color Research & Application 30(1), 21–30. DOI: 10.1002/col.20070.
- Official author-hosted test data: https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
- Author's implementation notes: https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/

The reference data was published for CIELAB pairs; tests must use those numeric Lab values rather than approximate HEX conversions.

## Bounds and limitations

- Palette length: 1–256 colors.
- Pixel arrays: at most 16,777,216 samples.
- Arrays must be dense. Invalid HEX, unknown metrics, malformed Lab values and non-finite options are rejected.
- CIEDE2000 is a perceptual difference model, not a universal guarantee of visual sameness. Results depend on reference white, display/viewing conditions and the suitability of Lab for the colors being compared.
- The CIEDE2000 path is opt-in. No existing RGB default, project data, editor UI, Agent API, bridge or MCP behavior is changed.
