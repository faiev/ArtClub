/*!
 * One Pixel Studio — deterministic palette extraction and project mapping.
 * Browser-global + CommonJS; previews and applies only to returned project copies.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPaletteMapping = api;
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

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function normalizeHex(value, label) {
    if (typeof value !== "string" || !HEX.test(value)) {
      throw new Error((label || "Color") + " must be a six-digit HEX value such as #A1B2C3.");
    }
    return value.toUpperCase();
  }

  function assertDense(array, label) {
    if (!Array.isArray(array)) throw new Error(label + " must be an array.");
    for (let index = 0; index < array.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(array, index)) {
        throw new Error(label + " cannot contain sparse or missing entries.");
      }
    }
  }

  function cloneJson(value, seen) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Project data numbers must be finite.");
      return value;
    }
    if (Array.isArray(value)) {
      assertDense(value, "Project data array");
      if (seen.has(value)) throw new Error("Project data cannot contain circular references.");
      seen.add(value);
      const output = value.map(item => cloneJson(item, seen));
      seen.delete(value);
      return output;
    }
    if (isPlainObject(value)) {
      if (seen.has(value)) throw new Error("Project data cannot contain circular references.");
      seen.add(value);
      const output = {};
      Object.keys(value).forEach(key => {
        if (value[key] === undefined || typeof value[key] === "function" || typeof value[key] === "symbol" || typeof value[key] === "bigint") {
          throw new Error("Project data must contain JSON-compatible values only.");
        }
        output[key] = cloneJson(value[key], seen);
      });
      seen.delete(value);
      return output;
    }
    throw new Error("Project data must contain JSON-compatible values only.");
  }

  function clone(value) {
    return cloneJson(value, new Set());
  }

  function validateProject(project) {
    if (!isPlainObject(project) || project.format !== "one-pixel-studio" || project.version !== 2) {
      throw new Error("Palette mapping requires a version 2 One Pixel Studio project.");
    }
    if (!isPlainObject(project.canvas)) throw new Error("Project canvas is missing.");
    const width = project.canvas.width;
    const height = project.canvas.height;
    if (!Number.isInteger(width) || width < 1 || width > LIMITS.maxDimension ||
        !Number.isInteger(height) || height < 1 || height > LIMITS.maxDimension) {
      throw new Error("Canvas width and height must be integers from 1 to " + LIMITS.maxDimension + ".");
    }
    if (!Array.isArray(project.palette) || project.palette.length < 1 || project.palette.length > LIMITS.maxPaletteColors) {
      throw new Error("Project palette must contain 1–" + LIMITS.maxPaletteColors + " colors.");
    }
    assertDense(project.palette, "Project palette");
    const palette = project.palette.map((color, index) => normalizeHex(color, "Project palette color " + index));

    if (!Array.isArray(project.layers) || project.layers.length < 1 || project.layers.length > LIMITS.maxLayers) {
      throw new Error("Project must contain 1–" + LIMITS.maxLayers + " layers.");
    }
    assertDense(project.layers, "Project layers");
    const layers = [];
    const layerIds = new Set();
    project.layers.forEach((layer, index) => {
      if (!isPlainObject(layer) || typeof layer.id !== "string" || !layer.id || layerIds.has(layer.id)) {
        throw new Error("Layer " + index + " must have a unique non-empty ID.");
      }
      if (typeof layer.name !== "string" || !layer.name.trim() || typeof layer.visible !== "boolean") {
        throw new Error("Layer " + layer.id + " must have a name and boolean visibility flag.");
      }
      layerIds.add(layer.id);
      layers.push({ id: layer.id, name: layer.name, visible: layer.visible });
    });

    if (!Array.isArray(project.frames) || project.frames.length < 1 || project.frames.length > LIMITS.maxFrames) {
      throw new Error("Project must contain 1–" + LIMITS.maxFrames + " frames.");
    }
    assertDense(project.frames, "Project frames");
    const frames = [];
    const frameIds = new Set();
    project.frames.forEach((frame, index) => {
      if (!isPlainObject(frame) || typeof frame.id !== "string" || !frame.id || frameIds.has(frame.id)) {
        throw new Error("Frame " + index + " must have a unique non-empty ID.");
      }
      if (typeof frame.name !== "string" || !frame.name.trim()) throw new Error("Frame " + frame.id + " must have a name.");
      frameIds.add(frame.id);
      frames.push({ id: frame.id, name: frame.name });
    });

    if (!Array.isArray(project.cels)) throw new Error("Project cels must be an array.");
    assertDense(project.cels, "Project cels");
    const expectedPixels = width * height;
    let totalCelPixels = 0;
    const celMap = new Map();
    project.cels.forEach((cel, celIndex) => {
      if (!isPlainObject(cel) || !layerIds.has(cel.layerId) || !frameIds.has(cel.frameId)) {
        throw new Error("Cel " + celIndex + " must reference an existing layer and frame.");
      }
      const key = cel.layerId + "\u0000" + cel.frameId;
      if (celMap.has(key)) throw new Error("A layer/frame pair cannot contain duplicate cels.");
      if (!Array.isArray(cel.pixels) || cel.pixels.length !== expectedPixels) {
        throw new Error("Cel " + celIndex + " must contain exactly width × height pixels.");
      }
      assertDense(cel.pixels, "Cel " + celIndex + " pixels");
      totalCelPixels += cel.pixels.length;
      if (totalCelPixels > LIMITS.maxCelPixels) throw new Error("Project exceeds the safe " + LIMITS.maxCelPixels + "-pixel limit.");
      cel.pixels.forEach((pixel, pixelIndex) => {
        if (pixel !== null) normalizeHex(pixel, "Cel " + celIndex + " pixel " + pixelIndex);
      });
      celMap.set(key, cel);
    });

    return {
      width: width,
      height: height,
      palette: palette,
      layers: layers,
      frames: frames,
      cels: project.cels,
      celMap: celMap,
      expectedPixels: expectedPixels,
      totalCelPixels: totalCelPixels
    };
  }

  function resolveScope(model, options) {
    options = options === undefined ? {} : options;
    if (!isPlainObject(options)) throw new Error("Scope options must be an object.");
    const includeHiddenLayers = options.includeHiddenLayers === undefined ? false : options.includeHiddenLayers;
    if (typeof includeHiddenLayers !== "boolean") throw new Error("includeHiddenLayers must be true or false.");
    if (options.frameId !== undefined && options.frameIds !== undefined) throw new Error("Use frameId or frameIds, not both.");
    let frameSet = null;
    if (options.frameId !== undefined) {
      if (typeof options.frameId !== "string" || !model.frames.some(frame => frame.id === options.frameId)) throw new Error("frameId does not exist.");
      frameSet = new Set([options.frameId]);
    } else if (options.frameIds !== undefined) {
      if (!Array.isArray(options.frameIds)) throw new Error("frameIds must be an array.");
      assertDense(options.frameIds, "frameIds");
      frameSet = new Set();
      options.frameIds.forEach(id => {
        if (typeof id !== "string" || !model.frames.some(frame => frame.id === id)) throw new Error("Every frameId must exist.");
        if (frameSet.has(id)) throw new Error("frameIds cannot contain duplicates.");
        frameSet.add(id);
      });
    }
    let layerSet = null;
    if (options.layerIds !== undefined) {
      if (!Array.isArray(options.layerIds)) throw new Error("layerIds must be an array.");
      assertDense(options.layerIds, "layerIds");
      layerSet = new Set();
      options.layerIds.forEach(id => {
        if (typeof id !== "string" || !model.layers.some(layer => layer.id === id)) throw new Error("Every layerId must exist.");
        if (layerSet.has(id)) throw new Error("layerIds cannot contain duplicates.");
        layerSet.add(id);
      });
    }
    return {
      includeHiddenLayers: includeHiddenLayers,
      layers: model.layers.filter(layer => (!layerSet || layerSet.has(layer.id)) && (includeHiddenLayers || layer.visible)),
      frames: model.frames.filter(frame => !frameSet || frameSet.has(frame.id))
    };
  }

  function rgbChannels(hex) {
    const value = normalizeHex(hex).slice(1);
    return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
  }

  function colorDistanceSquared(first, second) {
    const a = rgbChannels(first);
    const b = rgbChannels(second);
    const dr = a[0] - b[0];
    const dg = a[1] - b[1];
    const db = a[2] - b[2];
    return dr * dr + dg * dg + db * db;
  }

  function extractUsedColors(project, options) {
    const model = validateProject(project);
    const scope = resolveScope(model, options);
    const paletteFirstIndex = new Map();
    model.palette.forEach((color, index) => { if (!paletteFirstIndex.has(color)) paletteFirstIndex.set(color, index); });
    const usage = new Map();
    const perCel = [];
    let totalPixels = 0;
    let transparentPixels = 0;
    let storedCels = 0;
    let missingCels = 0;

    scope.layers.forEach(layer => {
      scope.frames.forEach(frame => {
        const cel = model.celMap.get(layer.id + "\u0000" + frame.id);
        if (!cel) { missingCels += 1; return; }
        storedCels += 1;
        totalPixels += cel.pixels.length;
        const celCounts = new Map();
        cel.pixels.forEach((pixel, pixelIndex) => {
          if (pixel === null) { transparentPixels += 1; return; }
          const color = pixel.toUpperCase();
          let record = usage.get(color);
          if (!record) {
            record = { hex: color, count: 0, paletteIndex: paletteFirstIndex.has(color) ? paletteFirstIndex.get(color) : null, firstOccurrence: null };
            usage.set(color, record);
          }
          record.count += 1;
          if (record.firstOccurrence === null) {
            record.firstOccurrence = {
              layerId: layer.id,
              layerName: layer.name,
              frameId: frame.id,
              frameName: frame.name,
              celIndex: model.cels.indexOf(cel),
              pixelIndex: pixelIndex,
              x: pixelIndex % model.width,
              y: Math.floor(pixelIndex / model.width)
            };
          }
          celCounts.set(color, (celCounts.get(color) || 0) + 1);
        });
        perCel.push({
          layerId: layer.id,
          layerName: layer.name,
          frameId: frame.id,
          frameName: frame.name,
          usedColorCount: celCounts.size,
          pixelCount: cel.pixels.length,
          transparentPixels: cel.pixels.filter(pixel => pixel === null).length
        });
      });
    });

    return {
      colors: Array.from(usage.values()),
      scope: {
        includeHiddenLayers: scope.includeHiddenLayers,
        layerIds: scope.layers.map(layer => layer.id),
        frameIds: scope.frames.map(frame => frame.id)
      },
      summary: {
        uniqueUsedColorCount: usage.size,
        totalPixels: totalPixels,
        transparentPixels: transparentPixels,
        opaquePixels: totalPixels - transparentPixels,
        transparencyRatio: totalPixels === 0 ? null : transparentPixels / totalPixels,
        storedCelCount: storedCels,
        missingCelCount: missingCels,
        unlistedUsedColorCount: Array.from(usage.values()).filter(item => item.paletteIndex === null).length
      },
      byCel: perCel
    };
  }

  function createPaletteMapping(sourcePalette, targetPalette, options) {
    options = options === undefined ? {} : options;
    if (!isPlainObject(options)) throw new Error("Mapping options must be an object.");
    const policy = options.policy === undefined ? "exact" : options.policy;
    if (["exact", "nearest", "reject-if-no-match"].indexOf(policy) === -1) {
      throw new Error("Mapping policy must be exact, nearest or reject-if-no-match.");
    }
    if (!Array.isArray(sourcePalette) || sourcePalette.length < 1 || sourcePalette.length > LIMITS.maxPaletteColors) {
      throw new Error("Source palette must contain 1–" + LIMITS.maxPaletteColors + " colors.");
    }
    if (!Array.isArray(targetPalette) || targetPalette.length < 1 || targetPalette.length > LIMITS.maxPaletteColors) {
      throw new Error("Target palette must contain 1–" + LIMITS.maxPaletteColors + " colors.");
    }
    assertDense(sourcePalette, "Source palette");
    assertDense(targetPalette, "Target palette");
    const source = sourcePalette.map((color, index) => normalizeHex(color, "Source palette color " + index));
    const target = targetPalette.map((color, index) => normalizeHex(color, "Target palette color " + index));
    const exactFirst = new Map();
    target.forEach((color, index) => { if (!exactFirst.has(color)) exactFirst.set(color, index); });

    const mappings = [];
    const unmatched = [];
    const targetUseCounts = new Map();
    source.forEach((color, sourceIndex) => {
      if (exactFirst.has(color)) {
        const targetIndex = exactFirst.get(color);
        mappings.push({ sourceIndex, sourceColor: color, targetIndex, targetColor: target[targetIndex], match: "exact", distanceSquared: 0 });
        targetUseCounts.set(targetIndex, (targetUseCounts.get(targetIndex) || 0) + 1);
        return;
      }
      if (policy === "nearest") {
        let bestIndex = 0;
        let bestDistance = Infinity;
        target.forEach((targetColor, targetIndex) => {
          const distance = colorDistanceSquared(color, targetColor);
          if (distance < bestDistance) { bestDistance = distance; bestIndex = targetIndex; }
        });
        mappings.push({ sourceIndex, sourceColor: color, targetIndex: bestIndex, targetColor: target[bestIndex], match: "nearest", distanceSquared: bestDistance });
        targetUseCounts.set(bestIndex, (targetUseCounts.get(bestIndex) || 0) + 1);
      } else {
        unmatched.push({ sourceIndex, sourceColor: color, reason: "no-exact-target" });
      }
    });

    const collisions = Array.from(targetUseCounts.entries()).filter(entry => entry[1] > 1).map(([targetIndex, sourceCount]) => ({
      targetIndex: targetIndex,
      targetColor: target[targetIndex],
      sourceCount: sourceCount
    }));
    const accepted = !(policy === "reject-if-no-match" && unmatched.length > 0);
    return {
      policy: policy,
      accepted: accepted,
      mappings: mappings,
      unmatched: unmatched,
      collisions: collisions,
      report: {
        policy: policy,
        accepted: accepted,
        sourcePaletteLength: source.length,
        targetPaletteLength: target.length,
        mappedSourceCount: mappings.length,
        unmatchedSourceCount: unmatched.length,
        nearestMatchCount: mappings.filter(item => item.match === "nearest").length,
        exactMatchCount: mappings.filter(item => item.match === "exact").length,
        targetCollisionCount: collisions.length
      }
    };
  }

  function mappingTable(mapping) {
    if (!isPlainObject(mapping) || !Array.isArray(mapping.mappings) || !Array.isArray(mapping.unmatched)) {
      throw new Error("Mapping must be created by createPaletteMapping.");
    }
    const table = new Map();
    mapping.mappings.forEach(item => {
      const source = normalizeHex(item.sourceColor, "Mapped source color");
      const target = normalizeHex(item.targetColor, "Mapped target color");
      if (table.has(source)) throw new Error("Mapping contains more than one result for a source color.");
      table.set(source, target);
    });
    return table;
  }

  function previewProjectPaletteMapping(project, mapping, options) {
    const model = validateProject(project);
    const scope = resolveScope(model, options);
    const table = mappingTable(mapping);
    const impacts = [];
    const unmappedUsedColors = new Map();
    let totalPixels = 0;
    let transparentPixels = 0;
    let mappedPixels = 0;
    let changedPixels = 0;
    let unchangedPixels = 0;
    let unmappedPixels = 0;
    let affectedCels = 0;

    scope.layers.forEach(layer => {
      scope.frames.forEach(frame => {
        const cel = model.celMap.get(layer.id + "\u0000" + frame.id);
        if (!cel) return;
        totalPixels += cel.pixels.length;
        let mappedInCel = 0;
        let changedInCel = 0;
        let unmappedInCel = 0;
        let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
        cel.pixels.forEach((pixel, pixelIndex) => {
          if (pixel === null) { transparentPixels += 1; return; }
          const color = pixel.toUpperCase();
          if (!table.has(color)) {
            unmappedPixels += 1;
            unmappedInCel += 1;
            const record = unmappedUsedColors.get(color) || { hex: color, count: 0 };
            record.count += 1;
            unmappedUsedColors.set(color, record);
            return;
          }
          const targetColor = table.get(color);
          mappedPixels += 1;
          mappedInCel += 1;
          if (targetColor === color) { unchangedPixels += 1; return; }
          changedPixels += 1;
          changedInCel += 1;
          const x = pixelIndex % model.width;
          const y = Math.floor(pixelIndex / model.width);
          minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        });
        if (changedInCel > 0) {
          affectedCels += 1;
          impacts.push({
            layerId: layer.id,
            layerName: layer.name,
            frameId: frame.id,
            frameName: frame.name,
            changedPixels: changedInCel,
            mappedPixels: mappedInCel,
            unmappedPixels: unmappedInCel,
            bounds: { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
          });
        }
      });
    });

    return {
      accepted: mapping.accepted !== false,
      policy: mapping.policy || "unknown",
      scope: {
        includeHiddenLayers: scope.includeHiddenLayers,
        layerIds: scope.layers.map(layer => layer.id),
        frameIds: scope.frames.map(frame => frame.id)
      },
      totalPixels: totalPixels,
      transparentPixels: transparentPixels,
      mappedPixels: mappedPixels,
      changedPixels: changedPixels,
      unchangedPixels: unchangedPixels,
      unmappedPixels: unmappedPixels,
      affectedCelCount: affectedCels,
      impactsByCel: impacts,
      unmappedUsedColors: Array.from(unmappedUsedColors.values())
    };
  }

  function applyProjectPaletteMapping(project, mapping, options) {
    const preview = previewProjectPaletteMapping(project, mapping, options);
    if (mapping.accepted === false) throw new Error("Mapping was rejected because one or more source colors have no exact target.");
    const table = mappingTable(mapping);
    const output = clone(project);
    const scope = resolveScope(validateProject(output), options);
    const selectedLayerIds = new Set(scope.layers.map(layer => layer.id));
    const selectedFrameIds = new Set(scope.frames.map(frame => frame.id));
    let changedPixels = 0;
    output.cels.forEach(cel => {
      if (!selectedLayerIds.has(cel.layerId) || !selectedFrameIds.has(cel.frameId)) return;
      cel.pixels = cel.pixels.map(pixel => {
        if (pixel === null) return null;
        const color = pixel.toUpperCase();
        if (!table.has(color)) return color;
        const target = table.get(color);
        if (target !== color) changedPixels += 1;
        return target;
      });
    });
    const mappedPalette = output.palette.map(color => table.has(color.toUpperCase()) ? table.get(color.toUpperCase()) : color);
    output.palette = mappedPalette;
    return {
      project: output,
      report: Object.assign({}, preview, {
        changedPixels: changedPixels,
        applied: true,
        unmappedPixelsLeftUnchanged: preview.unmappedPixels,
        sourceProjectUnchanged: true
      })
    };
  }

  return Object.freeze({
    LIMITS: LIMITS,
    normalizeHex: normalizeHex,
    extractUsedColors: extractUsedColors,
    createPaletteMapping: createPaletteMapping,
    previewProjectPaletteMapping: previewProjectPaletteMapping,
    applyProjectPaletteMapping: applyProjectPaletteMapping
  });
});
