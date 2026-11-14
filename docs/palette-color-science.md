# Palette color science utilities

js/palette-color-science.js contains dependency-free, deterministic color conversions, WCAG contrast calculations and bounded ramp generators. It exposes CommonJS and the browser global ArtClubPaletteColorScience and has no UI or project mutation.

## API and units

- hexToRgb(hex) returns integer {r, g, b} channels from 0–255.
- rgbToHex(r, g, b) accepts finite channel values from 0–255, rounds to the nearest integer and returns uppercase #RRGGBB.
- rgbToHsl(r, g, b) and rgbToHsv(r, g, b) return {h, s, l} or {h, s, v}. Hue is measured in degrees; saturation, lightness and value are normalized to 0–1.
- hslToRgb(h, s, l) and hsvToRgb(h, s, v) return integer RGB channel objects.
- relativeLuminance(hex) computes WCAG relative luminance from 0–1.
- contrastRatio(colorA, colorB) computes the WCAG contrast ratio.
- interpolateHex(from, to, amount) interpolates in encoded sRGB channel values, with amount from 0–1.
- createColorRamp(from, to, steps) returns a bounded array including both endpoints.
- createLightDarkRamps(base, steps, maxMix) returns {base, dark, light} ramps, both including the base color.

## Deterministic conversion rules

Input HEX colors must be six-digit #RRGGBB. RGB channels may be fractional but must be finite and within 0–255. Conversion to RGB integer channels and HEX uses Math.round; exact half values round upward. HSL/HSV hue wraps modulo 360, so 360 and 720 become 0, and negative hues wrap into the 0–360 interval. Saturation, lightness, value, interpolation amount and shade mix are validated in the 0–1 interval; values are rejected rather than silently clamped.

Grayscale colors use hue 0 and saturation 0, avoiding undefined hue output. Color-space conversions use the standard sRGB HSL/HSV equations; they are intended for predictable editing utilities, not perceptual color matching.

## Luminance and contrast

Relative luminance uses the WCAG sRGB linearization threshold 0.04045 and coefficients 0.2126, 0.7152 and 0.0722. Contrast is (lighter + 0.05) / (darker + 0.05). The black/white reference pair is 21:1. A contrast ratio is only one accessibility signal and does not establish that an interface or palette is accessible in every context.

## Ramps and bounds

createColorRamp accepts 2–64 entries and includes the exact start/end colors. Intermediate values are evenly spaced, and each channel is rounded with the same rule as rgbToHex. createLightDarkRamps uses the same ramp rule to mix toward black and white; maxMix defaults to 0.8 and may be set from 0–1. The dark ramp is ordered darkest-to-base; the light ramp is ordered base-to-lightest.
