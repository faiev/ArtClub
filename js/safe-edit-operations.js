/*!
 * One Pixel Studio — immutable safe-edit operations
 * Pure JavaScript; browser-global + CommonJS.
 */
(function (root, factory) {
  const guard = typeof module === "object" && module.exports
    ? require("./layer-edit-guard.js")
    : root.ArtClubLayerEditGuard;
  const api = factory(guard);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubSafeEditOperations = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (Guard) {
  "use strict";

  if (!Guard || typeof Guard.resolveEditableTarget !== "function") {
    throw new Error("ArtClubLayerEditGuard must be loaded before safe-edit-operations.js.");
  }

  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
  const REASONS = Object.freeze({
    OPTIONS_INVALID: "OPTIONS_INVALID",
    PATCHES_INVALID: "PATCHES_INVALID",
    PATCH_OUT_OF_BOUNDS: "PATCH_OUT_OF_BOUNDS",
    PATCH_OUTSIDE_SELECTION: "PATCH_OUTSIDE_SELECTION",
    PIXEL_BUFFER_INVALID: "PIXEL_BUFFER_INVALID",
    PROJECT_CLONE_FAILED: "PROJECT_CLONE_FAILED"
  });

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function denial(reason, message, details) {
    const result = { ok: false, reason: reason, message: message };
    if (details && details.layerId !== undefined) result.layerId = details.layerId;
    if (details && details.frameId !== undefined) result.frameId = details.frameId;
    if (details && details.index !== undefined) result.index = details.index;
    return result;
  }

  function cloneValue(value, active) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number") {
      if (!Number.isFinite(value)) throw new Error("Project contains a non-finite number.");
      return value;
    }
    if (typeof value !== "object") throw new Error("Project contains a non-data value.");
    if (active.has(value)) throw new Error("Project contains a cyclic reference.");
    active.add(value);

    let copy;
    if (Array.isArray(value)) {
      copy = new Array(value.length);
      for (let index = 0; index < value.length; index += 1) {
        if (Object.prototype.hasOwnProperty.call(value, index)) {
          copy[index] = cloneValue(value[index], active);
        }
      }
      Object.keys(value).forEach(function (key) {
        if (!/^(0|[1-9]\d*)$/.test(key)) copy[key] = cloneValue(value[key], active);
      });
    } else {
      const prototype = Object.getPrototypeOf(value);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new Error("Project contains a non-plain object.");
      }
      copy = prototype === null ? Object.create(null) : {};
      Object.keys(value).forEach(function (key) {
        copy[key] = cloneValue(value[key], active);
      });
    }

    active.delete(value);
    return copy;
  }

  function cloneProject(project) {
    return cloneValue(project, new WeakSet());
  }

  function validatePixelBuffer(pixels, expectedLength) {
    if (!Array.isArray(pixels) || pixels.length !== expectedLength) return false;
    for (let index = 0; index < expectedLength; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(pixels, index)) return false;
      const pixel = pixels[index];
      if (pixel !== null && (typeof pixel !== "string" || !HEX_COLOR.test(pixel))) return false;
    }
    return true;
  }

  function resolveTarget(project, options) {
    if (options !== undefined && !isRecord(options)) {
      return { denial: denial(REASONS.OPTIONS_INVALID, "Safe-edit options must be an object.") };
    }
    const safeOptions = options || {};
    const target = Guard.resolveEditableTarget(project, safeOptions);
    if (!target.ok) return { denial: target };

    const celIndex = project.cels.indexOf(target.cel);
    if (celIndex < 0) {
      return {
        denial: denial(Guard.REASONS.CEL_NOT_FOUND,
          "The validated target cel is no longer present in the project.",
          { layerId: target.layerId, frameId: target.frameId })
      };
    }

    return { target: target, celIndex: celIndex, options: safeOptions };
  }

  function buildResult(project, resolved, nextPixels) {
    let nextProject;
    try {
      nextProject = cloneProject(project);
    } catch (error) {
      return denial(REASONS.PROJECT_CLONE_FAILED,
        "The project cannot be safely cloned: " + error.message,
        { layerId: resolved.target.layerId, frameId: resolved.target.frameId });
    }

    nextProject.cels[resolved.celIndex].pixels = nextPixels;
    let changedPixels = 0;
    const before = resolved.target.cel.pixels;
    for (let index = 0; index < before.length; index += 1) {
      if (before[index] !== nextPixels[index]) changedPixels += 1;
    }

    return {
      ok: true,
      reason: null,
      project: nextProject,
      layerId: resolved.target.layerId,
      frameId: resolved.target.frameId,
      changedPixels: changedPixels
    };
  }

  function clearActiveCel(project, options) {
    const resolved = resolveTarget(project, options);
    if (resolved.denial) return resolved.denial;

    const source = resolved.target.cel.pixels;
    const next = source.slice();
    const selection = resolved.options.selection;
    if (selection === undefined || selection === null) {
      next.fill(null);
    } else {
      for (let y = selection.y; y < selection.y + selection.height; y += 1) {
        for (let x = selection.x; x < selection.x + selection.width; x += 1) {
          next[y * project.canvas.width + x] = null;
        }
      }
    }
    return buildResult(project, resolved, next);
  }

  function applyPixelPatches(project, patches, options) {
    const resolved = resolveTarget(project, options);
    if (resolved.denial) return resolved.denial;
    if (!Array.isArray(patches)) {
      return denial(REASONS.PATCHES_INVALID, "Pixel patches must be an array.",
        { layerId: resolved.target.layerId, frameId: resolved.target.frameId });
    }

    const width = project.canvas.width;
    const height = project.canvas.height;
    const selection = resolved.options.selection;
    const validated = [];
    const seen = new Set();

    for (let index = 0; index < patches.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(patches, index)) {
        return denial(REASONS.PATCHES_INVALID, "Pixel patch arrays cannot contain holes.",
          { layerId: resolved.target.layerId, frameId: resolved.target.frameId, index: index });
      }
      const patch = patches[index];
      if (!isRecord(patch) || !Number.isInteger(patch.x) || !Number.isInteger(patch.y) ||
          (patch.color !== null && (typeof patch.color !== "string" || !HEX_COLOR.test(patch.color)))) {
        return denial(REASONS.PATCHES_INVALID, "Each patch requires integer x/y coordinates and null or a HEX color.",
          { layerId: resolved.target.layerId, frameId: resolved.target.frameId, index: index });
      }
      if (patch.x < 0 || patch.y < 0 || patch.x >= width || patch.y >= height) {
        return denial(REASONS.PATCH_OUT_OF_BOUNDS, "A pixel patch lies outside the canvas.",
          { layerId: resolved.target.layerId, frameId: resolved.target.frameId, index: index });
      }
      if (selection && (selection === null || patch.x < selection.x || patch.y < selection.y ||
          patch.x >= selection.x + selection.width || patch.y >= selection.y + selection.height)) {
        return denial(REASONS.PATCH_OUTSIDE_SELECTION, "A pixel patch lies outside the supplied selection.",
          { layerId: resolved.target.layerId, frameId: resolved.target.frameId, index: index });
      }
      const pixelIndex = patch.y * width + patch.x;
      if (seen.has(pixelIndex)) {
        return denial(REASONS.PATCHES_INVALID, "A patch batch cannot write the same pixel more than once.",
          { layerId: resolved.target.layerId, frameId: resolved.target.frameId, index: index });
      }
      seen.add(pixelIndex);
      validated.push({ pixelIndex: pixelIndex, color: patch.color });
    }

    const next = resolved.target.cel.pixels.slice();
    validated.forEach(function (patch) { next[patch.pixelIndex] = patch.color; });
    return buildResult(project, resolved, next);
  }

  function replaceActiveCel(project, pixels, options) {
    const resolved = resolveTarget(project, options);
    if (resolved.denial) return resolved.denial;
    const expectedLength = project.canvas.width * project.canvas.height;
    if (!validatePixelBuffer(pixels, expectedLength)) {
      return denial(REASONS.PIXEL_BUFFER_INVALID,
        "Replacement pixels must contain one own entry per canvas cell, each null or a valid HEX color.",
        { layerId: resolved.target.layerId, frameId: resolved.target.frameId });
    }
    return buildResult(project, resolved, pixels.slice());
  }

  function applyResultBuffer(project, pixels, options) {
    return replaceActiveCel(project, pixels, options);
  }

  return Object.freeze({
    REASONS: REASONS,
    clearActiveCel: clearActiveCel,
    applyPixelPatches: applyPixelPatches,
    replaceActiveCel: replaceActiveCel,
    applyResultBuffer: applyResultBuffer
  });
});
