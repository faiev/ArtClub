/*!
 * One Pixel Studio — palette accessibility and diagnostic utilities.
 * Data-only reports and approximate simulation transforms; no UI or medical claims.
 * Browser-global + CommonJS, dependency-free.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPaletteAccessibility = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HEX = /^#[0-9a-f]{6}$/i;
  const LIMITS = Object.freeze({
    maxPaletteColors: 256,
    maxBackgrounds: 16,
    defaultNearDuplicateDeltaE76: 5
  });

  const VISION_MATRICES = Object.freeze({
    protanopia: Object.freeze([
      Object.freeze([0.152286, 1.052583, -0.204868]),
      Object.freeze([0.114503, 0.786281, 0.099216]),
      Object.freeze([-0.003882, -0.048116, 1.051998])
    ]),
    deuteranopia: Object.freeze([
      Object.freeze([0.367322, 0.860646, -0.227968]),
      Object.freeze([0.280085, 0.672501, 0.047413]),
      Object.freeze([-0.011820, 0.042940, 0.968881])
    ]),
    tritanopia: Object.freeze([
      Object.freeze([1.255528, -0.076749, -0.178779]),
      Object.freeze([-0.078411, 0.930809, 0.147602]),
      Object.freeze([0.004733, 0.691367, 0.303900])
    ])
  });

  function normalizeHex(value, label) {
    if (typeof value !== "string" || !HEX.test(value)) {
      throw new Error((label || "Color") + " must be a six-digit HEX value such as #A1B2C3.");
    }
    return value.toUpperCase();
  }

  function finiteNumber(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(label + " must be a finite number.");
    return value;
  }

  function unitInterval(value, label) {
    const number = finiteNumber(value, label);
    if (number < 0 || number > 1) throw new Error(label + " must be between 0 and 1.");
    return number;
  }

  function validatePalette(palette) {
    if (!Array.isArray(palette) || palette.length < 1 || palette.length > LIMITS.maxPaletteColors) {
      throw new Error("Palette must contain 1–" + LIMITS.maxPaletteColors + " colors.");
    }
    for (let index = 0; index < palette.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(palette, index)) throw new Error("Palette cannot contain sparse or missing entries.");
    }
    return palette.map((entry, index) => {
      const hex = typeof entry === "string" ? entry : (entry && typeof entry === "object" && !Array.isArray(entry) ? entry.hex : null);
      return normalizeHex(hex, "Palette color " + index);
    });
  }

  function rgbChannels(hex) {
    const normalized = normalizeHex(hex);
    return [
      parseInt(normalized.slice(1, 3), 16),
      parseInt(normalized.slice(3, 5), 16),
      parseInt(normalized.slice(5, 7), 16)
    ];
  }

  function linearize(channel) {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function encodeSrgb(value) {
    const clamped = Math.max(0, Math.min(1, value));
    const encoded = clamped <= 0.0031308
      ? 12.92 * clamped
      : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(encoded * 255)));
  }

  function rgbToHex(red, green, blue) {
    return "#" + [red, green, blue].map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function relativeLuminance(hex) {
    const [red, green, blue] = rgbChannels(hex).map(linearize);
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  }

  function contrastRatio(colorA, colorB) {
    const a = relativeLuminance(colorA);
    const b = relativeLuminance(colorB);
    const lighter = Math.max(a, b);
    const darker = Math.min(a, b);
    return (lighter + 0.05) / (darker + 0.05);
  }

  function analyzeContrastPairs(palette, options) {
    const colors = validatePalette(palette);
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Contrast options must be an object.");

    const textThreshold = options.textThreshold === undefined ? 4.5 : finiteNumber(options.textThreshold, "textThreshold");
    const largeTextThreshold = options.largeTextThreshold === undefined ? 3 : finiteNumber(options.largeTextThreshold, "largeTextThreshold");
    const graphicThreshold = options.graphicThreshold === undefined ? 3 : finiteNumber(options.graphicThreshold, "graphicThreshold");
    [textThreshold, largeTextThreshold, graphicThreshold].forEach(value => {
      if (value < 1 || value > 21) throw new Error("Contrast thresholds must be between 1 and 21.");
    });

    const pairs = [];
    for (let first = 0; first < colors.length; first += 1) {
      for (let second = first + 1; second < colors.length; second += 1) {
        const ratio = contrastRatio(colors[first], colors[second]);
        pairs.push({
          firstIndex: first,
          firstColor: colors[first],
          secondIndex: second,
          secondColor: colors[second],
          ratio: ratio,
          passesNormalText: ratio >= textThreshold,
          passesLargeText: ratio >= largeTextThreshold,
          passesNonText: ratio >= graphicThreshold
        });
      }
    }
    const backgrounds = options.backgrounds === undefined ? [] : options.backgrounds;
    if (!Array.isArray(backgrounds) || backgrounds.length > LIMITS.maxBackgrounds) {
      throw new Error("backgrounds must be an array with at most " + LIMITS.maxBackgrounds + " colors.");
    }
    for (let index = 0; index < backgrounds.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(backgrounds, index)) throw new Error("backgrounds cannot be sparse.");
    }
    const normalizedBackgrounds = backgrounds.map((value, index) => normalizeHex(value, "Background " + index));
    const backgroundChecks = [];
    colors.forEach((color, colorIndex) => {
      normalizedBackgrounds.forEach((background, backgroundIndex) => {
        const ratio = contrastRatio(color, background);
        backgroundChecks.push({
          colorIndex: colorIndex,
          color: color,
          backgroundIndex: backgroundIndex,
          background: background,
          ratio: ratio,
          passesNormalText: ratio >= textThreshold,
          passesLargeText: ratio >= largeTextThreshold,
          passesNonText: ratio >= graphicThreshold
        });
      });
    });
    return {
      thresholds: {
        normalText: textThreshold,
        largeText: largeTextThreshold,
        nonText: graphicThreshold
      },
      pairCount: pairs.length,
      pairs: pairs,
      backgroundChecks: backgroundChecks,
      summary: {
        pairCount: pairs.length,
        normalTextPassCount: pairs.filter(pair => pair.passesNormalText).length,
        normalTextFailCount: pairs.filter(pair => !pair.passesNormalText).length,
        largeTextPassCount: pairs.filter(pair => pair.passesLargeText).length,
        nonTextPassCount: pairs.filter(pair => pair.passesNonText).length,
        backgroundCheckCount: backgroundChecks.length,
        backgroundNormalTextFailCount: backgroundChecks.filter(check => !check.passesNormalText).length
      }
    };
  }

  function labF(value) {
    const epsilon = 216 / 24389;
    const kappa = 24389 / 27;
    return value > epsilon ? Math.cbrt(value) : (kappa * value + 16) / 116;
  }

  function rgbToLab(hex) {
    const [red, green, blue] = rgbChannels(hex).map(linearize);
    // sRGB D65 to XYZ, then normalize by the D65 reference white.
    const x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / 0.95047;
    const y = 0.2126729 * red + 0.7151522 * green + 0.0721750 * blue;
    const z = (0.0193339 * red + 0.1191920 * green + 0.9503041 * blue) / 1.08883;
    const fx = labF(x);
    const fy = labF(y);
    const fz = labF(z);
    return {
      l: 116 * fy - 16,
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  function deltaE76(colorA, colorB) {
    const a = rgbToLab(colorA);
    const b = rgbToLab(colorB);
    const dl = a.l - b.l;
    const da = a.a - b.a;
    const db = a.b - b.b;
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  function findNearDuplicateColors(palette, options) {
    const colors = validatePalette(palette);
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Near-duplicate options must be an object.");
    const threshold = options.threshold === undefined
      ? LIMITS.defaultNearDuplicateDeltaE76
      : finiteNumber(options.threshold, "threshold");
    if (threshold <= 0 || threshold > 100) throw new Error("Near-duplicate threshold must be greater than 0 and at most 100.");
    const pairs = [];
    for (let first = 0; first < colors.length; first += 1) {
      for (let second = first + 1; second < colors.length; second += 1) {
        const distance = deltaE76(colors[first], colors[second]);
        if (distance <= threshold) {
          pairs.push({
            firstIndex: first,
            firstColor: colors[first],
            secondIndex: second,
            secondColor: colors[second],
            deltaE76: distance,
            exactDuplicate: colors[first] === colors[second]
          });
        }
      }
    }
    pairs.sort((left, right) => left.deltaE76 - right.deltaE76 || left.firstIndex - right.firstIndex || left.secondIndex - right.secondIndex);
    return {
      metric: "CIE76",
      threshold: threshold,
      pairs: pairs,
      nearDuplicatePairCount: pairs.length,
      exactDuplicatePairCount: pairs.filter(pair => pair.exactDuplicate).length
    };
  }

  function simulateColorVision(hex, type) {
    const color = normalizeHex(hex);
    const [red, green, blue] = rgbChannels(color).map(linearize);
    if (type === "normal") return color;
    if (type === "achromatopsia") {
      const gray = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
      return rgbToHex(encodeSrgb(gray), encodeSrgb(gray), encodeSrgb(gray));
    }
    const matrix = VISION_MATRICES[type];
    if (!matrix) throw new Error("Simulation type must be normal, protanopia, deuteranopia, tritanopia or achromatopsia.");
    const simulated = matrix.map(row => row[0] * red + row[1] * green + row[2] * blue);
    return rgbToHex(encodeSrgb(simulated[0]), encodeSrgb(simulated[1]), encodeSrgb(simulated[2]));
  }

  function simulatePalette(palette, type) {
    const colors = validatePalette(palette);
    return colors.map(color => simulateColorVision(color, type));
  }

  function auditPaletteAccessibility(palette, options) {
    const colors = validatePalette(palette);
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("Audit options must be an object.");
    const contrast = analyzeContrastPairs(colors, {
      textThreshold: options.textThreshold,
      largeTextThreshold: options.largeTextThreshold,
      graphicThreshold: options.graphicThreshold,
      backgrounds: options.backgrounds || []
    });
    const nearDuplicates = findNearDuplicateColors(colors, { threshold: options.nearDuplicateThreshold });
    return {
      contrast: contrast,
      nearDuplicates: nearDuplicates,
      simulationTypes: ["normal", "protanopia", "deuteranopia", "tritanopia", "achromatopsia"],
      colorVisionPreviews: {
        normal: simulatePalette(colors, "normal"),
        protanopia: simulatePalette(colors, "protanopia"),
        deuteranopia: simulatePalette(colors, "deuteranopia"),
        tritanopia: simulatePalette(colors, "tritanopia"),
        achromatopsia: simulatePalette(colors, "achromatopsia")
      },
      limitations: [
        "Contrast ratios evaluate selected color pairs; they do not prove that a complete interface is accessible.",
        "CIE76 near-duplicate detection is a heuristic and is not a universal perceptual similarity threshold.",
        "Color-vision simulations are approximate visual data transforms, not medical tests or substitutes for user testing."
      ]
    };
  }

  return Object.freeze({
    LIMITS: LIMITS,
    normalizeHex: normalizeHex,
    relativeLuminance: relativeLuminance,
    contrastRatio: contrastRatio,
    analyzeContrastPairs: analyzeContrastPairs,
    rgbToLab: rgbToLab,
    deltaE76: deltaE76,
    findNearDuplicateColors: findNearDuplicateColors,
    simulateColorVision: simulateColorVision,
    simulatePalette: simulatePalette,
    auditPaletteAccessibility: auditPaletteAccessibility
  });
});
