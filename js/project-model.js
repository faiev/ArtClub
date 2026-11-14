/*!
 * One Pixel Studio — project document model
 * Version 2.0.0
 * Browser-global + CommonJS so the same rules can be tested in Node.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubProject = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT = "one-pixel-studio";
  const VERSION = 2;
  const LIMITS = Object.freeze({
    maxDimension: 512,
    maxLayers: 32,
    maxFrames: 256,
    maxPaletteColors: 256,
    maxCelPixels: 16777216
  });
  const HEX = /^#[0-9a-fA-F]{6}$/;

  function makeId(prefix) {
    const value = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 11);
    return prefix + "-" + value;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function assertDimension(value, name) {
    if (!Number.isInteger(value) || value < 1 || value > LIMITS.maxDimension) {
      throw new Error(name + " must be a whole number between 1 and " + LIMITS.maxDimension + ".");
    }
  }

  function makeLayer(name) {
    return {
      id: makeId("layer"),
      name: name || "Layer 1",
      visible: true,
      locked: false,
      opacity: 1
    };
  }

  function makeFrame(name, durationMs) {
    return {
      id: makeId("frame"),
      name: name || "Frame 1",
      durationMs: Number.isInteger(durationMs) ? durationMs : 100
    };
  }

  function createProject(options) {
    options = options || {};
    const width = options.width || options.w || 24;
    const height = options.height || options.h || 24;
    assertDimension(width, "Canvas width");
    assertDimension(height, "Canvas height");

    const layer = makeLayer(options.layerName || "Layer 1");
    const frame = makeFrame(options.frameName || "Frame 1", options.durationMs);
    const pixels = Array.isArray(options.pixels)
      ? options.pixels.slice()
      : Array(width * height).fill(null);
    if (pixels.length !== width * height) {
      throw new Error("The initial cel must contain exactly width × height pixels.");
    }

    const palette = Array.isArray(options.palette) && options.palette.length
      ? options.palette.slice()
      : ["#172b3a", "#344b55", "#53717a", "#87a7a0", "#d9e2c6", "#f4edda", "#f5c66d", "#ef945e", "#e96f55", "#b85e62", "#856f91", "#5e8da8"];

    const now = new Date().toISOString();
    const project = {
      format: FORMAT,
      version: VERSION,
      id: options.id || makeId("project"),
      name: options.name || options.projectName || "Untitled artwork",
      canvas: {
        width: width,
        height: height,
        background: null
      },
      palette: palette,
      selectedColorIndex: Number.isInteger(options.selectedColorIndex)
        ? options.selectedColorIndex
        : (Number.isInteger(options.selected) ? options.selected : 0),
      layers: [layer],
      frames: [frame],
      cels: [{
        layerId: layer.id,
        frameId: frame.id,
        pixels: pixels
      }],
      activeLayerId: layer.id,
      activeFrameId: frame.id,
      metadata: {
        createdAt: now,
        updatedAt: now
      }
    };

    const result = validateProject(project);
    if (!result.valid) throw new Error(result.errors.join(" "));
    return project;
  }

  function getLayer(project, layerId) {
    return project.layers.find(function (layer) {
      return layer.id === (layerId || project.activeLayerId);
    }) || null;
  }

  function getFrame(project, frameId) {
    return project.frames.find(function (frame) {
      return frame.id === (frameId || project.activeFrameId);
    }) || null;
  }

  function getCel(project, layerId, frameId) {
    return project.cels.find(function (cel) {
      return cel.layerId === (layerId || project.activeLayerId) &&
        cel.frameId === (frameId || project.activeFrameId);
    }) || null;
  }

  function ensureCel(project, layerId, frameId) {
    const layer = getLayer(project, layerId);
    const frame = getFrame(project, frameId);
    if (!layer || !frame) throw new Error("Cannot create a cel for a missing layer or frame.");
    let cel = getCel(project, layer.id, frame.id);
    if (!cel) {
      cel = {
        layerId: layer.id,
        frameId: frame.id,
        pixels: Array(project.canvas.width * project.canvas.height).fill(null)
      };
      project.cels.push(cel);
    }
    return cel;
  }

  function getCompositePixels(project, frameId) {
    const frame = getFrame(project, frameId);
    if (!frame) throw new Error("The requested frame does not exist.");
    const width = project.canvas.width;
    const height = project.canvas.height;
    const output = Array(width * height).fill(null);

    // Layers are ordered bottom-to-top. Later visible opaque pixels cover earlier ones.
    project.layers.forEach(function (layer) {
      if (!layer.visible) return;
      const cel = getCel(project, layer.id, frame.id);
      if (!cel) return;
      for (let i = 0; i < output.length; i += 1) {
        if (cel.pixels[i] !== null) output[i] = cel.pixels[i];
      }
    });
    return output;
  }

  function validateProject(project) {
    const errors = [];
    if (!project || typeof project !== "object" || Array.isArray(project)) {
      return { valid: false, errors: ["Project must be an object."] };
    }
    if (project.format !== FORMAT) errors.push("Unrecognized project format.");
    if (project.version !== VERSION) errors.push("Unsupported project version.");

    const canvas = project.canvas;
    if (!canvas || typeof canvas !== "object") {
      errors.push("Canvas settings are missing.");
    } else {
      try {
        assertDimension(canvas.width, "Canvas width");
        assertDimension(canvas.height, "Canvas height");
      } catch (error) {
        errors.push(error.message);
      }
    }

    if (typeof project.id !== "string" || !project.id) errors.push("Project ID is missing.");
    if (typeof project.name !== "string" || !project.name.trim() || project.name.length > 100) {
      errors.push("Project name must contain 1–100 characters.");
    }

    const palette = project.palette;
    if (!Array.isArray(palette) || palette.length < 1 || palette.length > LIMITS.maxPaletteColors ||
        palette.some(function (color) { return typeof color !== "string" || !HEX.test(color); })) {
      errors.push("Palette must contain 1–" + LIMITS.maxPaletteColors + " valid HEX colors.");
    }

    const layers = project.layers;
    if (!Array.isArray(layers) || layers.length < 1 || layers.length > LIMITS.maxLayers) {
      errors.push("Project must contain 1–" + LIMITS.maxLayers + " layers.");
    } else {
      const ids = new Set();
      layers.forEach(function (layer) {
        if (!layer || typeof layer.id !== "string" || !layer.id || ids.has(layer.id)) {
          errors.push("Layer IDs must be present and unique.");
        } else ids.add(layer.id);
        if (typeof layer.name !== "string" || !layer.name.trim()) errors.push("Every layer needs a name.");
        if (typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean") errors.push("Layer visibility and lock flags must be boolean.");
        if (typeof layer.opacity !== "number" || layer.opacity < 0 || layer.opacity > 1) errors.push("Layer opacity must be between 0 and 1.");
      });
    }

    const frames = project.frames;
    if (!Array.isArray(frames) || frames.length < 1 || frames.length > LIMITS.maxFrames) {
      errors.push("Project must contain 1–" + LIMITS.maxFrames + " frames.");
    } else {
      const ids = new Set();
      frames.forEach(function (frame) {
        if (!frame || typeof frame.id !== "string" || !frame.id || ids.has(frame.id)) {
          errors.push("Frame IDs must be present and unique.");
        } else ids.add(frame.id);
        if (typeof frame.name !== "string" || !frame.name.trim()) errors.push("Every frame needs a name.");
        if (!Number.isInteger(frame.durationMs) || frame.durationMs < 10 || frame.durationMs > 60000) {
          errors.push("Frame duration must be between 10 and 60000 milliseconds.");
        }
      });
    }

    if (Array.isArray(layers) && Array.isArray(frames)) {
      if (!layers.some(function (layer) { return layer.id === project.activeLayerId; })) errors.push("Active layer does not exist.");
      if (!frames.some(function (frame) { return frame.id === project.activeFrameId; })) errors.push("Active frame does not exist.");
    }

    if (!Number.isInteger(project.selectedColorIndex) || project.selectedColorIndex < 0 ||
        (Array.isArray(palette) && project.selectedColorIndex >= palette.length)) {
      errors.push("Selected palette index is invalid.");
    }

    if (!Array.isArray(project.cels)) {
      errors.push("Cels must be an array.");
    } else if (canvas && Number.isInteger(canvas.width) && Number.isInteger(canvas.height)) {
      const expectedPixels = canvas.width * canvas.height;
      let totalPixels = 0;
      const knownLayers = new Set(Array.isArray(layers) ? layers.map(function (item) { return item.id; }) : []);
      const knownFrames = new Set(Array.isArray(frames) ? frames.map(function (item) { return item.id; }) : []);
      const keys = new Set();
      project.cels.forEach(function (cel) {
        if (!cel || !knownLayers.has(cel.layerId) || !knownFrames.has(cel.frameId)) {
          errors.push("Every cel must reference an existing layer and frame.");
          return;
        }
        const key = cel.layerId + "::" + cel.frameId;
        if (keys.has(key)) errors.push("A layer/frame pair cannot contain duplicate cels.");
        keys.add(key);
        if (!Array.isArray(cel.pixels) || cel.pixels.length !== expectedPixels) {
          errors.push("Each cel must contain exactly width × height pixels.");
          return;
        }
        totalPixels += cel.pixels.length;
        if (cel.pixels.some(function (color) { return color !== null && (typeof color !== "string" || !HEX.test(color)); })) {
          errors.push("Cel pixels must be transparent or valid HEX colors.");
        }
      });
      if (totalPixels > LIMITS.maxCelPixels) errors.push("Project exceeds the safe pixel-data limit.");
    }

    if (project.metadata !== undefined && (!project.metadata || typeof project.metadata !== "object" || Array.isArray(project.metadata))) {
      errors.push("Project metadata must be an object.");
    }
    return { valid: errors.length === 0, errors: errors };
  }

  function fromLegacy(data) {
    const width = data.w;
    const height = data.h;
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        !Array.isArray(data.pixels) || !Array.isArray(data.palette)) {
      throw new Error("This older project file is incomplete.");
    }
    return createProject({
      width: width,
      height: height,
      name: data.projectName || "Untitled artwork",
      palette: data.palette,
      selectedColorIndex: Number.isInteger(data.selected) ? data.selected : 0,
      pixels: data.pixels
    });
  }

  function deserializeProject(input) {
    let data = input;
    if (typeof input === "string") {
      try { data = JSON.parse(input); }
      catch (error) { throw new Error("Project file is not valid JSON."); }
    }
    if (!data || typeof data !== "object" || Array.isArray(data)) {
      throw new Error("Project file must contain a project object.");
    }

    // v1 was the original single-canvas format. Migrate it into one layer and one frame.
    if (data.format !== FORMAT && (data.app === "One Pixel Studio" || ("w" in data && "h" in data && "pixels" in data))) {
      const migrated = fromLegacy(data);
      return migrated;
    }

    const result = validateProject(data);
    if (!result.valid) throw new Error("Invalid project: " + result.errors.join(" "));
    return deepClone(data);
  }

  function serializeProject(project, space) {
    const result = validateProject(project);
    if (!result.valid) throw new Error("Cannot save invalid project: " + result.errors.join(" "));
    return JSON.stringify(project, null, space === undefined ? 2 : space);
  }

  function cloneProject(project) {
    const result = validateProject(project);
    if (!result.valid) throw new Error("Cannot clone invalid project: " + result.errors.join(" "));
    return deepClone(project);
  }

  return Object.freeze({
    FORMAT: FORMAT,
    VERSION: VERSION,
    LIMITS: LIMITS,
    createProject: createProject,
    makeLayer: makeLayer,
    makeFrame: makeFrame,
    getLayer: getLayer,
    getFrame: getFrame,
    getCel: getCel,
    ensureCel: ensureCel,
    getCompositePixels: getCompositePixels,
    validateProject: validateProject,
    deserializeProject: deserializeProject,
    serializeProject: serializeProject,
    cloneProject: cloneProject
  });
});
