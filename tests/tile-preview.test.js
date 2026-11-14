/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const TilePreview = require("../js/tile-preview.js");

const RED = "#ff0000";
const GREEN = "#00ff00";
const BLUE = "#0000ff";

test("repeats a rectangular tile in row-major order without changing the source", () => {
  const source = [RED, GREEN, BLUE, null, RED, GREEN];
  const original = source.slice();

  const preview = TilePreview.createTiledPreview(source, 3, 2, 2, 2);

  assert.equal(preview.width, 6);
  assert.equal(preview.height, 4);
  assert.equal(preview.columns, 2);
  assert.equal(preview.rows, 2);
  assert.deepEqual(preview.pixels, [
    RED, GREEN, BLUE, RED, GREEN, BLUE,
    null, RED, GREEN, null, RED, GREEN,
    RED, GREEN, BLUE, RED, GREEN, BLUE,
    null, RED, GREEN, null, RED, GREEN
  ]);
  assert.deepEqual(source, original);
});

test("repeats a 1×1 transparent tile and preserves transparency", () => {
  const preview = TilePreview.createTiledPreview([null], 1, 1, 3, 2);

  assert.equal(preview.width, 3);
  assert.equal(preview.height, 2);
  assert.deepEqual(preview.pixels, [null, null, null, null, null, null]);
});

test("accepts typed pixel buffers and returns a regular deterministic array", () => {
  const preview = TilePreview.createTiledPreview(new Uint8Array([1, 2]), 2, 1, 2, 1);

  assert.equal(Array.isArray(preview.pixels), true);
  assert.deepEqual(preview.pixels, [1, 2, 1, 2]);
});

test("extracts opposing edge strips in top-to-bottom and left-to-right order", () => {
  const pixels = [RED, GREEN, BLUE, null, GREEN, RED];
  const edges = TilePreview.extractEdgeStrips(pixels, 3, 2);

  assert.deepEqual(edges, {
    width: 3,
    height: 2,
    left: [RED, null],
    right: [BLUE, RED],
    top: [RED, GREEN, BLUE],
    bottom: [null, GREEN, RED]
  });
});

test("reports matching edges, including matching transparent pixels", () => {
  const pixels = [RED, GREEN, RED, null, BLUE, null, GREEN, RED, GREEN, RED, GREEN, RED];
  const report = TilePreview.diagnoseSeams(pixels, 3, 4);

  assert.equal(report.seamless, true);
  assert.equal(report.mismatchCount, 0);
  assert.deepEqual(report.leftRight, { matches: true, mismatches: [] });
  assert.deepEqual(report.topBottom, { matches: true, mismatches: [] });
});

test("reports exact left/right and top/bottom mismatch coordinates and colors", () => {
  const pixels = [RED, GREEN, BLUE, null, GREEN, RED];
  const report = TilePreview.diagnoseSeams(pixels, 3, 2);

  assert.equal(report.seamless, false);
  assert.equal(report.mismatchCount, 4);
  assert.deepEqual(report.leftRight, {
    matches: false,
    mismatches: [
      { row: 0, left: { x: 0, y: 0, color: RED }, right: { x: 2, y: 0, color: BLUE } },
      { row: 1, left: { x: 0, y: 1, color: null }, right: { x: 2, y: 1, color: RED } }
    ]
  });
  assert.deepEqual(report.topBottom, {
    matches: false,
    mismatches: [
      { column: 0, top: { x: 0, y: 0, color: RED }, bottom: { x: 0, y: 1, color: null } },
      { column: 2, top: { x: 2, y: 0, color: BLUE }, bottom: { x: 2, y: 1, color: RED } }
    ]
  });
});

test("reports a one-pixel tile as seamless in both directions", () => {
  const report = TilePreview.diagnoseSeams([null], 1, 1);

  assert.equal(report.seamless, true);
  assert.equal(report.mismatchCount, 0);
});

test("rejects invalid dimensions and malformed pixel buffers", () => {
  assert.throws(() => TilePreview.createTiledPreview([], 0, 1, 1, 1), /Width must be/);
  assert.throws(() => TilePreview.createTiledPreview([], 1.5, 1, 1, 1), /Width must be/);
  assert.throws(() => TilePreview.createTiledPreview([], 1, 0, 1, 1), /Height must be/);
  assert.throws(() => TilePreview.createTiledPreview([], 4097, 1, 1, 1), /Width must be/);
  assert.throws(() => TilePreview.createTiledPreview("not pixels", 1, 1, 1, 1), /Array or typed array/);
  assert.throws(() => TilePreview.createTiledPreview([RED], 2, 1, 1, 1), /exactly width × height/);
  assert.throws(() => TilePreview.createTiledPreview([undefined], 1, 1, 1, 1), /use null for transparency/);
  assert.throws(() => TilePreview.createTiledPreview(new DataView(new ArrayBuffer(1)), 1, 1, 1, 1), /Array or typed array/);
});

test("rejects invalid repeat counts", () => {
  const tile = [RED];

  assert.throws(() => TilePreview.createTiledPreview(tile, 1, 1, 0, 1), /Columns must be/);
  assert.throws(() => TilePreview.createTiledPreview(tile, 1, 1, 1, -1), /Rows must be/);
  assert.throws(() => TilePreview.createTiledPreview(tile, 1, 1, 1.5, 1), /Columns must be/);
  assert.throws(() => TilePreview.createTiledPreview(tile, 1, 1, 257, 1), /Columns must be/);
});

test("rejects source buffers and output sizes above the safe allocation limits", () => {
  assert.throws(() => TilePreview.createTiledPreview([], 2049, 2049, 1, 1), /safe source pixel limit/);

  const tile = new Array(512 * 512).fill(null);
  assert.throws(() => TilePreview.createTiledPreview(tile, 512, 512, 5, 5), /safe output pixel limit/);
  assert.throws(() => TilePreview.createTiledPreview(new Array(17 * 17).fill(null), 17, 17, 256, 256), /safe output pixel limit/);
});

test("does not mutate the input while diagnosing seams or extracting edges", () => {
  const pixels = [RED, GREEN, BLUE, null, GREEN, RED];
  const original = pixels.slice();

  TilePreview.extractEdgeStrips(pixels, 3, 2);
  TilePreview.diagnoseSeams(pixels, 3, 2);

  assert.deepEqual(pixels, original);
});