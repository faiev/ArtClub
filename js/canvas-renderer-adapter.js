/*
 * Deterministic v2 project -> CanvasPixelRenderer state adapter.
 * Browser: window.ArtClubCanvasRendererAdapter.buildRendererState(project, options)
 * CommonJS: require("./canvas-renderer-adapter.js")
 *
 * The target renderer supports only opaque #RRGGBB and transparent null pixels.
 * Layer opacity is composited with premultiplied alpha. A final partially
 * transparent pixel cannot be represented by that renderer contract and is
 * rejected rather than silently flattened or made opaque.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubCanvasRendererAdapter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT = "one-pixel-studio";
  const VERSION = 2;
  const MAX_DIMENSION = 512;
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const ALPHA_EPSILON = 1e-12;

  function fail(message, Type) {
    throw new (Type || TypeError)(message);
  }

  function colorBytes(value, label) {
    if (typeof value !== "string" || !HEX.test(value)) {
      fail(label + " must be #RRGGBB or explicit null.");
    }
    const normalized = value.toLowerCase();
    return [
      parseInt(normalized.slice(1, 3), 16),
      parseInt(normalized.slice(3, 5), 16),
      parseInt(normalized.slice(5, 7), 16)
    ];
  }

  function assertDenseArray(value, label) {
    if (!Array.isArray(value)) fail(label + " must be an array.");
    for (let i = 0; i < value.length; i += 1) {
      if (!(i in value)) fail(label + " must not contain sparse entries (index " + i + ").");
    }
  }

  function assertPixelArray(pixels, count, label) {
    if (!Array.isArray(pixels) || pixels.length !== count) {
      fail(label + " must contain exactly width × height pixels.", RangeError);
    }
    for (let i = 0; i < count; i += 1) {
      if (!(i in pixels)) {
        fail(label + " must not contain sparse or undefined pixels (index " + i + ").");
      }
      if (pixels[i] !== null) colorBytes(pixels[i], label + " pixel " + i);
    }
  }

  function assertId(value, label) {
    if (typeof value !== "string" || value.length === 0) {
      fail(label + " must be a non-empty string.");
    }
  }

  function normalizeOnionOption(value) {
    if (value === undefined || value === false) return { before: false, after: false };
    if (value === true) return { before: true, after: true };
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      fail("onionSkin must be a boolean or an object with before/after booleans.");
    }
    const before = value.before === undefined ? false : value.before;
    const after = value.after === undefined ? false : value.after;
    if (typeof before !== "boolean" || typeof after !== "boolean") {
      fail("onionSkin.before and onionSkin.after must be booleans.");
    }
    return { before, after };
  }

  function validateProjectStructure(project) {
    if (!project || typeof project !== "object" || Array.isArray(project)) {
      fail("Project must be an object.");
    }
    if (project.format !== FORMAT || project.version !== VERSION) {
      fail("Canvas renderer adapter requires a version 2 one-pixel-studio project.");
    }
    if (typeof project.id !== "string" || project.id.length === 0) {
      fail("Project ID must be a non-empty string.");
    }
    const canvas = project.canvas;
    if (!canvas || typeof canvas !== "object" || Array.isArray(canvas)) {
      fail("Project canvas settings are missing.");
    }
    const width = canvas.width;
    const height = canvas.height;
    if (!Number.isInteger(width) || width < 1 || width > MAX_DIMENSION ||
        !Number.isInteger(height) || height < 1 || height > MAX_DIMENSION) {
      fail("Project dimensions must be positive integers no larger than 512.", RangeError);
    }
    const count = width * height;
    if (canvas.background !== null && canvas.background !== undefined) {
      colorBytes(canvas.background, "Canvas background");
    }

    assertDenseArray(project.layers, "Project layers");
    if (project.layers.length < 1) fail("Project must contain at least one layer.");
    const layerIds = new Set();
    project.layers.forEach((layer, index) => {
      if (!layer || typeof layer !== "object" || Array.isArray(layer)) {
        fail("Layer " + index + " must be an object.");
      }
      assertId(layer.id, "Layer " + index + " ID");
      if (layerIds.has(layer.id)) fail("Layer IDs must be unique.");
      layerIds.add(layer.id);
      if (typeof layer.visible !== "boolean") fail("Layer " + layer.id + " visibility must be boolean.");
      if (typeof layer.opacity !== "number" || !Number.isFinite(layer.opacity) ||
          layer.opacity < 0 || layer.opacity > 1) {
        fail("Layer " + layer.id + " opacity must be a finite number from 0 to 1.", RangeError);
      }
    });

    assertDenseArray(project.frames, "Project frames");
    if (project.frames.length < 1) fail("Project must contain at least one frame.");
    const frameIds = new Set();
    project.frames.forEach((frame, index) => {
      if (!frame || typeof frame !== "object" || Array.isArray(frame)) {
        fail("Frame " + index + " must be an object.");
      }
      assertId(frame.id, "Frame " + index + " ID");
      if (frameIds.has(frame.id)) fail("Frame IDs must be unique.");
      frameIds.add(frame.id);
    });

    assertId(project.activeLayerId, "Active layer ID");
    if (!layerIds.has(project.activeLayerId)) fail("Active layer does not exist in this project.");
    assertId(project.activeFrameId, "Active frame ID");
    if (!frameIds.has(project.activeFrameId)) fail("Active frame does not exist in this project.");

    assertDenseArray(project.cels, "Project cels");
    const celsByFrame = new Map();
    const celKeys = new Set();
    project.cels.forEach((cel, index) => {
      if (!cel || typeof cel !== "object" || Array.isArray(cel)) {
        fail("Cel " + index + " must be an object.");
      }
      if (!layerIds.has(cel.layerId) || !frameIds.has(cel.frameId)) {
        fail("Cel " + index + " references a missing layer or frame.");
      }
      const key = JSON.stringify([cel.layerId, cel.frameId]);
      if (celKeys.has(key)) fail("A layer/frame pair cannot contain duplicate cels.");
      celKeys.add(key);
      let frameCels = celsByFrame.get(cel.frameId);
      if (!frameCels) {
        frameCels = new Map();
        celsByFrame.set(cel.frameId, frameCels);
      }
      frameCels.set(cel.layerId, cel);
    });
    return { width, height, count, layers: project.layers, frames: project.frames, celsByFrame };
  }

  function validateFrameCels(frameId, structure) {
    const frameCels = structure.celsByFrame.get(frameId) || new Map();
    frameCels.forEach((cel, layerId) => {
      assertPixelArray(cel.pixels, structure.count,
        "Cel for layer " + layerId + " and frame " + frameId);
    });
    return frameCels;
  }

  function composeFrame(project, frameId, structure) {
    const frameCels = validateFrameCels(frameId, structure);
    const count = structure.count;
    const background = project.canvas.background === undefined
      ? null : project.canvas.background;
    const premultipliedRed = new Float64Array(count);
    const premultipliedGreen = new Float64Array(count);
    const premultipliedBlue = new Float64Array(count);
    const alpha = new Float64Array(count);

    if (background !== null) {
      const rgb = colorBytes(background, "Canvas background");
      premultipliedRed.fill(rgb[0]);
      premultipliedGreen.fill(rgb[1]);
      premultipliedBlue.fill(rgb[2]);
      alpha.fill(1);
    }

    // Project layer arrays are bottom-to-top. Source-over composition is stable
    // and uses premultiplied channels to avoid transparent-color division errors.
    structure.layers.forEach(layer => {
      if (!layer.visible || layer.opacity === 0) return;
      const cel = frameCels.get(layer.id);
      if (!cel) return; // Missing cels are transparent by the v2 model contract.
      const opacity = layer.opacity;
      const inverse = 1 - opacity;
      for (let i = 0; i < count; i += 1) {
        const pixel = cel.pixels[i];
        if (pixel === null) continue;
        const rgb = colorBytes(pixel, "Cel pixel " + i);
        premultipliedRed[i] = rgb[0] * opacity + premultipliedRed[i] * inverse;
        premultipliedGreen[i] = rgb[1] * opacity + premultipliedGreen[i] * inverse;
        premultipliedBlue[i] = rgb[2] * opacity + premultipliedBlue[i] * inverse;
        alpha[i] = opacity + alpha[i] * inverse;
      }
    });

    const output = new Array(count);
    for (let i = 0; i < count; i += 1) {
      const a = alpha[i];
      if (a === 0) {
        output[i] = null;
      } else if (a < 1 - ALPHA_EPSILON) {
        fail(
          "Frame " + frameId + " produces partially transparent pixel " + i +
          ", which the CanvasPixelRenderer #RRGGBB/null contract cannot represent. " +
          "Set an opaque canvas background or provide an opaque base layer.",
          RangeError
        );
      } else {
        const red = Math.max(0, Math.min(255, Math.round(premultipliedRed[i] / a)));
        const green = Math.max(0, Math.min(255, Math.round(premultipliedGreen[i] / a)));
        const blue = Math.max(0, Math.min(255, Math.round(premultipliedBlue[i] / a)));
        output[i] = "#" + [red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("");
      }
    }
    return output;
  }

  function makeCompositeRevision(project, activeFrameId, beforeFrameId, afterFrameId, onion) {
    return JSON.stringify({
      version: 1,
      projectId: project.id,
      canvasBackground: project.canvas.background === undefined ? null : project.canvas.background,
      activeFrameId,
      layerStack: project.layers.map(layer => [layer.id, layer.visible, layer.opacity]),
      onion: {
        beforeFrameId: onion.before ? beforeFrameId : null,
        afterFrameId: onion.after ? afterFrameId : null,
        beforeEnabled: onion.before,
        afterEnabled: onion.after
      }
    });
  }

  function buildRendererState(project, options) {
    const settings = options === undefined ? {} : options;
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
      fail("Adapter options must be an object.");
    }
    const structure = validateProjectStructure(project);
    const activeFrameId = project.activeFrameId;
    if (settings.expectedActiveFrameId !== undefined &&
        settings.expectedActiveFrameId !== activeFrameId) {
      fail("Stale frame state: expected active frame " + settings.expectedActiveFrameId +
        " but project is on " + activeFrameId + ".", RangeError);
    }
    if (settings.frameId !== undefined && settings.frameId !== activeFrameId) {
      fail("Requested frame " + settings.frameId +
        " does not match the project's active frame " + activeFrameId + ".", RangeError);
    }

    const activeIndex = structure.frames.findIndex(frame => frame.id === activeFrameId);
    const previousFrame = activeIndex > 0 ? structure.frames[activeIndex - 1] : null;
    const nextFrame = activeIndex >= 0 && activeIndex + 1 < structure.frames.length
      ? structure.frames[activeIndex + 1] : null;
    const onion = normalizeOnionOption(settings.onionSkin);
    const pixels = composeFrame(project, activeFrameId, structure);
    const onionBefore = onion.before && previousFrame
      ? composeFrame(project, previousFrame.id, structure) : null;
    const onionAfter = onion.after && nextFrame
      ? composeFrame(project, nextFrame.id, structure) : null;
    const compositeRevision = makeCompositeRevision(
      project,
      activeFrameId,
      previousFrame && previousFrame.id,
      nextFrame && nextFrame.id,
      onion
    );

    const result = {
      width: structure.width,
      height: structure.height,
      pixels,
      frameId: activeFrameId,
      compositeRevision,
      onionBefore,
      onionAfter
    };
    ["grid", "gridColor", "selection", "selectionPreview", "selectionColor"].forEach(key => {
      if (Object.prototype.hasOwnProperty.call(settings, key)) result[key] = settings[key];
    });
    return result;
  }

  return Object.freeze({
    VERSION,
    MAX_DIMENSION,
    buildRendererState
  });
});
