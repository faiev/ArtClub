/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Project = require("../js/project-model.js");

test("creates a valid project with one editable layer and one frame", () => {
  const pixels = Array(24 * 24).fill(null);
  pixels[12] = "#e96f55";
  const project = Project.createProject({
    width: 24,
    height: 24,
    name: "Sprite",
    palette: ["#172b3a", "#e96f55"],
    selectedColorIndex: 1,
    pixels
  });

  assert.equal(Project.validateProject(project).valid, true);
  assert.equal(project.format, "one-pixel-studio");
  assert.equal(project.version, 2);
  assert.equal(project.layers.length, 1);
  assert.equal(project.frames.length, 1);
  assert.equal(Project.getCel(project).pixels[12], "#e96f55");
});

test("supports empty cels for future layers and frames", () => {
  const project = Project.createProject({ width: 4, height: 3, palette: ["#000000"] });
  const layer = Project.makeLayer("Highlights");
  const frame = Project.makeFrame("Frame 2", 120);
  project.layers.push(layer);
  project.frames.push(frame);

  const cel = Project.ensureCel(project, layer.id, frame.id);
  assert.equal(cel.pixels.length, 12);
  assert.ok(cel.pixels.every(pixel => pixel === null));
  assert.equal(Project.validateProject(project).valid, true);
});

test("composites visible layers from bottom to top", () => {
  const project = Project.createProject({ width: 2, height: 1, palette: ["#000000", "#ffffff"] });
  const base = Project.getCel(project);
  base.pixels = ["#000000", null];

  const top = Project.makeLayer("Top");
  project.layers.push(top);
  const topCel = Project.ensureCel(project, top.id, project.activeFrameId);
  topCel.pixels = [null, "#ffffff"];

  assert.deepEqual(Project.getCompositePixels(project), ["#000000", "#ffffff"]);
  top.visible = false;
  assert.deepEqual(Project.getCompositePixels(project), ["#000000", null]);
});

test("migrates legacy single-canvas project files", () => {
  const legacy = {
    app: "One Pixel Studio",
    version: 1,
    w: 3,
    h: 2,
    projectName: "Old drawing",
    palette: ["#000000", "#ffffff"],
    selected: 1,
    pixels: ["#ffffff", null, null, null, "#000000", null]
  };
  const project = Project.deserializeProject(legacy);

  assert.equal(Project.validateProject(project).valid, true);
  assert.equal(project.name, "Old drawing");
  assert.equal(project.canvas.width, 3);
  assert.equal(project.canvas.height, 2);
  assert.equal(project.selectedColorIndex, 1);
  assert.equal(project.layers.length, 1);
  assert.equal(project.frames.length, 1);
  assert.deepEqual(Project.getCel(project).pixels, legacy.pixels);
});

test("round-trips versioned projects without losing layers, frames or pixels", () => {
  const project = Project.createProject({ width: 2, height: 2, palette: ["#123456"] });
  const layer = Project.makeLayer("Ink");
  const frame = Project.makeFrame("Frame 2", 180);
  project.layers.push(layer);
  project.frames.push(frame);
  Project.ensureCel(project, layer.id, frame.id).pixels[3] = "#123456";

  const saved = Project.serializeProject(project);
  const reopened = Project.deserializeProject(saved);

  assert.deepEqual(reopened, project);
});

test("rejects malformed dimensions, unknown versions and invalid pixel data", () => {
  assert.throws(() => Project.createProject({ width: 0, height: 4 }), /Canvas width/);

  const project = Project.createProject({ width: 2, height: 2 });
  project.version = 999;
  assert.equal(Project.validateProject(project).valid, false);
  assert.throws(() => Project.deserializeProject(project), /Unsupported project version/);

  const badPixelProject = Project.createProject({ width: 2, height: 2 });
  Project.getCel(badPixelProject).pixels[0] = "not-a-color";
  assert.equal(Project.validateProject(badPixelProject).valid, false);
});

test("rejects cels whose pixel dimensions do not match the document", () => {
  const project = Project.createProject({ width: 2, height: 2 });
  Project.getCel(project).pixels.pop();
  const result = Project.validateProject(project);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /exactly width/);
});
