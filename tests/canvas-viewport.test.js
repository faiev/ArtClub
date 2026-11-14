"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const viewport = require("../js/canvas-viewport.js");

test("creates a fit-to-canvas viewport and centers the unused axis", () => {
  const state = viewport.createViewport({
    canvasWidth: 1000, canvasHeight: 500, viewWidth: 500, viewHeight: 500
  });
  assert.equal(state.scale, 0.5);
  assert.equal(state.offsetX, 0);
  assert.equal(state.offsetY, 125);
  assert.equal(state.devicePixelRatio, 1);
});

test("clamps large-canvas panning to content edges", () => {
  const state = viewport.createViewport({
    canvasWidth: 1000, canvasHeight: 800,
    viewWidth: 400, viewHeight: 300, scale: 1
  });
  const moved = viewport.panBy(state, -250, -180);
  assert.equal(moved.offsetX, -250);
  assert.equal(moved.offsetY, -180);
  const atBottomRight = viewport.panBy(moved, -10000, -10000);
  assert.equal(atBottomRight.offsetX, -600);
  assert.equal(atBottomRight.offsetY, -500);
  const atTopLeft = viewport.panBy(atBottomRight, 10000, 10000);
  assert.equal(atTopLeft.offsetX, 0);
  assert.equal(atTopLeft.offsetY, 0);
});

test("keeps a canvas smaller than the view centered and prevents empty-space panning", () => {
  const state = viewport.createViewport({
    canvasWidth: 100, canvasHeight: 80,
    viewWidth: 400, viewHeight: 300, scale: 1
  });
  assert.equal(state.offsetX, 150);
  assert.equal(state.offsetY, 110);
  const moved = viewport.panBy(state, 80, -90);
  assert.equal(moved.offsetX, 150);
  assert.equal(moved.offsetY, 110);
});

test("cursor-anchored zoom preserves the logical point beneath the cursor", () => {
  const state = viewport.createViewport({
    canvasWidth: 1000, canvasHeight: 800,
    viewWidth: 400, viewHeight: 300, scale: 1,
    offsetX: -120, offsetY: -80, minScale: 0.1, maxScale: 8
  });
  const anchor = { x: 170, y: 120 };
  const before = viewport.screenToCanvas(state, anchor.x, anchor.y);
  const zoomed = viewport.zoomAt(state, 1.75, anchor.x, anchor.y);
  const after = viewport.screenToCanvas(zoomed, anchor.x, anchor.y);
  assert.ok(Math.abs(before.x - after.x) < 1e-10);
  assert.ok(Math.abs(before.y - after.y) < 1e-10);
  assert.equal(zoomed.scale, 1.75);
});

test("zoomBy multiplies scale and respects configured bounds", () => {
  const state = viewport.createViewport({
    canvasWidth: 100, canvasHeight: 100,
    viewWidth: 300, viewHeight: 300, scale: 2,
    minScale: 0.5, maxScale: 4
  });
  assert.equal(viewport.zoomBy(state, 2, 150, 150).scale, 4);
  assert.equal(viewport.zoomBy(state, 0.01, 150, 150).scale, 0.5);
  assert.throws(() => viewport.zoomBy(state, 0, 0, 0), /factor/);
});

test("reset returns to 1x zoom and applies the standard centering/edge policy", () => {
  const state = viewport.createViewport({
    canvasWidth: 120, canvasHeight: 90,
    viewWidth: 400, viewHeight: 300,
    scale: 2, offsetX: -20, offsetY: -40
  });
  const reset = viewport.resetViewport(state);
  assert.equal(reset.scale, 1);
  assert.equal(reset.offsetX, 140);
  assert.equal(reset.offsetY, 105);

  const large = viewport.createViewport({
    canvasWidth: 1000, canvasHeight: 900,
    viewWidth: 400, viewHeight: 300, scale: 2,
    offsetX: -1000, offsetY: -1000
  });
  const largeReset = viewport.resetViewport(large);
  assert.equal(largeReset.scale, 1);
  assert.equal(largeReset.offsetX, 0);
  assert.equal(largeReset.offsetY, 0);
});

test("fitToCanvas supports padding and obeys zoom bounds", () => {
  const state = viewport.createViewport({
    canvasWidth: 1000, canvasHeight: 500,
    viewWidth: 500, viewHeight: 400, scale: 1,
    minScale: 0.1, maxScale: 10
  });
  const fit = viewport.fitToCanvas(state, 20);
  assert.equal(fit.scale, 0.46);
  assert.equal(fit.offsetX, 20);
  assert.equal(fit.offsetY, 85);
  assert.throws(() => viewport.fitToCanvas(state, 250), /positive viewport area/);
  assert.throws(() => viewport.fitToCanvas(state, -1), /not be negative/);
});

test("canvas-to-screen and screen-to-canvas transforms are inverse operations", () => {
  const state = viewport.createViewport({
    canvasWidth: 320, canvasHeight: 240,
    viewWidth: 511.5, viewHeight: 333.25,
    scale: 1.4, offsetX: -33.25, offsetY: -18.5
  });
  const screen = viewport.canvasToScreen(state, 123.75, 201.5);
  const canvas = viewport.screenToCanvas(state, screen.x, screen.y);
  assert.ok(Math.abs(canvas.x - 123.75) < 1e-10);
  assert.ok(Math.abs(canvas.y - 201.5) < 1e-10);
});

