/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const TileTransform = require("../js/tile-transform.js");

const A = "#aa0000";
const B = "#00aa00";
const C = "#0000aa";
const D = "#aaaa00";
const E = "#aa00aa";
const F = "#00aaaa";
const RECT = [A, B, C, D, E, F];

function pixels(result) {
  return result.pixels;
}

test("rotates a rectangular tile clockwise and swaps dimensions on odd quarter turns", () => {
  const rotated = TileTransform.rotateTile(RECT, 3, 2, 1);

  assert.equal(rotated.width, 2);
  assert.equal(rotated.height, 3);
  assert.equal(rotated.quarterTurns, 1);
  assert.deepEqual(pixels(rotated), [D, A, E, B, F, C]);
});

test("rotates by zero, two and three quarter turns with exact row-major output", () => {
  assert.deepEqual(TileTransform.rotateTile(RECT, 3, 2, 0), {
    width: 3, height: 2, pixels: RECT, quarterTurns: 0
  });
  assert.deepEqual(pixels(TileTransform.rotateTile(RECT, 3, 2, 2)), [F, E, D, C, B, A]);

  const counterClockwise = TileTransform.rotateTile(RECT, 3, 2, 3);
  assert.equal(counterClockwise.width, 2);
  assert.equal(counterClockwise.height, 3);
  assert.deepEqual(pixels(counterClockwise), [C, F, B, E, A, D]);
});

test("normalizes negative and greater-than-three rotation counts", () => {
  assert.deepEqual(
    TileTransform.rotateTile(RECT, 3, 2, -1),
    TileTransform.rotateTile(RECT, 3, 2, 3)
  );
  assert.deepEqual(
    TileTransform.rotateTile(RECT, 3, 2, 5),
    TileTransform.rotateTile(RECT, 3, 2, 1)
  );
});

test("flips horizontally, vertically and on both axes", () => {
  assert.deepEqual(pixels(TileTransform.flipTile(RECT, 3, 2, { horizontal: true })),
    [C, B, A, F, E, D]);
  assert.deepEqual(pixels(TileTransform.flipTile(RECT, 3, 2, { vertical: true })),
    [D, E, F, A, B, C]);
  assert.deepEqual(pixels(TileTransform.flipTile(RECT, 3, 2, { horizontal: true, vertical: true })),
    [F, E, D, C, B, A]);
});

test("flip defaults make a copy and preserve transparent pixels", () => {
  const source = [A, null, C, null];
  const result = TileTransform.flipTile(source, 2, 2);

  assert.deepEqual(pixels(result), source);
  assert.notEqual(result.pixels, source);
  assert.equal(result.horizontal, false);
  assert.equal(result.vertical, false);
});

test("wraps positive and negative pixel offsets on a torus", () => {
  const shifted = TileTransform.offsetTile(RECT, 3, 2, 1, 1);
  assert.deepEqual(pixels(shifted), [F, D, E, C, A, B]);
  assert.equal(shifted.offsetX, 1);
  assert.equal(shifted.offsetY, 1);

  const negative = TileTransform.offsetTile(RECT, 3, 2, -1, 0);
  assert.deepEqual(pixels(negative), [B, C, A, E, F, D]);
  assert.equal(negative.offsetX, 2);
});

test("normalizes offsets larger than the tile and treats full-period offsets as zero", () => {
  assert.deepEqual(
    TileTransform.offsetTile(RECT, 3, 2, 4, 2),
    TileTransform.offsetTile(RECT, 3, 2, 1, 0)
  );
  assert.deepEqual(pixels(TileTransform.offsetTile(RECT, 3, 2, 300, -200)),
    pixels(TileTransform.offsetTile(RECT, 3, 2, 0, 0)));
});

test("creates a deterministic repeated offset preview without changing the source", () => {
  const source = RECT.slice();
  const preview = TileTransform.createOffsetPreview(source, 3, 2, 1, 0, 2, 2);

  assert.equal(preview.width, 6);
  assert.equal(preview.height, 4);
  assert.equal(preview.columns, 2);
  assert.equal(preview.rows, 2);
  assert.equal(preview.offsetX, 1);
  assert.equal(preview.offsetY, 0);
  assert.deepEqual(pixels(preview), [
    C, A, B, C, A, B,
    F, D, E, F, D, E,
    C, A, B, C, A, B,
    F, D, E, F, D, E
  ]);
  assert.deepEqual(source, RECT);
});

