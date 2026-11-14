/*!
 * One Pixel Studio — deterministic advanced dithering and outline operations.
 * Browser-global + CommonJS. All operations return fresh pixel buffers.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPixelAdvancedDither = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_DIMENSION = 512;
  const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
  const MAX_PALETTE = 64;
  const MAX_OUTLINE_THICKNESS = 32;
  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
  const FOUR = Object.freeze([[-1, 0], [0, -1], [1, 0], [0, 1]]);
  const EIGHT = Object.freeze([
    [-1, -1], [0, -1], [1, -1],
    [-1, 0],             [1, 0],
    [-1, 1],  [0, 1],   [1, 1]
  ]);

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
      const value = pixels[i];
      if (value !== null && (typeof value !== "string" || !HEX_COLOR.test(value))) {
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
    return "#" + channels.map(value => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function normalizePalette(palette) {
    if (!Array.isArray(palette) || palette.length < 2 || palette.length > MAX_PALETTE) {
      throw new RangeError("palette must contain between 2 and " + MAX_PALETTE + " HEX colors.");
    }
    const normalized = [];
    const seen = new Set();
    for (let i = 0; i < palette.length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(palette, i)) throw new TypeError("palette must not be sparse.");
      const color = normalizeColor(palette[i], "palette color", false);
      if (seen.has(color)) throw new RangeError("palette colors must be unique.");
      seen.add(color);
      normalized.push({ hex: color, rgb: parseColor(color) });
    }
    return normalized;
  }

  function normalizeDitherOptions(options) {
    options = options === undefined || options === null ? {} : options;
    if (typeof options !== "object" || Array.isArray(options)) throw new TypeError("options must be an object.");

    const scanDirection = options.scanDirection === undefined ? "serpentine" : options.scanDirection;
    if (!["left-to-right", "right-to-left", "serpentine"].includes(scanDirection)) {
      throw new RangeError("scanDirection must be left-to-right, right-to-left or serpentine.");
    }

    const alphaMode = options.alphaMode === undefined ? "preserve" : options.alphaMode;
    if (alphaMode !== "preserve" && alphaMode !== "composite") {
      throw new RangeError("alphaMode must be preserve or composite.");
    }

    const distanceMetric = options.distanceMetric === undefined ? "euclidean-rgb" : options.distanceMetric;
    if (distanceMetric !== "euclidean-rgb" && distanceMetric !== "weighted-rec601") {
      throw new RangeError("distanceMetric must be euclidean-rgb or weighted-rec601.");
    }

    const backgroundColor = alphaMode === "composite"
      ? normalizeColor(options.backgroundColor, "backgroundColor", false)
      : null;

    return { scanDirection, alphaMode, distanceMetric, backgroundColor };
  }

  function clampChannel(value) {
    return Math.max(0, Math.min(255, value));
  }

  function paletteDistance(r, g, b, candidate, metric) {
    const dr = r - candidate[0];
    const dg = g - candidate[1];
    const db = b - candidate[2];
    if (metric === "weighted-rec601") {
      return 299 * dr * dr + 587 * dg * dg + 114 * db * db;
    }
    return dr * dr + dg * dg + db * db;
  }

  function nearestPaletteColor(r, g, b, palette, metric) {
    let bestIndex = 0;
    let bestDistance = Infinity;
    for (let i = 0; i < palette.length; i += 1) {
      const distance = paletteDistance(r, g, b, palette[i].rgb, metric);
      // Strict comparison means exact ties select the earliest palette entry.
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return palette[bestIndex];
  }

  function floydSteinberg(pixels, width, height, paletteInput, options) {
    assertBuffer(pixels, width, height);
    const palette = normalizePalette(paletteInput);
    const config = normalizeDitherOptions(options);
    const output = Array(pixels.length);
    const work = new Float64Array(pixels.length * 3);
    const opaque = new Uint8Array(pixels.length);

    for (let i = 0; i < pixels.length; i += 1) {
      const source = pixels[i] === null && config.alphaMode === "composite"
        ? config.backgroundColor
        : pixels[i];
      if (source === null) {
        output[i] = null;
        continue;
      }
      const rgb = parseColor(source);
      work[i * 3] = rgb[0];
      work[i * 3 + 1] = rgb[1];
      work[i * 3 + 2] = rgb[2];
      opaque[i] = 1;
    }

    function diffuse(x, y, direction, errorR, errorG, errorB, numerator) {
      const nx = x + direction.dx;
      const ny = y + direction.dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return;
      const index = ny * width + nx;
      if (!opaque[index]) return; // Preserve-mode transparency is a diffusion barrier.
      const scale = numerator / 16;
      work[index * 3] += errorR * scale;
      work[index * 3 + 1] += errorG * scale;
      work[index * 3 + 2] += errorB * scale;
    }

    for (let y = 0; y < height; y += 1) {
      const leftToRight = config.scanDirection === "left-to-right" ||
        (config.scanDirection === "serpentine" && y % 2 === 0);
      const startX = leftToRight ? 0 : width - 1;
      const endX = leftToRight ? width : -1;
      const stepX = leftToRight ? 1 : -1;

      for (let x = startX; x !== endX; x += stepX) {
        const index = y * width + x;
        if (!opaque[index]) continue;

        const offset = index * 3;
        const red = clampChannel(work[offset]);
        const green = clampChannel(work[offset + 1]);
        const blue = clampChannel(work[offset + 2]);
        const selected = nearestPaletteColor(red, green, blue, palette, config.distanceMetric);
        output[index] = selected.hex;

        const errorR = red - selected.rgb[0];
        const errorG = green - selected.rgb[1];
        const errorB = blue - selected.rgb[2];

        const forward = { dx: leftToRight ? 1 : -1, dy: 0 };
        const downBack = { dx: leftToRight ? -1 : 1, dy: 1 };
        const down = { dx: 0, dy: 1 };
        const downForward = { dx: leftToRight ? 1 : -1, dy: 1 };

        diffuse(x, y, forward, errorR, errorG, errorB, 7);
        diffuse(x, y, downBack, errorR, errorG, errorB, 3);
        diffuse(x, y, down, errorR, errorG, errorB, 5);
        diffuse(x, y, downForward, errorR, errorG, errorB, 1);
      }
    }

    return {
      pixels: output,
      width,
      height,
      scanDirection: config.scanDirection,
      alphaMode: config.alphaMode,
      distanceMetric: config.distanceMetric
    };
  }

  function getNeighbors(connectivity) {
    if (connectivity === 4) return FOUR;
    if (connectivity === 8) return EIGHT;
    throw new RangeError("connectivity must be 4 or 8.");
  }

  function computeOuterDistances(pixels, width, height, neighbors, thickness) {
    const distances = new Uint8Array(pixels.length);
    distances.fill(255);
    const queue = new Uint32Array(pixels.length);
    let read = 0;
    let write = 0;

    for (let i = 0; i < pixels.length; i += 1) {
      if (pixels[i] !== null) {
        distances[i] = 0;
        queue[write] = i;
        write += 1;
      }
    }

    while (read < write) {
      const index = queue[read];
      read += 1;
      const distance = distances[index];
      if (distance >= thickness) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      for (let n = 0; n < neighbors.length; n += 1) {
        const nx = x + neighbors[n][0];
        const ny = y + neighbors[n][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (pixels[next] !== null || distances[next] !== 255) continue;
        distances[next] = distance + 1;
        queue[write] = next;
        write += 1;
      }
    }
    return distances;
  }

  function computeInnerDistances(pixels, width, height, neighbors, thickness) {
    const distances = new Uint8Array(pixels.length);
    distances.fill(255);
    const queue = new Uint32Array(pixels.length);
    let read = 0;
    let write = 0;

    for (let i = 0; i < pixels.length; i += 1) {
      if (pixels[i] === null) {
        distances[i] = 0;
        queue[write] = i;
        write += 1;
        continue;
      }

      const x = i % width;
      const y = Math.floor(i / width);
      let touchesOutside = false;
      for (let n = 0; n < neighbors.length; n += 1) {
        const nx = x + neighbors[n][0];
        const ny = y + neighbors[n][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
          touchesOutside = true;
          break;
        }
      }
      if (touchesOutside) {
        distances[i] = 1;
        queue[write] = i;
        write += 1;
      }
    }

    while (read < write) {
      const index = queue[read];
      read += 1;
      const distance = distances[index];
      if (distance >= thickness) continue;
      const x = index % width;
      const y = Math.floor(index / width);
      for (let n = 0; n < neighbors.length; n += 1) {
        const nx = x + neighbors[n][0];
        const ny = y + neighbors[n][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        if (pixels[next] === null || distances[next] !== 255) continue;
        distances[next] = distance + 1;
        queue[write] = next;
        write += 1;
      }
    }
    return distances;
  }

  function outlinePixels(pixels, width, height, options) {
    assertBuffer(pixels, width, height);
    options = options === undefined || options === null ? {} : options;
    if (typeof options !== "object" || Array.isArray(options)) throw new TypeError("options must be an object.");

    const color = normalizeColor(options.color === undefined ? "#000000" : options.color, "outline color", false);
    const thickness = options.thickness === undefined ? 1 : options.thickness;
    if (!Number.isInteger(thickness) || thickness < 1 || thickness > MAX_OUTLINE_THICKNESS) {
      throw new RangeError("thickness must be an integer from 1 to " + MAX_OUTLINE_THICKNESS + ".");
    }
    const mode = options.mode === undefined ? "outer" : options.mode;
    if (mode !== "outer" && mode !== "inner" && mode !== "both") {
      throw new RangeError("mode must be outer, inner or both.");
    }
    const connectivity = options.connectivity === undefined ? 4 : options.connectivity;
    const neighbors = getNeighbors(connectivity);
    const output = pixels.slice();

    if (mode === "outer" || mode === "both") {
      const outer = computeOuterDistances(pixels, width, height, neighbors, thickness);
      for (let i = 0; i < output.length; i += 1) {
        if (pixels[i] === null && outer[i] > 0 && outer[i] <= thickness) output[i] = color;
      }
    }

    if (mode === "inner" || mode === "both") {
      const inner = computeInnerDistances(pixels, width, height, neighbors, thickness);
      for (let i = 0; i < output.length; i += 1) {
        if (pixels[i] !== null && inner[i] > 0 && inner[i] <= thickness) output[i] = color;
      }
    }

    return output;
  }

  return Object.freeze({
    MAX_DIMENSION,
    MAX_PIXELS,
    MAX_PALETTE,
    MAX_OUTLINE_THICKNESS,
    floydSteinberg,
    outlinePixels
  });
});
