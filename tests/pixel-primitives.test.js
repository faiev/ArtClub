"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Primitives = require("../js/pixel-primitives.js");

function coords(points) {
  return points.map(point => [point.x, point.y]);
}

test("Bresenham rasterizes horizontal, vertical and degenerate lines in start-to-end order", () => {
  assert.deepEqual(coords(Primitives.rasterizeLine(1, 2, 4, 2, { width: 6, height: 5 })), [[1, 2], [2, 2], [3, 2], [4, 2]]);
  assert.deepEqual(coords(Primitives.rasterizeLine(3, 0, 3, 3, { width: 6, height: 5 })), [[3, 0], [3, 1], [3, 2], [3, 3]]);
  assert.deepEqual(coords(Primitives.rasterizeLine(2, 2, 2, 2, { width: 6, height: 5 })), [[2, 2]]);
});

test("Bresenham rasterizes all octants with deterministic integer tie-breaking", () => {
  assert.deepEqual(coords(Primitives.rasterizeLine(0, 0, 4, 2, { width: 5, height: 3 })), [[0, 0], [1, 1], [2, 1], [3, 2], [4, 2]]);
  assert.deepEqual(coords(Primitives.rasterizeLine(0, 2, 4, 0, { width: 5, height: 3 })), [[0, 2], [1, 1], [2, 1], [3, 0], [4, 0]]);
  assert.deepEqual(coords(Primitives.rasterizeLine(4, 0, 0, 2, { width: 5, height: 3 })), [[4, 0], [3, 1], [2, 1], [1, 2], [0, 2]]);
  assert.deepEqual(coords(Primitives.rasterizeLine(4, 2, 0, 0, { width: 5, height: 3 })), [[4, 2], [3, 1], [2, 1], [1, 0], [0, 0]]);
});

test("line clipping keeps only in-canvas pixels without duplicate coordinates", () => {
  assert.deepEqual(coords(Primitives.rasterizeLine(-2, 1, 4, 1, { width: 3, height: 3 })), [[0, 1], [1, 1], [2, 1]]);
  assert.deepEqual(coords(Primitives.rasterizeLine(1, -2, 1, 3, { width: 3, height: 3 })), [[1, 0], [1, 1], [1, 2]]);
  assert.deepEqual(coords(Primitives.rasterizeLine(-4, -4, -1, -1, { width: 3, height: 3 })), []);
});

test("line rejects non-integer, out-of-policy and overlong endpoints", () => {
  assert.throws(() => Primitives.rasterizeLine(0.5, 0, 2, 2, { width: 3, height: 3 }), /safe integer/);
  assert.throws(() => Primitives.rasterizeLine(0, 0, 9000, 0, { width: 3, height: 3 }), /-8192 to 8192/);
  assert.throws(() => Primitives.rasterizeLine(-8192, 0, 8192, 0, { width: 3, height: 3 }), /step limit/);
  assert.throws(() => Primitives.rasterizeLine(0, 0, 1, 1, { width: 0, height: 3 }), /canvas width/);
});

test("rectangle outline includes all four edges and uses row-major order", () => {
  assert.deepEqual(
    coords(Primitives.rasterizeRectangle(1, 1, 3, 3, { width: 5, height: 5 })),
    [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [1, 3], [2, 3], [3, 3]]
  );
});

test("filled rectangle includes every pixel in its inclusive-origin extent", () => {
  assert.deepEqual(
    coords(Primitives.rasterizeRectangle(1, 1, 2, 3, { width: 5, height: 5, filled: true })),
    [[1, 1], [2, 1], [1, 2], [2, 2], [1, 3], [2, 3]]
  );
});

test("rectangle clipping handles negative origins and canvas overflow", () => {
  assert.deepEqual(
    coords(Primitives.rasterizeRectangle(-1, 2, 4, 3, { width: 3, height: 4, filled: true })),
    [[0, 2], [1, 2], [2, 2], [0, 3], [1, 3], [2, 3]]
  );
  assert.deepEqual(coords(Primitives.rasterizeRectangle(4, 4, 3, 3, { width: 5, height: 5 })), [[4, 4]]);
});

test("one-pixel and one-row rectangles contain unique pixels", () => {
  assert.deepEqual(coords(Primitives.rasterizeRectangle(2, 1, 1, 3, { width: 5, height: 5 })), [[2, 1], [2, 2], [2, 3]]);
  assert.deepEqual(coords(Primitives.rasterizeRectangle(1, 2, 4, 1, { width: 5, height: 5 })), [[1, 2], [2, 2], [3, 2], [4, 2]]);
});

