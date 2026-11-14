/*!
 * One Pixel Studio — deterministic pixel color and gradient operations.
 * Browser-global + CommonJS; every operation returns a new row-major buffer.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPixelColor = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_DIMENSION = 512;
  const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
  const MAX_RAMP_COLORS = 256;
  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  function assertDimensions(width, height) {
    if (!Number.isInteger(width) || width < 1 || width > MAX_DIMENSION) {
      throw new RangeError("width must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (!Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
      throw new RangeError("height must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (width * height > MAX_PIXELS) throw new RangeError("canvas exceeds the safe pixel limit.");
  }

  function assertBuffer(pixels, width, height) {
    assertDimensions(width, height);
    if (!Array.isArray(pixels) || pixels.length !== width * height) {
      throw new RangeError("pixels must contain exactly width × height entries.");
    }
    for (let i = 0; i < pixels.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(pixels, i)) {
        throw new TypeError("pixels[" + i + "] is missing; sparse buffers are not supported.");
      }
      const color = pixels[i];
      if (color !== null && (typeof color !== "string" || !HEX_COLOR.test(color))) {
        throw new TypeError("pixels[" + i + "] must be null or a #RRGGBB color.");
      }
    }
  }

  function normalizeColor(color, name, allowNull) {
    if (allowNull && color === null) return null;
    if (typeof color !== "string" || !HEX_COLOR.test(color)) {
      throw new TypeError((name || "color") + " must be " + (allowNull ? "null or " : "") + "a #RRGGBB color.");
    }
    return color.toUpperCase();
  }

  function parseColor(color) {
    const normalized = normalizeColor(color, "color", false);
    return [
      parseInt(normalized.slice(1, 3), 16),
      parseInt(normalized.slice(3, 5), 16),
      parseInt(normalized.slice(5, 7), 16)
    ];
  }

  function toHexColor(channels) {
    return "#" + channels.map(value => value.toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function roundRatioHalfUp(numerator, denominator) {
    return Math.floor((2 * numerator + denominator) / (2 * denominator));
  }

  function interpolateColor(colorA, colorB, numerator, denominator) {
    const a = parseColor(colorA);
    const b = parseColor(colorB);
    return toHexColor(a.map((channel, i) => {
      const value = channel * (denominator - numerator) + b[i] * numerator;
      return roundRatioHalfUp(value, denominator);
    }));
  }

  function replaceColor(pixels, width, height, fromColor, toColor) {
    assertBuffer(pixels, width, height);
    const from = normalizeColor(fromColor, "fromColor", true);
    const to = normalizeColor(toColor, "toColor", true);
    const output = pixels.slice();
    for (let i = 0; i < output.length; i += 1) {
      const current = output[i];
      const matches = from === null ? current === null : current !== null && current.toUpperCase() === from;
      if (matches) output[i] = to;
    }
    return output;
  }

  function mapPalette(pixels, width, height, mappings) {
    assertBuffer(pixels, width, height);
    if (!Array.isArray(mappings) || mappings.length > MAX_RAMP_COLORS) {
      throw new RangeError("mappings must be an array with at most " + MAX_RAMP_COLORS + " entries.");
    }

    const map = new Map();
    for (let i = 0; i < mappings.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(mappings, i)) {
        throw new TypeError("mappings must not be sparse.");
      }
      const entry = mappings[i];
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new TypeError("mapping " + i + " must be an object with from and to colors.");
      }
      const from = normalizeColor(entry.from, "mapping from", true);
      const to = normalizeColor(entry.to, "mapping to", true);
      const key = from === null ? "<transparent>" : from;
      if (map.has(key)) throw new RangeError("palette mapping contains a duplicate source color.");
      map.set(key, to);
    }

    const output = pixels.slice();
    for (let i = 0; i < output.length; i += 1) {
      const current = output[i];
      const key = current === null ? "<transparent>" : current.toUpperCase();
      if (map.has(key)) output[i] = map.get(key);
    }
    return output;
  }

  function normalizeGradientOptions(options, width, height) {
    options = options === undefined || options === null ? {} : options;
    if (typeof options !== "object" || Array.isArray(options)) throw new TypeError("options must be an object.");
    const orientation = options.orientation === undefined ? "horizontal" : options.orientation;
    if (orientation !== "horizontal" && orientation !== "vertical" && orientation !== "linear") {
      throw new RangeError("orientation must be horizontal, vertical or linear.");
    }

    if (orientation !== "linear") return { orientation };
    const startX = options.startX === undefined ? 0 : options.startX;
    const startY = options.startY === undefined ? 0 : options.startY;
    const endX = options.endX === undefined ? Math.max(0, width - 1) : options.endX;
    const endY = options.endY === undefined ? Math.max(0, height - 1) : options.endY;
    for (const [value, name, bound] of [
      [startX, "startX", width], [endX, "endX", width], [startY, "startY", height], [endY, "endY", height]
    ]) {
      if (!Number.isSafeInteger(value) || value < 0 || value >= bound) {
        throw new RangeError(name + " must be an integer coordinate inside the canvas.");
      }
    }
    const vx = endX - startX;
    const vy = endY - startY;
    const denominator = vx * vx + vy * vy;
    return { orientation, startX, startY, vx, vy, denominator };
  }

  function gradientPosition(x, y, config, width, height) {
    if (config.orientation === "horizontal") {
      const denominator = Math.max(1, width - 1);
      return { numerator: width === 1 ? 0 : x, denominator };
    }
    if (config.orientation === "vertical") {
      const denominator = Math.max(1, height - 1);
      return { numerator: height === 1 ? 0 : y, denominator };
    }
    if (config.denominator === 0) return { numerator: 0, denominator: 1 };
    const dot = (x - config.startX) * config.vx + (y - config.startY) * config.vy;
    return {
      numerator: Math.max(0, Math.min(config.denominator, dot)),
      denominator: config.denominator
    };
  }

  // Applies a gradient to opaque pixels only; null pixels remain transparent.
  function applyGradient(pixels, width, height, colorA, colorB, options) {
    assertBuffer(pixels, width, height);
    const from = normalizeColor(colorA, "colorA", false);
    const to = normalizeColor(colorB, "colorB", false);
    const config = normalizeGradientOptions(options, width, height);
    const output = pixels.slice();
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (pixels[index] === null) continue;
        const position = gradientPosition(x, y, config, width, height);
        output[index] = interpolateColor(from, to, position.numerator, position.denominator);
      }
    }
    return output;
  }

  function quantizeChannel(channel, levels) {
    const level = roundRatioHalfUp(channel * (levels - 1), 255);
    return roundRatioHalfUp(level * 255, levels - 1);
  }

  function quantizeColor(color, levels) {
    if (!Number.isInteger(levels) || levels < 2 || levels > 256) {
      throw new RangeError("levels must be an integer from 2 to 256.");
    }
    return toHexColor(parseColor(color).map(channel => quantizeChannel(channel, levels)));
  }

  function posterize(pixels, width, height, levels) {
    assertBuffer(pixels, width, height);
    if (!Number.isInteger(levels) || levels < 2 || levels > 256) {
      throw new RangeError("levels must be an integer from 2 to 256.");
    }
    return pixels.map(color => color === null ? null : quantizeColor(color, levels));
  }

  function applyColorRamp(pixels, width, height, ramp) {
    assertBuffer(pixels, width, height);
    if (!Array.isArray(ramp) || ramp.length < 2 || ramp.length > MAX_RAMP_COLORS) {
      throw new RangeError("ramp must contain between 2 and " + MAX_RAMP_COLORS + " colors.");
    }
    const colors = [];
    for (let i = 0; i < ramp.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(ramp, i)) throw new TypeError("ramp must not be sparse.");
      colors.push(normalizeColor(ramp[i], "ramp color", false));
    }

    const output = pixels.slice();
    const denominator = 255000;
    for (let i = 0; i < pixels.length; i += 1) {
      if (pixels[i] === null) continue;
      const [red, green, blue] = parseColor(pixels[i]);
      // Integer Rec.601 luma: weights sum to 1000; ties choose the brighter ramp stop.
      const luma = 299 * red + 587 * green + 114 * blue;
      const index = roundRatioHalfUp(luma * (colors.length - 1), denominator);
      output[i] = colors[Math.min(colors.length - 1, index)];
    }
    return output;
  }

  return Object.freeze({
    MAX_DIMENSION,
    MAX_PIXELS,
    MAX_RAMP_COLORS,
    replaceColor,
    mapPalette,
    applyGradient,
    quantizeColor,
    posterize,
    applyColorRamp
  });
});
