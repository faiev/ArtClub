/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Exporter = require("../js/sprite-sheet-export.js");

function makeProject() {
  const width = 2;
  const height = 2;
  const base = { id: "base", name: "Base", visible: true, locked: false, opacity: 1 };
  const ink = { id: "ink", name: "Ink", visible: true, locked: false, opacity: 1 };
  const hidden = { id: "hidden", name: "Hidden", visible: false, locked: false, opacity: 1 };
  const first = { id: "f1", name: "Idle", durationMs: 100 };
  const second = { id: "f2", name: "Step", durationMs: 180 };
  const third = { id: "f3", name: "Contact", durationMs: 240 };
  const cel = (layerId, frameId, pixels) => ({ layerId, frameId, pixels });

  const project = {
    format: "one-pixel-studio",
    version: 2,
    id: "project-test",
    name: "Test walk cycle",
    canvas: { width, height, background: null },
    palette: ["#ff0000", "#00ff00", "#0000ff", "#ffffff"],
    selectedColorIndex: 0,
    layers: [base, ink, hidden],
    frames: [first, second, third],
    cels: [
      cel("base", "f1", ["#ff0000", null, null, null]),
      cel("ink", "f1", [null, "#ffffff", null, null]),
      cel("hidden", "f1", [null, null, null, "#0000ff"]),
      cel("base", "f2", [null, "#00ff00", null, null]),
      cel("ink", "f2", [null, null, "#ffffff", null]),
      cel("base", "f3", [null, null, null, "#ff0000"])
    ],
    activeLayerId: "base",
    activeFrameId: "f1",
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
  return { project };
}

function rgbaAt(sheet, x, y) {
  const offset = (y * sheet.width + x) * 4;
  return Array.from(sheet.rgba.slice(offset, offset + 4));
}

test("exports all frames horizontally with exact colors, transparency and durations", () => {
  const { project } = makeProject();
  const sheet = Exporter.buildSpriteSheet(project);

  assert.equal(sheet.width, 6);
  assert.equal(sheet.height, 2);
  assert.equal(sheet.frameCount, 3);
  assert.equal(sheet.frames[0].durationMs, 100);
  assert.equal(sheet.frames[1].durationMs, 180);
  assert.equal(sheet.frames[2].durationMs, 240);
  assert.deepEqual(rgbaAt(sheet, 0, 0), [255, 0, 0, 255]);
  assert.deepEqual(rgbaAt(sheet, 1, 0), [255, 255, 255, 255]);
  assert.deepEqual(rgbaAt(sheet, 3, 0), [0, 255, 0, 255]);
  assert.deepEqual(rgbaAt(sheet, 4, 1), [0, 0, 0, 0]);
  // Hidden layers are excluded from the default visible composite.
  assert.deepEqual(rgbaAt(sheet, 1, 1), [0, 0, 0, 0]);
});

test("supports vertical and grid layouts with margin and spacing metadata", () => {
  const { project } = makeProject();
  const vertical = Exporter.buildSpriteSheet(project, { layout: "vertical", margin: 1, spacing: 2 });
  assert.deepEqual([vertical.width, vertical.height, vertical.columns, vertical.rows], [4, 12, 1, 3]);
  assert.deepEqual(vertical.frames.map(frame => [frame.x, frame.y]), [[1, 1], [1, 5], [1, 9]]);

  const grid = Exporter.buildSpriteSheet(project, { layout: "grid", columns: 2, margin: 1, spacing: 1 });
  assert.deepEqual([grid.width, grid.height, grid.columns, grid.rows], [7, 7, 2, 2]);
  assert.deepEqual(grid.frames.map(frame => [frame.x, frame.y]), [[1, 1], [4, 1], [1, 4]]);

  const metadata = Exporter.buildMetadata(grid, "walk.png");
  assert.equal(metadata.format, "one-pixel-studio-sprite-sheet");
  assert.equal(metadata.image.filename, "walk.png");
  assert.equal(metadata.image.width, 7);
  assert.equal(metadata.layout.type, "grid");
  assert.deepEqual(metadata.frames[2], {
    index: 2, frameId: "f3", name: "Contact", x: 1, y: 4,
    width: 2, height: 2, durationMs: 240
  });
});

test("supports explicit row-first and fixed row/column grid packing with stable metadata", () => {
  const { project } = makeProject();

  const rowFirst = Exporter.buildSpriteSheet(project, {
    layout: "grid",
    rows: 2,
    margin: 1,
    spacing: 1
  });
  assert.deepEqual([rowFirst.width, rowFirst.height, rowFirst.columns, rowFirst.rows], [7, 7, 2, 2]);
  assert.deepEqual(rowFirst.frames.map(frame => [frame.frameId, frame.x, frame.y]), [
    ["f1", 1, 1], ["f2", 4, 1], ["f3", 1, 4]
  ]);

  const columnFirst = Exporter.buildSpriteSheet(project, {
    layout: "grid",
    columns: 1,
    margin: 1,
    spacing: 1
  });
  assert.deepEqual([columnFirst.width, columnFirst.height, columnFirst.columns, columnFirst.rows], [4, 10, 1, 3]);
  assert.deepEqual(columnFirst.frames.map(frame => [frame.x, frame.y]), [[1, 1], [1, 4], [1, 7]]);

  const fixed = Exporter.buildSpriteSheet(project, {
    layout: "grid",
    columns: 3,
    rows: 2,
    margin: 1,
    spacing: 1
  });
  assert.deepEqual([fixed.width, fixed.height, fixed.columns, fixed.rows], [10, 7, 3, 2]);
  assert.deepEqual(fixed.frames.map(frame => [frame.x, frame.y]), [[1, 1], [4, 1], [7, 1]]);
  assert.deepEqual(rgbaAt(fixed, 8, 5), [0, 0, 0, 0], "unused grid cells remain transparent");

  const metadata = Exporter.buildMetadata(fixed, "explicit-grid.png");
  const roundTripped = JSON.parse(JSON.stringify(metadata));
  assert.deepEqual(roundTripped, metadata, "metadata must survive JSON serialization without losing the export contract");
  assert.deepEqual(roundTripped.layout, {
    type: "grid", columns: 3, rows: 2, margin: 1, spacing: 1
  });
  assert.deepEqual(roundTripped.frames.map(frame => [
    frame.index, frame.frameId, frame.name, frame.x, frame.y, frame.width, frame.height, frame.durationMs
  ]), [
    [0, "f1", "Idle", 1, 1, 2, 2, 100],
    [1, "f2", "Step", 4, 1, 2, 2, 180],
    [2, "f3", "Contact", 7, 1, 2, 2, 240]
  ]);
});

test("allows explicit frame order and selected layers, including hidden layers", () => {
  const { project } = makeProject();
  const sheet = Exporter.buildSpriteSheet(project, {
    frameIds: ["f3", "f1"],
    layerIds: ["hidden", "ink"]
  });

  assert.deepEqual(sheet.frames.map(frame => frame.frameId), ["f3", "f1"]);
  // Layer selection respects the document's bottom-to-top order, not caller array order.
  assert.deepEqual(rgbaAt(sheet, 1, 1), [0, 0, 0, 0]);
  assert.deepEqual(rgbaAt(sheet, 3, 1), [0, 0, 255, 255]);
  assert.deepEqual(rgbaAt(sheet, 3, 0), [255, 255, 255, 255]);
});

test("transparent background is default and an explicit background is applied only to empty pixels", () => {
  const { project } = makeProject();
  const transparent = Exporter.buildSpriteSheet(project, { frameIds: ["f2"] });
  assert.deepEqual(rgbaAt(transparent, 0, 0), [0, 0, 0, 0]);

  const opaque = Exporter.buildSpriteSheet(project, { frameIds: ["f2"], backgroundColor: "#123456" });
  assert.deepEqual(rgbaAt(opaque, 0, 0), [18, 52, 86, 255]);
  assert.deepEqual(rgbaAt(opaque, 1, 0), [0, 255, 0, 255]);
});

test("rejects invalid selection, layout, dimensions, and malformed cel data", () => {
  const { project } = makeProject();
  assert.throws(() => Exporter.buildSpriteSheet(project, { frameIds: ["missing"] }), /Unknown frame ID/);
  assert.throws(() => Exporter.buildSpriteSheet(project, { frameIds: ["f1", "f1"] }), /duplicate IDs/);
  assert.throws(() => Exporter.buildSpriteSheet(project, { layout: "diagonal" }), /Layout must be/);
  assert.throws(() => Exporter.buildSpriteSheet(project, { layout: "grid", columns: 4 }), /Grid columns/);
  assert.throws(() => Exporter.buildSpriteSheet(project, { layout: "grid", rows: 0 }), /Grid rows/);
  assert.throws(() => Exporter.buildSpriteSheet(project, { layout: "grid", columns: 1, rows: 1 }), /at least one cell/);
  assert.throws(() => Exporter.buildSpriteSheet(project, { layout: "horizontal", rows: 1 }), /only be specified when layout is grid/);
  assert.throws(() => Exporter.buildSpriteSheet(project, { spacing: -1 }), /Spacing/);

  const malformed = structuredClone(project);
  malformed.cels[0].pixels.pop();
  assert.throws(() => Exporter.buildSpriteSheet(malformed), /exactly width/);
});

test("checks output pixel budget before allocating the image buffer", () => {
  const { project } = makeProject();
  assert.throws(
    () => Exporter.buildSpriteSheet(project, { maxPixels: 3 }),
    /Maximum export pixels|too large/
  );
});

test("renders ImageData directly without scaling and encodes a PNG blob", async () => {
  const { project } = makeProject();
  const sheet = Exporter.buildSpriteSheet(project, { frameIds: ["f1"] });
  let receivedImageData = null;
  let requestedDimensions = null;
  const fakeBlob = { type: "image/png", size: 17 };
  const canvasFactory = (width, height) => {
    requestedDimensions = [width, height];
    return {
      getContext(type, options) {
        assert.equal(type, "2d");
        assert.equal(options.alpha, true);
        return {
          createImageData(imageWidth, imageHeight) {
            assert.deepEqual([imageWidth, imageHeight], [2, 2]);
            return { data: new Uint8ClampedArray(imageWidth * imageHeight * 4) };
          },
          putImageData(imageData, x, y) {
            assert.deepEqual([x, y], [0, 0]);
            receivedImageData = imageData;
          }
        };
      },
      toBlob(callback, type) {
        assert.equal(type, "image/png");
        callback(fakeBlob);
      }
    };
  };

  const blob = await Exporter.renderSpriteSheetPNG(sheet, { canvasFactory });
  assert.deepEqual(requestedDimensions, [2, 2]);
  assert.deepEqual(Array.from(receivedImageData.data), Array.from(sheet.rgba));
  assert.equal(blob, fakeBlob);
});

test("rejects a PNG encoder that returns no blob", async () => {
  const { project } = makeProject();
  const sheet = Exporter.buildSpriteSheet(project, { frameIds: ["f1"] });
  const canvasFactory = () => ({
    getContext() {
      return {
        createImageData(width, height) { return { data: new Uint8ClampedArray(width * height * 4) }; },
        putImageData() {}
      };
    },
    toBlob(callback) { callback(null); }
  });
  await assert.rejects(Exporter.renderSpriteSheetPNG(sheet, { canvasFactory }), /could not encode/);
});

test("rejects a sheet whose single side exceeds the canvas safety limit", () => {
  const { project } = makeProject();
  project.canvas = { width: 512, height: 1, background: null };
  project.frames = Array.from({ length: 256 }, (_, index) => ({
    id: "large-" + index, name: "Frame " + index, durationMs: 100
  }));
  project.cels = [];
  project.activeFrameId = project.frames[0].id;
  assert.throws(
    () => Exporter.buildSpriteSheet(project, { layout: "horizontal" }),
    /safe canvas side limit/
  );
});

test("high-level export returns both the PNG blob and matching metadata", async () => {
  const { project } = makeProject();
  const fakeBlob = { type: "image/png", size: 42 };
  const canvasFactory = (width, height) => ({
    getContext() {
      return {
        createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
        putImageData() {}
      };
    },
    toBlob(callback) { callback(fakeBlob); }
  });
  const exported = await Exporter.exportSpriteSheet(project, {
    frameIds: ["f2", "f1"],
    layout: "vertical",
    imageFilename: "selected-frames.png",
    canvasFactory
  });
  assert.equal(exported.blob, fakeBlob);
  assert.equal(exported.metadata.image.filename, "selected-frames.png");
  assert.deepEqual(exported.metadata.frames.map(frame => frame.frameId), ["f2", "f1"]);
});