/*!
 * One Pixel Studio — deterministic tile transforms and offset previews
 * Browser-global + CommonJS so the same pure operations can be tested in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubTileTransform = api;
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
    if (!Number.isSafeInteger(value) || value < 1 || value > LIMITS.maxDimension) {
      throw new RangeError(name + " must be a whole number between 1 and " + LIMITS.maxDimension + ".");
    }
  }

  function validatePixelBuffer(pixels, width, height) {
    assertDimension(width, "Width");
    assertDimension(height, "Height");
    const expectedLength = width * height;
    if (!Number.isSafeInteger(expectedLength) || expectedLength > LIMITS.maxSourcePixels) {
      throw new RangeError("Tile exceeds the safe source pixel limit of " + LIMITS.maxSourcePixels + ".");
    }
    const isTypedArray = typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView(pixels) &&
      Object.prototype.toString.call(pixels) !== "[object DataView]";
    if (!Array.isArray(pixels) && !isTypedArray) {
      throw new TypeError("Pixel buffer must be an Array or typed array.");
    }
    if (pixels.length !== expectedLength) {
      throw new RangeError("Pixel buffer length must be exactly width × height (" +
        expectedLength + "); received " + pixels.length + ".");
    }
    for (let i = 0; i < expectedLength; i += 1) {
      if (pixels[i] === undefined) {
        throw new TypeError("Pixel buffer must not contain undefined values; use null for transparency (index " + i + ").");
      }
    }
  }

  function assertRepeatCount(value, name) {
    if (!Number.isSafeInteger(value) || value < 1 || value > LIMITS.maxRepeatCount) {
      throw new RangeError(name + " must be a whole number between 1 and " + LIMITS.maxRepeatCount + ".");
    }
  }

  function normalizeOffset(value, size, name) {
    if (!Number.isSafeInteger(value)) throw new TypeError(name + " must be a safe integer.");
    return ((value % size) + size) % size;
  }

  function createResult(width, height, pixels, extra) {
    return Object.assign({ width: width, height: height, pixels: pixels }, extra || {});
  }

  /** Rotate clockwise by quarterTurns × 90°. Negative turns are normalized. */
  function rotateTile(pixels, width, height, quarterTurns) {
    validatePixelBuffer(pixels, width, height);
    if (!Number.isSafeInteger(quarterTurns)) throw new TypeError("Quarter turns must be a safe integer.");
    const turns = ((quarterTurns % 4) + 4) % 4;
    const outputWidth = turns % 2 === 1 ? height : width;
    const outputHeight = turns % 2 === 1 ? width : height;
    const output = new Array(outputWidth * outputHeight);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let destinationX = x;
        let destinationY = y;
        if (turns === 1) {
          destinationX = height - 1 - y;
          destinationY = x;
        } else if (turns === 2) {
          destinationX = width - 1 - x;
          destinationY = height - 1 - y;
        } else if (turns === 3) {
          destinationX = y;
          destinationY = width - 1 - x;
        }
        output[destinationY * outputWidth + destinationX] = pixels[y * width + x];
      }
    }
    return createResult(outputWidth, outputHeight, output, { quarterTurns: turns });
  }

  /** Flip across the vertical axis (horizontal=true), horizontal axis (vertical=true), or both. */
  function flipTile(pixels, width, height, options) {
    validatePixelBuffer(pixels, width, height);
    options = options === undefined ? {} : options;
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("Flip options must be an object.");
    }
    const horizontal = options.horizontal === undefined ? false : options.horizontal;
    const vertical = options.vertical === undefined ? false : options.vertical;
    if (typeof horizontal !== "boolean" || typeof vertical !== "boolean") {
      throw new TypeError("Horizontal and vertical flip options must be boolean.");
    }

    const output = new Array(width * height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const sourceX = horizontal ? width - 1 - x : x;
        const sourceY = vertical ? height - 1 - y : y;
        output[y * width + x] = pixels[sourceY * width + sourceX];
      }
    }
    return createResult(width, height, output, { horizontal: horizontal, vertical: vertical });
  }

  /** Positive offsets move pixels right/down; negative offsets move them left/up. */
  function offsetTile(pixels, width, height, offsetX, offsetY) {
    validatePixelBuffer(pixels, width, height);
    const normalizedX = normalizeOffset(offsetX, width, "Offset X");
    const normalizedY = normalizeOffset(offsetY, height, "Offset Y");
    const output = new Array(width * height);
    for (let y = 0; y < height; y += 1) {
      const sourceY = (y - normalizedY + height) % height;
      for (let x = 0; x < width; x += 1) {
        const sourceX = (x - normalizedX + width) % width;
        output[y * width + x] = pixels[sourceY * width + sourceX];
      }
    }
    return createResult(width, height, output, { offsetX: normalizedX, offsetY: normalizedY });
  }

  /** Repeated preview of a toroidally offset tile, bounded before output allocation. */
  function createOffsetPreview(pixels, width, height, offsetX, offsetY, columns, rows) {
    validatePixelBuffer(pixels, width, height);
    const normalizedX = normalizeOffset(offsetX, width, "Offset X");
    const normalizedY = normalizeOffset(offsetY, height, "Offset Y");
    assertRepeatCount(columns, "Columns");
    assertRepeatCount(rows, "Rows");
    const previewWidth = width * columns;
    const previewHeight = height * rows;
    const previewLength = previewWidth * previewHeight;
    if (!Number.isSafeInteger(previewWidth) || !Number.isSafeInteger(previewHeight) ||
        previewWidth > LIMITS.maxPreviewDimension || previewHeight > LIMITS.maxPreviewDimension) {
      throw new RangeError("Offset preview dimensions exceed the safe limit of " +
        LIMITS.maxPreviewDimension + " pixels per side.");
    }
    if (!Number.isSafeInteger(previewLength) || previewLength > LIMITS.maxPreviewPixels) {
      throw new RangeError("Offset preview exceeds the safe output pixel limit of " +
        LIMITS.maxPreviewPixels + ".");
    }

    const output = new Array(previewLength);
    for (let y = 0; y < previewHeight; y += 1) {
      const sourceY = (y - normalizedY + height) % height;
      const outputRow = y * previewWidth;
      const sourceRow = sourceY * width;
      for (let x = 0; x < previewWidth; x += 1) {
        const sourceX = (x - normalizedX + width) % width;
        output[outputRow + x] = pixels[sourceRow + sourceX];
      }
    }
    return createResult(previewWidth, previewHeight, output, {
      columns: columns, rows: rows, offsetX: normalizedX, offsetY: normalizedY
    });
  }

  /** Crop a non-empty rectangle. Out-of-bounds crops are rejected, not clipped. */
  function cropTile(pixels, width, height, rectangle) {
    validatePixelBuffer(pixels, width, height);
    if (!rectangle || typeof rectangle !== "object" || Array.isArray(rectangle)) {
      throw new TypeError("Crop rectangle must be an object.");
    }
    const x = rectangle.x;
    const y = rectangle.y;
    const cropWidth = rectangle.width;
    const cropHeight = rectangle.height;
    if (!Number.isSafeInteger(x) || x < 0 || !Number.isSafeInteger(y) || y < 0 ||
        !Number.isSafeInteger(cropWidth) || cropWidth < 1 ||
        !Number.isSafeInteger(cropHeight) || cropHeight < 1) {
      throw new RangeError("Crop x/y must be non-negative integers and crop width/height must be positive integers.");
    }
    if (x + cropWidth > width || y + cropHeight > height) {
      throw new RangeError("Crop rectangle must fit entirely inside the source tile.");
    }
    const output = new Array(cropWidth * cropHeight);
    for (let row = 0; row < cropHeight; row += 1) {
      const sourceStart = (y + row) * width + x;
      const targetStart = row * cropWidth;
      for (let column = 0; column < cropWidth; column += 1) {
        output[targetStart + column] = pixels[sourceStart + column];
      }
    }
    return createResult(cropWidth, cropHeight, output, {
      sourceRect: { x: x, y: y, width: cropWidth, height: cropHeight }
    });
  }

  /** Add transparent or caller-supplied padding and report the source rectangle. */
  function padTile(pixels, width, height, padding, fillPixel) {
    validatePixelBuffer(pixels, width, height);
    if (padding === undefined) padding = {};
    if (!padding || typeof padding !== "object" || Array.isArray(padding)) {
      throw new TypeError("Padding must be an object.");
    }
    const top = padding.top === undefined ? 0 : padding.top;
    const right = padding.right === undefined ? 0 : padding.right;
    const bottom = padding.bottom === undefined ? 0 : padding.bottom;
    const left = padding.left === undefined ? 0 : padding.left;
    [top, right, bottom, left].forEach((value, index) => {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new RangeError(["Top", "Right", "Bottom", "Left"][index] +
          " padding must be a non-negative whole number.");
      }
    });
    if (fillPixel === undefined) fillPixel = null;
    const outputWidth = width + left + right;
    const outputHeight = height + top + bottom;
    if (!Number.isSafeInteger(outputWidth) || !Number.isSafeInteger(outputHeight) ||
        outputWidth > LIMITS.maxDimension || outputHeight > LIMITS.maxDimension) {
      throw new RangeError("Padded tile dimensions exceed the safe limit of " + LIMITS.maxDimension + " pixels per side.");
    }
    const outputLength = outputWidth * outputHeight;
    if (!Number.isSafeInteger(outputLength) || outputLength > LIMITS.maxSourcePixels) {
      throw new RangeError("Padded tile exceeds the safe output pixel limit of " + LIMITS.maxSourcePixels + ".");
    }
    const output = new Array(outputLength).fill(fillPixel);
    for (let y = 0; y < height; y += 1) {
      const sourceStart = y * width;
      const targetStart = (y + top) * outputWidth + left;
      for (let x = 0; x < width; x += 1) output[targetStart + x] = pixels[sourceStart + x];
    }
    return createResult(outputWidth, outputHeight, output, {
      padding: { top: top, right: right, bottom: bottom, left: left },
      sourceRect: { x: left, y: top, width: width, height: height }
    });
  }

  /** Compare the two diagonal pairs that meet at a four-tile junction. */
  function diagnoseCornerWraps(pixels, width, height) {
    validatePixelBuffer(pixels, width, height);
    const points = getTileBoundaryCoordinates(width, height).corners;
    const corners = {};
    Object.keys(points).forEach(function (name) {
      const point = points[name];
      corners[name] = { x: point.x, y: point.y, color: pixels[point.y * width + point.x] };
    });
    const pairs = [
      { first: "topLeft", second: "bottomRight" },
      { first: "topRight", second: "bottomLeft" }
    ];
    const mismatches = [];
    pairs.forEach(function (pair) {
      const first = corners[pair.first];
      const second = corners[pair.second];
      if (!Object.is(first.color, second.color)) {
        mismatches.push({ first: pair.first, second: pair.second, a: first, b: second });
      }
    });
    return { matches: mismatches.length === 0, mismatches: mismatches, corners: corners };
  }

  /** Diagnose opposing edge joins and diagonal corner joins for a tiled repeat. */
  function diagnoseTileWraps(pixels, width, height) {
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

    const leftRight = { matches: leftRightMismatches.length === 0, mismatches: leftRightMismatches };
    const topBottom = { matches: topBottomMismatches.length === 0, mismatches: topBottomMismatches };
    const cornerWraps = diagnoseCornerWraps(pixels, width, height);
    return {
      width: width,
      height: height,
      seamless: leftRight.matches && topBottom.matches && cornerWraps.matches,
      mismatchCount: leftRightMismatches.length + topBottomMismatches.length + cornerWraps.mismatches.length,
      leftRight: leftRight,
      topBottom: topBottom,
      cornerWraps: cornerWraps
    };
  }

  /** Return all boundary coordinates; edge arrays include corners as endpoints. */
  function getTileBoundaryCoordinates(width, height) {
    assertDimension(width, "Width");
    assertDimension(height, "Height");
    const top = [];
    const right = [];
    const bottom = [];
    const left = [];
    for (let x = 0; x < width; x += 1) {
      top.push({ x: x, y: 0 });
      bottom.push({ x: x, y: height - 1 });
    }
    for (let y = 0; y < height; y += 1) {
      left.push({ x: 0, y: y });
      right.push({ x: width - 1, y: y });
    }
    return {
      width: width,
      height: height,
      edges: { top: top, right: right, bottom: bottom, left: left },
      corners: {
        topLeft: { x: 0, y: 0 },
        topRight: { x: width - 1, y: 0 },
        bottomRight: { x: width - 1, y: height - 1 },
        bottomLeft: { x: 0, y: height - 1 }
      }
    };
  }

  return Object.freeze({
    LIMITS: LIMITS,
    rotateTile: rotateTile,
    flipTile: flipTile,
    offsetTile: offsetTile,
    createOffsetPreview: createOffsetPreview,
    cropTile: cropTile,
    padTile: padTile,
    getTileBoundaryCoordinates: getTileBoundaryCoordinates,
    diagnoseCornerWraps: diagnoseCornerWraps,
    diagnoseTileWraps: diagnoseTileWraps
  });
});
