/*!
 * One Pixel Studio — immutable palette transformations and harmony suggestions.
 * Browser-global + CommonJS; no project mutation or external dependencies.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubPaletteTransformations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const HEX = /^#?[0-9a-f]{6}$/i;
  const MAX_COLORS = 4096;
  const MAX_RAMP_STEPS = 64;
  const MAX_NAME_LENGTH = 256;

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return false;
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function assertDenseArray(array, label) {
    if (!Array.isArray(array)) throw new Error(label + " must be an array.");
    for (let index = 0; index < array.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(array, index)) {
        throw new Error(label + " cannot contain sparse or missing entries.");
      }
    }
  }

  function cloneJsonValue(value, seen) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Palette metadata numbers must be finite.");
      return value;
    }
    if (Array.isArray(value)) {
      assertDenseArray(value, "Palette metadata array");
      if (seen.has(value)) throw new Error("Palette data cannot contain circular references.");
      seen.add(value);
      const output = value.map(item => cloneJsonValue(item, seen));
      seen.delete(value);
      return output;
    }
    if (isPlainObject(value)) {
      if (seen.has(value)) throw new Error("Palette data cannot contain circular references.");
      seen.add(value);
      const output = {};
      Object.keys(value).forEach(key => {
        if (value[key] === undefined || typeof value[key] === "function" || typeof value[key] === "symbol" || typeof value[key] === "bigint") {
          throw new Error("Palette data must contain JSON-compatible values only.");
        }
        output[key] = cloneJsonValue(value[key], seen);
      });
      seen.delete(value);
      return output;
    }
    throw new Error("Palette data must contain JSON-compatible values only.");
  }

  function clone(value) {
    return cloneJsonValue(value, new Set());
  }

  function normalizeHex(value, label) {
    if (typeof value !== "string" || !HEX.test(value.trim())) {
      throw new Error((label || "Color") + " must be a six-digit HEX value.");
    }
    const raw = value.trim().replace(/^#/, "");
    return "#" + raw.toUpperCase();
  }

  function colorHex(entry, index) {
    if (typeof entry === "string") return normalizeHex(entry, "Color " + index);
    if (!isPlainObject(entry)) throw new Error("Color " + index + " must be a HEX string or color object.");
    return normalizeHex(entry.hex, "Color " + index);
  }

  function validatePalette(input) {
    if (!isPlainObject(input)) throw new Error("Palette must be an object with a colors array.");
    if (!Array.isArray(input.colors) || input.colors.length < 1 || input.colors.length > MAX_COLORS) {
      throw new Error("Palette must contain 1–" + MAX_COLORS + " colors.");
    }
    assertDenseArray(input.colors, "Palette colors");
    const palette = clone(input);
    if (palette.name !== undefined && (typeof palette.name !== "string" || !palette.name.trim() || palette.name.length > MAX_NAME_LENGTH)) {
      throw new Error("Palette name must contain 1–" + MAX_NAME_LENGTH + " characters.");
    }
    palette.colors.forEach((entry, index) => {
      const hex = colorHex(entry, index);
      if (typeof entry === "string") palette.colors[index] = hex;
      else {
        entry.hex = hex;
        if (entry.name !== undefined && (typeof entry.name !== "string" || !entry.name.trim() || entry.name.length > MAX_NAME_LENGTH)) {
          throw new Error("Color " + index + " name must contain 1–" + MAX_NAME_LENGTH + " characters.");
        }
      }
    });
    return palette;
  }

  function paletteMetadata(palette) {
    const metadata = {};
    Object.keys(palette).forEach(key => {
      if (key !== "name" && key !== "colors") metadata[key] = clone(palette[key]);
    });
    return metadata;
  }

  function changeReport(operation, extra) {
    return Object.assign({ operation: operation, discardedMetadata: [] }, extra || {});
  }

  function reorderPalette(input, order) {
    const palette = validatePalette(input);
    if (!Array.isArray(order) || order.length !== palette.colors.length) {
      throw new Error("Order must contain every palette index exactly once.");
    }
    assertDenseArray(order, "Order");
    const seen = new Set();
    order.forEach(index => {
      if (!Number.isInteger(index) || index < 0 || index >= palette.colors.length || seen.has(index)) {
        throw new Error("Order must be a permutation of valid palette indices.");
      }
      seen.add(index);
    });
    const reordered = clone(palette);
    reordered.colors = order.map(index => clone(palette.colors[index]));
    return {
      palette: reordered,
      report: changeReport("reorder", {
        order: order.slice(),
        movedEntries: order.reduce((count, sourceIndex, targetIndex) => count + (sourceIndex === targetIndex ? 0 : 1), 0)
      })
    };
  }

  function renamePalette(input, name) {
    const palette = validatePalette(input);
    if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
      throw new Error("New palette name must contain 1–" + MAX_NAME_LENGTH + " characters.");
    }
    const output = clone(palette);
    const previousName = output.name === undefined ? null : output.name;
    output.name = name.trim();
    return {
      palette: output,
      report: changeReport("rename", { previousName: previousName, newName: output.name })
    };
  }

  function mergePalettes(inputs, options) {
    if (!Array.isArray(inputs) || inputs.length < 2) throw new Error("Merge requires at least two palettes.");
    if (inputs.length > 256) throw new Error("Merge accepts at most 256 palettes.");
    assertDenseArray(inputs, "Merge palettes");
    options = options === undefined ? {} : options;
    if (!isPlainObject(options)) throw new Error("Merge options must be an object.");
    const palettes = inputs.map(validatePalette);
    const colors = [];
    palettes.forEach(palette => palette.colors.forEach(entry => colors.push(clone(entry))));
    if (colors.length > MAX_COLORS) throw new Error("Merged palette exceeds the " + MAX_COLORS + " color limit.");
    const name = options.name === undefined
      ? palettes.map((palette, index) => palette.name || ("Palette " + (index + 1))).join(" + ")
      : options.name;
    if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
      throw new Error("Merged palette name must contain 1–" + MAX_NAME_LENGTH + " characters.");
    }
    const output = { name: name.trim(), colors: colors };
    const discardedMetadata = [];
    palettes.forEach((palette, index) => {
      const metadata = paletteMetadata(palette);
      Object.keys(metadata).forEach(key => {
        discardedMetadata.push({ sourcePaletteIndex: index, field: key, value: metadata[key] });
      });
    });
    return {
      palette: output,
      report: changeReport("merge", {
        sourcePaletteCount: palettes.length,
        sourceColorCounts: palettes.map(palette => palette.colors.length),
        outputColorCount: colors.length,
        duplicateHexCount: duplicateEntryCount(colors),
        discardedMetadata: discardedMetadata
      })
    };
  }

  function splitPalette(input, groups, options) {
    const palette = validatePalette(input);
    options = options === undefined ? {} : options;
    if (!isPlainObject(options)) throw new Error("Split options must be an object.");
    if (!Array.isArray(groups) || groups.length < 2 || groups.length > palette.colors.length) {
      throw new Error("Split requires 2 or more non-empty index groups.");
    }
    assertDenseArray(groups, "Split groups");
    const assignments = new Set();
    groups.forEach((group, groupIndex) => {
      if (!Array.isArray(group) || group.length < 1) throw new Error("Split group " + groupIndex + " must not be empty.");
      assertDenseArray(group, "Split group " + groupIndex);
      group.forEach(index => {
        if (!Number.isInteger(index) || index < 0 || index >= palette.colors.length || assignments.has(index)) {
          throw new Error("Split groups must partition valid palette indices without duplicates.");
        }
        assignments.add(index);
      });
    });
    if (assignments.size !== palette.colors.length) throw new Error("Split groups must include every palette index exactly once.");
    if (options.names !== undefined && (!Array.isArray(options.names) || options.names.length !== groups.length)) {
      throw new Error("Split names must contain one name per output palette.");
    }
    if (options.names !== undefined) assertDenseArray(options.names, "Split names");
    const baseName = palette.name || "Palette";
    const outputs = groups.map((group, groupIndex) => {
      const name = options.names ? options.names[groupIndex] : baseName + " " + (groupIndex + 1);
      if (typeof name !== "string" || !name.trim() || name.trim().length > MAX_NAME_LENGTH) {
        throw new Error("Split palette names must contain 1–" + MAX_NAME_LENGTH + " characters.");
      }
      const result = clone(palette);
      result.name = name.trim();
      result.colors = group.map(index => clone(palette.colors[index]));
      return result;
    });
    return {
      palettes: outputs,
      report: changeReport("split", {
        sourceColorCount: palette.colors.length,
        outputPaletteCount: outputs.length,
        outputColorCounts: outputs.map(item => item.colors.length),
        discardedMetadata: []
      })
    };
  }

  function duplicateEntryCount(colors) {
    const seen = new Set();
    let duplicates = 0;
    colors.forEach((entry, index) => {
      const hex = colorHex(entry, index);
      if (seen.has(hex)) duplicates += 1;
      else seen.add(hex);
    });
    return duplicates;
  }

  function removeDuplicateColors(input, options) {
    const palette = validatePalette(input);
    options = options === undefined ? {} : options;
    if (!isPlainObject(options)) throw new Error("Duplicate-removal options must be an object.");
    const keep = options.keep === undefined ? "first" : options.keep;
    if (keep !== "first" && keep !== "last") throw new Error("Duplicate keep policy must be first or last.");
    const kept = new Set();
    const removed = [];
    const output = clone(palette);
    const source = palette.colors;
    const selected = [];
    if (keep === "first") {
      source.forEach((entry, index) => {
        const hex = colorHex(entry, index);
        if (kept.has(hex)) removed.push({ index: index, entry: clone(entry), reason: "duplicate" });
        else { kept.add(hex); selected.push(clone(entry)); }
      });
    } else {
      const keepIndices = new Map();
      source.forEach((entry, index) => keepIndices.set(colorHex(entry, index), index));
      source.forEach((entry, index) => {
        const hex = colorHex(entry, index);
        if (keepIndices.get(hex) !== index) removed.push({ index: index, entry: clone(entry), reason: "duplicate" });
      });
      source.forEach((entry, index) => {
        if (keepIndices.get(colorHex(entry, index)) === index) selected.push(clone(entry));
      });
    }
    output.colors = selected;
    return {
      palette: output,
      report: changeReport("remove-duplicates", {
        keep: keep,
        removedCount: removed.length,
        removedEntries: removed,
        discardedMetadata: removed.map(item => ({ sourceColorIndex: item.index, entry: clone(item.entry) }))
      })
    };
  }

  function replaceColor(input, fromHex, toHex) {
    const palette = validatePalette(input);
    const from = normalizeHex(fromHex, "Source color");
    const to = normalizeHex(toHex, "Replacement color");
    const output = clone(palette);
    const indices = [];
    output.colors = output.colors.map((entry, index) => {
      if (colorHex(entry, index) !== from) return entry;
      indices.push(index);
      if (typeof entry === "string") return to;
      const next = clone(entry);
      next.hex = to;
      return next;
    });
    return {
      palette: output,
      report: changeReport("replace-color", {
        fromColor: from,
        toColor: to,
        matchedEntries: indices.length,
        matchedIndices: indices,
        isNoOp: from === to
      })
    };
  }

  function replaceColorInBuffers(buffers, fromHex, toHex) {
    if (!Array.isArray(buffers)) throw new Error("Buffers must be an array.");
    if (buffers.length > 4096) throw new Error("At most 4,096 buffers can be transformed at once.");
    assertDenseArray(buffers, "Buffers");
    const from = normalizeHex(fromHex, "Source color");
    const to = normalizeHex(toHex, "Replacement color");
    const seen = new Set();
    const details = [];
    let matchedPixels = 0;
    const output = buffers.map((buffer, bufferIndex) => {
      if (!isPlainObject(buffer) || !Array.isArray(buffer.pixels)) throw new Error("Buffer " + bufferIndex + " must contain a pixels array.");
      if (seen.has(buffer)) throw new Error("The same buffer object cannot be supplied more than once.");
      seen.add(buffer);
      for (let pixelIndex = 0; pixelIndex < buffer.pixels.length; pixelIndex += 1) {
        if (!Object.prototype.hasOwnProperty.call(buffer.pixels, pixelIndex)) {
          throw new Error("Buffer " + bufferIndex + " pixels cannot contain sparse or missing entries.");
        }
      }
      const next = clone(buffer);
      let count = 0;
      next.pixels = next.pixels.map((pixel, pixelIndex) => {
        if (pixel === null) return null;
        const hex = normalizeHex(pixel, "Buffer " + bufferIndex + " pixel " + pixelIndex);
        if (hex !== from) return hex;
        count += 1;
        return to;
      });
      matchedPixels += count;
      details.push({ bufferIndex: bufferIndex, id: buffer.id === undefined ? null : buffer.id, matchedPixels: count });
      return next;
    });
    return {
      buffers: output,
      report: changeReport("replace-color-in-buffers", {
        fromColor: from,
        toColor: to,
        matchedPixels: matchedPixels,
        changedPixels: from === to ? 0 : matchedPixels,
        impactsByBuffer: details
      })
    };
  }

  function rgbToHsl(hex) {
    const raw = normalizeHex(hex).slice(1);
    const r = parseInt(raw.slice(0, 2), 16) / 255;
    const g = parseInt(raw.slice(2, 4), 16) / 255;
    const b = parseInt(raw.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const lightness = (max + min) / 2;
    let hue = 0;
    let saturation = 0;
    if (delta !== 0) {
      saturation = delta / (1 - Math.abs(2 * lightness - 1));
      if (max === r) hue = 60 * (((g - b) / delta) % 6);
      else if (max === g) hue = 60 * ((b - r) / delta + 2);
      else hue = 60 * ((r - g) / delta + 4);
    }
    return { h: ((hue % 360) + 360) % 360, s: saturation, l: lightness };
  }

  function hslToHex(hue, saturation, lightness) {
    const h = ((hue % 360) + 360) % 360;
    const s = saturation;
    const l = lightness;
    const chroma = (1 - Math.abs(2 * l - 1)) * s;
    const sector = h / 60;
    const x = chroma * (1 - Math.abs((sector % 2) - 1));
    let r = 0, g = 0, b = 0;
    if (sector < 1) { r = chroma; g = x; }
    else if (sector < 2) { r = x; g = chroma; }
    else if (sector < 3) { g = chroma; b = x; }
    else if (sector < 4) { g = x; b = chroma; }
    else if (sector < 5) { r = x; b = chroma; }
    else { r = chroma; b = x; }
    const match = l - chroma / 2;
    return "#" + [r, g, b].map(value => Math.max(0, Math.min(255, Math.round((value + match) * 255))).toString(16).padStart(2, "0")).join("").toUpperCase();
  }

  function harmonySuggestions(baseHex, type, options) {
    const base = normalizeHex(baseHex);
    options = options === undefined ? {} : options;
    if (!isPlainObject(options)) throw new Error("Harmony options must be an object.");
    const hsl = rgbToHsl(base);
    const definitions = {
      complementary: [180],
      analogous: [-30, 30],
      triadic: [120, 240],
      monochrome: null
    };
    if (!Object.prototype.hasOwnProperty.call(definitions, type)) {
      throw new Error("Harmony type must be complementary, analogous, triadic or monochrome.");
    }
    let hexes;
    if (type === "monochrome") {
      const levels = options.lightnessSteps === undefined ? [0.2, 0.35, 0.5, 0.65, 0.8] : options.lightnessSteps;
      if (!Array.isArray(levels) || levels.length < 2 || levels.length > 16) throw new Error("Monochrome lightnessSteps must contain 2–16 values.");
      assertDenseArray(levels, "Monochrome lightnessSteps");
      levels.forEach(value => {
        if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) throw new Error("Monochrome lightness values must be between 0 and 1.");
      });
      hexes = levels.map(lightness => hslToHex(hsl.h, hsl.s, lightness));
    } else {
      hexes = definitions[type].map(offset => hslToHex(hsl.h + offset, hsl.s, hsl.l));
    }
    const unique = [];
    hexes.forEach(hex => { if (hex !== base && unique.indexOf(hex) === -1) unique.push(hex); });
    return {
      baseColor: base,
      type: type,
      suggestions: unique,
      report: changeReport("harmony-suggestions", { generatedCount: unique.length, deduplicatedCount: hexes.length - unique.length })
    };
  }

  function buildRampFromTwoColors(fromHex, toHex, steps) {
    const from = normalizeHex(fromHex, "Ramp start color");
    const to = normalizeHex(toHex, "Ramp end color");
    if (!Number.isInteger(steps) || steps < 2 || steps > MAX_RAMP_STEPS) {
      throw new Error("Ramp steps must be an integer from 2 to " + MAX_RAMP_STEPS + ".");
    }
    const a = [0, 2, 4].map(offset => parseInt(from.slice(offset + 1, offset + 3), 16));
    const b = [0, 2, 4].map(offset => parseInt(to.slice(offset + 1, offset + 3), 16));
    const colors = [];
    for (let step = 0; step < steps; step += 1) {
      const t = step / (steps - 1);
      colors.push("#" + a.map((value, index) => Math.round(value + (b[index] - value) * t).toString(16).padStart(2, "0")).join("").toUpperCase());
    }
    return colors;
  }

  return Object.freeze({
    MAX_COLORS: MAX_COLORS,
    MAX_RAMP_STEPS: MAX_RAMP_STEPS,
    normalizeHex: normalizeHex,
    reorderPalette: reorderPalette,
    renamePalette: renamePalette,
    mergePalettes: mergePalettes,
    splitPalette: splitPalette,
    removeDuplicateColors: removeDuplicateColors,
    replaceColor: replaceColor,
    replaceColorInBuffers: replaceColorInBuffers,
    harmonySuggestions: harmonySuggestions,
    buildRampFromTwoColors: buildRampFromTwoColors
  });
});
