/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { CanvasPixelRenderer, parseColor } = require("../js/canvas-renderer.js");

class FakeContext {
  constructor() {
    this.calls = [];
    this.imageSmoothingEnabled = true;
    this.strokeCount = 0;
    this.strokeRectCount = 0;
  }
  createImageData(width, height) {
    return { width, height, data: new Uint8ClampedArray(width * height * 4) };
  }
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
  let currentRatio = ratio || 1;
  const renderer = new CanvasPixelRenderer(canvas, {
    devicePixelRatio: () => currentRatio,
    createSurface() {
      const surface = new FakeCanvas(1, 1, { left: 0, top: 0, width: 1, height: 1 });
      surfaces.push(surface);
      return surface;
    }
  });
  return {
    canvas,
    renderer,
    surfaces,
    setRatio(value) { currentRatio = value; }
  };
}

test("parses supported project colors and transparent pixels", () => {
  assert.deepEqual(parseColor("#123456"), [18, 52, 86, 255]);
  assert.deepEqual(parseColor(null), [0, 0, 0, 0]);
  assert.deepEqual(parseColor("transparent"), [0, 0, 0, 0]);
  assert.throws(() => parseColor("red"), /#RRGGBB/);
  assert.throws(() => parseColor(123), /strings or null/);
});

test("renders exact source pixels with crisp nearest-neighbor scaling", () => {
  const { canvas, renderer, surfaces } = createRenderer(
    { left: 0, top: 0, width: 80, height: 40 }, 2
  );
  const stats = renderer.render({ width: 2, height: 1, pixels: ["#ff0000", null], grid: false });
  assert.equal(stats.pixelCount, 2);
  assert.equal(stats.lastRenderMode, "full");
  assert.equal(canvas.width, 160);
  assert.equal(canvas.height, 80);
  assert.equal(canvas.style.imageRendering, "pixelated");
  assert.equal(canvas.context.imageSmoothingEnabled, false);
  assert.equal(surfaces[0].context.imageSmoothingEnabled, false);
  assert.equal(surfaces[1].context.imageSmoothingEnabled, false);
  assert.deepEqual(Array.from(renderer.imageData.data), [255, 0, 0, 255, 0, 0, 0, 0]);
  const draws = canvas.context.calls.filter(call => call[0] === "drawImage");
  assert.deepEqual(draws[0].slice(2), [0, 0, 2, 1, 0, 0, 80, 40]);
  assert.deepEqual(draws[1].slice(2), [0, 0, 160, 80, 0, 0, 80, 40]);
});

test("renders previous and next onion skins over transparency only", () => {
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

test("composes overlapping onion-skin masks without changing the artwork buffer", () => {
  const { renderer } = createRenderer();
  renderer.render({
    width: 1, height: 1, pixels: [null],
    onionBefore: ["#ff0000"], onionAfter: ["#0000ff"], grid: false
  });
  assert.deepEqual(Array.from(renderer.imageData.data), [137, 125, 167, 147]);
});

test("dirty-region updates only requested pixels and blits only that crop", () => {
  const { renderer, surfaces } = createRenderer(
    { left: 0, top: 0, width: 100, height: 100 }, 1
  );
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
  assert.deepEqual(blits.at(-2).slice(2), [1, 2, 1, 1, 25, 50, 25, 25]);
});

test("dirty rectangles clip safely to raster bounds", () => {
  const { renderer, surfaces } = createRenderer(
    { left: 0, top: 0, width: 100, height: 100 }, 1
  );
  const state = { width: 4, height: 4, pixels: Array(16).fill(null), grid: false };
  renderer.render(state);
  state.pixels[0] = "#010203";
  const stats = renderer.render(state, { x: -1, y: 0, width: 2, height: 2 });
  assert.deepEqual(stats.lastDirtyRect, { x: 0, y: 0, width: 1, height: 2 });
  const writes = surfaces[0].context.calls.filter(call => call[0] === "putImageData");
  assert.deepEqual(writes.at(-1).slice(2), [0, 0, 0, 0, 1, 2]);
  assert.deepEqual(Array.from(renderer.imageData.data.slice(0, 4)), [1, 2, 3, 255]);
  assert.equal(renderer.render(state, { x: 4, y: 4, width: 1, height: 1 }).renderCount, 2);
});

test("rejects malformed dirty rectangles before mutating the canvas", () => {
  const { renderer, canvas } = createRenderer();
  const state = { width: 2, height: 2, pixels: Array(4).fill(null), grid: false };
  renderer.render(state);
  const before = renderer.renderCount;
  const drawCount = canvas.context.calls.length;
  assert.throws(() => renderer.render(state, { x: 0.5, y: 0, width: 1, height: 1 }), /integer/);
  assert.throws(() => renderer.render(state, { x: 0, y: 0, width: 0, height: 1 }), /positive/);
  assert.equal(renderer.renderCount, before);
  assert.equal(canvas.context.calls.length, drawCount);
});

test("dirty rendering does not reset the visible canvas backing store", () => {
  const { canvas, renderer } = createRenderer(
    { left: 0, top: 0, width: 100, height: 100 }, 1
  );
  const state = { width: 4, height: 4, pixels: Array(16).fill(null), grid: false };
  renderer.render(state);
  const widthSets = canvas.widthSets;
  const heightSets = canvas.heightSets;
  state.pixels[0] = "#ff0000";
  renderer.render(state, { x: 0, y: 0, width: 1, height: 1 });
  assert.equal(canvas.widthSets, widthSets);
  assert.equal(canvas.heightSets, heightSets);
});

test("logical canvas resizing forces a full redraw even with a dirty rectangle", () => {
  const { renderer } = createRenderer(
    { left: 0, top: 0, width: 100, height: 100 }, 1
  );
  renderer.render({ width: 2, height: 2, pixels: Array(4).fill(null), grid: false });
  const result = renderer.render(
    { width: 3, height: 2, pixels: Array(6).fill(null), grid: false },
    { x: 1, y: 1, width: 1, height: 1 }
  );
  assert.equal(result.lastRenderMode, "full");
  assert.deepEqual(result.lastDirtyRect, { x: 0, y: 0, width: 3, height: 2 });
});

test("display-size and device-pixel-ratio changes resize both backing stores safely", () => {
  const { canvas, renderer, surfaces, setRatio } = createRenderer(
    { left: 0, top: 0, width: 100, height: 50 }, 1
  );
  const state = { width: 2, height: 2, pixels: Array(4).fill(null), grid: false };
  renderer.render(state);
  const imageData = renderer.imageData;
  assert.equal(canvas.width, 100);
  assert.equal(canvas.height, 50);
  assert.equal(surfaces[1].width, 100);
  assert.equal(surfaces[1].height, 50);

  setRatio(2);
  canvas.bounds.width = 120;
  canvas.bounds.height = 60;
  canvas.clientWidth = 120;
  canvas.clientHeight = 60;
  const stats = renderer.render(state, { x: 0, y: 0, width: 1, height: 1 });
  assert.equal(stats.lastRenderMode, "full");
  assert.deepEqual(stats.lastDirtyRect, { x: 0, y: 0, width: 2, height: 2 });
  assert.equal(canvas.width, 240);
  assert.equal(canvas.height, 120);
  assert.equal(surfaces[1].width, 240);
  assert.equal(surfaces[1].height, 120);
  assert.equal(renderer.imageData, imageData);
  assert.equal(stats.devicePixelRatio, 2);
});

test("grid and selection use an isolated display-resolution overlay surface", () => {
  const { renderer, surfaces } = createRenderer(
    { left: 0, top: 0, width: 90, height: 60 }, 1
  );
  const artwork = ["#123456", null, null, null, null, null];
  renderer.render({
    width: 3, height: 2, pixels: artwork, grid: true,
    selection: { x: 1, y: 0, width: 2, height: 2 }
  });
  assert.equal(surfaces[1].width, 90);
  assert.equal(surfaces[1].height, 60);
  assert.equal(surfaces[1].context.strokeCount, 1);
  assert.equal(surfaces[1].context.strokeRectCount, 1);
  assert.ok(surfaces[1].context.calls.some(call => call[0] === "clearRect"));
  assert.equal(surfaces[0].context.strokeCount, 0);
  assert.equal(surfaces[0].context.strokeRectCount, 0);
  assert.deepEqual(Array.from(renderer.imageData.data.slice(0, 8)),
    [18, 52, 86, 255, 0, 0, 0, 0]);
});

test("overlay changes force a full visible blit to erase stale grid or selection pixels", () => {
  const { renderer } = createRenderer(
    { left: 0, top: 0, width: 100, height: 100 }, 1
  );
  const state = {
    width: 4, height: 4, pixels: Array(16).fill(null), grid: true,
    selection: { x: 0, y: 0, width: 1, height: 1 }
  };
  renderer.render(state);
  state.selection = { x: 2, y: 2, width: 1, height: 1 };
  const moved = renderer.render(state, { x: 2, y: 2, width: 1, height: 1 });
  assert.equal(moved.lastRenderMode, "full");
  assert.deepEqual(moved.lastDirtyRect, { x: 0, y: 0, width: 4, height: 4 });

  state.selection = null;
  state.grid = false;
  const cleared = renderer.render(state, { x: 2, y: 2, width: 1, height: 1 });
  assert.equal(cleared.lastRenderMode, "full");
});

test("maps pointer coordinates to logical pixels and excludes invalid/outside positions", () => {
  const { renderer } = createRenderer(
    { left: 10, top: 20, width: 200, height: 100 }, 1
  );
  assert.equal(renderer.mapClientToPixel(10, 20), null);
  renderer.render({ width: 4, height: 2, pixels: Array(8).fill(null), grid: false });
  assert.deepEqual(renderer.mapClientToPixel(10, 20), { x: 0, y: 0, i: 0 });
  assert.deepEqual(renderer.mapClientToPixel(209.9, 119.9), { x: 3, y: 1, i: 7 });
  assert.equal(renderer.mapClientToPixel(210, 120), null);
  assert.equal(renderer.mapClientToPixel(9.99, 20), null);
  assert.equal(renderer.mapClientToPixel(NaN, 20), null);
  assert.equal(renderer.mapClientToPixel(10, 20, { left: 0, top: 0, width: 0, height: 2 }), null);
});

test("supports the editor's maximum 512 by 512 raster", () => {
  const { renderer } = createRenderer(
    { left: 0, top: 0, width: 512, height: 512 }, 1
  );
  const pixels = Array(512 * 512).fill(null);
  pixels[0] = "#010203";
  pixels[pixels.length - 1] = "#aabbcc";
  const stats = renderer.render({ width: 512, height: 512, pixels, grid: false });
  assert.equal(stats.pixelCount, 262144);
  assert.equal(renderer.imageData.data.length, 262144 * 4);
  assert.deepEqual(Array.from(renderer.imageData.data.slice(0, 4)), [1, 2, 3, 255]);
  assert.deepEqual(Array.from(renderer.imageData.data.slice(-4)), [170, 187, 204, 255]);
});

test("rejects malformed buffers, dimensions, colors, onion masks and selections", () => {
  const { renderer } = createRenderer();
  assert.throws(() => renderer.render({ width: 0, height: 1, pixels: [] }), /positive integers/);
  assert.throws(() => renderer.render({ width: 2, height: 2, pixels: [null] }), /length/);
  assert.throws(() => renderer.render({ width: 1, height: 1, pixels: ["#12345678"] }), /#RRGGBB/);
  assert.throws(() => renderer.render({
    width: 2, height: 2, pixels: Array(4).fill(null), onionBefore: [null]
  }), /Previous-frame/);
  assert.throws(() => renderer.render({
    width: 2, height: 2, pixels: Array(4).fill(null), onionAfter: [null]
  }), /Next-frame/);
  assert.throws(() => renderer.render({
    width: 2, height: 2, pixels: Array(4).fill(null), selection: { x: 0, y: 0, width: 0, height: 1 }
  }), /selection/i);
  assert.throws(() => renderer.render({
    width: 2, height: 2, pixels: Array(4).fill(null), selection: { x: 1, y: 1, width: 2, height: 1 }
  }), /inside the canvas/i);
});

test("invalid selection validation happens before buffers or the visible canvas change", () => {
  const { renderer, canvas } = createRenderer();
  const good = { width: 2, height: 2, pixels: Array(4).fill(null), grid: false };
  renderer.render(good);
  const beforeCount = renderer.renderCount;
  const beforeCalls = canvas.context.calls.length;
  assert.throws(() => renderer.render({
    width: 2, height: 2, pixels: Array(4).fill("#ff0000"),
    selection: { x: 1, y: 1, width: 2, height: 1 }
  }), /inside the canvas/i);
  assert.equal(renderer.renderCount, beforeCount);
  assert.equal(canvas.context.calls.length, beforeCalls);
  assert.deepEqual(Array.from(renderer.imageData.data.slice(0, 4)), [0, 0, 0, 0]);
});

test("destroy releases backing buffers and prevents subsequent rendering or hit testing", () => {
  const { renderer, surfaces } = createRenderer();
  renderer.render({ width: 1, height: 1, pixels: ["#123456"], grid: false });
  renderer.destroy();
  assert.equal(surfaces[0].width, 1);
  assert.equal(surfaces[0].height, 1);
  assert.equal(surfaces[1].width, 1);
  assert.equal(surfaces[1].height, 1);
  assert.throws(() => renderer.render({ width: 1, height: 1, pixels: [null] }), /destroyed/);
  assert.throws(() => renderer.mapClientToPixel(0, 0), /destroyed/);
});
