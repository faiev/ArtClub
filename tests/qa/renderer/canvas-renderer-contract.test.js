"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CanvasPixelRenderer,
  parseColor
} = require("../../../js/canvas-renderer.js");

class Context {
  constructor() {
    this.imageSmoothingEnabled = true;
    this.calls = [];
  }
  createImageData(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }
  putImageData(...args) { this.calls.push(["putImageData", ...args]); }
  clearRect(...args) { this.calls.push(["clearRect", ...args]); }
  drawImage(...args) { this.calls.push(["drawImage", ...args]); }
  save() {}
  restore() {}
  setTransform() {}
  beginPath() {}
  moveTo() {}
  lineTo() {}
  stroke() {}
  strokeRect() {}
  setLineDash() {}
}

function fakeCanvas(bounds) {
  const context = new Context();
  return {
    _width: 300,
    _height: 150,
    widthSets: 0,
    heightSets: 0,
    clientWidth: bounds.width,
    clientHeight: bounds.height,
    style: {},
    get width() { return this._width; },
    set width(value) { this.widthSets += 1; this._width = value; },
    get height() { return this._height; },
    set height(value) { this.heightSets += 1; this._height = value; },
    getContext(type) { return type === "2d" ? context : null; },
    getBoundingClientRect() { return bounds; },
    context
  };
}

function createRenderer(bounds = { left: 10, top: 20, width: 100, height: 80 }) {
  const canvas = fakeCanvas(bounds);
  const surfaces = [];
  const renderer = new CanvasPixelRenderer(canvas, {
    devicePixelRatio: 1,
    createSurface() {
      const surface = fakeCanvas({ left: 0, top: 0, width: 1, height: 1 });
      surfaces.push(surface);
      return surface;
    }
  });
  return { renderer, canvas, surfaces };
}

test("frame identity and composite revision reject invalid token types before resizing", () => {
  const { renderer, canvas, surfaces } = createRenderer();
  const base = { width: 2, height: 1, pixels: [null, null], grid: false };

  for (const frameId of [null, 1, {}, true]) {
    assert.throws(
      () => renderer.render({ ...base, frameId }),
      /frameId must be a string/
    );
  }

  for (const compositeRevision of [null, true, {}, []]) {
    assert.throws(
      () => renderer.render({ ...base, compositeRevision }),
      /compositeRevision must be a string or number/
    );
  }

  assert.equal(renderer.renderCount, 0);
  assert.equal(renderer.width, 0);
  assert.equal(renderer.height, 0);
  assert.equal(canvas.widthSets, 0);
  assert.equal(canvas.heightSets, 0);
  assert.equal(surfaces[0].width, 1);
  assert.equal(surfaces[1].width, 1);
  assert.equal(canvas.context.calls.length, 0);
});

test("pointer hit testing rejects malformed client bounds without returning a pixel", () => {
  const { renderer } = createRenderer();
  renderer.render({ width: 3, height: 2, pixels: Array(6).fill(null), grid: false });

  const invalidBounds = [
    { left: NaN, top: 0, width: 10, height: 10 },
    { left: 0, top: Infinity, width: 10, height: 10 },
    { left: 0, top: 0, width: 0, height: 10 },
    { left: 0, top: 0, width: -1, height: 10 },
    { left: 0, top: 0, width: 10, height: 0 },
    { left: 0, top: 0, width: 10, height: Infinity },
    { left: 0, top: 0, width: "10", height: 10 },
    { left: 0, top: 0, height: 10 }
  ];

  for (const bounds of invalidBounds) {
    assert.equal(renderer.mapClientToPixel(1, 1, bounds), null);
  }
});

test("parseColor does not expose mutable shared cache entries", {
  todo: "Known QA finding: rgba() returns its cached array; consumer mutation corrupts later renders."
}, () => {
  const color = "#a1b2c3";
  const parsed = parseColor(color);
  parsed[0] = 0;
  assert.deepEqual(parseColor(color), [161, 178, 195, 255]);

  const { renderer } = createRenderer();
  renderer.render({ width: 1, height: 1, pixels: [color], grid: false });
  assert.deepEqual(Array.from(renderer.imageData.data), [161, 178, 195, 255]);
});
