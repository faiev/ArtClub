/*!
 * One Pixel Studio — bounded, deterministic pixel-region operations.
 * Browser-global + CommonJS; all operations return fresh data and never mutate inputs.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPixelRegions = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_DIMENSION = 512;
  const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
  const FOUR_NEIGHBORS = Object.freeze([[-1, 0], [0, -1], [1, 0], [0, 1]]);
  const EIGHT_NEIGHBORS = Object.freeze([
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
    if (width * height > MAX_PIXELS) {
      throw new RangeError("canvas exceeds the safe pixel limit.");
    }
  }

  function assertPixelBuffer(pixels, width, height) {
    assertDimensions(width, height);
    if (!Array.isArray(pixels) || pixels.length !== width * height) {
      throw new RangeError("pixels must contain exactly width × height entries.");
    }
    for (let index = 0; index < pixels.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(pixels, index)) {
        throw new TypeError("pixels[" + index + "] is missing; sparse buffers are not supported.");
      }
      const color = pixels[index];
      if (color !== null && (typeof color !== "string" || !HEX_COLOR.test(color))) {
        throw new TypeError("pixels[" + index + "] must be null or a #RRGGBB color.");
      }
    }
  }

  function assertSeed(startX, startY, width, height) {
    if (!Number.isSafeInteger(startX) || !Number.isSafeInteger(startY)) {
      throw new TypeError("startX and startY must be safe integer coordinates.");
    }
    if (startX < 0 || startY < 0 || startX >= width || startY >= height) {
      throw new RangeError("seed point must be inside the canvas.");
    }
  }

  function normalizeOptions(options) {
    options = options === undefined || options === null ? {} : options;
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must be an object.");
    }

    const connectivity = options.connectivity === undefined ? 4 : options.connectivity;
    if (connectivity !== 4 && connectivity !== 8) {
      throw new RangeError("connectivity must be 4 or 8.");
    }

    const tolerance = options.tolerance === undefined ? 0 : options.tolerance;
    if (typeof tolerance !== "number" || !Number.isFinite(tolerance) || tolerance !== 0) {
      throw new RangeError("only exact color matching is supported; tolerance must be 0.");
    }

    const maxIterations = options.maxIterations === undefined ? MAX_PIXELS : options.maxIterations;
    if (!Number.isInteger(maxIterations) || maxIterations < 1 || maxIterations > MAX_PIXELS) {
      throw new RangeError("maxIterations must be an integer from 1 to " + MAX_PIXELS + ".");
    }

    const shouldCancel = options.shouldCancel;
    if (shouldCancel !== undefined && typeof shouldCancel !== "function") {
      throw new TypeError("shouldCancel must be a function when supplied.");
    }

    return {
      connectivity,
      tolerance,
      maxIterations,
      shouldCancel,
      neighbors: connectivity === 4 ? FOUR_NEIGHBORS : EIGHT_NEIGHBORS
    };
  }

  function colorsEqual(a, b) {
    if (a === null || b === null) return a === b;
    return a.toUpperCase() === b.toUpperCase();
  }

  function createAbortError() {
    const error = new Error("pixel-region operation was cancelled.");
    error.name = "AbortError";
    return error;
  }

  function checkCancellation(shouldCancel) {
    if (shouldCancel && shouldCancel()) throw createAbortError();
  }

  function collectRegion(pixels, width, height, startX, startY, options) {
    assertPixelBuffer(pixels, width, height);
    assertSeed(startX, startY, width, height);
    const config = normalizeOptions(options);
    checkCancellation(config.shouldCancel);

    const seedIndex = startY * width + startX;
    const targetColor = pixels[seedIndex];
    const visited = new Uint8Array(pixels.length);
    const queue = new Uint32Array(pixels.length);
    let readIndex = 0;
    let writeIndex = 0;
    let iterations = 0;
    visited[seedIndex] = 1;
    queue[writeIndex] = seedIndex;
    writeIndex += 1;

    while (readIndex < writeIndex) {
      checkCancellation(config.shouldCancel);
      if (iterations >= config.maxIterations) {
        throw new RangeError("region exceeded maxIterations; no partial result was returned.");
      }

      const index = queue[readIndex];
      readIndex += 1;
      iterations += 1;
      const x = index % width;
      const y = Math.floor(index / width);

      for (let n = 0; n < config.neighbors.length; n += 1) {
        const nx = x + config.neighbors[n][0];
        const ny = y + config.neighbors[n][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const nextIndex = ny * width + nx;
        if (visited[nextIndex]) continue;
        visited[nextIndex] = 1;
        if (!colorsEqual(pixels[nextIndex], targetColor)) continue;
        if (writeIndex >= queue.length) {
          throw new RangeError("region queue exceeded the canvas pixel limit.");
        }
        queue[writeIndex] = nextIndex;
        writeIndex += 1;
      }
    }

    const indices = Array.from(queue.subarray(0, writeIndex));
    indices.sort((a, b) => a - b);
    return { color: targetColor, indices, iterations, config };
  }

  function indicesToPoints(indices, width) {
    return indices.map(function (index) {
      return { x: index % width, y: Math.floor(index / width) };
    });
  }

  function calculateBounds(indices, width) {
    if (indices.length === 0) return null;
    let minX = width;
    let minY = Number.MAX_SAFE_INTEGER;
    let maxX = -1;
    let maxY = -1;
    for (let i = 0; i < indices.length; i += 1) {
      const x = indices[i] % width;
      const y = Math.floor(indices[i] / width);
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  }

  function selectRegion(pixels, width, height, startX, startY, options) {
    const region = collectRegion(pixels, width, height, startX, startY, options);
    return {
      color: region.color,
      points: indicesToPoints(region.indices, width),
      bounds: calculateBounds(region.indices, width),
      iterations: region.iterations
    };
  }

  function extractRegionBorder(pixels, width, height, startX, startY, options) {
    const region = collectRegion(pixels, width, height, startX, startY, options);
    const membership = new Uint8Array(pixels.length);
    for (let i = 0; i < region.indices.length; i += 1) membership[region.indices[i]] = 1;

    const border = [];
    for (let i = 0; i < region.indices.length; i += 1) {
      const index = region.indices[i];
      const x = index % width;
      const y = Math.floor(index / width);
      let isBorder = false;
      for (let n = 0; n < region.config.neighbors.length; n += 1) {
        const nx = x + region.config.neighbors[n][0];
        const ny = y + region.config.neighbors[n][1];
        if (nx < 0 || ny < 0 || nx >= width || ny >= height || !membership[ny * width + nx]) {
          isBorder = true;
          break;
        }
      }
      if (isBorder) border.push(index);
    }

    return {
      color: region.color,
      points: indicesToPoints(border, width),
      bounds: calculateBounds(border, width),
      regionSize: region.indices.length,
      iterations: region.iterations
    };
  }

  function normalizeReplacementColor(color) {
    if (color === null) return null;
    if (typeof color !== "string" || !HEX_COLOR.test(color)) {
      throw new TypeError("replacementColor must be null or a #RRGGBB color.");
    }
    return color.toUpperCase();
  }

  function floodFill(pixels, width, height, startX, startY, replacementColor, options) {
    const normalizedReplacement = normalizeReplacementColor(replacementColor);
    const region = collectRegion(pixels, width, height, startX, startY, options);
    const output = pixels.slice();
    const alreadySame = colorsEqual(region.color, normalizedReplacement);
    if (!alreadySame) {
      for (let i = 0; i < region.indices.length; i += 1) {
        output[region.indices[i]] = normalizedReplacement;
      }
    }

    return {
      pixels: output,
      color: region.color,
      replacementColor: normalizedReplacement,
      points: indicesToPoints(region.indices, width),
      bounds: calculateBounds(region.indices, width),
      changed: alreadySame ? 0 : region.indices.length,
      iterations: region.iterations
    };
  }

  return Object.freeze({
    MAX_DIMENSION,
    MAX_PIXELS,
    selectRegion,
    extractRegionBorder,
    floodFill
  });
});
