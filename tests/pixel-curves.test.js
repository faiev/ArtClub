"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Curves = require("../js/pixel-curves.js");

const coords = points => points.map(point => [point.x, point.y]);
const options = { width: 9, height: 9 };

test("quadratic straight-line degeneration returns the exact inclusive Bresenham line", () => {
  assert.deepEqual(coords(Curves.rasterizeQuadratic(
    { x: 0, y: 2 }, { x: 2, y: 2 }, { x: 4, y: 2 }, options
  )), [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]);
});

test("cubic straight-line degeneration returns the exact inclusive Bresenham line", () => {
  assert.deepEqual(coords(Curves.rasterizeCubic(
    { x: 0, y: 3 }, { x: 1, y: 3 }, { x: 3, y: 3 }, { x: 4, y: 3 }, options
  )), [[0, 3], [1, 3], [2, 3], [3, 3], [4, 3]]);
});

test("horizontal and vertical quadratic curves preserve exact pixel order", () => {
  assert.deepEqual(coords(Curves.rasterizeQuadratic(
    { x: 1, y: 1 }, { x: 3, y: 1 }, { x: 5, y: 1 }, options
  )), [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1]]);
  assert.deepEqual(coords(Curves.rasterizeQuadratic(
    { x: 4, y: 1 }, { x: 4, y: 3 }, { x: 4, y: 5 }, options
  )), [[4, 1], [4, 2], [4, 3], [4, 4], [4, 5]]);
});

test("coincident quadratic and cubic control points emit one pixel", () => {
  const same = { x: 4, y: 4 };
  assert.deepEqual(coords(Curves.rasterizeQuadratic(same, same, same, options)), [[4, 4]]);
  assert.deepEqual(coords(Curves.rasterizeCubic(same, same, same, same, options)), [[4, 4]]);
});

test("closed cubic loop includes its shared endpoint once in path order", () => {
  const loop = Curves.rasterizeCubic(
    { x: 4, y: 4 }, { x: 7, y: 1 }, { x: 1, y: 1 }, { x: 4, y: 4 }, options
  );
  assert.ok(loop.length > 4);
  assert.deepEqual(loop[0], { x: 4, y: 4 });
  assert.equal(loop.filter(point => point.x === 4 && point.y === 4).length, 1);
  assert.equal(new Set(loop.map(point => point.x + "," + point.y)).size, loop.length);
});

test("cusp-like cubic output is repeatable, unique and retains both endpoint coordinates", () => {
  const controls = [
    { x: 4, y: 4 }, { x: 8, y: 0 }, { x: 0, y: 0 }, { x: 4, y: 4 }
  ];
  const first = Curves.rasterizeCubic(...controls, options);
  const second = Curves.rasterizeCubic(...controls, options);
  assert.deepEqual(first, second);
  assert.deepEqual(first[0], { x: 4, y: 4 });
  assert.ok(first.length > 4);
  assert.equal(new Set(first.map(point => point.x + "," + point.y)).size, first.length);
});

test("mirrored quadratic curves produce mirrored integer paths with stable ordering", () => {
  const left = Curves.rasterizeQuadratic(
    { x: 0, y: 6 }, { x: 2, y: 1 }, { x: 4, y: 6 }, options
  );
  const right = Curves.rasterizeQuadratic(
    { x: 8, y: 6 }, { x: 6, y: 1 }, { x: 4, y: 6 }, options
  );
  assert.deepEqual(coords(right), coords(left).map(([x, y]) => [8 - x, y]));
});

test("out-of-bounds curve segments are clipped while retaining visible endpoint coverage", () => {
  assert.deepEqual(coords(Curves.rasterizeQuadratic(
    { x: -2, y: 2 }, { x: 1, y: 2 }, { x: 4, y: 2 },
    { width: 5, height: 5 }
  )), [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]]);
});

test("a curve fully outside the canvas returns an empty coordinate list", () => {
  assert.deepEqual(Curves.rasterizeCubic(
    { x: -8, y: -8 }, { x: -6, y: -2 }, { x: -4, y: -2 }, { x: -2, y: -8 },
    { width: 5, height: 5 }
  ), []);
});

test("shared flattened-segment endpoints are deduplicated without breaking path order", () => {
  const points = Curves.rasterizeCubic(
    { x: 0, y: 4 }, { x: 2, y: 0 }, { x: 6, y: 0 }, { x: 8, y: 4 }, options
  );
  const keys = points.map(point => point.x + "," + point.y);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(points[0], { x: 0, y: 4 });
  assert.deepEqual(points.at(-1), { x: 8, y: 4 });
});

test("all curve outputs are clipped integer coordinates and contain no duplicates", () => {
  const cases = [
    Curves.rasterizeQuadratic({ x: -4, y: 0 }, { x: 4, y: 12 }, { x: 12, y: 0 }, options),
    Curves.rasterizeCubic({ x: 0, y: 0 }, { x: 12, y: 12 }, { x: -4, y: 12 }, { x: 8, y: 0 }, options)
  ];
  for (const points of cases) {
    const keys = points.map(point => point.x + "," + point.y);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(points.every(point =>
      Number.isInteger(point.x) && Number.isInteger(point.y) &&
      point.x >= 0 && point.y >= 0 && point.x < options.width && point.y < options.height
    ));
  }
});

test("quadratic and cubic operations never mutate control point objects or arrays", () => {
  const quadratic = [{ x: 0, y: 0 }, { x: 3, y: 6 }, { x: 6, y: 0 }];
  const cubic = [{ x: 0, y: 0 }, { x: 2, y: 6 }, { x: 4, y: 6 }, { x: 6, y: 0 }];
  const qOriginal = structuredClone(quadratic);
  const cOriginal = structuredClone(cubic);
  Curves.rasterizeQuadratic(...quadratic, options);
  Curves.rasterizeCubic(...cubic, options);
  assert.deepEqual(quadratic, qOriginal);
  assert.deepEqual(cubic, cOriginal);
});

