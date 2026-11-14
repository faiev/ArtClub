/*!
 * One Pixel Studio — layer edit safety guard
 * Pure JavaScript; browser-global + CommonJS for reuse and Node tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubLayerEditGuard = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const REASONS = Object.freeze({
    OPTIONS_INVALID: "OPTIONS_INVALID",
    PROJECT_INVALID: "PROJECT_INVALID",
    LAYER_ID_INVALID: "LAYER_ID_INVALID",
    LAYER_NOT_FOUND: "LAYER_NOT_FOUND",
    LAYER_AMBIGUOUS: "LAYER_AMBIGUOUS",
    LAYER_NOT_ACTIVE: "LAYER_NOT_ACTIVE",
    LAYER_METADATA_INVALID: "LAYER_METADATA_INVALID",
    LAYER_HIDDEN: "LAYER_HIDDEN",
    LAYER_LOCKED: "LAYER_LOCKED",
    FRAME_ID_INVALID: "FRAME_ID_INVALID",
    FRAME_NOT_FOUND: "FRAME_NOT_FOUND",
    FRAME_AMBIGUOUS: "FRAME_AMBIGUOUS",
    FRAME_NOT_ACTIVE: "FRAME_NOT_ACTIVE",
    CEL_NOT_FOUND: "CEL_NOT_FOUND",
    CEL_AMBIGUOUS: "CEL_AMBIGUOUS",
    CEL_INVALID: "CEL_INVALID"
  });

  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function denial(reason, message, ids) {
    const result = {
      ok: false,
      reason: reason,
      message: message
    };
    if (ids && ids.layerId !== undefined) result.layerId = ids.layerId;
    if (ids && ids.frameId !== undefined) result.frameId = ids.frameId;
    return result;
  }

  function findUniqueById(items, id) {
    const matches = items.filter(function (item) {
      return isRecord(item) && item.id === id;
    });
    if (matches.length > 1) return { ambiguous: true, value: null };
    return { ambiguous: false, value: matches[0] || null };
  }

  /**
   * Resolve the active layer/frame cel for a pixel-edit operation.
   * Explicit IDs are accepted only when they identify the current active layer
   * and frame: editor mutation paths currently operate on the active pixel buffer.
   * This function never creates a missing layer, frame, or cel.
   */
  function resolveEditableTarget(project, options) {
    options = options === undefined ? {} : options;
    if (!isRecord(options)) {
      return denial(REASONS.OPTIONS_INVALID, "Layer edit options must be an object.");
    }
    if (!isRecord(project) || project.format !== "one-pixel-studio" || project.version !== 2 ||
        !Array.isArray(project.layers) || !Array.isArray(project.frames) ||
        !Array.isArray(project.cels) || !isRecord(project.canvas) ||
        !Number.isInteger(project.canvas.width) || project.canvas.width < 1 || project.canvas.width > 512 ||
        !Number.isInteger(project.canvas.height) || project.canvas.height < 1 || project.canvas.height > 512) {
      return denial(REASONS.PROJECT_INVALID, "The project document is malformed or incomplete.");
    }

    if (typeof project.activeLayerId !== "string" || !project.activeLayerId) {
      return denial(REASONS.LAYER_ID_INVALID, "The project has no valid active layer ID.");
    }
    if (typeof project.activeFrameId !== "string" || !project.activeFrameId) {
      return denial(REASONS.FRAME_ID_INVALID, "The project has no valid active frame ID.");
    }

    const layerId = options.layerId === undefined ? project.activeLayerId : options.layerId;
    if (typeof layerId !== "string" || !layerId) {
      return denial(REASONS.LAYER_ID_INVALID, "The requested layer ID must be a non-empty string.");
    }

    const layerMatch = findUniqueById(project.layers, layerId);
    if (layerMatch.ambiguous) {
      return denial(REASONS.LAYER_AMBIGUOUS, "The requested layer ID is duplicated in the project.", { layerId: layerId });
    }
    if (!layerMatch.value) {
      return denial(REASONS.LAYER_NOT_FOUND, "The requested layer does not exist.", { layerId: layerId });
    }
    const layer = layerMatch.value;
    if (layerId !== project.activeLayerId) {
      return denial(REASONS.LAYER_NOT_ACTIVE, "Only the active layer can be edited by this editor operation.", { layerId: layerId });
    }
    if (typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean") {
      return denial(REASONS.LAYER_METADATA_INVALID, "The target layer must have boolean visible and locked flags.", { layerId: layerId });
    }
    if (!layer.visible) {
      return denial(REASONS.LAYER_HIDDEN, "The target layer is hidden and cannot be edited.", { layerId: layerId });
    }
    if (layer.locked) {
      return denial(REASONS.LAYER_LOCKED, "The target layer is locked and cannot be edited.", { layerId: layerId });
    }

    const frameId = options.frameId === undefined ? project.activeFrameId : options.frameId;
    if (typeof frameId !== "string" || !frameId) {
      return denial(REASONS.FRAME_ID_INVALID, "The requested frame ID must be a non-empty string.", { layerId: layerId });
    }
    const frameMatch = findUniqueById(project.frames, frameId);
    if (frameMatch.ambiguous) {
      return denial(REASONS.FRAME_AMBIGUOUS, "The requested frame ID is duplicated in the project.", { layerId: layerId, frameId: frameId });
    }
    if (!frameMatch.value) {
      return denial(REASONS.FRAME_NOT_FOUND, "The requested frame does not exist.", { layerId: layerId, frameId: frameId });
    }
    if (frameId !== project.activeFrameId) {
      return denial(REASONS.FRAME_NOT_ACTIVE, "Only the active frame can be edited by this editor operation.", { layerId: layerId, frameId: frameId });
    }

    const matchingCels = project.cels.filter(function (cel) {
      return isRecord(cel) && cel.layerId === layerId && cel.frameId === frameId;
    });
    if (matchingCels.length > 1) {
      return denial(REASONS.CEL_AMBIGUOUS, "The target layer/frame pair has duplicate cels.", { layerId: layerId, frameId: frameId });
    }
    if (matchingCels.length === 0) {
      return denial(REASONS.CEL_NOT_FOUND, "The target cel does not exist; an edit must not create it implicitly.", { layerId: layerId, frameId: frameId });
    }

    const cel = matchingCels[0];
    const expectedPixels = project.canvas.width * project.canvas.height;
    if (!Array.isArray(cel.pixels) || cel.pixels.length !== expectedPixels ||
        cel.pixels.some(function (pixel) { return pixel !== null && (typeof pixel !== "string" || !HEX_COLOR.test(pixel)); })) {
      return denial(REASONS.CEL_INVALID, "The target cel pixel buffer is malformed.", { layerId: layerId, frameId: frameId });
    }

    return {
      ok: true,
      reason: null,
      message: "The target layer and cel are editable.",
      layerId: layerId,
      frameId: frameId,
      layer: layer,
      frame: frameMatch.value,
      cel: cel
    };
  }

  /** Resolve a target or throw an error with a stable machine-readable code. */
  function assertEditableTarget(project, options) {
    const result = resolveEditableTarget(project, options);
    if (result.ok) return result;

    const error = new Error(result.message);
    error.name = "LayerEditDeniedError";
    error.code = result.reason;
    error.reason = result.reason;
    error.layerId = result.layerId;
    error.frameId = result.frameId;
    throw error;
  }

  return Object.freeze({
    REASONS: REASONS,
    resolveEditableTarget: resolveEditableTarget,
    assertEditableTarget: assertEditableTarget
  });
});