test("offset previews preserve transparent values across wrap boundaries", () => {
  const preview = TileTransform.createOffsetPreview([A, null, C, D], 2, 2, 1, 1, 2, 1);
  assert.deepEqual(pixels(preview), [D, C, D, C, null, A, null, A]);
});

test("crops an exact in-bounds rectangle and reports its source coordinates", () => {
  const crop = TileTransform.cropTile(RECT, 3, 2, { x: 1, y: 0, width: 2, height: 2 });

  assert.equal(crop.width, 2);
  assert.equal(crop.height, 2);
  assert.deepEqual(pixels(crop), [B, C, E, F]);
  assert.deepEqual(crop.sourceRect, { x: 1, y: 0, width: 2, height: 2 });
});

test("pads with transparent pixels by default and reports the embedded source rectangle", () => {
  const padded = TileTransform.padTile([A, B, C, D], 2, 2, {
    top: 1, right: 1, bottom: 1, left: 2
  });

  assert.equal(padded.width, 5);
  assert.equal(padded.height, 4);
  assert.deepEqual(pixels(padded), [
    null, null, null, null, null,
    null, null, A, B, null,
    null, null, C, D, null,
    null, null, null, null, null
  ]);
  assert.deepEqual(padded.padding, { top: 1, right: 1, bottom: 1, left: 2 });
  assert.deepEqual(padded.sourceRect, { x: 2, y: 1, width: 2, height: 2 });
});

test("pads with a caller-supplied exact fill value and permits omitted sides", () => {
  const padded = TileTransform.padTile([A, B], 2, 1, { left: 1 }, "pad");
  assert.equal(padded.width, 3);
  assert.equal(padded.height, 1);
  assert.deepEqual(pixels(padded), ["pad", A, B]);
  assert.deepEqual(padded.padding, { top: 0, right: 0, bottom: 0, left: 1 });
});

test("reports exact edge and corner coordinates for a rectangular tile", () => {
  const bounds = TileTransform.getTileBoundaryCoordinates(3, 2);

  assert.deepEqual(bounds.edges.top, [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]);
  assert.deepEqual(bounds.edges.right, [{ x: 2, y: 0 }, { x: 2, y: 1 }]);
  assert.deepEqual(bounds.edges.bottom, [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }]);
  assert.deepEqual(bounds.edges.left, [{ x: 0, y: 0 }, { x: 0, y: 1 }]);
  assert.deepEqual(bounds.corners, {
    topLeft: { x: 0, y: 0 },
    topRight: { x: 2, y: 0 },
    bottomRight: { x: 2, y: 1 },
    bottomLeft: { x: 0, y: 1 }
  });
});

test("reports all four corner labels at a one-pixel tile without coordinate drift", () => {
  const bounds = TileTransform.getTileBoundaryCoordinates(1, 1);
  for (const corner of Object.values(bounds.corners)) assert.deepEqual(corner, { x: 0, y: 0 });
  assert.deepEqual(bounds.edges, {
    top: [{ x: 0, y: 0 }],
    right: [{ x: 0, y: 0 }],
    bottom: [{ x: 0, y: 0 }],
    left: [{ x: 0, y: 0 }]
  });
});

test("diagnoses diagonal corner joins across a four-tile junction", () => {
  const report = TileTransform.diagnoseCornerWraps([A, B, C, D], 2, 2);
  assert.equal(report.matches, false);
  assert.equal(report.mismatches.length, 2);
  assert.deepEqual(report.mismatches, [
    { first: "topLeft", second: "bottomRight", a: { x: 0, y: 0, color: A }, b: { x: 1, y: 1, color: D } },
    { first: "topRight", second: "bottomLeft", a: { x: 1, y: 0, color: B }, b: { x: 0, y: 1, color: C } }
  ]);
});

test("combines opposing-edge and corner-wrap diagnostics and preserves transparent corners", () => {
  const report = TileTransform.diagnoseTileWraps([null, A, null, B, C, B, null, A, null], 3, 3);
  assert.equal(report.seamless, true);
  assert.equal(report.mismatchCount, 0);
  assert.equal(report.cornerWraps.matches, true);
  assert.equal(report.cornerWraps.corners.topRight.color, null);
  assert.equal(report.cornerWraps.corners.bottomLeft.color, null);
});

test("reports the complete wrap diagnostics without changing source pixels", () => {
  const source = [A, B, C, D, E, F];
  const original = source.slice();
  const report = TileTransform.diagnoseTileWraps(source, 3, 2);
  assert.equal(report.seamless, false);
  assert.ok(report.mismatchCount > 0);
  assert.deepEqual(source, original);
});