test("rectangle rejects invalid extents, coordinates and filled values", () => {
  assert.throws(() => Primitives.rasterizeRectangle(0, 0, 0, 2, { width: 3, height: 3 }), /shape width/);
  assert.throws(() => Primitives.rasterizeRectangle(0, 0, 2, 2, { width: 3, height: 3, filled: 1 }), /filled/);
  assert.throws(() => Primitives.rasterizeRectangle(8192, 0, 2, 1, { width: 3, height: 3 }), /right edge/);
});

test("ellipse outline matches a deterministic 5-by-5 integer mask", () => {
  assert.deepEqual(
    coords(Primitives.rasterizeEllipse(0, 0, 5, 5, { width: 5, height: 5 })),
    [[1, 0], [2, 0], [3, 0], [0, 1], [4, 1], [0, 2], [4, 2], [0, 3], [4, 3], [1, 4], [2, 4], [3, 4]]
  );
});

test("filled ellipse uses pixel-center inclusion and preserves row-major order", () => {
  assert.deepEqual(
    coords(Primitives.rasterizeEllipse(0, 0, 5, 5, { width: 5, height: 5, filled: true })),
    [
      [1, 0], [2, 0], [3, 0],
      [0, 1], [1, 1], [2, 1], [3, 1], [4, 1],
      [0, 2], [1, 2], [2, 2], [3, 2], [4, 2],
      [0, 3], [1, 3], [2, 3], [3, 3], [4, 3],
      [1, 4], [2, 4], [3, 4]
    ]
  );
});

test("ellipse handles one-pixel and narrow degenerate bounds", () => {
  assert.deepEqual(coords(Primitives.rasterizeEllipse(2, 1, 1, 3, { width: 5, height: 5, filled: true })), [[2, 1], [2, 2], [2, 3]]);
  assert.deepEqual(coords(Primitives.rasterizeEllipse(1, 2, 3, 1, { width: 5, height: 5 })), [[1, 2], [2, 2], [3, 2]]);
});

test("ellipse clipping bounds outputs while preserving shape coordinates", () => {
  assert.deepEqual(
    coords(Primitives.rasterizeEllipse(-2, -2, 5, 5, { width: 3, height: 3, filled: true })),
    [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2]]
  );
});

test("circle is the equal-diameter ellipse primitive in both outline and filled modes", () => {
  assert.deepEqual(
    Primitives.rasterizeCircle(2, 1, 5, { width: 8, height: 7 }),
    Primitives.rasterizeEllipse(2, 1, 5, 5, { width: 8, height: 7 })
  );
  assert.deepEqual(
    Primitives.rasterizeCircle(2, 1, 5, { width: 8, height: 7, filled: true }),
    Primitives.rasterizeEllipse(2, 1, 5, 5, { width: 8, height: 7, filled: true })
  );
});

test("ellipse rejects invalid extents and fill modes", () => {
  assert.throws(() => Primitives.rasterizeEllipse(0, 0, 513, 2, { width: 3, height: 3 }), /shape width/);
  assert.throws(() => Primitives.rasterizeEllipse(0, 0, 2, 2, { width: 3, height: 3, filled: "yes" }), /filled/);
});

test("polygon fills an axis-aligned square using left-inclusive right-exclusive pixel centers", () => {
  const polygon = [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 4 }, { x: 1, y: 4 }];
  assert.deepEqual(
    coords(Primitives.rasterizePolygon(polygon, { width: 6, height: 6 })),
    [[1, 1], [2, 1], [3, 1], [1, 2], [2, 2], [3, 2], [1, 3], [2, 3], [3, 3]]
  );
});

test("polygon applies even-odd scanline filling to a triangle", () => {
  const triangle = [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 5 }];
  assert.deepEqual(
    coords(Primitives.rasterizePolygon(triangle, { width: 7, height: 7 })),
    [[1, 1], [2, 1], [3, 1], [4, 1], [2, 2], [3, 2], [2, 3], [3, 3]]
  );
});

test("polygon output is invariant to winding direction and fills self-intersections by even-odd rule", () => {
  const square = [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 5 }, { x: 1, y: 5 }];
  const forward = Primitives.rasterizePolygon(square, { width: 7, height: 7 });
  const reverse = Primitives.rasterizePolygon(square.slice().reverse(), { width: 7, height: 7 });
  assert.deepEqual(reverse, forward);

  const bowTie = [{ x: 1, y: 1 }, { x: 5, y: 5 }, { x: 1, y: 5 }, { x: 5, y: 1 }];
  const filled = Primitives.rasterizePolygon(bowTie, { width: 7, height: 7 });
  assert.ok(filled.length > 0);
  assert.equal(new Set(filled.map(p => p.x + "," + p.y)).size, filled.length);
});

