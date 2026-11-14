/*!
 * One Pixel Studio — deterministic pixel-grid Bézier curve rasterization.
 * Browser-global + CommonJS; fixed-point flattening, then integer major-axis segment rasterization.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPixelCurves = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_DIMENSION = 512;
  const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
  const MAX_COORDINATE = 8192;
  const FIXED_SCALE = 1024;
  const MAX_FLATNESS_TOLERANCE = FIXED_SCALE;
  const MAX_SEGMENTS = 8192;
  const MAX_ITERATIONS = 16383;
  const MAX_DEPTH = 16;
  const MAX_RASTER_STEPS = 1048576;

  function assertCanvas(width, height) {
    if (!Number.isInteger(width) || width < 1 || width > MAX_DIMENSION) {
      throw new RangeError("canvas width must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (!Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
      throw new RangeError("canvas height must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (width * height > MAX_PIXELS) throw new RangeError("canvas exceeds the safe pixel limit.");
  }

  function assertCoordinate(value, name) {
    if (!Number.isSafeInteger(value) || value < -MAX_COORDINATE || value > MAX_COORDINATE) {
      throw new RangeError(name + " must be a safe integer from -" + MAX_COORDINATE + " to " + MAX_COORDINATE + ".");
    }
  }

  function normalizePoint(point, index) {
    if (!point || typeof point !== "object" || Array.isArray(point)) {
      throw new TypeError("control point " + index + " must be an {x, y} object.");
    }
    assertCoordinate(point.x, "control point " + index + " x");
    assertCoordinate(point.y, "control point " + index + " y");
    return {
      x: point.x * FIXED_SCALE,
      y: point.y * FIXED_SCALE
    };
  }

  function normalizePoints(input, expectedCount) {
    if (!Array.isArray(input) || input.length !== expectedCount) {
      throw new RangeError("curve must contain exactly " + expectedCount + " control points.");
    }
    const points = [];
    for (let i = 0; i < expectedCount; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(input, i)) {
        throw new TypeError("control point array must not be sparse.");
      }
      points.push(normalizePoint(input[i], i));
    }
    return points;
  }

  function assertOptionInteger(value, name, min, max) {
    if (!Number.isSafeInteger(value) || value < min || value > max) {
      throw new RangeError(name + " must be an integer from " + min + " to " + max + ".");
    }
  }

  function normalizeOptions(options, width, height) {
    assertCanvas(width, height);
    options = options === undefined || options === null ? {} : options;
    if (typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must be an object.");
    }

    const flatnessTolerance = options.flatnessTolerance === undefined ? 128 : options.flatnessTolerance;
    const maxSegments = options.maxSegments === undefined ? 4096 : options.maxSegments;
    const maxIterations = options.maxIterations === undefined ? 8191 : options.maxIterations;
    const maxDepth = options.maxDepth === undefined ? 12 : options.maxDepth;
    const maxRasterSteps = options.maxRasterSteps === undefined ? 262144 : options.maxRasterSteps;

    assertOptionInteger(flatnessTolerance, "flatnessTolerance", 1, MAX_FLATNESS_TOLERANCE);
    assertOptionInteger(maxSegments, "maxSegments", 1, MAX_SEGMENTS);
    assertOptionInteger(maxIterations, "maxIterations", 1, MAX_ITERATIONS);
    assertOptionInteger(maxDepth, "maxDepth", 1, MAX_DEPTH);
    assertOptionInteger(maxRasterSteps, "maxRasterSteps", 1, MAX_RASTER_STEPS);

    return {
      width,
      height,
      flatnessTolerance,
      maxSegments,
      maxIterations,
      maxDepth,
      maxRasterSteps
    };
  }

  // Midpoint in fixed-point space. Exact halves round away from zero.
  function midpointValue(a, b) {
    const sum = a + b;
    return sum < 0 ? Math.ceil((sum - 1) / 2) : Math.floor((sum + 1) / 2);
  }

  function midpoint(a, b) {
    return {
      x: midpointValue(a.x, b.x),
      y: midpointValue(a.y, b.y)
    };
  }

  function distanceSquared(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  }

  function pointWithinSegmentTolerance(start, end, point, tolerance) {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const qx = point.x - start.x;
    const qy = point.y - start.y;
    const chordSquared = dx * dx + dy * dy;
    const toleranceSquared = tolerance * tolerance;

    if (chordSquared === 0) {
      return distanceSquared(start, point) <= toleranceSquared;
    }

    const projection = qx * dx + qy * dy;
    if (projection <= 0) return distanceSquared(start, point) <= toleranceSquared;
    if (projection >= chordSquared) return distanceSquared(end, point) <= toleranceSquared;

    const cross = dx * qy - dy * qx;
    const crossBig = BigInt(cross);
    const toleranceBig = BigInt(tolerance);
    const chordBig = BigInt(chordSquared);
    return crossBig * crossBig <= toleranceBig * toleranceBig * chordBig;
  }

  function isFlat(points, tolerance) {
    const start = points[0];
    const end = points[points.length - 1];
    for (let i = 1; i < points.length - 1; i += 1) {
      if (!pointWithinSegmentTolerance(start, end, points[i], tolerance)) return false;
    }
    return true;
  }

  function splitQuadratic(points) {
    const p01 = midpoint(points[0], points[1]);
    const p12 = midpoint(points[1], points[2]);
    const p012 = midpoint(p01, p12);
    return [
      [points[0], p01, p012],
      [p012, p12, points[2]]
    ];
  }

  function splitCubic(points) {
    const p01 = midpoint(points[0], points[1]);
    const p12 = midpoint(points[1], points[2]);
    const p23 = midpoint(points[2], points[3]);
    const p012 = midpoint(p01, p12);
    const p123 = midpoint(p12, p23);
    const p0123 = midpoint(p012, p123);
    return [
      [points[0], p01, p012, p0123],
      [p0123, p123, p23, points[3]]
    ];
  }

  // Convert fixed-point coordinates to integer pixels; exact half ties round away from zero.
  function toPixel(value) {
    return value < 0
      ? Math.ceil((value - FIXED_SCALE / 2) / FIXED_SCALE)
      : Math.floor((value + FIXED_SCALE / 2) / FIXED_SCALE);
  }

  function roundRatioTowardDirection(numerator, denominator, direction) {
    const lower = Math.floor(numerator / denominator);
    const remainder = numerator - lower * denominator;
    const doubled = remainder * 2;
    if (doubled > denominator) return lower + 1;
    if (doubled < denominator) return lower;
    // At exact half ties, round toward the segment endpoint. Reversing or
    // reflecting a segment therefore reflects the selected pixel as well.
    return direction > 0 ? lower + 1 : lower;
  }

  function rasterizeIntegerLine(x0, y0, x1, y1, width, height, output, seen) {
    const deltaX = x1 - x0;
    const deltaY = y1 - y0;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const steps = Math.max(absX, absY) + 1;

    if (absX >= absY && absX > 0) {
      for (let i = 0; i <= absX; i += 1) {
        const x = x0 + (deltaX > 0 ? i : -i);
        const numerator = y0 * absX + deltaY * i;
        const y = roundRatioTowardDirection(numerator, absX, deltaY);
        if (x >= 0 && y >= 0 && x < width && y < height) {
          const key = x + "," + y;
          if (!seen.has(key)) {
            seen.add(key);
            output.push({ x, y });
          }
        }
      }
      return steps;
    }

    if (absY > 0) {
      for (let i = 0; i <= absY; i += 1) {
        const y = y0 + (deltaY > 0 ? i : -i);
        const numerator = x0 * absY + deltaX * i;
        const x = roundRatioTowardDirection(numerator, absY, deltaX);
        if (x >= 0 && y >= 0 && x < width && y < height) {
          const key = x + "," + y;
          if (!seen.has(key)) {
            seen.add(key);
            output.push({ x, y });
          }
        }
      }
      return steps;
    }

    if (x0 >= 0 && y0 >= 0 && x0 < width && y0 < height) {
      const key = x0 + "," + y0;
      if (!seen.has(key)) {
        seen.add(key);
        output.push({ x: x0, y: y0 });
      }
    }
    return 1;
  }

  function rasterizeBezier(controlPoints, degree, options) {
    const normalized = normalizeOptions(options, options && options.width, options && options.height);
    const fixedPoints = normalizePoints(controlPoints, degree + 1);
    const stack = [{ points: fixedPoints, depth: 0 }];
    const output = [];
    const seen = new Set();
    let iterations = 0;
    let segments = 0;
    let rasterSteps = 0;

    while (stack.length > 0) {
      if (iterations >= normalized.maxIterations) {
        throw new RangeError("curve exceeded maxIterations; no partial result was returned.");
      }
      iterations += 1;

      const current = stack.pop();
      if (isFlat(current.points, normalized.flatnessTolerance)) {
        segments += 1;
        if (segments > normalized.maxSegments) {
          throw new RangeError("curve exceeded maxSegments; no partial result was returned.");
        }

        const start = current.points[0];
        const end = current.points[current.points.length - 1];
        const x0 = toPixel(start.x);
        const y0 = toPixel(start.y);
        const x1 = toPixel(end.x);
        const y1 = toPixel(end.y);
        const estimate = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) + 1;
        if (rasterSteps + estimate > normalized.maxRasterSteps) {
          throw new RangeError("curve exceeded maxRasterSteps; no partial result was returned.");
        }
        rasterSteps += rasterizeIntegerLine(
          x0, y0, x1, y1,
          normalized.width, normalized.height,
          output, seen
        );
        continue;
      }

      if (current.depth >= normalized.maxDepth) {
        throw new RangeError("curve exceeded maxDepth before reaching flatness tolerance.");
      }

      const halves = degree === 2
        ? splitQuadratic(current.points)
        : splitCubic(current.points);
      // Push right first so the left half is processed first (stable path order).
      stack.push({ points: halves[1], depth: current.depth + 1 });
      stack.push({ points: halves[0], depth: current.depth + 1 });
    }

    return output;
  }

  function rasterizeQuadratic(p0, p1, p2, options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must contain canvas width and height.");
    }
    return rasterizeBezier([p0, p1, p2], 2, options);
  }

  function rasterizeCubic(p0, p1, p2, p3, options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must contain canvas width and height.");
    }
    return rasterizeBezier([p0, p1, p2, p3], 3, options);
  }

  return Object.freeze({
    MAX_DIMENSION,
    MAX_PIXELS,
    MAX_COORDINATE,
    FIXED_SCALE,
    MAX_FLATNESS_TOLERANCE,
    MAX_SEGMENTS,
    MAX_ITERATIONS,
    MAX_DEPTH,
    MAX_RASTER_STEPS,
    rasterizeQuadratic,
    rasterizeCubic
  });
});