test("accepts typed arrays and returns regular arrays", () => {
  const result = TileTransform.rotateTile(new Uint8Array([1, 2, 3, 4]), 2, 2, 1);
  assert.equal(Array.isArray(result.pixels), true);
  assert.deepEqual(result.pixels, [3, 1, 4, 2]);
});

test("every transform returns fresh data and leaves its input unchanged", () => {
  const source = [A, null, C, D, E, F];
  const original = source.slice();
  TileTransform.rotateTile(source, 3, 2, 1);
  TileTransform.flipTile(source, 3, 2, { horizontal: true, vertical: true });
  TileTransform.offsetTile(source, 3, 2, 1, 1);
  TileTransform.createOffsetPreview(source, 3, 2, -1, 4, 2, 2);
  TileTransform.cropTile(source, 3, 2, { x: 1, y: 0, width: 2, height: 2 });
  TileTransform.padTile(source, 3, 2, { top: 1, right: 1 });
  assert.deepEqual(source, original);
});

test("rejects malformed dimensions, missing pixels and invalid buffer types", () => {
  assert.throws(() => TileTransform.rotateTile([], 0, 1, 1), /Width must be/);
  assert.throws(() => TileTransform.flipTile([], 1.5, 1), /Width must be/);
  assert.throws(() => TileTransform.offsetTile([], 1, 0, 0, 0), /Height must be/);
  assert.throws(() => TileTransform.rotateTile("pixels", 1, 1, 1), /Array or typed array/);
  assert.throws(() => TileTransform.rotateTile([A], 2, 1, 1), /exactly width × height/);
  assert.throws(() => TileTransform.rotateTile([undefined], 1, 1, 1), /use null for transparency/);
  assert.throws(() => TileTransform.rotateTile(new DataView(new ArrayBuffer(1)), 1, 1, 1), /Array or typed array/);
});

test("rejects invalid rotations, flip options and non-integer offsets", () => {
  assert.throws(() => TileTransform.rotateTile(RECT, 3, 2, 1.5), /safe integer/);
  assert.throws(() => TileTransform.flipTile(RECT, 3, 2, null), /options must be an object/);
  assert.throws(() => TileTransform.flipTile(RECT, 3, 2, { horizontal: 1 }), /must be boolean/);
  assert.throws(() => TileTransform.offsetTile(RECT, 3, 2, 0.5, 0), /Offset X must be a safe integer/);
  assert.throws(() => TileTransform.offsetTile(RECT, 3, 2, 0, NaN), /Offset Y must be a safe integer/);
});

test("rejects malformed crops rather than silently clipping them", () => {
  assert.throws(() => TileTransform.cropTile(RECT, 3, 2, null), /rectangle must be an object/);
  assert.throws(() => TileTransform.cropTile(RECT, 3, 2, { x: -1, y: 0, width: 1, height: 1 }), /non-negative integers/);
  assert.throws(() => TileTransform.cropTile(RECT, 3, 2, { x: 0, y: 0, width: 0, height: 1 }), /positive integers/);
  assert.throws(() => TileTransform.cropTile(RECT, 3, 2, { x: 2, y: 0, width: 2, height: 1 }), /fit entirely inside/);
  assert.throws(() => TileTransform.cropTile(RECT, 3, 2, { x: 0, y: 1, width: 1, height: 2 }), /fit entirely inside/);
});

test("rejects malformed padding and output dimensions above the allocation guardrails", () => {
  assert.throws(() => TileTransform.padTile(RECT, 3, 2, null), /Padding must be an object/);
  assert.throws(() => TileTransform.padTile(RECT, 3, 2, { left: -1 }), /Left padding must be/);
  assert.throws(() => TileTransform.padTile(RECT, 3, 2, { top: 0.5 }), /Top padding must be/);
  assert.throws(() => TileTransform.padTile([A], 1, 1, { right: 4096 }), /dimensions exceed/);
  assert.throws(() => TileTransform.padTile(new Array(2048 * 2048).fill(null), 2048, 2048, { left: 1 }), /safe output pixel limit/);
});

test("rejects invalid repeat counts and excessive offset-preview allocations", () => {
  assert.throws(() => TileTransform.createOffsetPreview(RECT, 3, 2, 0, 0, 0, 1), /Columns must be/);
  assert.throws(() => TileTransform.createOffsetPreview(RECT, 3, 2, 0, 0, 1, 257), /Rows must be/);
  assert.throws(() => TileTransform.createOffsetPreview(new Array(512 * 512).fill(null), 512, 512, 0, 0, 5, 5), /safe output pixel limit/);
});