test("polygon supports concave shapes with deterministic row-major output", () => {
  const concave = [
    { x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 2 },
    { x: 3, y: 2 }, { x: 3, y: 5 }, { x: 1, y: 5 }
  ];
  assert.deepEqual(coords(Primitives.rasterizePolygon(concave, { width: 7, height: 7 })), [
    [1, 1], [2, 1], [3, 1], [4, 1],
    [1, 2], [2, 2],
    [1, 3], [2, 3],
    [1, 4], [2, 4]
  ]);
});

test("polygon clips negative and overflowing vertices to the canvas", () => {
  const polygon = [{ x: -2, y: -2 }, { x: 3, y: -2 }, { x: 3, y: 3 }, { x: -2, y: 3 }];
  assert.deepEqual(coords(Primitives.rasterizePolygon(polygon, { width: 3, height: 3 })), [
    [0, 0], [1, 0], [2, 0],
    [0, 1], [1, 1], [2, 1],
    [0, 2], [1, 2], [2, 2]
  ]);
});

test("polygon removes duplicate adjacent and closing vertices without duplicate pixels", () => {
  const polygon = [
    { x: 1, y: 1 }, { x: 4, y: 1 }, { x: 4, y: 1 },
    { x: 4, y: 4 }, { x: 1, y: 4 }, { x: 1, y: 1 }
  ];
  const result = Primitives.rasterizePolygon(polygon, { width: 6, height: 6 });
  assert.equal(result.length, 9);
  assert.equal(new Set(result.map(p => p.x + "," + p.y)).size, result.length);
});

test("polygon rejects sparse, malformed, short and overlong point lists", () => {
  const sparse = new Array(3);
  assert.throws(() => Primitives.rasterizePolygon(sparse, { width: 5, height: 5 }), /vertex 0/);
  assert.throws(() => Primitives.rasterizePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }], { width: 5, height: 5 }), /between 3/);
  assert.throws(() => Primitives.rasterizePolygon([{ x: 0, y: 0 }, null, { x: 1, y: 1 }], { width: 5, height: 5 }), /point object/);
  assert.throws(() => Primitives.rasterizePolygon([{ x: 0, y: 0 }, { x: 1.5, y: 1 }, { x: 1, y: 2 }], { width: 5, height: 5 }), /safe integer/);
  assert.throws(() => Primitives.rasterizePolygon([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }], { width: 5, height: 5 }), /three distinct/);
  assert.throws(() => Primitives.rasterizePolygon(Array(Primitives.MAX_POLYGON_VERTICES + 1).fill({ x: 0, y: 0 }), { width: 5, height: 5 }), /between 3/);
});

test("all primitive outputs are unique, clipped and row-major where specified", () => {
  const line = Primitives.rasterizeLine(-2, 0, 5, 3, { width: 4, height: 4 });
  const rectangle = Primitives.rasterizeRectangle(-2, -1, 8, 7, { width: 4, height: 4, filled: true });
  const ellipse = Primitives.rasterizeEllipse(-2, -1, 8, 7, { width: 4, height: 4, filled: true });
  const polygon = Primitives.rasterizePolygon([{ x: -2, y: -1 }, { x: 5, y: -1 }, { x: 5, y: 5 }, { x: -2, y: 5 }], { width: 4, height: 4 });
  for (const points of [line, rectangle, ellipse, polygon]) {
    const keys = points.map(p => p.x + "," + p.y);
    assert.equal(new Set(keys).size, keys.length);
    assert.ok(points.every(p => p.x >= 0 && p.y >= 0 && p.x < 4 && p.y < 4));
  }
  for (const points of [rectangle, ellipse, polygon]) {
    assert.deepEqual(points, points.slice().sort((a, b) => a.y - b.y || a.x - b.x));
  }
});

test("raster primitives never mutate caller-owned point arrays", () => {
  const polygon = [{ x: 1, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 4 }];
  const original = structuredClone(polygon);
  const line = { x0: 0, y0: 0, x1: 2, y1: 2 };
  const originalLine = structuredClone(line);
  Primitives.rasterizePolygon(polygon, { width: 6, height: 6 });
  Primitives.rasterizeLine(line.x0, line.y0, line.x1, line.y1, { width: 6, height: 6 });
  assert.deepEqual(polygon, original);
  assert.deepEqual(line, originalLine);
});

test("maximum canvas dimensions remain bounded for filled raster operations", () => {
  assert.equal(Primitives.rasterizeRectangle(0, 0, 512, 512, { width: 512, height: 512, filled: true }).length, Primitives.MAX_PIXELS);
  assert.ok(Primitives.rasterizeEllipse(0, 0, 512, 512, { width: 512, height: 512, filled: true }).length <= Primitives.MAX_PIXELS);
  assert.equal(Primitives.rasterizePolygon([{ x: 0, y: 0 }, { x: 512, y: 0 }, { x: 512, y: 512 }, { x: 0, y: 512 }], { width: 512, height: 512 }).length, Primitives.MAX_PIXELS);
});
