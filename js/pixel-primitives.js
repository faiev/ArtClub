/*!
 * One Pixel Studio — deterministic raster primitives.
 * Browser-global + CommonJS; every operation returns fresh coordinate objects.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPixelPrimitives = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const MAX_DIMENSION = 512;
  const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
  const MAX_COORDINATE = 8192;
  const MAX_LINE_STEPS = 8192;
  const MAX_POLYGON_VERTICES = 4096;

  function assertCanvas(width, height) {
    if (!Number.isInteger(width) || width < 1 || width > MAX_DIMENSION) {
      throw new RangeError("canvas width must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (!Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
      throw new RangeError("canvas height must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
    if (width * height > MAX_PIXELS) throw new RangeError("canvas exceeds the safe pixel limit.");
  }

  function assertOptions(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("options must be an object containing canvas width and height.");
    }
    assertCanvas(options.width, options.height);
  }

  function assertCoordinate(value, name) {
    if (!Number.isSafeInteger(value) || value < -MAX_COORDINATE || value > MAX_COORDINATE) {
      throw new RangeError((name || "coordinate") + " must be a safe integer from -" + MAX_COORDINATE + " to " + MAX_COORDINATE + ".");
    }
  }

  function assertExtent(value, name) {
    if (!Number.isInteger(value) || value < 1 || value > MAX_DIMENSION) {
      throw new RangeError((name || "extent") + " must be an integer from 1 to " + MAX_DIMENSION + ".");
    }
  }

  function assertBounds(x, y, width, height) {
    assertCoordinate(x, "x");
    assertCoordinate(y, "y");
    assertExtent(width, "shape width");
    assertExtent(height, "shape height");
    assertCoordinate(x + width - 1, "right edge");
    assertCoordinate(y + height - 1, "bottom edge");
  }

  function appendUnique(output, seen, x, y) {
    const key = x + "," + y;
    if (seen.has(key)) return;
    seen.add(key);
    output.push({ x, y });
  }

  function rasterizeLine(x0, y0, x1, y1, options) {
    assertOptions(options);
    assertCoordinate(x0, "x0");
    assertCoordinate(y0, "y0");
    assertCoordinate(x1, "x1");
    assertCoordinate(y1, "y1");

    const dx = Math.abs(x1 - x0);
    const sx = x0 < x1 ? 1 : -1;
    const dy = -Math.abs(y1 - y0);
    const sy = y0 < y1 ? 1 : -1;
    const steps = Math.max(dx, -dy) + 1;
    if (steps > MAX_LINE_STEPS) throw new RangeError("line exceeds the maximum raster step limit.");

    let error = dx + dy;
    let x = x0;
    let y = y0;
    const output = [];
    const seen = new Set();

    for (let step = 0; step < steps; step += 1) {
      if (x >= 0 && y >= 0 && x < options.width && y < options.height) {
        appendUnique(output, seen, x, y);
      }
      if (x === x1 && y === y1) break;
      const doubledError = 2 * error;
      if (doubledError >= dy) { error += dy; x += sx; }
      if (doubledError <= dx) { error += dx; y += sy; }
    }
    return output;
  }

  function rasterizeRectangle(x, y, rectWidth, rectHeight, options) {
    assertOptions(options);
    assertBounds(x, y, rectWidth, rectHeight);
    const filled = options.filled === undefined ? false : options.filled;
    if (typeof filled !== "boolean") throw new TypeError("filled must be a boolean.");

    const startX = Math.max(0, x);
    const endX = Math.min(options.width, x + rectWidth);
    const startY = Math.max(0, y);
    const endY = Math.min(options.height, y + rectHeight);
    const output = [];

    for (let py = startY; py < endY; py += 1) {
      for (let px = startX; px < endX; px += 1) {
        if (filled || px === x || px === x + rectWidth - 1 || py === y || py === y + rectHeight - 1) {
          output.push({ x: px, y: py });
        }
      }
    }
    return output;
  }

  function ellipseContains(localX, localY, ellipseWidth, ellipseHeight) {
    if (localX < 0 || localY < 0 || localX >= ellipseWidth || localY >= ellipseHeight) return false;
    const dx2 = 2 * localX + 1 - ellipseWidth;
    const dy2 = 2 * localY + 1 - ellipseHeight;
    const widthSquared = ellipseWidth * ellipseWidth;
    const heightSquared = ellipseHeight * ellipseHeight;
    return dx2 * dx2 * heightSquared + dy2 * dy2 * widthSquared <= widthSquared * heightSquared;
  }

  function rasterizeEllipse(x, y, ellipseWidth, ellipseHeight, options) {
    assertOptions(options);
    assertBounds(x, y, ellipseWidth, ellipseHeight);
    const filled = options.filled === undefined ? false : options.filled;
    if (typeof filled !== "boolean") throw new TypeError("filled must be a boolean.");

    const startX = Math.max(0, x);
    const endX = Math.min(options.width, x + ellipseWidth);
    const startY = Math.max(0, y);
    const endY = Math.min(options.height, y + ellipseHeight);
    const output = [];

    for (let py = startY; py < endY; py += 1) {
      for (let px = startX; px < endX; px += 1) {
        const lx = px - x;
        const ly = py - y;
        if (!ellipseContains(lx, ly, ellipseWidth, ellipseHeight)) continue;
        if (filled ||
            !ellipseContains(lx - 1, ly, ellipseWidth, ellipseHeight) ||
            !ellipseContains(lx + 1, ly, ellipseWidth, ellipseHeight) ||
            !ellipseContains(lx, ly - 1, ellipseWidth, ellipseHeight) ||
            !ellipseContains(lx, ly + 1, ellipseWidth, ellipseHeight)) {
          output.push({ x: px, y: py });
        }
      }
    }
    return output;
  }

  function rasterizeCircle(x, y, diameter, options) {
    return rasterizeEllipse(x, y, diameter, diameter, options);
  }

  function normalizePolygon(points) {
    if (!Array.isArray(points)) throw new TypeError("points must be an array of polygon vertices.");
    if (points.length < 3 || points.length > MAX_POLYGON_VERTICES) {
      throw new RangeError("polygon must contain between 3 and " + MAX_POLYGON_VERTICES + " vertices.");
    }

    const vertices = [];
    for (let index = 0; index < points.length; index += 1) {
      const point = points[index];
      if (!point || typeof point !== "object" || Array.isArray(point)) {
        throw new TypeError("polygon vertex " + index + " must be a point object.");
      }
      assertCoordinate(point.x, "vertex x");
      assertCoordinate(point.y, "vertex y");
      const previous = vertices[vertices.length - 1];
      if (!previous || previous.x !== point.x || previous.y !== point.y) vertices.push({ x: point.x, y: point.y });
    }

    if (vertices.length > 1) {
      const first = vertices[0];
      const last = vertices[vertices.length - 1];
      if (first.x === last.x && first.y === last.y) vertices.pop();
    }
    if (new Set(vertices.map(point => point.x + "," + point.y)).size < 3) {
      throw new RangeError("polygon must contain at least three distinct vertices.");
    }
    return vertices;
  }

  function compareRationals(a, b) {
    const difference = a.numerator * b.denominator - b.numerator * a.denominator;
    if (difference !== 0) return difference < 0 ? -1 : 1;
    return a.order - b.order;
  }

  function rasterizePolygon(points, options) {
    assertOptions(options);
    const vertices = normalizePolygon(points);
    let minY = vertices[0].y;
    let maxY = vertices[0].y;
    for (let i = 1; i < vertices.length; i += 1) {
      minY = Math.min(minY, vertices[i].y);
      maxY = Math.max(maxY, vertices[i].y);
    }

    const startY = Math.max(0, minY);
    const endY = Math.min(options.height - 1, maxY);
    const output = [];

    for (let py = startY; py <= endY; py += 1) {
      const scanY2 = 2 * py + 1;
      const crossings = [];

      for (let i = 0; i < vertices.length; i += 1) {
        const a = vertices[i];
        const b = vertices[(i + 1) % vertices.length];
        const ay2 = 2 * a.y;
        const by2 = 2 * b.y;
        if (ay2 === by2) continue;

        const lower = ay2 < by2 ? a : b;
        const upper = ay2 < by2 ? b : a;
        const lowerY2 = 2 * lower.y;
        const upperY2 = 2 * upper.y;
        if (scanY2 < lowerY2 || scanY2 >= upperY2) continue;

        const deltaY = upper.y - lower.y;
        const deltaX = upper.x - lower.x;
        const numerator = 2 * lower.x * deltaY + (scanY2 - lowerY2) * deltaX;
        crossings.push({ numerator, denominator: 2 * deltaY, order: i });
      }

      crossings.sort(compareRationals);
      for (let i = 0; i + 1 < crossings.length; i += 2) {
        const left = crossings[i];
        const right = crossings[i + 1];
        for (let px = 0; px < options.width; px += 1) {
          const centerX2 = 2 * px + 1;
          const leftInclusive = centerX2 * left.denominator >= 2 * left.numerator;
          const rightExclusive = centerX2 * right.denominator < 2 * right.numerator;
          if (leftInclusive && rightExclusive) output.push({ x: px, y: py });
        }
      }
    }
    return output;
  }

  return Object.freeze({
    MAX_DIMENSION,
    MAX_PIXELS,
    MAX_COORDINATE,
    MAX_LINE_STEPS,
    MAX_POLYGON_VERTICES,
    rasterizeLine,
    rasterizeRectangle,
    rasterizeEllipse,
    rasterizeCircle,
    rasterizePolygon
  });
});
