/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CanvasPixelRenderer, parseColor } = require("../js/canvas-renderer.js");

class FakeContext {
  constructor() { this.calls = []; this.imageSmoothingEnabled = true; this.strokeCount = 0; this.strokeRectCount = 0; }
  createImageData(width, height) { return { width, height, data: new Uint8ClampedArray(width * height * 4) }; }
  putImageData(...args) { this.calls.push(["putImageData", ...args]); }
  clearRect(...args) { this.calls.push(["clearRect", ...args]); }
  drawImage(...args) { this.calls.push(["drawImage", ...args]); }
  save() { this.calls.push(["save"]); }
  restore() { this.calls.push(["restore"]); }
  setTransform(...args) { this.calls.push(["setTransform", ...args]); }
  beginPath() { this.calls.push(["beginPath"]); }
  moveTo(...args) { this.calls.push(["moveTo", ...args]); }
  lineTo(...args) { this.calls.push(["lineTo", ...args]); }
  stroke() { this.strokeCount++; this.calls.push(["stroke"]); }
  strokeRect(...args) { this.strokeRectCount++; this.calls.push(["strokeRect", ...args]); }
  setLineDash(...args) { this.calls.push(["setLineDash", ...args]); }
}

class FakeCanvas {
  constructor(width, height, bounds) {
    this._width = width || 300;
    this._height = height || 150;
    this.widthSets = 0;
    this.heightSets = 0;
    this.clientWidth = bounds ? bounds.width : 100;
    this.clientHeight = bounds ? bounds.height : 100;
    this.style = {};
    this.bounds = bounds || { left: 10, top: 20, width: 100, height: 100 };
    this.context = new FakeContext();
  }
  get width() { return this._width; }
  set width(value) { this.widthSets++; this._width = value; }
  get height() { return this._height; }
  set height(value) { this.heightSets++; this._height = value; }
  getContext(type) { return type === "2d" ? this.context : null; }
  getBoundingClientRect() { return this.bounds; }
}

function createRenderer(bounds, ratio) {
  const canvas = new FakeCanvas(300, 150, bounds);
  const surfaces = [];
  const renderer = new CanvasPixelRenderer(canvas, {
    devicePixelRatio: ratio || 1,
    createSurface() {
      const surface = new FakeCanvas(1, 1, { left: 0, top: 0, width: 1, height: 1 });
      surfaces.push(surface);
      return surface;
    }
  });
  return { canvas, renderer, surfaces };
}

