/*!
 * One Pixel Studio — sprite-sheet exporter
 * Dependency-free browser/Node module for exact, frame-aware PNG sprite sheets.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubSpriteSheetExporter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT = "one-pixel-studio-sprite-sheet";
  const VERSION = 1;
  const MAX_DIMENSION = 512;
  const MAX_FRAMES = 256;
  const MAX_EXPORT_PIXELS = 16 * 1024 * 1024;
  const MAX_CANVAS_SIDE = 32767;
  const HEX = /^#[0-9a-fA-F]{6}$/;

  function isPlainObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function assertInteger(value, name, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(name + " must be a whole number between " + min + " and " + max + ".");
    }
  }

  function assertUniqueIds(items, label) {
    const ids = new Set();
    items.forEach(function (item) {
      if (!item || typeof item.id !== "string" || !item.id || ids.has(item.id)) {
        throw new Error(label + " IDs must be present and unique.");
      }
      ids.add(item.id);
    });
    return ids;
  }

  function assertProject(project) {
    if (!isPlainObject(project)) throw new Error("Project must be an object.");
    if (project.format !== "one-pixel-studio" || project.version !== 2) {
      throw new Error("Sprite-sheet export requires a version 2 One Pixel Studio project.");
    }
    if (!isPlainObject(project.canvas)) throw new Error("Project canvas settings are missing.");

    const width = project.canvas.width;
    const height = project.canvas.height;
    assertInteger(width, "Canvas width", 1, MAX_DIMENSION);
    assertInteger(height, "Canvas height", 1, MAX_DIMENSION);

    if (!Array.isArray(project.frames) || project.frames.length < 1 || project.frames.length > MAX_FRAMES) {
      throw new Error("Project must contain 1–" + MAX_FRAMES + " frames.");
    }
    if (!Array.isArray(project.layers) || project.layers.length < 1) {
      throw new Error("Project must contain at least one layer.");
    }
    if (!Array.isArray(project.cels)) throw new Error("Project cels must be an array.");

    const frameIds = assertUniqueIds(project.frames, "Frame");
    const layerIds = assertUniqueIds(project.layers, "Layer");
    project.frames.forEach(function (frame) {
      if (typeof frame.name !== "string" || !frame.name.trim()) throw new Error("Every frame needs a name.");
      assertInteger(frame.durationMs, "Frame duration", 10, 60000);
    });
    project.layers.forEach(function (layer) {
      if (typeof layer.visible !== "boolean") throw new Error("Layer visibility must be boolean.");
    });

    const celKeys = new Set();
    project.cels.forEach(function (cel) {
      if (!cel || !layerIds.has(cel.layerId) || !frameIds.has(cel.frameId)) {
        throw new Error("Every cel must reference an existing layer and frame.");
      }
      const key = cel.layerId + "::" + cel.frameId;
      if (celKeys.has(key)) throw new Error("A layer/frame pair cannot contain duplicate cels.");
      celKeys.add(key);
      if (!Array.isArray(cel.pixels) || cel.pixels.length !== width * height) {
        throw new Error("Each cel must contain exactly width × height pixels.");
      }
      cel.pixels.forEach(function (color) {
        if (color !== null && (typeof color !== "string" || !HEX.test(color))) {
          throw new Error("Cel pixels must be transparent or valid HEX colors.");
        }
      });
    });

    return { width: width, height: height, frameIds: frameIds, layerIds: layerIds };
  }

  function resolveSelection(selection, available, defaultItems, label) {
    if (selection === undefined || selection === null) return defaultItems.slice();
    if (!Array.isArray(selection) || selection.length < 1) {
      throw new Error(label + " must be a non-empty array when provided.");
    }
    const seen = new Set();
    selection.forEach(function (id) {
      if (typeof id !== "string" || !available.has(id)) {
        throw new Error("Unknown " + label.replace(/ IDs$/, "").toLowerCase() + " ID: " + String(id));
      }
      if (seen.has(id)) throw new Error(label + " cannot contain duplicate IDs.");
      seen.add(id);
    });
    return selection.slice();
  }

  function parseHex(color) {
    return [
      parseInt(color.slice(1, 3), 16),
      parseInt(color.slice(3, 5), 16),
      parseInt(color.slice(5, 7), 16)
    ];
  }

  function buildSpriteSheet(project, options) {
    options = options || {};
    const dimensions = assertProject(project);
    const width = dimensions.width;
    const height = dimensions.height;
    const framesById = new Map(project.frames.map(function (frame) { return [frame.id, frame]; }));

    const frameIds = resolveSelection(options.frameIds, dimensions.frameIds, project.frames.map(function (frame) { return frame.id; }), "Frame IDs");
    const defaultLayerIds = project.layers.filter(function (layer) { return layer.visible; }).map(function (layer) { return layer.id; });
    const selectedLayerIds = resolveSelection(options.layerIds, dimensions.layerIds, defaultLayerIds, "Layer IDs");
    // Keep the document's bottom-to-top stacking order regardless of the order of the IDs supplied.
    const orderedLayerIds = project.layers.filter(function (layer) { return selectedLayerIds.includes(layer.id); }).map(function (layer) { return layer.id; });

    const layout = options.layout === undefined ? "horizontal" : options.layout;
    if (!["horizontal", "vertical", "grid"].includes(layout)) {
      throw new Error("Layout must be horizontal, vertical or grid.");
    }
    const margin = options.margin === undefined ? 0 : options.margin;
    const spacing = options.spacing === undefined ? 0 : options.spacing;
    assertInteger(margin, "Margin", 0, 4096);
    assertInteger(spacing, "Spacing", 0, 4096);

    let columns;
    if (layout === "horizontal") columns = frameIds.length;
    else if (layout === "vertical") columns = 1;
    else {
      columns = options.columns === undefined ? Math.ceil(Math.sqrt(frameIds.length)) : options.columns;
      assertInteger(columns, "Grid columns", 1, frameIds.length);
    }
    const rows = Math.ceil(frameIds.length / columns);
    const sheetWidth = margin * 2 + columns * width + Math.max(0, columns - 1) * spacing;
    const sheetHeight = margin * 2 + rows * height + Math.max(0, rows - 1) * spacing;
    const pixelCount = sheetWidth * sheetHeight;
    if (sheetWidth > MAX_CANVAS_SIDE || sheetHeight > MAX_CANVAS_SIDE) {
      throw new Error("Sprite sheet dimensions exceed the safe canvas side limit of " + MAX_CANVAS_SIDE + " pixels.");
    }
    const maxPixels = options.maxPixels === undefined ? MAX_EXPORT_PIXELS : options.maxPixels;
    assertInteger(maxPixels, "Maximum export pixels", 1, MAX_EXPORT_PIXELS);
    if (!Number.isSafeInteger(pixelCount) || pixelCount > maxPixels) {
      throw new Error("Sprite sheet is too large (" + sheetWidth + " × " + sheetHeight + "). Reduce the frame count, margin or spacing.");
    }

    const backgroundColor = options.backgroundColor === undefined ? null : options.backgroundColor;
    if (backgroundColor !== null && (typeof backgroundColor !== "string" || !HEX.test(backgroundColor))) {
      throw new Error("Background color must be null or a valid #RRGGBB color.");
    }

    // RGBA ImageData avoids string-heavy pixel arrays and preserves exact source RGB values.
    const rgba = new Uint8ClampedArray(pixelCount * 4);
    if (backgroundColor !== null) {
      const rgb = parseHex(backgroundColor);
      for (let offset = 0; offset < rgba.length; offset += 4) {
        rgba[offset] = rgb[0];
        rgba[offset + 1] = rgb[1];
        rgba[offset + 2] = rgb[2];
        rgba[offset + 3] = 255;
      }
    }

    const celsByKey = new Map(project.cels.map(function (cel) {
      return [cel.layerId + "::" + cel.frameId, cel];
    }));
    const colorCache = new Map();
    function rgbFor(color) {
      if (!colorCache.has(color)) colorCache.set(color, parseHex(color));
      return colorCache.get(color);
    }
    const frameRects = [];

    frameIds.forEach(function (frameId, index) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + column * (width + spacing);
      const y = margin + row * (height + spacing);
      const frame = framesById.get(frameId);
      frameRects.push({
        index: index,
        frameId: frame.id,
        name: frame.name,
        x: x,
        y: y,
        width: width,
        height: height,
        durationMs: frame.durationMs
      });

      orderedLayerIds.forEach(function (layerId) {
        const cel = celsByKey.get(layerId + "::" + frameId);
        if (!cel) return;
        const source = cel.pixels;
        for (let sourceIndex = 0; sourceIndex < source.length; sourceIndex += 1) {
          const color = source[sourceIndex];
          if (color === null) continue;
          const rgb = rgbFor(color);
          const pixelX = sourceIndex % width;
          const pixelY = Math.floor(sourceIndex / width);
          const targetOffset = ((y + pixelY) * sheetWidth + x + pixelX) * 4;
          rgba[targetOffset] = rgb[0];
          rgba[targetOffset + 1] = rgb[1];
          rgba[targetOffset + 2] = rgb[2];
          rgba[targetOffset + 3] = 255;
        }
      });
    });

    return {
      format: FORMAT,
      version: VERSION,
      width: sheetWidth,
      height: sheetHeight,
      frameWidth: width,
      frameHeight: height,
      layout: layout,
      columns: columns,
      rows: rows,
      margin: margin,
      spacing: spacing,
      backgroundColor: backgroundColor,
      frameCount: frameRects.length,
      frames: frameRects,
      rgba: rgba
    };
  }

  function buildMetadata(sheet, imageFilename) {
    if (!sheet || sheet.format !== FORMAT || !(sheet.rgba instanceof Uint8ClampedArray)) {
      throw new Error("A sprite sheet built by this exporter is required.");
    }
    return {
      format: FORMAT,
      version: VERSION,
      image: {
        filename: typeof imageFilename === "string" && imageFilename.trim() ? imageFilename : "sprite-sheet.png",
        width: sheet.width,
        height: sheet.height
      },
      canvas: {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight
      },
      layout: {
        type: sheet.layout,
        columns: sheet.columns,
        rows: sheet.rows,
        margin: sheet.margin,
        spacing: sheet.spacing
      },
      frameCount: sheet.frameCount,
      frames: sheet.frames.map(function (frame) {
        return {
          index: frame.index,
          frameId: frame.frameId,
          name: frame.name,
          x: frame.x,
          y: frame.y,
          width: frame.width,
          height: frame.height,
          durationMs: frame.durationMs
        };
      })
    };
  }

  function defaultCanvasFactory(width, height) {
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(width, height);
    if (typeof document !== "undefined" && document.createElement) {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    throw new Error("PNG export requires OffscreenCanvas or a browser document canvas.");
  }

  async function canvasToBlob(canvas) {
    if (canvas && typeof canvas.convertToBlob === "function") {
      return canvas.convertToBlob({ type: "image/png" });
    }
    if (canvas && typeof canvas.toBlob === "function") {
      return new Promise(function (resolve, reject) {
        try {
          canvas.toBlob(function (blob) {
            if (blob) resolve(blob);
            else reject(new Error("The browser could not encode the sprite sheet as PNG."));
          }, "image/png");
        } catch (error) {
          reject(error);
        }
      });
    }
    throw new Error("This canvas cannot encode PNG images.");
  }

  async function renderSpriteSheetPNG(sheet, options) {
    options = options || {};
    if (!sheet || sheet.format !== FORMAT || !(sheet.rgba instanceof Uint8ClampedArray)) {
      throw new Error("A sprite sheet built by this exporter is required.");
    }
    const canvasFactory = options.canvasFactory || defaultCanvasFactory;
    const canvas = canvasFactory(sheet.width, sheet.height);
    if (!canvas || typeof canvas.getContext !== "function") throw new Error("Canvas factory must return a canvas-like object.");
    const context = canvas.getContext("2d", { alpha: true });
    if (!context || typeof context.createImageData !== "function" || typeof context.putImageData !== "function") {
      throw new Error("A 2D canvas context with ImageData support is required.");
    }
    const imageData = context.createImageData(sheet.width, sheet.height);
    imageData.data.set(sheet.rgba);
    // putImageData writes native pixels directly: no scaling, smoothing or interpolation occurs.
    context.putImageData(imageData, 0, 0);
    const blob = await canvasToBlob(canvas);
    if (!blob || (blob.type && blob.type !== "image/png")) throw new Error("PNG encoder returned an unexpected image type.");
    return blob;
  }

  async function exportSpriteSheet(project, options) {
    options = options || {};
    const sheet = buildSpriteSheet(project, options);
    const blob = await renderSpriteSheetPNG(sheet, options);
    const metadata = buildMetadata(sheet, options.imageFilename);
    return { blob: blob, metadata: metadata, sheet: sheet };
  }

  return Object.freeze({
    FORMAT: FORMAT,
    VERSION: VERSION,
    MAX_EXPORT_PIXELS: MAX_EXPORT_PIXELS,
    MAX_CANVAS_SIDE: MAX_CANVAS_SIDE,
    buildSpriteSheet: buildSpriteSheet,
    buildMetadata: buildMetadata,
    renderSpriteSheetPNG: renderSpriteSheetPNG,
    exportSpriteSheet: exportSpriteSheet
  });
});