/*!
 * One Pixel Studio — exact pixel-grid transforms.
 * Browser-global + CommonJS. No smoothing, interpolation or source mutation.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPixelTransform = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_DIMENSION = 512;
  const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  function assertDimensions(width, height, name) {
    const prefix = name || "canvas";
    if (!Number.isInteger(width) || width < 1 || width > MAX_DIMENSION) {
      throw new RangeError(prefix + " width must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (!Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
      throw new RangeError(prefix + " height must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (width * height > MAX_PIXELS) throw new RangeError(prefix + " exceeds the safe pixel limit.");
  }

  function assertBuffer(pixels, width, height) {
    assertDimensions(width, height, "source canvas");
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

  function assertNonNegativeInteger(value, name) {
    if (!Number.isInteger(value) || value < 0 || value > MAX_DIMENSION) {
      throw new RangeError(name + " must be an integer from 0 to " + MAX_DIMENSION + ".");
    }
  }

  function normalizeFillColor(color) {
    if (color === null) return null;
    if (typeof color !== "string" || !HEX_COLOR.test(color)) {
      throw new TypeError("fillColor must be null or a #RRGGBB color.");
    }
    return color.toUpperCase();
  }

  function result(pixels, width, height) {
    return { pixels, width, height };
  }

  function flipHorizontal(pixels, width, height) {
    assertBuffer(pixels, width, height);
    const output = Array(pixels.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        output[y * width + (width - 1 - x)] = pixels[y * width + x];
      }
    }
    return result(output, width, height);
  }

  function flipVertical(pixels, width, height) {
    assertBuffer(pixels, width, height);
    const output = Array(pixels.length);
    for (let y = 0; y < height; y += 1) {
      const targetY = height - 1 - y;
      for (let x = 0; x < width; x += 1) {
        output[targetY * width + x] = pixels[y * width + x];
      }
    }
    return result(output, width, height);
  }

  function rotate90(pixels, width, height) {
    assertBuffer(pixels, width, height);
    const newWidth = height;
    const newHeight = width;
    const output = Array(pixels.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const targetX = height - 1 - y;
        const targetY = x;
        output[targetY * newWidth + targetX] = pixels[y * width + x];
      }
    }
    return result(output, newWidth, newHeight);
  }

  function rotate180(pixels, width, height) {
    assertBuffer(pixels, width, height);
    const output = Array(pixels.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const targetX = width - 1 - x;
        const targetY = height - 1 - y;
        output[targetY * width + targetX] = pixels[y * width + x];
      }
    }
    return result(output, width, height);
  }

  function rotate270(pixels, width, height) {
    assertBuffer(pixels, width, height);
    const newWidth = height;
    const newHeight = width;
    const output = Array(pixels.length);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const targetX = y;
        const targetY = width - 1 - x;
        output[targetY * newWidth + targetX] = pixels[y * width + x];
      }
    }
    return result(output, newWidth, newHeight);
  }

  function crop(pixels, width, height, x, y, cropWidth, cropHeight) {
    assertBuffer(pixels, width, height);
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0) {
      throw new RangeError("crop origin x and y must be non-negative integers.");
    }
    assertDimensions(cropWidth, cropHeight, "crop");
    if (x + cropWidth > width || y + cropHeight > height) {
      throw new RangeError("crop rectangle must be fully inside the source canvas.");
    }

    const output = Array(cropWidth * cropHeight);
    for (let targetY = 0; targetY < cropHeight; targetY += 1) {
      for (let targetX = 0; targetX < cropWidth; targetX += 1) {
        output[targetY * cropWidth + targetX] = pixels[(y + targetY) * width + (x + targetX)];
      }
    }
    return result(output, cropWidth, cropHeight);
  }

  function pad(pixels, width, height, left, top, right, bottom, fillColor) {
    assertBuffer(pixels, width, height);
    assertNonNegativeInteger(left, "left padding");
    assertNonNegativeInteger(top, "top padding");
    assertNonNegativeInteger(right, "right padding");
    assertNonNegativeInteger(bottom, "bottom padding");
    const fill = fillColor === undefined ? null : normalizeFillColor(fillColor);
    const newWidth = width + left + right;
    const newHeight = height + top + bottom;
    assertDimensions(newWidth, newHeight, "padded canvas");

    const output = Array(newWidth * newHeight).fill(fill);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        output[(y + top) * newWidth + x + left] = pixels[y * width + x];
      }
    }
    return result(output, newWidth, newHeight);
  }

  function scaleNearest(pixels, width, height, newWidth, newHeight) {
    assertBuffer(pixels, width, height);
    assertDimensions(newWidth, newHeight, "scaled canvas");
    const output = Array(newWidth * newHeight);
    for (let y = 0; y < newHeight; y += 1) {
      const sourceY = Math.min(height - 1, Math.floor(((2 * y + 1) * height) / (2 * newHeight)));
      for (let x = 0; x < newWidth; x += 1) {
        const sourceX = Math.min(width - 1, Math.floor(((2 * x + 1) * width) / (2 * newWidth)));
        output[y * newWidth + x] = pixels[sourceY * width + sourceX];
      }
    }
    return result(output, newWidth, newHeight);
  }

  return Object.freeze({
    MAX_DIMENSION,
    MAX_PIXELS,
    flipHorizontal,
    flipVertical,
    rotate90,
    rotate180,
    rotate270,
    crop,
    pad,
    scaleNearest
  });
});
