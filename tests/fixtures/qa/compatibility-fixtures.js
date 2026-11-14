"use strict";

const Project = require("../../../js/project-model.js");

function makeBoundaryProject(options) {
  options = options || {};
  const id = options.id || "qa-compat";
  const width = options.width === undefined ? 2 : options.width;
  const height = options.height === undefined ? 2 : options.height;
  const layerCount = options.layerCount === undefined ? 1 : options.layerCount;
  const frameCount = options.frameCount === undefined ? 1 : options.frameCount;
  const paletteCount = options.paletteCount === undefined ? 2 : options.paletteCount;
  const palette = Array.from({ length: paletteCount }, (_, index) =>
    "#" + index.toString(16).padStart(6, "0")
  );

  // Create a valid document first, then mutate only the intended fixture
  // dimensions for negative cases such as an over-limit palette.
  const creationPalette = palette.slice(0, Project.LIMITS.maxPaletteColors);
  const requestedSelectedIndex = options.selectedColorIndex === undefined
    ? palette.length - 1
    : options.selectedColorIndex;
  const creationSelectedIndex = Math.max(
    0,
    Math.min(creationPalette.length - 1, requestedSelectedIndex)
  );
  const project = Project.createProject({
    id,
    name: options.name || id,
    width,
    height,
    palette: creationPalette,
    selectedColorIndex: creationSelectedIndex,
    durationMs: options.firstDuration === undefined ? 100 : options.firstDuration
  });
  project.palette = palette;
  project.selectedColorIndex = requestedSelectedIndex;

  for (let index = 1; index < layerCount; index += 1) {
    const layer = Project.makeLayer("Layer " + (index + 1));
    layer.id = id + "-layer-" + (index + 1);
    project.layers.push(layer);
  }

  for (let index = 1; index < frameCount; index += 1) {
    const frame = Project.makeFrame(
      "Frame " + (index + 1),
      index === frameCount - 1 && options.lastDuration !== undefined
        ? options.lastDuration
        : 100
    );
    frame.id = id + "-frame-" + (index + 1);
    project.frames.push(frame);
  }

  if (options.activeLayerLast) {
    project.activeLayerId = project.layers[project.layers.length - 1].id;
  }
  if (options.activeFrameLast) {
    project.activeFrameId = project.frames[project.frames.length - 1].id;
  }
  return project;
}

function makeLegacyProject() {
  return {
    app: "One Pixel Studio",
    version: 1,
    w: 3,
    h: 2,
    projectName: "Legacy fixture",
    palette: ["#112233", "#445566", "#778899"],
    selected: 2,
    pixels: ["#112233", null, "#445566", null, "#778899", null]
  };
}

function makeSparseCelProject() {
  const project = makeBoundaryProject({ id: "qa-sparse", width: 2, height: 2 });
  delete project.cels[0].pixels[1];
  return project;
}

function makeUndefinedCelProject() {
  const project = makeBoundaryProject({ id: "qa-undefined", width: 2, height: 2 });
  project.cels[0].pixels[1] = undefined;
  return project;
}

function makeOverBudgetCelProject() {
  const width = 512;
  const height = 512;
  const project = makeBoundaryProject({
    id: "qa-over-budget",
    width,
    height,
    frameCount: 65,
    activeFrameLast: true
  });
  const pixelsPerCel = width * height;

  // Sparse arrays keep the test allocation small. The project validator
  // still counts each cel's declared length toward the aggregate data cap.
  project.cels = project.frames.map(frame => ({
    layerId: project.layers[0].id,
    frameId: frame.id,
    pixels: new Array(pixelsPerCel)
  }));
  return project;
}

module.exports = {
  Project,
  makeBoundaryProject,
  makeLegacyProject,
  makeSparseCelProject,
  makeUndefinedCelProject,
  makeOverBudgetCelProject
};