test("client-to-canvas conversion handles fractional element bounds", () => {
  const state = viewport.createViewport({
    canvasWidth: 400, canvasHeight: 200,
    viewWidth: 333.3, viewHeight: 177.7,
    scale: 0.75, offsetX: 16.65, offsetY: 13.85,
    devicePixelRatio: 1.5
  });
  const bounds = { left: 10.25, top: 20.5, width: 333.3, height: 177.7 };
  const point = viewport.clientToCanvas(
    state,
    bounds.left + bounds.width * 0.5,
    bounds.top + bounds.height * 0.5,
    bounds
  );
  assert.ok(Math.abs(point.x - 200) < 1e-10);
  assert.ok(Math.abs(point.y - 100) < 1e-10);
});

test("device-pixel-ratio conversions preserve CSS coordinates and round backing dimensions", () => {
  const state = viewport.createViewport({
    canvasWidth: 200, canvasHeight: 100,
    viewWidth: 333.3, viewHeight: 222.2,
    devicePixelRatio: 1.5
  });
  assert.deepEqual(viewport.getBackingSize(state), { width: 500, height: 333 });
  const backing = viewport.screenToBacking(state, 100.25, 60.5);
  assert.deepEqual(backing, { x: 150.375, y: 90.75 });
  assert.deepEqual(viewport.backingToScreen(state, backing.x, backing.y),
    { x: 100.25, y: 60.5 });
});

test("resizing preserves the logical point at the viewport center and updates DPR independently", () => {
  const state = viewport.createViewport({
    canvasWidth: 1200, canvasHeight: 900,
    viewWidth: 500.5, viewHeight: 300.25,
    scale: 0.8, offsetX: -120, offsetY: -90,
    devicePixelRatio: 1
  });
  const centerBefore = viewport.screenToCanvas(state, state.viewWidth / 2, state.viewHeight / 2);
  const resized = viewport.resizeViewport(state, 640.5, 360.75, 2);
  const centerAfter = viewport.screenToCanvas(resized, resized.viewWidth / 2, resized.viewHeight / 2);
  assert.ok(Math.abs(centerBefore.x - centerAfter.x) < 1e-10);
  assert.ok(Math.abs(centerBefore.y - centerAfter.y) < 1e-10);
  assert.equal(resized.devicePixelRatio, 2);
  assert.equal(state.devicePixelRatio, 1);
  assert.equal(state.viewWidth, 500.5);
});

test("serialization is deterministic and round-trips the complete transform", () => {
  const state = viewport.createViewport({
    canvasWidth: 640, canvasHeight: 480,
    viewWidth: 801.25, viewHeight: 605.5,
    scale: 1.75, offsetX: -23.5, offsetY: -17.25,
    devicePixelRatio: 1.5, minScale: 0.25, maxScale: 12
  });
  const first = viewport.serializeViewport(state);
  const second = viewport.serializeViewport(state);
  assert.equal(first, second);
  assert.equal(first, JSON.stringify({
    version: 1,
    canvasWidth: 640,
    canvasHeight: 480,
    viewWidth: 801.25,
    viewHeight: 605.5,
    scale: 1.75,
    offsetX: -23.5,
    offsetY: -17.25,
    devicePixelRatio: 1.5,
    minScale: 0.25,
    maxScale: 12
  }));
  assert.deepEqual(viewport.deserializeViewport(first), state);
});

test("serialization rejects malformed JSON and unsupported versions", () => {
  assert.throws(() => viewport.deserializeViewport("not json"), /valid JSON/);
  assert.throws(() => viewport.deserializeViewport(JSON.stringify({ version: 2 })), /unsupported/);
  assert.throws(() => viewport.deserializeViewport(JSON.stringify({
    version: 1, canvasWidth: 0, canvasHeight: 10, viewWidth: 100, viewHeight: 100
  })), /positive integer/);
});

test("rejects invalid dimensions, DPR, zoom limits and non-finite transform inputs", () => {
  assert.throws(() => viewport.createViewport({ canvasWidth: 0, canvasHeight: 10, viewWidth: 100, viewHeight: 100 }), /canvasWidth/);
  assert.throws(() => viewport.createViewport({ canvasWidth: 10, canvasHeight: 10, viewWidth: 0, viewHeight: 100 }), /viewWidth/);
  assert.throws(() => viewport.createViewport({ canvasWidth: 10, canvasHeight: 10, viewWidth: 100, viewHeight: 100, devicePixelRatio: 0 }), /devicePixelRatio/);
  assert.throws(() => viewport.createViewport({ canvasWidth: 10, canvasHeight: 10, viewWidth: 100, viewHeight: 100, minScale: 2, maxScale: 1 }), /minScale/);
  assert.throws(() => viewport.panBy(viewport.createViewport({ canvasWidth: 10, canvasHeight: 10, viewWidth: 100, viewHeight: 100 }), Infinity, 0), /deltaX/);
  assert.throws(() => viewport.canvasToScreen(viewport.createViewport({ canvasWidth: 10, canvasHeight: 10, viewWidth: 100, viewHeight: 100 }), NaN, 0), /canvasX/);
  assert.throws(() => viewport.clientToCanvas(viewport.createViewport({ canvasWidth: 10, canvasHeight: 10, viewWidth: 100, viewHeight: 100 }), 0, 0, { left: 0, top: 0, width: 0, height: 10 }), /bounds.width/);
});

test("viewport operations are immutable and clampViewport is deterministic", () => {
  const state = viewport.createViewport({
    canvasWidth: 1000, canvasHeight: 800, viewWidth: 400, viewHeight: 300,
    scale: 1, offsetX: -100, offsetY: -80
  });
  const snapshot = JSON.stringify(state);
  const moved = viewport.panBy(state, -20, 30);
  assert.equal(JSON.stringify(state), snapshot);
  assert.notEqual(moved, state);
  assert.deepEqual(viewport.clampViewport(moved), moved);
});
