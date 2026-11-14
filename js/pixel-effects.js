/*!
 * One Pixel Studio — deterministic pixel-art craft algorithms.
 * Browser-global + CommonJS so the same pure functions can be tested in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPixelEffects = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_DIMENSION = 512;
  const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
  const SYMMETRY_MODES = Object.freeze(["horizontal", "vertical", "four-way"]);
  const BAYER_SIZES = Object.freeze([2, 4, 8]);

  function assertDimensions(width, height) {
    if (!Number.isInteger(width) || width < 1 || width > MAX_DIMENSION) {
      throw new RangeError("width must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (!Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
      throw new RangeError("height must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (width * height > MAX_PIXELS) {
      throw new RangeError("canvas exceeds the safe pixel limit.");
    }
  }

  function assertColor(color, name) {
    if (typeof color !== "string" || !HEX_COLOR.test(color)) {
      throw new TypeError((name || "color") + " must be a #RRGGBB color.");
    }
  }

  function assertPixelBuffer(pixels, width, height, name) {
    assertDimensions(width, height);
    if (!Array.isArray(pixels) || pixels.length !== width * height) {
      throw new RangeError((name || "pixels") + " must contain exactly width × height entries.");
    }
    for (let index = 0; index < pixels.length; index += 1) {
      const color = pixels[index];
      if (color !== null && (typeof color !== "string" || !HEX_COLOR.test(color))) {
        throw new TypeError((name || "pixels") + "[" + index + "] must be null or a #RRGGBB color.");
      }
    }
  }

  function normalizePoints(input) {
    const points = Array.isArray(input) ? input : [input];
    if (!Array.isArray(input) && (!input || typeof input !== "object")) {
      throw new TypeError("points must be a point object or an array of point objects.");
    }
    if (points.length > MAX_PIXELS) {
      throw new RangeError("stroke contains too many points.");
    }
    return points.map(function (point, index) {
      if (!point || typeof point !== "object" || Array.isArray(point) ||
          !Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) {
        throw new TypeError("point " + index + " must contain safe integer x and y coordinates.");
      }
      return { x: point.x, y: point.y };
    });
  }

  function expandSymmetry(input, options) {
    options = options || {};
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must be an object.");
    }

    const width = options.width;
    const height = options.height;
    assertDimensions(width, height);
    const mode = options.mode === undefined ? "four-way" : options.mode;
    if (!SYMMETRY_MODES.includes(mode)) {
      throw new RangeError("mode must be horizontal, vertical or four-way.");
    }

    const points = normalizePoints(input);
    const output = [];
    const seen = new Set();

    points.forEach(function (point) {
      const mirroredX = width - 1 - point.x;
      const mirroredY = height - 1 - point.y;
      if (!Number.isSafeInteger(mirroredX) || !Number.isSafeInteger(mirroredY)) {
        throw new RangeError("point coordinates are too large to mirror safely.");
      }

      const candidates = [point];
      if (mode === "horizontal" || mode === "four-way") {
        candidates.push({ x: mirroredX, y: point.y });
      }
      if (mode === "vertical" || mode === "four-way") {
        candidates.push({ x: point.x, y: mirroredY });
      }
      if (mode === "four-way") {
        candidates.push({ x: mirroredX, y: mirroredY });
      }

      candidates.forEach(function (candidate) {
        if (candidate.x < 0 || candidate.y < 0 || candidate.x >= width || candidate.y >= height) return;
        const key = candidate.x + "," + candidate.y;
        if (seen.has(key)) return;
        seen.add(key);
        output.push({ x: candidate.x, y: candidate.y });
      });
    });

    return output;
  }

  function generateOutline(pixels, width, height, options) {
    options = options || {};
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must be an object.");
    }
    assertPixelBuffer(pixels, width, height, "pixels");

    const color = options.color === undefined ? "#000000" : options.color;
    const neighbors = options.neighbors === undefined ? 8 : options.neighbors;
    assertColor(color, "outline color");
    if (neighbors !== 4 && neighbors !== 8) {
      throw new RangeError("neighbors must be 4 or 8.");
    }

    const result = pixels.slice();
    const offsets = neighbors === 4
      ? [[0, -1], [1, 0], [0, 1], [-1, 0]]
      : [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]];

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        if (pixels[index] === null) continue;

        offsets.forEach(function (offset) {
          const nextX = x + offset[0];
          const nextY = y + offset[1];
          if (nextX < 0 || nextY < 0 || nextX >= width || nextY >= height) return;
          const nextIndex = nextY * width + nextX;
          if (pixels[nextIndex] === null) result[nextIndex] = color;
        });
      }
    }

    return result;
  }

  function parseColor(color) {
    assertColor(color, "color");
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16)
    ];
  }

  function toHexColor(channels) {
    return "#" + channels.map(function (channel) {
      return channel.toString(16).padStart(2, "0");
    }).join("").toUpperCase();
  }

  function assertAmount(amount, min, max, name) {
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount < min || amount > max) {
      throw new RangeError((name || "amount") + " must be between " + min + " and " + max + ".");
    }
  }

  function shadeColor(color, amount) {
    assertAmount(amount, -1, 1, "amount");
    const channels = parseColor(color);
    const target = amount >= 0 ? 255 : 0;
    const strength = Math.abs(amount);
    return toHexColor(channels.map(function (channel) {
      // Round each interpolated channel to the nearest integer (half values round up).
      return Math.round(channel + (target - channel) * strength);
    }));
  }

  function lightenColor(color, amount) {
    assertAmount(amount, 0, 1, "lighten amount");
    return shadeColor(color, amount);
  }

  function darkenColor(color, amount) {
    assertAmount(amount, 0, 1, "darken amount");
    return shadeColor(color, -amount);
  }

  function createBayerMatrix(size) {
    if (!BAYER_SIZES.includes(size)) {
      throw new RangeError("matrixSize must be 2, 4 or 8.");
    }

    let matrix = [[0]];
    while (matrix.length < size) {
      const previousSize = matrix.length;
      const next = Array.from({ length: previousSize * 2 }, function () {
        return Array(previousSize * 2).fill(0);
      });
      for (let y = 0; y < previousSize; y += 1) {
        for (let x = 0; x < previousSize; x += 1) {
          const value = matrix[y][x] * 4;
          next[y][x] = value;
          next[y][x + previousSize] = value + 2;
          next[y + previousSize][x] = value + 3;
          next[y + previousSize][x + previousSize] = value + 1;
        }
      }
      matrix = next;
    }
    return matrix;
  }

  function modulo(value, divisor) {
    return ((value % divisor) + divisor) % divisor;
  }

  function orderedDither(tones, width, height, options) {
    options = options || {};
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must be an object.");
    }
    assertDimensions(width, height);
    if (!Array.isArray(tones) || tones.length !== width * height) {
      throw new RangeError("tones must contain exactly width × height entries.");
    }

    const colorA = options.colorA;
    const colorB = options.colorB;
    assertColor(colorA, "colorA");
    assertColor(colorB, "colorB");

    const matrixSize = options.matrixSize === undefined ? 4 : options.matrixSize;
    const matrix = createBayerMatrix(matrixSize);
    const originX = options.originX === undefined ? 0 : options.originX;
    const originY = options.originY === undefined ? 0 : options.originY;
    if (!Number.isSafeInteger(originX) || !Number.isSafeInteger(originY)) {
      throw new TypeError("originX and originY must be safe integers.");
    }

    for (let index = 0; index < tones.length; index += 1) {
      const tone = tones[index];
      if (tone !== null && (typeof tone !== "number" || !Number.isFinite(tone) || tone < 0 || tone > 1)) {
        throw new RangeError("tones[" + index + "] must be null or a number between 0 and 1.");
      }
    }

    const result = Array(tones.length);
    const thresholdScale = matrixSize * matrixSize;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = y * width + x;
        const tone = tones[index];
        if (tone === null) {
          result[index] = null;
          continue;
        }
        const matrixValue = matrix[modulo(y + originY, matrixSize)][modulo(x + originX, matrixSize)];
        const threshold = (matrixValue + 0.5) / thresholdScale;
        // A strict comparison makes equality deterministic: equal-to-threshold selects colorA.
        result[index] = tone > threshold ? colorB : colorA;
      }
    }

    return result;
  }

  return Object.freeze({
    MAX_DIMENSION: MAX_DIMENSION,
    MAX_PIXELS: MAX_PIXELS,
    SYMMETRY_MODES: SYMMETRY_MODES,
    BAYER_SIZES: BAYER_SIZES,
    expandSymmetry: expandSymmetry,
    generateOutline: generateOutline,
    shadeColor: shadeColor,
    lightenColor: lightenColor,
    darkenColor: darkenColor,
    createBayerMatrix: createBayerMatrix,
    orderedDither: orderedDither
  });
});
