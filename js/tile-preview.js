/*!
 * One Pixel Studio — tiled preview and seam diagnostics
 * Browser-global + CommonJS so the same rules can be tested in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubTilePreview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const LIMITS = Object.freeze({
    maxDimension: 4096,
    maxSourcePixels: 4194304,
    maxRepeatCount: 256,
    maxPreviewDimension: 16384,
    maxPreviewPixels: 4194304
  });

  function assertDimension(value, name) {
    if (!Number.isInteger(value) || value < 1 || value > LIMITS.maxDimension) {
      throw new RangeError(name + " must be a whole number between 1 and " + LIMITS.maxDimension + ".");
    }
  }

  function assertRepeatCount(value, name) {
    if (!Number.isInteger(value) || value < 1 || value > LIMITS.maxRepeatCount) {
      throw new RangeError(name + " must be a whole number between 1 and " + LIMITS.maxRepeatCount + ".");
    }
  }

  function isPixelBuffer(value) {
    return Array.isArray(value) || (
      typeof ArrayBuffer !== "undefined" &&
      ArrayBuffer.isView(value) &&
      Object.prototype.toString.call(value) !== "[object DataView]"
    );
  }

  function validatePixelBuffer(pixels, width, height) {
    assertDimension(width, "Width");
    assertDimension(height, "Height");

    const expectedLength = width * height;
    if (!Number.isSafeInteger(expectedLength) || expectedLength > LIMITS.maxSourcePixels) {
      throw new RangeError("Tile exceeds the safe source pixel limit of " + LIMITS.maxSourcePixels + ".");
    }
    if (!isPixelBuffer(pixels)) {
      throw new TypeError("Pixel buffer must be an Array or typed array.");
    }
    if (pixels.length !== expectedLength) {
      throw new RangeError("Pixel buffer length must be exactly width × height (" + expectedLength + "); received " + pixels.length + ".");
    }

    for (let i = 0; i < expectedLength; i += 1) {
      if (pixels[i] === undefined) {
        throw new TypeError("Pixel buffer must not contain undefined values; use null for transparency (index " + i + ").");
      }
    }
  }

  function createTiledPreview(pixels, width, height, columns, rows) {
    validatePixelBuffer(pixels, width, height);
    assertRepeatCount(columns, "Columns");
    assertRepeatCount(rows, "Rows");

    const previewWidth = width * columns;
    const previewHeight = height * rows;
    const previewLength = previewWidth * previewHeight;

    if (!Number.isSafeInteger(previewWidth) || !Number.isSafeInteger(previewHeight) ||
        previewWidth > LIMITS.maxPreviewDimension || previewHeight > LIMITS.maxPreviewDimension) {
      throw new RangeError("Tiled preview dimensions exceed the safe limit of " + LIMITS.maxPreviewDimension + " pixels per side.");
    }
    if (!Number.isSafeInteger(previewLength) || previewLength > LIMITS.maxPreviewPixels) {
      throw new RangeError("Tiled preview exceeds the safe output pixel limit of " + LIMITS.maxPreviewPixels + ".");
    }

    const output = new Array(previewLength);
    for (let y = 0; y < previewHeight; y += 1) {
      const sourceRow = (y % height) * width;
      const outputRow = y * previewWidth;
      for (let x = 0; x < previewWidth; x += 1) {
        output[outputRow + x] = pixels[sourceRow + (x % width)];
      }
    }

    return {
      width: previewWidth,
      height: previewHeight,
      columns: columns,
      rows: rows,
      pixels: output
    };
  }

  function extractEdgeStrips(pixels, width, height) {
    validatePixelBuffer(pixels, width, height);

    const left = new Array(height);
    const right = new Array(height);
    const top = new Array(width);
    const bottom = new Array(width);

    for (let y = 0; y < height; y += 1) {
      const row = y * width;
      left[y] = pixels[row];
      right[y] = pixels[row + width - 1];
    }
    for (let x = 0; x < width; x += 1) {
      top[x] = pixels[x];
      bottom[x] = pixels[(height - 1) * width + x];
    }

    return { width: width, height: height, left: left, right: right, top: top, bottom: bottom };
  }

  function diagnoseSeams(pixels, width, height) {
    validatePixelBuffer(pixels, width, height);

    const leftRightMismatches = [];
    const topBottomMismatches = [];

    for (let y = 0; y < height; y += 1) {
      const leftColor = pixels[y * width];
      const rightColor = pixels[y * width + width - 1];
      if (!Object.is(leftColor, rightColor)) {
        leftRightMismatches.push({
          row: y,
          left: { x: 0, y: y, color: leftColor },
          right: { x: width - 1, y: y, color: rightColor }
        });
      }
    }

    for (let x = 0; x < width; x += 1) {
      const topColor = pixels[x];
      const bottomColor = pixels[(height - 1) * width + x];
      if (!Object.is(topColor, bottomColor)) {
        topBottomMismatches.push({
          column: x,
          top: { x: x, y: 0, color: topColor },
          bottom: { x: x, y: height - 1, color: bottomColor }
        });
      }
    }

    const leftRight = {
      matches: leftRightMismatches.length === 0,
      mismatches: leftRightMismatches
    };
    const topBottom = {
      matches: topBottomMismatches.length === 0,
      mismatches: topBottomMismatches
    };

    return {
      width: width,
      height: height,
      seamless: leftRight.matches && topBottom.matches,
      mismatchCount: leftRightMismatches.length + topBottomMismatches.length,
      leftRight: leftRight,
      topBottom: topBottom
    };
  }

  return Object.freeze({
    LIMITS: LIMITS,
    createTiledPreview: createTiledPreview,
    extractEdgeStrips: extractEdgeStrips,
    diagnoseSeams: diagnoseSeams
  });
});