/*!
 * One Pixel Studio — deterministic color conversion and ramp utilities.
 * Browser-global + CommonJS; pure functions with explicit rounding rules.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPaletteColorScience = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HEX = /^#[0-9a-f]{6}$/i;
  const LIMITS = Object.freeze({ maxRampSteps: 64 });

  function normalizeHex(hex) {
    if (typeof hex !== "string" || !HEX.test(hex)) {
      throw new Error("Color must be a six-digit HEX value such as #A1B2C3.");
    }
    return hex.toUpperCase();
  }

  function finiteNumber(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(label + " must be a finite number.");
    }
    return value;
  }

  function channel(value, label) {
    const number = finiteNumber(value, label);
    if (number < 0 || number > 255) throw new Error(label + " must be between 0 and 255.");
    return number;
  }

  function unitValue(value, label) {
    const number = finiteNumber(value, label);
    if (number < 0 || number > 1) throw new Error(label + " must be between 0 and 1.");
    return number;
  }

  function normalizeHue(value) {
    const hue = finiteNumber(value, "Hue");
    return ((hue % 360) + 360) % 360;
  }

  function roundChannel(value) {
    // Math.round gives a documented nearest-integer rule; exact .5 ties round upward.
    return Math.max(0, Math.min(255, Math.round(value)));
  }

  function hexToRgb(hex) {
    const value = normalizeHex(hex);
    return {
      r: parseInt(value.slice(1, 3), 16),
      g: parseInt(value.slice(3, 5), 16),
      b: parseInt(value.slice(5, 7), 16)
    };
  }

  function rgbToHex(red, green, blue) {
    const values = [channel(red, "Red"), channel(green, "Green"), channel(blue, "Blue")];
    return "#" + values.map(value => roundChannel(value).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function rgbToHsl(red, green, blue) {
    let r = channel(red, "Red") / 255;
    let g = channel(green, "Green") / 255;
    let b = channel(blue, "Blue") / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    let hue = 0;
    let saturation = 0;

    if (delta !== 0) {
      saturation = delta / (1 - Math.abs(2 * lightness - 1));
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    return { h: normalizeHue(hue), s: saturation, l: lightness };
  }

  function hslToRgb(hue, saturation, lightness) {
    const h = normalizeHue(hue);
    const s = unitValue(saturation, "Saturation");
    const l = unitValue(lightness, "Lightness");
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const sector = h / 60;
    const x = chroma * (1 - Math.abs((sector % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (sector < 1) { r1 = chroma; g1 = x; }
    else if (sector < 2) { r1 = x; g1 = chroma; }
    else if (sector < 3) { g1 = chroma; b1 = x; }
    else if (sector < 4) { g1 = x; b1 = chroma; }
    else if (sector < 5) { r1 = x; b1 = chroma; }
    else { r1 = chroma; b1 = x; }

    const match = l - chroma / 2;
    return {
      r: roundChannel((r1 + match) * 255),
      g: roundChannel((g1 + match) * 255),
      b: roundChannel((b1 + match) * 255)
    };
  }

  function rgbToHsv(red, green, blue) {
    const r = channel(red, "Red") / 255;
    const g = channel(green, "Green") / 255;
    const b = channel(blue, "Blue") / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    let hue = 0;
    if (delta !== 0) {
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    return { h: normalizeHue(hue), s: max === 0 ? 0 : delta / max, v: max };
  }

  function hsvToRgb(hue, saturation, value) {
    const h = normalizeHue(hue);
    const s = unitValue(saturation, "Saturation");
    const v = unitValue(value, "Value");
    const chroma = v * s;
    const sector = h / 60;
    const x = chroma * (1 - Math.abs((sector % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (sector < 1) { r1 = chroma; g1 = x; }
    else if (sector < 2) { r1 = x; g1 = chroma; }
    else if (sector < 3) { g1 = chroma; b1 = x; }
    else if (sector < 4) { g1 = x; b1 = chroma; }
    else if (sector < 5) { r1 = x; b1 = chroma; }
    else { r1 = chroma; b1 = x; }

    const match = v - chroma;
    return {
      r: roundChannel((r1 + match) * 255),
      g: roundChannel((g1 + match) * 255),
      b: roundChannel((b1 + match) * 255)
    };
  }

  function relativeLuminance(hex) {
    const rgb = hexToRgb(hex);
    const linear = [rgb.r, rgb.g, rgb.b].map(value => {
      const channelValue = value / 255;
      return channelValue <= 0.04045
        ? channelValue / 12.92
        : Math.pow((channelValue + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
  }

  function contrastRatio(colorA, colorB) {
    const luminanceA = relativeLuminance(colorA);
    const luminanceB = relativeLuminance(colorB);
    const lighter = Math.max(luminanceA, luminanceB);
    const darker = Math.min(luminanceA, luminanceB);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function interpolateHex(fromHex, toHex, amount) {
    const from = hexToRgb(fromHex);
    const to = hexToRgb(toHex);
    const progress = unitValue(amount, "Interpolation amount");
    return rgbToHex(
      from.r + (to.r - from.r) * progress,
      from.g + (to.g - from.g) * progress,
      from.b + (to.b - from.b) * progress
    );
  }

  function validateStepCount(steps) {
    if (!Number.isInteger(steps) || steps < 2 || steps > LIMITS.maxRampSteps) {
      throw new Error("Ramp steps must be an integer from 2 to " + LIMITS.maxRampSteps + ".");
    }
  }

  function createColorRamp(fromHex, toHex, steps) {
    const from = normalizeHex(fromHex);
    const to = normalizeHex(toHex);
    validateStepCount(steps);
    const ramp = [];
    for (let index = 0; index < steps; index += 1) {
      ramp.push(interpolateHex(from, to, index / (steps - 1)));
    }
    return ramp;
  }

  function createLightDarkRamps(baseHex, steps, maxMix) {
    const base = normalizeHex(baseHex);
    validateStepCount(steps);
    const mix = maxMix === undefined ? 0.8 : unitValue(maxMix, "Maximum shade mix");
    return {
      base: base,
      dark: createColorRamp(interpolateHex(base, "#000000", mix), base, steps),
      light: createColorRamp(base, interpolateHex(base, "#FFFFFF", mix), steps)
    };
  }

  return Object.freeze({
    LIMITS: LIMITS,
    normalizeHue: normalizeHue,
    hexToRgb: hexToRgb,
    rgbToHex: rgbToHex,
    rgbToHsl: rgbToHsl,
    hslToRgb: hslToRgb,
    rgbToHsv: rgbToHsv,
    hsvToRgb: hsvToRgb,
    relativeLuminance: relativeLuminance,
    contrastRatio: contrastRatio,
    interpolateHex: interpolateHex,
    createColorRamp: createColorRamp,
    createLightDarkRamps: createLightDarkRamps
  });
});
