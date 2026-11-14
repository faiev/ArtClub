/*!
 * One Pixel Studio — deterministic palette analysis utilities.
 * Browser-global + CommonJS; pure analysis only, no project mutation.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPaletteTools = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HEX = /^#[0-9a-f]{6}$/i;
  const LIMITS = Object.freeze({
    maxDimension: 512,
    maxLayers: 32,
    maxFrames: 256,
    maxPaletteColors: 256,
    maxCelPixels: 16777216
  });

  function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function normalizeHex(value, label) {
    if (typeof value !== "string" || !HEX.test(value)) {
      throw new Error((label || "Color") + " must be a six-digit HEX color such as #A1B2C3.");
    }
    return value.toUpperCase();
  }

  function assertDenseArray(array, length, label) {
    if (!Array.isArray(array) || array.length !== length) {
      throw new Error(label + " must contain exactly " + length + " entries.");
    }
    for (let i = 0; i < length; i += 1) {
      if (!Object.prototype.hasOwnProperty.call(array, i)) {
        throw new Error(label + " cannot contain sparse or missing entries.");
      }
    }
  }

  function validateProject(project) {
    if (!isObject(project)) throw new Error("Project must be an object.");
    if (project.format !== "one-pixel-studio" || project.version !== 2) {
      throw new Error("Palette analysis requires a version 2 One Pixel Studio project.");
    }
    if (!isObject(project.canvas)) throw new Error("Project canvas is missing.");
    const width = project.canvas.width;
    const height = project.canvas.height;
    if (!Number.isInteger(width) || width < 1 || width > LIMITS.maxDimension ||
        !Number.isInteger(height) || height < 1 || height > LIMITS.maxDimension) {
      throw new Error("Project canvas dimensions must be integers between 1 and " + LIMITS.maxDimension + ".");
    }
    if (!Array.isArray(project.palette) || project.palette.length < 1 || project.palette.length > LIMITS.maxPaletteColors) {
      throw new Error("Project palette must contain 1–" + LIMITS.maxPaletteColors + " colors.");
    }
    assertDenseArray(project.palette, project.palette.length, "Project palette");
    const palette = project.palette.map((color, index) => normalizeHex(color, "Palette color " + index));

    if (!Array.isArray(project.layers) || project.layers.length < 1 || project.layers.length > LIMITS.maxLayers) {
      throw new Error("Project must contain 1–" + LIMITS.maxLayers + " layers.");
    }
    assertDenseArray(project.layers, project.layers.length, "Project layers");
    const layerIds = new Set();
    project.layers.forEach((layer, index) => {
      if (!isObject(layer) || typeof layer.id !== "string" || !layer.id || layerIds.has(layer.id)) {
        throw new Error("Layer " + index + " must have a unique non-empty ID.");
      }
      if (typeof layer.name !== "string" || !layer.name.trim()) throw new Error("Layer " + layer.id + " must have a name.");
      if (typeof layer.visible !== "boolean") throw new Error("Layer " + layer.id + " must have a boolean visibility flag.");
      layerIds.add(layer.id);
    });

    if (!Array.isArray(project.frames) || project.frames.length < 1 || project.frames.length > LIMITS.maxFrames) {
      throw new Error("Project must contain 1–" + LIMITS.maxFrames + " frames.");
    }
    assertDenseArray(project.frames, project.frames.length, "Project frames");
    const frameIds = new Set();
    project.frames.forEach((frame, index) => {
      if (!isObject(frame) || typeof frame.id !== "string" || !frame.id || frameIds.has(frame.id)) {
        throw new Error("Frame " + index + " must have a unique non-empty ID.");
      }
      if (typeof frame.name !== "string" || !frame.name.trim()) throw new Error("Frame " + frame.id + " must have a name.");
      frameIds.add(frame.id);
    });

    if (!Array.isArray(project.cels)) throw new Error("Project cels must be an array.");
    assertDenseArray(project.cels, project.cels.length, "Project cels");
    const expectedPixels = width * height;
    const celKeys = new Set();
    let totalCelPixels = 0;
    project.cels.forEach((cel, index) => {
      if (!isObject(cel) || !layerIds.has(cel.layerId) || !frameIds.has(cel.frameId)) {
        throw new Error("Cel " + index + " must reference an existing layer and frame.");
      }
      const key = cel.layerId + "\u0000" + cel.frameId;
      if (celKeys.has(key)) throw new Error("A layer/frame pair cannot contain duplicate cels.");
      celKeys.add(key);
      assertDenseArray(cel.pixels, expectedPixels, "Cel " + index + " pixels");
      totalCelPixels += cel.pixels.length;
      if (totalCelPixels > LIMITS.maxCelPixels) {
        throw new Error("Project exceeds the safe pixel-data analysis limit.");
      }
      cel.pixels.forEach((pixel, pixelIndex) => {
        if (pixel !== null) normalizeHex(pixel, "Cel " + index + " pixel " + pixelIndex);
      });
    });

    return {
      width: width,
      height: height,
      palette: palette,
      paletteRaw: project.palette.slice(),
      layers: project.layers,
      frames: project.frames,
      cels: project.cels,
      expectedPixels: expectedPixels,
      totalCelPixels: totalCelPixels
    };
  }

  function resolveScope(model, options) {
    options = options === undefined ? {} : options;
    if (!isObject(options)) throw new Error("Analysis options must be an object.");

    const includeHiddenLayers = options.includeHiddenLayers === undefined ? false : options.includeHiddenLayers;
    if (typeof includeHiddenLayers !== "boolean") {
      throw new Error("includeHiddenLayers must be true or false.");
    }

    if (options.frameId !== undefined && options.frameIds !== undefined) {
      throw new Error("Use frameId or frameIds, not both.");
    }
    let requestedFrames = null;
    if (options.frameId !== undefined) {
      if (typeof options.frameId !== "string" || !model.frames.some(frame => frame.id === options.frameId)) {
        throw new Error("Requested frameId does not exist.");
      }
      requestedFrames = new Set([options.frameId]);
    } else if (options.frameIds !== undefined) {
      if (!Array.isArray(options.frameIds)) throw new Error("frameIds must be an array of frame IDs.");
      requestedFrames = new Set();
      options.frameIds.forEach(id => {
        if (typeof id !== "string" || !model.frames.some(frame => frame.id === id)) {
          throw new Error("Every requested frameId must exist in the project.");
        }
        if (requestedFrames.has(id)) throw new Error("frameIds cannot contain duplicates.");
        requestedFrames.add(id);
      });
    }

    let requestedLayers = null;
    if (options.layerIds !== undefined) {
      if (!Array.isArray(options.layerIds)) throw new Error("layerIds must be an array of layer IDs.");
      requestedLayers = new Set();
      options.layerIds.forEach(id => {
        if (typeof id !== "string" || !model.layers.some(layer => layer.id === id)) {
          throw new Error("Every requested layerId must exist in the project.");
        }
        if (requestedLayers.has(id)) throw new Error("layerIds cannot contain duplicates.");
        requestedLayers.add(id);
      });
    }

    // Always preserve the project's own ordering, independent of option-array order.
    const frames = model.frames.filter(frame => !requestedFrames || requestedFrames.has(frame.id));
    const layers = model.layers.filter(layer =>
      (!requestedLayers || requestedLayers.has(layer.id)) && (includeHiddenLayers || layer.visible)
    );
    return {
      includeHiddenLayers: includeHiddenLayers,
      frameIds: frames.map(frame => frame.id),
      layerIds: layers.map(layer => layer.id),
      frames: frames,
      layers: layers
    };
  }

  function paletteGroups(paletteRaw, paletteNormalized) {
    const groups = new Map();
    paletteNormalized.forEach((color, index) => {
      if (!groups.has(color)) groups.set(color, { color: color, indices: [], rawColors: [] });
      const group = groups.get(color);
      group.indices.push(index);
      group.rawColors.push(paletteRaw[index]);
    });
    return Array.from(groups.values());
  }

  function scanProject(project, options) {
    const model = validateProject(project);
    const scope = resolveScope(model, options);
    const colorCounts = new Map();
    const groups = paletteGroups(model.paletteRaw, model.palette);

    // Seed palette colors in palette order so unused colors are still reported as zero.
    groups.forEach(group => {
      colorCounts.set(group.color, {
        color: group.color,
        count: 0,
        paletteIndices: group.indices.slice(),
        inPalette: true
      });
    });

    const celMap = new Map();
    model.cels.forEach(cel => celMap.set(cel.layerId + "\u0000" + cel.frameId, cel));
    let totalPixels = 0;
    let transparentPixels = 0;
    let opaquePixels = 0;
    let storedCelCount = 0;
    let missingCelCount = 0;
    const selectedCels = [];

    scope.layers.forEach(layer => {
      scope.frames.forEach(frame => {
        const cel = celMap.get(layer.id + "\u0000" + frame.id);
        if (!cel) {
          missingCelCount += 1;
          return;
        }
        storedCelCount += 1;
        selectedCels.push({ layer: layer, frame: frame, cel: cel });
        totalPixels += cel.pixels.length;
        cel.pixels.forEach(pixel => {
          if (pixel === null) {
            transparentPixels += 1;
            return;
          }
          opaquePixels += 1;
          const color = pixel.toUpperCase();
          let record = colorCounts.get(color);
          if (!record) {
            record = { color: color, count: 0, paletteIndices: [], inPalette: false };
            colorCounts.set(color, record);
          }
          record.count += 1;
        });
      });
    });

    const colorUsage = Array.from(colorCounts.values());
    const unusedColors = groups.filter(group => colorCounts.get(group.color).count === 0).map(group => ({
      color: group.color,
      paletteIndices: group.indices.slice(),
      rawColors: group.rawColors.slice()
    }));
    const duplicateColors = groups.filter(group => group.indices.length > 1).map(group => ({
      color: group.color,
      paletteIndices: group.indices.slice(),
      rawColors: group.rawColors.slice(),
      caseVariant: new Set(group.rawColors).size > 1,
      duplicateEntryCount: group.indices.length - 1
    }));
    const unlistedColors = colorUsage.filter(record => !record.inPalette && record.count > 0).map(record => ({
      color: record.color,
      count: record.count
    }));
    const uniquePaletteColors = groups.length;
    const usedPaletteColors = groups.filter(group => colorCounts.get(group.color).count > 0).length;
    const colorCoverage = uniquePaletteColors === 0 ? null : usedPaletteColors / uniquePaletteColors;
    const summary = {
      paletteLength: model.palette.length,
      uniquePaletteColorCount: uniquePaletteColors,
      duplicatePaletteEntryCount: duplicateColors.reduce((sum, group) => sum + group.duplicateEntryCount, 0),
      usedPaletteColorCount: usedPaletteColors,
      unusedPaletteColorCount: unusedColors.length,
      colorCoverage: colorCoverage,
      colorCoveragePercent: colorCoverage === null ? null : colorCoverage * 100,
      uniqueUsedColorCount: colorUsage.filter(record => record.count > 0).length,
      unlistedUsedColorCount: unlistedColors.length,
      totalPixels: totalPixels,
      opaquePixels: opaquePixels,
      transparentPixels: transparentPixels,
      transparencyRatio: totalPixels === 0 ? null : transparentPixels / totalPixels,
      transparencyPercent: totalPixels === 0 ? null : transparentPixels / totalPixels * 100,
      storedCelCount: storedCelCount,
      missingCelCount: missingCelCount,
      selectedCelSlotCount: scope.layers.length * scope.frames.length
    };

    return {
      scope: {
        includeHiddenLayers: scope.includeHiddenLayers,
        layerIds: scope.layerIds.slice(),
        frameIds: scope.frameIds.slice()
      },
      colorUsage: colorUsage,
      unusedColors: unusedColors,
      duplicateColors: duplicateColors,
      unlistedColors: unlistedColors,
      summary: summary,
      selectedCels: selectedCels,
      model: model
    };
  }

  function countColorUsage(project, options) {
    const report = scanProject(project, options);
    return {
      scope: report.scope,
      colors: report.colorUsage.map(record => ({
        color: record.color,
        count: record.count,
        paletteIndices: record.paletteIndices.slice(),
        inPalette: record.inPalette
      })),
      totalPixels: report.summary.totalPixels,
      opaquePixels: report.summary.opaquePixels,
      transparentPixels: report.summary.transparentPixels,
      storedCelCount: report.summary.storedCelCount,
      missingCelCount: report.summary.missingCelCount,
      selectedCelSlotCount: report.summary.selectedCelSlotCount
    };
  }

  function analyzePalette(project, options) {
    const report = scanProject(project, options);
    return {
      scope: report.scope,
      colorUsage: report.colorUsage.map(record => ({
        color: record.color,
        count: record.count,
        paletteIndices: record.paletteIndices.slice(),
        inPalette: record.inPalette
      })),
      unusedColors: report.unusedColors,
      duplicateColors: report.duplicateColors,
      unlistedColors: report.unlistedColors,
      summary: report.summary
    };
  }

  function summarizePalette(project, options) {
    const report = scanProject(project, options);
    return { scope: report.scope, summary: report.summary };
  }

  function rgbChannels(hex) {
    const normalized = normalizeHex(hex);
    return [
      parseInt(normalized.slice(1, 3), 16),
      parseInt(normalized.slice(3, 5), 16),
      parseInt(normalized.slice(5, 7), 16)
    ];
  }

  function findNearestColor(targetColor, palette) {
    const target = rgbChannels(targetColor);
    if (!Array.isArray(palette) || palette.length < 1 || palette.length > LIMITS.maxPaletteColors) {
      throw new Error("Palette must contain 1–" + LIMITS.maxPaletteColors + " colors.");
    }
    assertDenseArray(palette, palette.length, "Palette");
    let best = null;
    palette.forEach((rawColor, index) => {
      const color = normalizeHex(rawColor, "Palette color " + index);
      const channels = rgbChannels(color);
      const dr = target[0] - channels[0];
      const dg = target[1] - channels[1];
      const db = target[2] - channels[2];
      const distanceSquared = dr * dr + dg * dg + db * db;
      // Strictly smaller keeps the earliest palette index on equal distances.
      if (!best || distanceSquared < best.distanceSquared) {
        best = { color: color, index: index, distanceSquared: distanceSquared };
      }
    });
    best.distance = Math.sqrt(best.distanceSquared);
    best.metric = "rgb-euclidean";
    return best;
  }

  function estimateReplacementImpact(project, fromColor, toColor, options) {
    const from = normalizeHex(fromColor, "Source color");
    const to = normalizeHex(toColor, "Replacement color");
    const report = scanProject(project, options);
    const model = report.model;
    const impacts = [];
    const layerTotals = new Map();
    const frameTotals = new Map();
    let matchedPixels = 0;

    report.selectedCels.forEach(({ layer, frame, cel }) => {
      let count = 0;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -1;
      let maxY = -1;
      cel.pixels.forEach((pixel, index) => {
        if (pixel === null || pixel.toUpperCase() !== from) return;
        count += 1;
        const x = index % model.width;
        const y = Math.floor(index / model.width);
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      });
      if (!count) return;
      matchedPixels += count;
      impacts.push({
        layerId: layer.id,
        layerName: layer.name,
        frameId: frame.id,
        frameName: frame.name,
        matchedPixels: count,
        bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      });
      layerTotals.set(layer.id, (layerTotals.get(layer.id) || 0) + count);
      frameTotals.set(frame.id, (frameTotals.get(frame.id) || 0) + count);
    });

    const paletteSourceIndices = [];
    const paletteTargetIndices = [];
    model.palette.forEach((color, index) => {
      if (color === from) paletteSourceIndices.push(index);
      if (color === to) paletteTargetIndices.push(index);
    });
    return {
      fromColor: from,
      toColor: to,
      isNoOp: from === to,
      matchedPixels: matchedPixels,
      changedPixels: from === to ? 0 : matchedPixels,
      affectedCelCount: impacts.length,
      affectedLayerCount: layerTotals.size,
      affectedFrameCount: frameTotals.size,
      paletteSourceIndices: paletteSourceIndices,
      paletteTargetIndices: paletteTargetIndices,
      replacementAlreadyInPalette: paletteTargetIndices.length > 0,
      targetColorIsUnlisted: paletteTargetIndices.length === 0,
      impactsByCel: impacts,
      impactsByLayer: report.scope.layerIds.filter(id => layerTotals.has(id)).map(id => ({
        layerId: id,
        layerName: model.layers.find(layer => layer.id === id).name,
        matchedPixels: layerTotals.get(id)
      })),
      impactsByFrame: report.scope.frameIds.filter(id => frameTotals.has(id)).map(id => ({
        frameId: id,
        frameName: model.frames.find(frame => frame.id === id).name,
        matchedPixels: frameTotals.get(id)
      })),
      scope: report.scope
    };
  }

  return Object.freeze({
    LIMITS: LIMITS,
    normalizeHex: normalizeHex,
    countColorUsage: countColorUsage,
    analyzePalette: analyzePalette,
    summarizePalette: summarizePalette,
    findNearestColor: findNearestColor,
    estimateReplacementImpact: estimateReplacementImpact
  });
});