test("parses supported project colors and transparent pixels", () => {
  assert.deepEqual(parseColor("#123456"), [18, 52, 86, 255]);
  assert.deepEqual(parseColor(null), [0, 0, 0, 0]);
  assert.deepEqual(parseColor("transparent"), [0, 0, 0, 0]);
  assert.throws(() => parseColor("red"), /#RRGGBB/);
  assert.throws(() => parseColor(123), /strings or null/);
});

test("renders one composited pixel per source cell without smoothing", () => {
  const { canvas, renderer, surfaces } = createRenderer({ left: 0, top: 0, width: 80, height: 40 }, 2);
  const stats = renderer.render({ width: 2, height: 1, pixels: ["#ff0000", null], grid: false });
  assert.equal(stats.pixelCount, 2);
  assert.equal(stats.lastRenderMode, "full");
  assert.equal(canvas.width, 160);
  assert.equal(canvas.height, 80);
  assert.equal(canvas.style.imageRendering, "pixelated");
  assert.equal(canvas.context.imageSmoothingEnabled, false);
  assert.deepEqual(Array.from(renderer.imageData.data), [255, 0, 0, 255, 0, 0, 0, 0]);
  assert.equal(surfaces.length, 2);
});

test("renders onion-skin tints only over transparent current pixels", () => {
  const { renderer } = createRenderer();
  renderer.render({
    width: 3, height: 1, pixels: [null, "#112233", null],
    onionBefore: ["#aa0000", "#00aa00", null],
    onionAfter: [null, "#0000aa", "#0000aa"], grid: false
  });
  const data = renderer.imageData.data;
  assert.deepEqual(Array.from(data.slice(0, 4)), [232, 95, 100, 89]);
  assert.deepEqual(Array.from(data.slice(4, 8)), [17, 34, 51, 255]);
  assert.deepEqual(Array.from(data.slice(8, 12)), [76, 144, 210, 89]);
});

test("dirty-region updates only requested pixels and blit region", () => {
  const { renderer, surfaces } = createRenderer({ left: 0, top: 0, width: 100, height: 100 }, 1);
  const pixels = Array(16).fill(null);
  const state = { width: 4, height: 4, pixels, grid: false };
  renderer.render(state);
  pixels[9] = "#abcdef";
  const stats = renderer.render(state, { x: 1, y: 2, width: 1, height: 1 });
  assert.equal(stats.lastRenderMode, "dirty");
  assert.deepEqual(stats.lastDirtyRect, { x: 1, y: 2, width: 1, height: 1 });
  const writes = surfaces[0].context.calls.filter(call => call[0] === "putImageData");
  assert.deepEqual(writes.at(-1).slice(2), [0, 0, 1, 2, 1, 1]);
  assert.deepEqual(Array.from(renderer.imageData.data.slice(36, 40)), [171, 205, 239, 255]);
  const blits = renderer.context.calls.filter(call => call[0] === "drawImage");
  assert.equal(blits.length, 4);
});

test("dirty rendering does not reset the visible canvas backing store", () => {
  const { canvas, renderer } = createRenderer({ left: 0, top: 0, width: 100, height: 100 }, 1);
  const state = { width: 4, height: 4, pixels: Array(16).fill(null), grid: false };
  renderer.render(state);
  const widthSets = canvas.widthSets;
  const heightSets = canvas.heightSets;
  state.pixels[0] = "#ff0000";
  renderer.render(state, { x: 0, y: 0, width: 1, height: 1 });
  assert.equal(canvas.widthSets, widthSets);
  assert.equal(canvas.heightSets, heightSets);
});

test("canvas resizing forces a full redraw even when a dirty rectangle is supplied", () => {
  const { renderer } = createRenderer({ left: 0, top: 0, width: 100, height: 100 }, 1);
  renderer.render({ width: 2, height: 2, pixels: Array(4).fill(null), grid: false });
  const result = renderer.render({ width: 3, height: 2, pixels: Array(6).fill(null), grid: false },
    { x: 1, y: 1, width: 1, height: 1 });
  assert.equal(result.lastRenderMode, "full");
  assert.deepEqual(result.lastDirtyRect, { x: 0, y: 0, width: 3, height: 2 });
});

test("grid and selection render on a display-resolution overlay surface", () => {
  const { renderer, surfaces } = createRenderer({ left: 0, top: 0, width: 90, height: 60 }, 1);
  renderer.render({
    width: 3, height: 2, pixels: Array(6).fill(null), grid: true,
    selection: { x: 1, y: 0, width: 2, height: 2 }
  });
  assert.equal(surfaces[1].width, 90);
  assert.equal(surfaces[1].height, 60);
  assert.equal(surfaces[1].context.strokeCount, 1);
  assert.equal(surfaces[1].context.strokeRectCount, 1);
  assert.ok(surfaces[1].context.calls.some(call => call[0] === "clearRect"));
});

test("maps pointer coordinates to pixel positions and excludes outside edges", () => {
  const { renderer } = createRenderer({ left: 10, top: 20, width: 200, height: 100 }, 1);
  renderer.render({ width: 4, height: 2, pixels: Array(8).fill(null), grid: false });
  assert.deepEqual(renderer.mapClientToPixel(10, 20), { x: 0, y: 0, i: 0 });
  assert.deepEqual(renderer.mapClientToPixel(209.9, 119.9), { x: 3, y: 1, i: 7 });
  assert.equal(renderer.mapClientToPixel(210, 120), null);
  assert.equal(renderer.mapClientToPixel(9.99, 20), null);
});

test("supports the editor's maximum 512 by 512 raster", () => {
  const { renderer } = createRenderer({ left: 0, top: 0, width: 512, height: 512 }, 1);
  const pixels = Array(512 * 512).fill(null);
  pixels[0] = "#010203";
  pixels[pixels.length - 1] = "#aabbcc";
  const stats = renderer.render({ width: 512, height: 512, pixels, grid: false });
  assert.equal(stats.pixelCount, 262144);
  assert.equal(renderer.imageData.data.length, 262144 * 4);
  assert.deepEqual(Array.from(renderer.imageData.data.slice(0, 4)), [1, 2, 3, 255]);
  assert.deepEqual(Array.from(renderer.imageData.data.slice(-4)), [170, 187, 204, 255]);
});

test("rejects malformed buffers, dimensions, colors and selection rectangles", () => {
  const { renderer } = createRenderer();
  assert.throws(() => renderer.render({ width: 0, height: 1, pixels: [] }), /positive integers/);
  assert.throws(() => renderer.render({ width: 2, height: 2, pixels: [null] }), /length/);
  assert.throws(() => renderer.render({ width: 1, height: 1, pixels: ["#12345678"] }), /#RRGGBB/);
  assert.throws(() => renderer.render({
    width: 2, height: 2, pixels: Array(4).fill(null), selection: { x: 0, y: 0, width: 0, height: 1 }
  }), /selection/i);
  assert.throws(() => renderer.render({
    width: 2, height: 2, pixels: Array(4).fill(null), selection: { x: 1, y: 1, width: 2, height: 1 }
  }), /inside the canvas/i);
});

test("destroy releases backing buffers and prevents subsequent renders", () => {
  const { renderer, surfaces } = createRenderer();
  renderer.render({ width: 1, height: 1, pixels: ["#123456"], grid: false });
  renderer.destroy();
  assert.equal(surfaces[0].width, 1);
  assert.equal(surfaces[0].height, 1);
  assert.throws(() => renderer.render({ width: 1, height: 1, pixels: [null] }), /destroyed/);
});
