/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const GIF = require("../js/gif-export.js");
const Sprite = require("../js/sprite-sheet-export.js");

const examplesDirectory = path.join(__dirname, "../examples/export");
const project = JSON.parse(fs.readFileSync(
  path.join(examplesDirectory, "walk-cycle-v2.json"),
  "utf8"
));
const expectedAtlas = JSON.parse(fs.readFileSync(
  path.join(examplesDirectory, "expected-atlas-metadata.json"),
  "utf8"
));
const expectedGif = JSON.parse(fs.readFileSync(
  path.join(examplesDirectory, "expected-gif-timing.json"),
  "utf8"
));

function rgbaAt(sheet, x, y) {
  const offset = (y * sheet.width + x) * 4;
  return Array.from(sheet.rgba.slice(offset, offset + 4));
}

test("example project generates the documented reordered PNG atlas and JSON metadata", () => {
  const originalProject = JSON.stringify(project);
  const sheet = Sprite.buildSpriteSheet(project, {
    frameIds: ["contact", "idle"],
    layout: "grid",
    columns: 2,
    margin: 1,
    spacing: 1
  });

  assert.deepEqual([sheet.width, sheet.height], [7, 4]);
  assert.deepEqual(Sprite.buildMetadata(sheet, "walk-cycle-atlas.png"), expectedAtlas);
  assert.deepEqual(rgbaAt(sheet, 0, 0), [0, 0, 0, 0], "outer margin stays transparent");
  assert.deepEqual(rgbaAt(sheet, 3, 1), [0, 0, 0, 0], "inter-frame spacing stays transparent");
  assert.deepEqual(rgbaAt(sheet, 2, 1), [249, 115, 22, 255], "contact frame retains exact source orange");
  assert.deepEqual(rgbaAt(sheet, 1, 2), [31, 41, 55, 255], "contact frame retains exact source charcoal");
  assert.equal(JSON.stringify(project), originalProject, "atlas generation must not mutate the source project");
});

test("example project matches the documented GIF timing, looping and transparency contract", () => {
  const encoded = GIF.encodeGIF(project, { frameIds: ["idle", "contact"], loopCount: 0 });
  const actualFrames = encoded.metadata.frames.map(frame => ({
    index: frame.index,
    frameId: frame.frameId,
    name: frame.name,
    width: frame.width,
    height: frame.height,
    durationMs: frame.durationMs,
    encodedDelayCentiseconds: frame.encodedDelayCentiseconds,
    effectiveDurationMs: frame.effectiveDurationMs
  }));

  assert.equal(encoded.metadata.format, expectedGif.format);
  assert.equal(encoded.metadata.version, expectedGif.version);
  assert.deepEqual(encoded.metadata.image, expectedGif.image);
  assert.equal(encoded.metadata.frameCount, expectedGif.frameCount);
  assert.deepEqual(actualFrames, expectedGif.frames);
  assert.equal(encoded.diagnostics.loopCount, expectedGif.diagnostics.loopCount);
  assert.equal(encoded.diagnostics.loopBehavior, expectedGif.diagnostics.loopBehavior);
  assert.equal(encoded.diagnostics.transparentPixelCount, expectedGif.diagnostics.transparentPixelCount);
  assert.equal(encoded.diagnostics.transparency, expectedGif.diagnostics.transparency);
});
