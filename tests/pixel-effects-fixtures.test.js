"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const corpusPath = path.join(__dirname, "fixtures", "pixel-effects", "golden-corpus.json");
const corpus = JSON.parse(fs.readFileSync(corpusPath, "utf8"));
const HEX = /^#[0-9A-Fa-f]{6}$/;

function isPixel(value) {
  return value === null || (typeof value === "string" && HEX.test(value));
}

function key(point) {
  return point[0] + "," + point[1];
}

function rotate90Reference(source, width, height) {
  const output = Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetX = height - 1 - y;
      const targetY = x;
      output[targetY * height + targetX] = source[y * width + x];
    }
  }
  return output;
}

function flipHorizontalReference(source, width, height) {
  const output = Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      output[y * width + (width - 1 - x)] = source[y * width + x];
    }
  }
  return output;
}

function flipVerticalReference(source, width, height) {
  const output = Array(source.length);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      output[(height - 1 - y) * width + x] = source[y * width + x];
    }
  }
  return output;
}

test("golden corpus metadata and fixture IDs are versioned and unique", () => {
  assert.equal(corpus.schemaVersion, 1);
  assert.equal(corpus.pixelFormat, "#RRGGBB strings or null; row-major dense buffers");
  assert.ok(Array.isArray(corpus.fixtures));
  assert.equal(corpus.fixtures.length, 6);
  const ids = corpus.fixtures.map(fixture => fixture.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("every static source buffer is dense row-major data with exact dimensions", () => {
  for (const fixture of corpus.fixtures) {
    assert.ok(Number.isInteger(fixture.width) && fixture.width >= 1 && fixture.width <= 512, fixture.id);
    assert.ok(Number.isInteger(fixture.height) && fixture.height >= 1 && fixture.height <= 512, fixture.id);
    if (!fixture.generator) {
      assert.equal(fixture.source.length, fixture.width * fixture.height, fixture.id);
      assert.ok(fixture.source.every(isPixel), fixture.id);
    }
  }
});

test("every expected golden buffer has the matching output size and valid pixel values", () => {
  for (const fixture of corpus.fixtures) {
    for (const [operation, expected] of Object.entries(fixture.expectedBuffers || {})) {
      assert.equal(expected.length, fixture.width * fixture.height, fixture.id + ":" + operation);
      assert.ok(expected.every(isPixel), fixture.id + ":" + operation);
    }
  }
});

test("expected region coordinates are unique integer points inside the fixture canvas", () => {
  for (const fixture of corpus.fixtures) {
    for (const [operation, points] of Object.entries(fixture.expectedPoints || {})) {
      const keys = points.map(key);
      assert.equal(new Set(keys).size, keys.length, fixture.id + ":" + operation);
      for (const point of points) {
        assert.ok(Array.isArray(point) && point.length === 2, fixture.id + ":" + operation);
        assert.ok(Number.isInteger(point[0]) && Number.isInteger(point[1]), fixture.id + ":" + operation);
        assert.ok(point[0] >= 0 && point[0] < fixture.width, fixture.id + ":" + operation);
        assert.ok(point[1] >= 0 && point[1] < fixture.height, fixture.id + ":" + operation);
      }
    }
  }
});

test("checkerboard transform expectations match independent integer reference transforms", () => {
  const fixture = corpus.fixtures.find(item => item.id === "checkerboard-4x4");
  assert.deepEqual(fixture.expectedBuffers.flipHorizontal, flipHorizontalReference(fixture.source, fixture.width, fixture.height));
  assert.deepEqual(fixture.expectedBuffers.flipVertical, flipVerticalReference(fixture.source, fixture.width, fixture.height));
  assert.deepEqual(fixture.expectedBuffers.rotate90, rotate90Reference(fixture.source, fixture.width, fixture.height));
});

test("symmetric sprite fixture is invariant under horizontal flip and quarter-turn rotation", () => {
  const fixture = corpus.fixtures.find(item => item.id === "symmetric-sprite-5x5");
  assert.deepEqual(fixture.expectedBuffers.flipHorizontal, flipHorizontalReference(fixture.source, fixture.width, fixture.height));
  assert.deepEqual(fixture.expectedBuffers.rotate90, rotate90Reference(fixture.source, fixture.width, fixture.height));
  assert.deepEqual(fixture.expectedBuffers.flipHorizontal, fixture.source);
  assert.deepEqual(fixture.expectedBuffers.rotate90, fixture.source);
});

test("diagonal line region fixture contains exact four/eight connectivity expectations", () => {
  const fixture = corpus.fixtures.find(item => item.id === "diagonal-line-5x5");
  assert.deepEqual(fixture.expectedPoints.select4FromOrigin, [[0, 0]]);
  assert.deepEqual(fixture.expectedPoints.select8FromOrigin, [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4]]);
  assert.deepEqual(fixture.expectedPoints.border8FromOrigin, fixture.expectedPoints.select8FromOrigin);
  assert.deepEqual(fixture.expectedBuffers.flood8ToBlack.map((pixel, i) => pixel === "#000000" ? i : -1).filter(i => i >= 0), [0, 6, 12, 18, 24]);
});

test("transparent-hole region fixture keeps the center hole separate", () => {
  const fixture = corpus.fixtures.find(item => item.id === "transparent-hole-5x5");
  assert.equal(fixture.source[2 * fixture.width + 2], null);
  assert.equal(fixture.expectedBuffers.fillBlue4[2 * fixture.width + 2], null);
  assert.equal(fixture.expectedPoints.select4FromOneOne.length, 8);
  assert.deepEqual(fixture.expectedPoints.border4FromOneOne, fixture.expectedPoints.select4FromOneOne);
});

test("gradient ramp fixture retains deterministic posterize and ramp expected endpoints", () => {
  const fixture = corpus.fixtures.find(item => item.id === "gradient-ramp-4x1");
  assert.deepEqual(fixture.expectedBuffers.posterize2, ["#000000", "#000000", "#FFFFFF", "#FFFFFF"]);
  assert.deepEqual(fixture.expectedBuffers.rec601Ramp3, ["#000000", "#808080", "#808080", "#FFFFFF"]);
});

test("generated maximum-dimension checkerboard has bounded pixel and exact color counts", () => {
  const fixture = corpus.fixtures.find(item => item.id === "stress-512-checkerboard");
  assert.equal(fixture.width * fixture.height, 262144);
  assert.equal(fixture.expectedPixelCount, 262144);
  let colorA = 0;
  let colorB = 0;
  for (let y = 0; y < fixture.height; y += 1) {
    for (let x = 0; x < fixture.width; x += 1) {
      if ((x + y) % 2 === 0) colorA += 1;
      else colorB += 1;
    }
  }
  assert.deepEqual({ "#000000": colorA, "#FFFFFF": colorB }, fixture.expectedCounts);
});
