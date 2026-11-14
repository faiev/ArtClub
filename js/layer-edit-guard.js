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
    LAYER_ZERO_OPACITY: "LAYER_ZERO_OPACITY",
    FRAME_ID_INVALID: "FRAME_ID_INVALID",
    FRAME_NOT_FOUND: "FRAME_NOT_FOUND",
    FRAME_AMBIGUOUS: "FRAME_AMBIGUOUS",
    FRAME_NOT_ACTIVE: "FRAME_NOT_ACTIVE",
    FRAME_METADATA_INVALID: "FRAME_METADATA_INVALID",
    PROJECT_REVISION_STALE: "PROJECT_REVISION_STALE",
    FRAME_REVISION_STALE: "FRAME_REVISION_STALE",
    COMPOSITE_REVISION_STALE: "COMPOSITE_REVISION_STALE",
    REVISION_CONTEXT_INVALID: "REVISION_CONTEXT_INVALID",
    SELECTION_INVALID: "SELECTION_INVALID",
    CANVAS_SIZE_INVALID: "CANVAS_SIZE_INVALID",
    CEL_NOT_FOUND: "CEL_NOT_FOUND",
    CEL_AMBIGUOUS: "CEL_AMBIGUOUS",
    CEL_INVALID: "CEL_INVALID"
  });

  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
  const LIMITS = Object.freeze({
    maxDimension: 512,
    maxCanvasPixels: 512 * 512
  });
  const REVISION_FIELDS = Object.freeze([
    { key: "project", reason: "PROJECT_REVISION_STALE" },
    { key: "frame", reason: "FRAME_REVISION_STALE" },
    { key: "composite", reason: "COMPOSITE_REVISION_STALE" }
  ]);

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

  function hasValidPixelBuffer(pixels, expectedPixels) {
    if (!Array.isArray(pixels) || pixels.length !== expectedPixels) return false;

    // Array iteration helpers such as .some() skip sparse holes. Check every
    // expected slot explicitly so a hole or explicit undefined fails closed.
    for (let index = 0; index < expectedPixels; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(pixels, index)) return false;
      const pixel = pixels[index];
      if (pixel !== null && (typeof pixel !== "string" || !HEX_COLOR.test(pixel))) {
        return false;
      }
    }
    return true;
  }

  function validateRevisionContext(options) {
    const hasExpected = Object.prototype.hasOwnProperty.call(options, "expectedRevisions");
    const hasCurrent = Object.prototype.hasOwnProperty.call(options, "currentRevisions");
    if (!hasExpected && !hasCurrent) return null;
    if (!hasExpected || !hasCurrent ||
        !isRecord(options.expectedRevisions) || !isRecord(options.currentRevisions)) {
      return denial(REASONS.REVISION_CONTEXT_INVALID,
        "Expected and current project, frame and composite revisions must be supplied together.");
    }

    for (const field of REVISION_FIELDS) {
      const expected = options.expectedRevisions[field.key];
      const current = options.currentRevisions[field.key];
      if (!Number.isSafeInteger(expected) || expected < 0 ||
          !Number.isSafeInteger(current) || current < 0) {
        return denial(REASONS.REVISION_CONTEXT_INVALID,
          "Revision values must be non-negative safe integers.");
      }
      if (expected !== current) {
        return denial(REASONS[field.reason],
          "The " + field.key + " revision is stale; read the target again before editing.");
      }
    }
    return null;
  }

  function validateSelection(selection, width, height) {
    if (selection === undefined || selection === null) return null;
    if (!isRecord(selection)) {
      return denial(REASONS.SELECTION_INVALID, "Selection must be null or an integer rectangle.");
    }
    const x = selection.x;
    const y = selection.y;
    const selectionWidth = selection.width;
    const selectionHeight = selection.height;
    if (![x, y, selectionWidth, selectionHeight].every(Number.isInteger) ||
        x < 0 || y < 0 || selectionWidth < 1 || selectionHeight < 1 ||
        x + selectionWidth > width || y + selectionHeight > height) {
      return denial(REASONS.SELECTION_INVALID,
        "Selection must be a non-empty integer rectangle fully inside the canvas.");
    }
    return null;
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
        !Array.isArray(project.cels) || !isRecord(project.canvas)) {
      return denial(REASONS.PROJECT_INVALID, "The project document is malformed or incomplete.");
    }
    const canvasWidth = project.canvas.width;
    const canvasHeight = project.canvas.height;
    if (!Number.isInteger(canvasWidth) || !Number.isInteger(canvasHeight) ||
        canvasWidth < 1 || canvasHeight < 1 ||
        canvasWidth > LIMITS.maxDimension || canvasHeight > LIMITS.maxDimension ||
        canvasWidth * canvasHeight > LIMITS.maxCanvasPixels) {
      return denial(REASONS.CANVAS_SIZE_INVALID,
        "Canvas dimensions must be whole numbers from 1 to " + LIMITS.maxDimension + " per side.");
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
    if (typeof layer.name !== "string" || !layer.name.trim() ||
        typeof layer.visible !== "boolean" || typeof layer.locked !== "boolean" ||
        typeof layer.opacity !== "number" || !Number.isFinite(layer.opacity) ||
        layer.opacity < 0 || layer.opacity > 1) {
      return denial(REASONS.LAYER_METADATA_INVALID,
        "The target layer must have a name, boolean visible/locked flags and opacity from 0 to 1.",
        { layerId: layerId });
    }
    if (!layer.visible) {
      return denial(REASONS.LAYER_HIDDEN, "The target layer is hidden and cannot be edited.", { layerId: layerId });
    }
    if (layer.locked) {
      return denial(REASONS.LAYER_LOCKED, "The target layer is locked and cannot be edited.", { layerId: layerId });
    }
    if (layer.opacity === 0) {
      return denial(REASONS.LAYER_ZERO_OPACITY,
        "The target layer has zero opacity and cannot receive an invisible edit.",
        { layerId: layerId });
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
    const frame = frameMatch.value;
    if (typeof frame.name !== "string" || !frame.name.trim() ||
        !Number.isInteger(frame.durationMs) || frame.durationMs < 10 || frame.durationMs > 60000) {
      return denial(REASONS.FRAME_METADATA_INVALID,
        "The target frame must have a name and duration from 10 to 60000 milliseconds.",
        { layerId: layerId, frameId: frameId });
    }

    const revisionDenial = validateRevisionContext(options);
    if (revisionDenial) {
      revisionDenial.layerId = layerId;
      revisionDenial.frameId = frameId;
      return revisionDenial;
    }
    const selectionDenial = validateSelection(options.selection, canvasWidth, canvasHeight);
    if (selectionDenial) {
      selectionDenial.layerId = layerId;
      selectionDenial.frameId = frameId;
      return selectionDenial;
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
    if (!hasValidPixelBuffer(cel.pixels, expectedPixels)) {
      return denial(REASONS.CEL_INVALID, "The target cel pixel buffer is malformed.", { layerId: layerId, frameId: frameId });
    }

    return {
      ok: true,
      reason: null,
      message: "The target layer and cel are editable.",
      layerId: layerId,
      frameId: frameId,
      layer: layer,
      frame: frame,
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
    LIMITS: LIMITS,
    resolveEditableTarget: resolveEditableTarget,
    assertEditableTarget: assertEditableTarget
  });
});