test("repeated calls with the same curve and options produce byte-for-byte equal coordinates", () => {
  const controls = [{ x: 0, y: 7 }, { x: 2, y: -2 }, { x: 7, y: 8 }];
  const one = Curves.rasterizeQuadratic(...controls, {
    width: 9, height: 9, flatnessTolerance: 64, maxDepth: 14
  });
  const two = Curves.rasterizeQuadratic(...controls, {
    width: 9, height: 9, flatnessTolerance: 64, maxDepth: 14
  });
  assert.deepEqual(one, two);
});

test("rejects malformed control point counts, sparse arrays and non-finite coordinates", () => {
  assert.throws(() => Curves.rasterizeQuadratic({ x: 0, y: 0 }, { x: 1, y: 1 }, options), /exactly 3/);
  const sparse = new Array(3);
  sparse[0] = { x: 0, y: 0 };
  sparse[2] = { x: 2, y: 0 };
  assert.throws(() => Curves.rasterizeQuadratic(...sparse, options), /must not be sparse/);
  assert.throws(() => Curves.rasterizeQuadratic(
    { x: 0, y: 0 }, { x: NaN, y: 1 }, { x: 2, y: 0 }, options
  ), /safe integer/);
  assert.throws(() => Curves.rasterizeCubic(
    { x: 0, y: 0 }, { x: 1, y: Infinity }, { x: 2, y: 1 }, { x: 3, y: 0 }, options
  ), /safe integer/);
});

test("rejects control coordinates outside the documented precision bound", () => {
  assert.throws(() => Curves.rasterizeQuadratic(
    { x: -8193, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, options
  ), /-8192 to 8192/);
});

test("rejects invalid canvas sizes and malformed options before flattening", () => {
  assert.throws(() => Curves.rasterizeQuadratic(
    { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }, { width: 0, height: 4 }
  ), /canvas width/);
  assert.throws(() => Curves.rasterizeCubic(
    { x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 3, y: 0 }, null
  ), /options/);
});

test("flatness tolerance and all work ceilings reject non-integer or over-budget options", () => {
  const curve = [{ x: 0, y: 0 }, { x: 4, y: 8 }, { x: 8, y: 0 }];
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, flatnessTolerance: 0 }), /flatnessTolerance/);
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, flatnessTolerance: 1025 }), /flatnessTolerance/);
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, maxDepth: 17 }), /maxDepth/);
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, maxSegments: 8193 }), /maxSegments/);
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, maxIterations: 16384 }), /maxIterations/);
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, maxRasterSteps: 1048577 }), /maxRasterSteps/);
});

test("maximum-iteration rejection throws instead of returning partial curve pixels", () => {
  assert.throws(() => Curves.rasterizeQuadratic(
    { x: 0, y: 0 }, { x: 4, y: 8 }, { x: 8, y: 0 },
    { width: 9, height: 9, maxIterations: 1 }
  ), /maxIterations/);
});

test("maximum-depth, segment and raster-step ceilings stop pathological curves", () => {
  const curve = [{ x: 0, y: 0 }, { x: 4, y: 8 }, { x: 8, y: 0 }];
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, flatnessTolerance: 1, maxDepth: 1 }), /maxDepth/);
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, flatnessTolerance: 1, maxSegments: 1 }), /maxSegments/);
  assert.throws(() => Curves.rasterizeQuadratic(...curve, { ...options, maxRasterSteps: 2 }), /maxRasterSteps/);
});

test("maximum supported canvas dimensions remain bounded", () => {
  const points = Curves.rasterizeQuadratic(
    { x: 0, y: 256 }, { x: 256, y: 0 }, { x: 511, y: 256 },
    { width: 512, height: 512, flatnessTolerance: 256 }
  );
  assert.ok(points.length > 0);
  assert.ok(points.length <= Curves.MAX_PIXELS);
  assert.ok(points.every(point => point.x >= 0 && point.y >= 0 && point.x < 512 && point.y < 512));
});


const curveFixtures = require("./fixtures/pixel-effects/curves.json");

test("synthetic quadratic/cubic golden fixtures match exact integer coordinate arrays", () => {
  assert.equal(curveFixtures.schemaVersion, 1);
  for (const fixture of curveFixtures.cases) {
    const canvas = fixture.canvas;
    const points = fixture.degree === 2
      ? Curves.rasterizeQuadratic(...fixture.controlPoints, canvas)
      : Curves.rasterizeCubic(...fixture.controlPoints, canvas);
    assert.deepEqual(coords(points), fixture.expected, fixture.id);
  }
});

test("closed-loop and cusp-like synthetic fixtures satisfy exact endpoint and uniqueness invariants", () => {
  for (const fixture of curveFixtures.invariantCases) {
    const points = fixture.degree === 2
      ? Curves.rasterizeQuadratic(...fixture.controlPoints, fixture.canvas)
      : Curves.rasterizeCubic(...fixture.controlPoints, fixture.canvas);
    const [startX, startY] = fixture.invariants.start;
    assert.deepEqual(points[0], { x: startX, y: startY }, fixture.id);
    assert.ok(points.length >= fixture.invariants.minPointCount, fixture.id);
    if (fixture.invariants.startCoordinateOccursOnce) {
      assert.equal(points.filter(point => point.x === startX && point.y === startY).length, 1, fixture.id);
    }
    if (fixture.invariants.uniqueCoordinates) {
      assert.equal(new Set(points.map(point => point.x + "," + point.y)).size, points.length, fixture.id);
    }
  }
});
