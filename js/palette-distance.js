/*!
 * One Pixel Studio — opt-in perceptual palette distance utilities.
 * Squared RGB remains the default; CIE76 and CIEDE2000 are explicit alternatives.
 * Browser-global + CommonJS, pure and deterministic.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPaletteDistance = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HEX = /^#[0-9a-f]{6}$/i;
  const LIMITS = Object.freeze({
    maxPaletteColors: 256,
    maxPixels: 16777216
  });
  const METRICS = Object.freeze(["rgb-squared", "rgb-euclidean", "cie76", "ciede2000"]);

  function normalizeHex(value, label) {
    if (typeof value !== "string" || !HEX.test(value)) {
      throw new Error((label || "Color") + " must be a six-digit HEX value such as #A1B2C3.");
    }
    return value.toUpperCase();
  }

  function finiteNumber(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(label + " must be a finite number.");
    }
    return value;
  }

  function rgbChannels(hex) {
    const value = normalizeHex(hex).slice(1);
    return [
      parseInt(value.slice(0, 2), 16),
      parseInt(value.slice(2, 4), 16),
      parseInt(value.slice(4, 6), 16)
    ];
  }

  function linearize(channel) {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  function labF(value) {
    const epsilon = 216 / 24389;
    const kappa = 24389 / 27;
    return value > epsilon ? Math.cbrt(value) : (kappa * value + 16) / 116;
  }

  function hexToLab(hex) {
    const [red, green, blue] = rgbChannels(hex).map(linearize);
    // IEC sRGB (D65) to XYZ, then normalize by the D65 reference white.
    const x = (0.4124564 * red + 0.3575761 * green + 0.1804375 * blue) / 0.95047;
    const y = 0.2126729 * red + 0.7151522 * green + 0.0721750 * blue;
    const z = (0.0193339 * red + 0.1191920 * green + 0.9503041 * blue) / 1.08883;
    const fx = labF(x);
    const fy = labF(y);
    const fz = labF(z);
    const rawLightness = 116 * fy - 16;
    // The rounded sRGB/XYZ matrix can produce a few 1e-6 above 100 for #FFFFFF.
    // Clamp only this mathematically bounded conversion result, not user input.
    return {
      l: Math.max(0, Math.min(100, rawLightness)),
      a: 500 * (fx - fy),
      b: 200 * (fy - fz)
    };
  }

  function toLab(value, label) {
    let lab;
    if (Array.isArray(value)) {
      if (value.length !== 3) throw new Error(label + " must be [L*, a*, b*] or an object.");
      lab = { l: value[0], a: value[1], b: value[2] };
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      lab = { l: value.l, a: value.a, b: value.b };
    } else {
      throw new Error(label + " must be [L*, a*, b*] or an object.");
    }
    const l = finiteNumber(lab.l, label + " L*");
    const a = finiteNumber(lab.a, label + " a*");
    const b = finiteNumber(lab.b, label + " b*");
    if (l < 0 || l > 100) throw new Error(label + " L* must be between 0 and 100.");
    return { l: l, a: a, b: b };
  }

  function degreesToRadians(value) {
    return value * Math.PI / 180;
  }

  function radiansToDegrees(value) {
    return value * 180 / Math.PI;
  }

  function hueDegrees(a, b) {
    if (a === 0 && b === 0) return 0;
    const angle = radiansToDegrees(Math.atan2(b, a));
    return angle < 0 ? angle + 360 : angle;
  }

  function deltaE76Lab(labAInput, labBInput) {
    const labA = toLab(labAInput, "First color");
    const labB = toLab(labBInput, "Second color");
    const dl = labA.l - labB.l;
    const da = labA.a - labB.a;
    const db = labA.b - labB.b;
    return Math.sqrt(dl * dl + da * da + db * db);
  }

  function deltaE76Hex(hexA, hexB) {
    return deltaE76Lab(hexToLab(hexA), hexToLab(hexB));
  }

  function ciede2000(labAInput, labBInput, options) {
    const labA = toLab(labAInput, "First color");
    const labB = toLab(labBInput, "Second color");
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new Error("CIEDE2000 options must be an object.");
    }
    const kL = options.kL === undefined ? 1 : finiteNumber(options.kL, "kL");
    const kC = options.kC === undefined ? 1 : finiteNumber(options.kC, "kC");
    const kH = options.kH === undefined ? 1 : finiteNumber(options.kH, "kH");
    if (kL <= 0 || kC <= 0 || kH <= 0 || kL > 10 || kC > 10 || kH > 10) {
      throw new Error("CIEDE2000 parametric factors must be greater than 0 and at most 10.");
    }

    const L1 = labA.l, a1 = labA.a, b1 = labA.b;
    const L2 = labB.l, a2 = labB.a, b2 = labB.b;
    const C1 = Math.sqrt(a1 * a1 + b1 * b1);
    const C2 = Math.sqrt(a2 * a2 + b2 * b2);
    const Cbar = (C1 + C2) / 2;
    const Cbar7 = Math.pow(Cbar, 7);
    const twentyFive7 = Math.pow(25, 7);
    const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + twentyFive7)));

    const a1Prime = (1 + G) * a1;
    const a2Prime = (1 + G) * a2;
    const C1Prime = Math.sqrt(a1Prime * a1Prime + b1 * b1);
    const C2Prime = Math.sqrt(a2Prime * a2Prime + b2 * b2);
    const h1Prime = hueDegrees(a1Prime, b1);
    const h2Prime = hueDegrees(a2Prime, b2);

    const deltaLPrime = L2 - L1;
    const deltaCPrime = C2Prime - C1Prime;
    let deltaHueDegrees;
    if (C1Prime * C2Prime === 0) {
      deltaHueDegrees = 0;
    } else {
      const rawDifference = h2Prime - h1Prime;
      if (Math.abs(rawDifference) <= 180) deltaHueDegrees = rawDifference;
      else if (rawDifference > 180) deltaHueDegrees = rawDifference - 360;
      else deltaHueDegrees = rawDifference + 360;
    }
    const deltaHPrime = 2 * Math.sqrt(C1Prime * C2Prime) * Math.sin(degreesToRadians(deltaHueDegrees / 2));

    const LbarPrime = (L1 + L2) / 2;
    const CbarPrime = (C1Prime + C2Prime) / 2;
    let hbarPrime;
    if (C1Prime * C2Prime === 0) {
      hbarPrime = h1Prime + h2Prime;
    } else if (Math.abs(h1Prime - h2Prime) <= 180) {
      hbarPrime = (h1Prime + h2Prime) / 2;
    } else if (h1Prime + h2Prime < 360) {
      hbarPrime = (h1Prime + h2Prime + 360) / 2;
    } else {
      hbarPrime = (h1Prime + h2Prime - 360) / 2;
    }

    const T =
      1
      - 0.17 * Math.cos(degreesToRadians(hbarPrime - 30))
      + 0.24 * Math.cos(degreesToRadians(2 * hbarPrime))
      + 0.32 * Math.cos(degreesToRadians(3 * hbarPrime + 6))
      - 0.20 * Math.cos(degreesToRadians(4 * hbarPrime - 63));
    const deltaTheta = 30 * Math.exp(-Math.pow((hbarPrime - 275) / 25, 2));
    const CbarPrime7 = Math.pow(CbarPrime, 7);
    const RC = 2 * Math.sqrt(CbarPrime7 / (CbarPrime7 + twentyFive7));
    const SL = 1 + (0.015 * Math.pow(LbarPrime - 50, 2)) / Math.sqrt(20 + Math.pow(LbarPrime - 50, 2));
    const SC = 1 + 0.045 * CbarPrime;
    const SH = 1 + 0.015 * CbarPrime * T;
    const RT = -Math.sin(degreesToRadians(2 * deltaTheta)) * RC;

    const lightnessTerm = deltaLPrime / (kL * SL);
    const chromaTerm = deltaCPrime / (kC * SC);
    const hueTerm = deltaHPrime / (kH * SH);
    const squared = lightnessTerm * lightnessTerm
      + chromaTerm * chromaTerm
      + hueTerm * hueTerm
      + RT * chromaTerm * hueTerm;
    return Math.sqrt(Math.max(0, squared));
  }

  function deltaE00Hex(hexA, hexB, options) {
    return ciede2000(hexToLab(hexA), hexToLab(hexB), options);
  }

  function validatePalette(palette) {
    if (!Array.isArray(palette) || palette.length < 1 || palette.length > LIMITS.maxPaletteColors) {
      throw new Error("Palette must contain 1–" + LIMITS.maxPaletteColors + " colors.");
    }
    for (let index = 0; index < palette.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(palette, index)) {
        throw new Error("Palette cannot contain sparse or missing entries.");
      }
    }
    return palette.map((color, index) => normalizeHex(color, "Palette color " + index));
  }

  function rgbDistanceSquared(hexA, hexB) {
    const a = rgbChannels(hexA);
    const b = rgbChannels(hexB);
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function normalizeMetric(metric) {
    const selected = metric === undefined ? "rgb-squared" : metric;
    if (selected !== "rgb-squared" && selected !== "rgb-euclidean" &&
        selected !== "cie76" && selected !== "ciede2000") {
      throw new Error("Metric must be rgb-squared, rgb-euclidean, cie76 or ciede2000.");
    }
    return selected;
  }

  function metricDistance(target, color, metric, options) {
    if (metric === "rgb-squared") return rgbDistanceSquared(target, color);
    if (metric === "rgb-euclidean") return Math.sqrt(rgbDistanceSquared(target, color));
    if (metric === "cie76") return deltaE76Hex(target, color);
    return deltaE00Hex(target, color, options);
  }

  function findNearestColor(targetHex, palette, options) {
    const targets = validatePalette(palette);
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new Error("Nearest-color options must be an object.");
    }
    const metric = normalizeMetric(options.metric);
    if (targetHex === null) {
      return {
        ok: false,
        targetColor: null,
        metric: metric,
        match: null,
        color: null,
        index: null,
        distance: null,
        tieCount: 0,
        diagnostics: [{
          code: "transparent-target",
          message: "A null/transparent pixel has no color and is not matched to a palette entry."
        }]
      };
    }
    const target = normalizeHex(targetHex, "Target color");
    let best = null;
    let tieCount = 0;
    targets.forEach((color, index) => {
      const distance = metricDistance(target, color, metric, options);
      const distanceSquared = metric === "rgb-squared" || metric === "rgb-euclidean"
        ? rgbDistanceSquared(target, color)
        : null;
      if (best === null || distance < best.distance) {
        best = { color: color, index: index, distance: distance, distanceSquared: distanceSquared };
        tieCount = 0;
      } else if (distance === best.distance) {
        tieCount += 1;
      }
    });
    const diagnostics = tieCount > 0 ? [{
      code: "equal-distance-tie",
      message: "Multiple palette entries have equal distance; the first palette entry is selected.",
      tiedEntryCount: tieCount + 1
    }] : [];
    const match = {
      color: best.color,
      index: best.index,
      distance: best.distance,
      distanceSquared: best.distanceSquared,
      metric: metric,
      tieCount: tieCount
    };
    return {
      ok: true,
      targetColor: target,
      metric: metric,
      match: match,
      color: match.color,
      index: match.index,
      distance: match.distance,
      distanceSquared: match.distanceSquared,
      tieCount: match.tieCount,
      diagnostics: diagnostics
    };
  }

  function mapToPalette(pixels, palette, options) {
    if (!Array.isArray(pixels) || pixels.length > LIMITS.maxPixels) {
      throw new Error("Pixels must be an array with at most " + LIMITS.maxPixels + " samples.");
    }
    for (let index = 0; index < pixels.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(pixels, index)) {
        throw new Error("Pixels cannot contain sparse or missing entries.");
      }
    }
    const targets = validatePalette(palette);
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new Error("Mapping options must be an object.");
    }
    const metric = normalizeMetric(options.metric);
    const mapped = [];
    const matches = [];
    let transparentPixels = 0;
    let exactMatches = 0;
    let mappedPixels = 0;
    let tiePixels = 0;
    let maxDistance = 0;
    let totalDistance = 0;
    pixels.forEach((pixel, pixelIndex) => {
      if (pixel === null) {
        transparentPixels += 1;
        mapped.push(null);
        matches.push(null);
        return;
      }
      const match = findNearestColor(pixel, targets, options);
      mapped.push(match.color);
      matches.push({
        pixelIndex: pixelIndex,
        paletteIndex: match.index,
        sourceColor: normalizeHex(pixel),
        targetColor: match.color,
        distance: match.distance,
        distanceSquared: match.distanceSquared,
        metric: match.metric,
        tieCount: match.tieCount,
        diagnostics: match.diagnostics
      });
      mappedPixels += 1;
      if (match.distance === 0) exactMatches += 1;
      if (match.tieCount > 0) tiePixels += 1;
      if (match.distance > maxDistance) maxDistance = match.distance;
      totalDistance += match.distance;
    });
    return {
      pixels: mapped,
      matches: matches,
      diagnostics: matches.filter(Boolean).flatMap(match => match.diagnostics),
      report: {
        metric: metric,
        totalPixelCount: pixels.length,
        mappedPixelCount: mappedPixels,
        transparentPixelCount: transparentPixels,
        exactMatchCount: exactMatches,
        changedPixelCount: mappedPixels - exactMatches,
        tiePixelCount: tiePixels,
        maxDistance: mappedPixels ? maxDistance : null,
        meanDistance: mappedPixels ? totalDistance / mappedPixels : null
      }
    };
  }

  return Object.freeze({
    LIMITS: LIMITS,
    METRICS: METRICS,
    hexToLab: hexToLab,
    deltaE76Lab: deltaE76Lab,
    deltaE76Hex: deltaE76Hex,
    ciede2000: ciede2000,
    deltaE00Hex: deltaE00Hex,
    findNearestColor: findNearestColor,
    mapToPalette: mapToPalette
  });
});
