/*!
 * One Pixel Studio — export planner
 * Pure, dependency-free preflight planning and JSON manifest generation.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.OnePixelStudioExportPlanner = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PLAN_FORMAT = "one-pixel-studio-export-plan";
  const PLAN_VERSION = 1;
  const PROJECT_FORMAT = "one-pixel-studio";
  const PROJECT_VERSION = 2;
  const MAX_DIMENSION = 512;
  const MAX_FRAMES = 256;
  const MAX_LAYERS = 32;
  const MAX_SOURCE_CEL_PIXELS = 16 * 1024 * 1024;
  const MAX_GIF_TOTAL_FRAME_PIXELS = 1024 * 1024;
  const MAX_GIF_BYTES = 16 * 1024 * 1024;
  const MAX_SPRITE_SHEET_PIXELS = 16 * 1024 * 1024;
  const MAX_SHEET_SIDE = 32767;
  const HEX = /^#[0-9a-fA-F]{6}$/;

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function assertInteger(value, name, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(name + " must be a whole number between " + min + " and " + max + ".");
    }
  }

  function assertUniqueIds(items, label) {
    const ids = new Set();
    for (let index = 0; index < items.length; index += 1) {
      const item = items[index];
      if (!isObject(item) || typeof item.id !== "string" || !item.id || ids.has(item.id)) {
        throw new Error(label + " IDs must be present and unique.");
      }
      ids.add(item.id);
    }
    return ids;
  }

  function validateProject(project) {
    if (!isObject(project)) throw new Error("Project must be an object.");
    if (project.format !== PROJECT_FORMAT || project.version !== PROJECT_VERSION) {
      throw new Error("Export planning requires a version 2 One Pixel Studio project.");
    }
    if (!isObject(project.canvas)) throw new Error("Project canvas settings are missing.");

    const width = project.canvas.width;
    const height = project.canvas.height;
    assertInteger(width, "Canvas width", 1, MAX_DIMENSION);
    assertInteger(height, "Canvas height", 1, MAX_DIMENSION);

    if (!Array.isArray(project.frames) || project.frames.length < 1 || project.frames.length > MAX_FRAMES) {
      throw new Error("Project must contain 1–" + MAX_FRAMES + " frames.");
    }
    if (!Array.isArray(project.layers) || project.layers.length < 1 || project.layers.length > MAX_LAYERS) {
      throw new Error("Project must contain 1–" + MAX_LAYERS + " layers.");
    }
    if (!Array.isArray(project.cels)) throw new Error("Project cels must be an array.");

    const frameIds = assertUniqueIds(project.frames, "Frame");
    const layerIds = assertUniqueIds(project.layers, "Layer");
    for (let index = 0; index < project.frames.length; index += 1) {
      const frame = project.frames[index];
      if (typeof frame.name !== "string" || !frame.name.trim()) throw new Error("Every frame needs a name.");
      assertInteger(frame.durationMs, "Frame duration", 10, 60000);
    }
    for (let index = 0; index < project.layers.length; index += 1) {
      const layer = project.layers[index];
      if (typeof layer.visible !== "boolean") throw new Error("Layer visibility must be boolean.");
    }

    const celKeys = new Set();
    let sourceCelPixels = 0;
    for (let celIndex = 0; celIndex < project.cels.length; celIndex += 1) {
      const cel = project.cels[celIndex];
      if (!isObject(cel) || !layerIds.has(cel.layerId) || !frameIds.has(cel.frameId)) {
        throw new Error("Every cel must reference an existing layer and frame.");
      }
      const key = cel.layerId + "::" + cel.frameId;
      if (celKeys.has(key)) throw new Error("A layer/frame pair cannot contain duplicate cels.");
      celKeys.add(key);
      if (!Array.isArray(cel.pixels) || cel.pixels.length !== width * height) {
        throw new Error("Each cel must contain exactly width × height pixels.");
      }
      sourceCelPixels += cel.pixels.length;
      if (sourceCelPixels > MAX_SOURCE_CEL_PIXELS) {
        throw new Error("Project exceeds the export planner source cel-data safety limit.");
      }
      for (let pixelIndex = 0; pixelIndex < cel.pixels.length; pixelIndex += 1) {
        const color = cel.pixels[pixelIndex];
        if (color !== null && (typeof color !== "string" || !HEX.test(color))) {
          throw new Error("Cel pixels must be transparent or valid #RRGGBB colors.");
        }
      }
    }

    return {
      width: width,
      height: height,
      frameIds: frameIds,
      layerIds: layerIds
    };
  }

  function resolveFrames(project, options, availableFrameIds) {
    const hasFrameIds = options.frameIds !== undefined;
    const hasFrameRange = options.frameRange !== undefined;
    if (hasFrameIds && hasFrameRange) {
      throw new Error("Use either frameIds or frameRange, not both.");
    }

    if (hasFrameIds) {
      if (!Array.isArray(options.frameIds) || options.frameIds.length < 1) {
        throw new Error("Frame IDs must be a non-empty array when provided.");
      }
      const seen = new Set();
      const framesById = new Map(project.frames.map(function (frame) { return [frame.id, frame]; }));
      const frames = options.frameIds.map(function (id) {
        if (typeof id !== "string" || !availableFrameIds.has(id)) {
          throw new Error("Unknown frame ID: " + String(id));
        }
        if (seen.has(id)) throw new Error("Frame IDs cannot contain duplicates.");
        seen.add(id);
        return framesById.get(id);
      });
      return {
        mode: "explicit-order",
        startIndex: null,
        endIndex: null,
        frames: frames
      };
    }

    if (hasFrameRange) {
      const range = options.frameRange;
      if (!isObject(range)) throw new Error("Frame range must be an object with startIndex and endIndex.");
      assertInteger(range.startIndex, "Frame range startIndex", 0, project.frames.length - 1);
      assertInteger(range.endIndex, "Frame range endIndex", 0, project.frames.length - 1);
      if (range.startIndex > range.endIndex) {
        throw new Error("Frame range startIndex cannot be after endIndex.");
      }
      return {
        mode: "inclusive-range",
        startIndex: range.startIndex,
        endIndex: range.endIndex,
        frames: project.frames.slice(range.startIndex, range.endIndex + 1)
      };
    }

    return {
      mode: "all",
      startIndex: null,
      endIndex: null,
      frames: project.frames.slice()
    };
  }

  function diagnosticsForSelection(selection, frameCount) {
    if (selection.mode === "all") return [];
    if (selection.mode === "inclusive-range") {
      return [{
        code: "FRAME_RANGE_SELECTED",
        severity: "info",
        message: "Selected " + frameCount + " frame(s) from inclusive source indexes " +
          selection.startIndex + " through " + selection.endIndex + "."
      }];
    }
    return [{
      code: "EXPLICIT_FRAME_ORDER",
      severity: "info",
      message: "Selected " + frameCount + " frame(s) in the requested explicit order."
    }];
  }

  function buildGifPlan(project, dimensions, selection, options) {
    if (options.layout !== undefined || options.columns !== undefined ||
        options.rows !== undefined || options.margin !== undefined ||
        options.spacing !== undefined || options.backgroundColor !== undefined ||
        options.maxPixels !== undefined) {
      throw new Error("Sprite-sheet layout options cannot be used with GIF planning.");
    }

    const timingPolicy = options.timingPolicy === undefined
      ? "nearest-centisecond"
      : options.timingPolicy;
    if (timingPolicy !== "nearest-centisecond") {
      throw new Error("GIF timingPolicy must be nearest-centisecond.");
    }

    const loopCount = options.loopCount === undefined ? 0 : options.loopCount;
    if (loopCount !== null) assertInteger(loopCount, "Loop count", 0, 65535);

    const pixelsPerFrame = dimensions.width * dimensions.height;
    const totalFramePixels = pixelsPerFrame * selection.frames.length;
    const maxTotalFramePixels = options.maxTotalFramePixels === undefined
      ? MAX_GIF_TOTAL_FRAME_PIXELS
      : options.maxTotalFramePixels;
    assertInteger(maxTotalFramePixels, "Maximum total GIF frame pixels", 1, MAX_GIF_TOTAL_FRAME_PIXELS);
    if (!Number.isSafeInteger(totalFramePixels) || totalFramePixels > maxTotalFramePixels) {
      throw new Error("GIF plan exceeds the selected-frame pixel budget (" + totalFramePixels + ").");
    }

    const estimatedEncodedBytesUpperBound =
      totalFramePixels * 2 + selection.frames.length * 260 + 512;
    const maxBytes = options.maxBytes === undefined ? MAX_GIF_BYTES : options.maxBytes;
    assertInteger(maxBytes, "Maximum GIF bytes", 1024, MAX_GIF_BYTES);
    if (estimatedEncodedBytesUpperBound > maxBytes) {
      throw new Error("GIF plan exceeds the encoded-byte budget estimate (" +
        estimatedEncodedBytesUpperBound + " bytes).");
    }

    const frames = selection.frames.map(function (frame, index) {
      const delayCentiseconds = Math.max(1, Math.round(frame.durationMs / 10));
      return {
        index: index,
        frameId: frame.id,
        name: frame.name,
        durationMs: frame.durationMs,
        encodedDelayCentiseconds: delayCentiseconds,
        effectiveDurationMs: delayCentiseconds * 10,
        x: 0,
        y: 0,
        width: dimensions.width,
        height: dimensions.height
      };
    });

    const diagnostics = diagnosticsForSelection(selection, frames.length);
    if (frames.some(function (frame) { return frame.effectiveDurationMs !== frame.durationMs; })) {
      diagnostics.push({
        code: "GIF_TIMING_ROUNDED",
        severity: "info",
        message: "GIF frame delays use 10 ms centisecond units and are rounded to the nearest unit."
      });
    }
    diagnostics.push({
      code: loopCount === null ? "PLAY_ONCE" : (loopCount === 0 ? "INFINITE_LOOP" : "FINITE_LOOP"),
      severity: "info",
      message: loopCount === null
        ? "The GIF will omit the looping extension and play once."
        : (loopCount === 0 ? "The GIF will loop indefinitely." : "The GIF will use a repeat count of " + loopCount + ".")
    });
    diagnostics.push({
      code: "GIF_SIZE_ESTIMATE",
      severity: "info",
      message: "Estimated GIF data upper bound is " + estimatedEncodedBytesUpperBound + " bytes; actual LZW size depends on pixel repetition."
    });

    return {
      format: PLAN_FORMAT,
      version: PLAN_VERSION,
      outputFormat: "gif",
      projectId: typeof project.id === "string" ? project.id : null,
      selection: {
        mode: selection.mode,
        startIndex: selection.startIndex,
        endIndex: selection.endIndex,
        frameIds: frames.map(function (frame) { return frame.frameId; })
      },
      timing: {
        policy: timingPolicy,
        loopCount: loopCount,
        loopBehavior: loopCount === null ? "play-once" : (loopCount === 0 ? "infinite" : "finite-repeat")
      },
      layout: null,
      output: {
        width: dimensions.width,
        height: dimensions.height,
        frameWidth: dimensions.width,
        frameHeight: dimensions.height,
        frameCount: frames.length,
        pixelsPerFrame: pixelsPerFrame,
        totalFramePixels: totalFramePixels,
        outputPixels: totalFramePixels,
        rgbaBufferBytes: totalFramePixels * 4,
        indexedBufferBytes: totalFramePixels,
        estimatedEncodedBytesUpperBound: estimatedEncodedBytesUpperBound,
        maxTotalFramePixels: maxTotalFramePixels,
        maxEncodedBytes: maxBytes
      },
      frames: frames,
      diagnostics: diagnostics
    };
  }

  function buildSpriteSheetPlan(project, dimensions, selection, options) {
    if (options.loopCount !== undefined || options.maxTotalFramePixels !== undefined || options.maxBytes !== undefined) {
      throw new Error("GIF loop and output-byte options cannot be used with sprite-sheet planning.");
    }
    const timingPolicy = options.timingPolicy === undefined ? "preserve-source-ms" : options.timingPolicy;
    if (timingPolicy !== "preserve-source-ms") {
      throw new Error("Sprite-sheet timingPolicy must be preserve-source-ms.");
    }

    const layoutType = options.layout === undefined ? "horizontal" : options.layout;
    if (!["horizontal", "vertical", "grid"].includes(layoutType)) {
      throw new Error("Layout must be horizontal, vertical or grid.");
    }
    const margin = options.margin === undefined ? 0 : options.margin;
    const spacing = options.spacing === undefined ? 0 : options.spacing;
    assertInteger(margin, "Margin", 0, 4096);
    assertInteger(spacing, "Spacing", 0, 4096);

    let columns;
    let rows;
    if (layoutType === "horizontal") {
      if (options.rows !== undefined || options.columns !== undefined) {
        throw new Error("Grid rows and columns can only be specified when layout is grid.");
      }
      columns = selection.frames.length;
      rows = 1;
    } else if (layoutType === "vertical") {
      if (options.rows !== undefined || options.columns !== undefined) {
        throw new Error("Grid rows and columns can only be specified when layout is grid.");
      }
      columns = 1;
      rows = selection.frames.length;
    } else {
      const requestedColumns = options.columns;
      const requestedRows = options.rows;
      if (requestedColumns !== undefined) assertInteger(requestedColumns, "Grid columns", 1, selection.frames.length);
      if (requestedRows !== undefined) assertInteger(requestedRows, "Grid rows", 1, selection.frames.length);
      if (requestedColumns !== undefined && requestedRows !== undefined) {
        if (requestedColumns * requestedRows < selection.frames.length) {
          throw new Error("Grid rows × columns must provide at least one cell for every selected frame.");
        }
        columns = requestedColumns;
        rows = requestedRows;
      } else if (requestedColumns !== undefined) {
        columns = requestedColumns;
        rows = Math.ceil(selection.frames.length / columns);
      } else if (requestedRows !== undefined) {
        rows = requestedRows;
        columns = Math.ceil(selection.frames.length / rows);
      } else {
        columns = Math.ceil(Math.sqrt(selection.frames.length));
        rows = Math.ceil(selection.frames.length / columns);
      }
    }

    const sheetWidth = margin * 2 + columns * dimensions.width + Math.max(0, columns - 1) * spacing;
    const sheetHeight = margin * 2 + rows * dimensions.height + Math.max(0, rows - 1) * spacing;
    if (sheetWidth > MAX_SHEET_SIDE || sheetHeight > MAX_SHEET_SIDE) {
      throw new Error("Sprite-sheet plan exceeds the safe side limit of " + MAX_SHEET_SIDE + " pixels.");
    }
    const outputPixels = sheetWidth * sheetHeight;
    const maxPixels = options.maxPixels === undefined ? MAX_SPRITE_SHEET_PIXELS : options.maxPixels;
    assertInteger(maxPixels, "Maximum sprite-sheet pixels", 1, MAX_SPRITE_SHEET_PIXELS);
    if (!Number.isSafeInteger(outputPixels) || outputPixels > maxPixels) {
      throw new Error("Sprite-sheet plan exceeds the output pixel budget (" + outputPixels + ").");
    }

    const backgroundColor = options.backgroundColor === undefined ? null : options.backgroundColor;
    if (backgroundColor !== null && (typeof backgroundColor !== "string" || !HEX.test(backgroundColor))) {
      throw new Error("Background color must be null or a valid #RRGGBB color.");
    }

    const frameWidth = dimensions.width;
    const frameHeight = dimensions.height;
    const frames = selection.frames.map(function (frame, index) {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        index: index,
        frameId: frame.id,
        name: frame.name,
        durationMs: frame.durationMs,
        x: margin + column * (frameWidth + spacing),
        y: margin + row * (frameHeight + spacing),
        width: frameWidth,
        height: frameHeight
      };
    });
    const unusedCells = columns * rows - frames.length;
    const layout = {
      type: layoutType,
      columns: columns,
      rows: rows,
      margin: margin,
      spacing: spacing,
      backgroundColor: backgroundColor,
      unusedCells: unusedCells
    };

    const diagnostics = diagnosticsForSelection(selection, frames.length);
    if (unusedCells > 0) {
      diagnostics.push({
        code: "GRID_UNUSED_CELLS",
        severity: "info",
        message: "The selected frame count leaves " + unusedCells + " unused cell(s) in the configured grid."
      });
    }
    diagnostics.push({
      code: "SPRITE_SHEET_SIZE_ESTIMATE",
      severity: "info",
      message: "The RGBA output buffer requires " + (outputPixels * 4) + " bytes before PNG encoding."
    });

    return {
      format: PLAN_FORMAT,
      version: PLAN_VERSION,
      outputFormat: "sprite-sheet",
      projectId: typeof project.id === "string" ? project.id : null,
      selection: {
        mode: selection.mode,
        startIndex: selection.startIndex,
        endIndex: selection.endIndex,
        frameIds: frames.map(function (frame) { return frame.frameId; })
      },
      timing: {
        policy: timingPolicy,
        loopCount: null,
        loopBehavior: "not-applicable"
      },
      layout: layout,
      output: {
        width: sheetWidth,
        height: sheetHeight,
        frameWidth: frameWidth,
        frameHeight: frameHeight,
        frameCount: frames.length,
        pixelsPerFrame: frameWidth * frameHeight,
        totalFramePixels: frameWidth * frameHeight * frames.length,
        outputPixels: outputPixels,
        rgbaBufferBytes: outputPixels * 4,
        indexedBufferBytes: null,
        estimatedEncodedBytesUpperBound: null,
        maxOutputPixels: maxPixels
      },
      frames: frames,
      diagnostics: diagnostics
    };
  }

  function buildExportPlan(project, options) {
    options = options || {};
    if (!isObject(options)) throw new Error("Export options must be an object.");
    const dimensions = validateProject(project);
    const selection = resolveFrames(project, options, dimensions.frameIds);
    const format = options.format;
    if (format === "gif") return buildGifPlan(project, dimensions, selection, options);
    if (format === "sprite-sheet") return buildSpriteSheetPlan(project, dimensions, selection, options);
    throw new Error("Export format must be gif or sprite-sheet.");
  }

  function serializeExportPlan(plan) {
    if (!isObject(plan) || plan.format !== PLAN_FORMAT || plan.version !== PLAN_VERSION ||
        !Array.isArray(plan.frames) || !Array.isArray(plan.diagnostics) ||
        !isObject(plan.output) || !isObject(plan.selection)) {
      throw new Error("A version 1 export plan created by this module is required.");
    }
    return JSON.stringify(plan);
  }

  return Object.freeze({
    FORMAT: PLAN_FORMAT,
    VERSION: PLAN_VERSION,
    MAX_GIF_TOTAL_FRAME_PIXELS: MAX_GIF_TOTAL_FRAME_PIXELS,
    MAX_GIF_BYTES: MAX_GIF_BYTES,
    MAX_SPRITE_SHEET_PIXELS: MAX_SPRITE_SHEET_PIXELS,
    buildExportPlan: buildExportPlan,
    serializeExportPlan: serializeExportPlan
  });
});
