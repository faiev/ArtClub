/*!
 * One Pixel Studio — import staging and rollback-safe candidate validation.
 * Pure JavaScript; browser-global + CommonJS.
 */
(function (root, factory) {
  const projectModel = typeof module === "object" && module.exports
    ? require("./project-model.js")
    : root.ArtClubProject;
  const api = factory(projectModel);
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubImportStaging = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (ProjectModel) {
  "use strict";

  if (!ProjectModel || typeof ProjectModel.validateProject !== "function" ||
      typeof ProjectModel.deserializeProject !== "function") {
    throw new Error("ArtClubProject must be loaded before import-staging.js.");
  }

  const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
  const LIMITS = Object.freeze({
    maxProjectBytes: 32 * 1024 * 1024,
    maxImageBytes: 8 * 1024 * 1024,
    maxDimension: ProjectModel.LIMITS.maxDimension,
    maxImagePixels: ProjectModel.LIMITS.maxDimension * ProjectModel.LIMITS.maxDimension,
    maxLayers: ProjectModel.LIMITS.maxLayers,
    maxFrames: ProjectModel.LIMITS.maxFrames,
    maxPaletteColors: ProjectModel.LIMITS.maxPaletteColors,
    maxTotalCelPixels: ProjectModel.LIMITS.maxCelPixels,
    defaultAlphaThreshold: 32
  });

  const REASONS = Object.freeze({
    OPTIONS_INVALID: "OPTIONS_INVALID",
    PROJECT_INPUT_INVALID: "PROJECT_INPUT_INVALID",
    PROJECT_BYTES_EXCEEDED: "PROJECT_BYTES_EXCEEDED",
    PROJECT_JSON_INVALID: "PROJECT_JSON_INVALID",
    PROJECT_STRUCTURE_INVALID: "PROJECT_STRUCTURE_INVALID",
    PROJECT_DIMENSIONS_EXCEEDED: "PROJECT_DIMENSIONS_EXCEEDED",
    PROJECT_COUNTS_EXCEEDED: "PROJECT_COUNTS_EXCEEDED",
    PROJECT_PIXEL_BUDGET_EXCEEDED: "PROJECT_PIXEL_BUDGET_EXCEEDED",
    PROJECT_MODEL_INVALID: "PROJECT_MODEL_INVALID",
    IMAGE_INPUT_INVALID: "IMAGE_INPUT_INVALID",
    IMAGE_BYTES_EXCEEDED: "IMAGE_BYTES_EXCEEDED",
    IMAGE_DIMENSIONS_EXCEEDED: "IMAGE_DIMENSIONS_EXCEEDED",
    IMAGE_PIXEL_BUDGET_EXCEEDED: "IMAGE_PIXEL_BUDGET_EXCEEDED",
    IMAGE_RGBA_INVALID: "IMAGE_RGBA_INVALID",
    PALETTE_INVALID: "PALETTE_INVALID",
    TARGET_DIMENSIONS_INVALID: "TARGET_DIMENSIONS_INVALID",
    ALPHA_THRESHOLD_INVALID: "ALPHA_THRESHOLD_INVALID"
  });

  function isRecord(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }

  function utf8ByteLength(value) {
    return new TextEncoder().encode(value).byteLength;
  }

  function makeDiagnostic(code, severity, message, path) {
    const diagnostic = { code: code, severity: severity, message: message };
    if (path !== undefined) diagnostic.path = path;
    return diagnostic;
  }

  function failure(kind, diagnostics, warnings) {
    return {
      ok: false,
      kind: kind,
      diagnostics: diagnostics,
      warnings: warnings || [],
      commit: null
    };
  }

  function success(kind, staged, commit, diagnostics, warnings) {
    return {
      ok: true,
      kind: kind,
      staged: staged,
      commit: commit,
      diagnostics: diagnostics || [],
      warnings: warnings || []
    };
  }

  function freezeDeep(value, seen) {
    if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
    if (ArrayBuffer.isView(value)) return value;
    seen = seen || new WeakSet();
    if (seen.has(value)) return value;
    seen.add(value);
    Object.keys(value).forEach(function (key) { freezeDeep(value[key], seen); });
    return Object.freeze(value);
  }

  function isDenseArray(array) {
    if (!Array.isArray(array)) return false;
    for (let index = 0; index < array.length; index += 1) {
      if (!Object.prototype.hasOwnProperty.call(array, index)) return false;
    }
    return true;
  }

  function preflightProject(candidate) {
    const diagnostics = [];
    const add = function (code, message, path) {
      diagnostics.push(makeDiagnostic(code, "error", message, path));
    };

    if (!isRecord(candidate)) {
      add(REASONS.PROJECT_INPUT_INVALID, "Project import must be a JSON object.");
      return diagnostics;
    }

    const legacy = candidate.format === undefined &&
      (candidate.app === "One Pixel Studio" ||
        (Object.prototype.hasOwnProperty.call(candidate, "w") &&
         Object.prototype.hasOwnProperty.call(candidate, "h") &&
         Object.prototype.hasOwnProperty.call(candidate, "pixels")));

    const width = legacy ? candidate.w : candidate.canvas && candidate.canvas.width;
    const height = legacy ? candidate.h : candidate.canvas && candidate.canvas.height;
    if (!Number.isInteger(width) || !Number.isInteger(height) ||
        width < 1 || height < 1 ||
        width > LIMITS.maxDimension || height > LIMITS.maxDimension ||
        width * height > LIMITS.maxImagePixels) {
      add(REASONS.PROJECT_DIMENSIONS_EXCEEDED,
        "Project canvas dimensions must be between 1 and " + LIMITS.maxDimension + " per side.");
      return diagnostics;
    }
    const expectedPixels = width * height;

    if (legacy) {
      if (!isDenseArray(candidate.pixels)) {
        add(REASONS.PROJECT_STRUCTURE_INVALID,
          "Legacy pixel data must be a dense array with an own entry at every index.", "pixels");
      } else if (candidate.pixels.length !== expectedPixels) {
        add(REASONS.PROJECT_STRUCTURE_INVALID,
          "Legacy pixel count must equal canvas width × height.", "pixels");
      } else {
        candidate.pixels.forEach(function (pixel, index) {
          if (pixel !== null && (typeof pixel !== "string" || !HEX_COLOR.test(pixel))) {
            add(REASONS.PROJECT_STRUCTURE_INVALID,
              "Legacy pixels must be explicit null or #RRGGBB colors.", "pixels[" + index + "]");
          }
        });
      }
      return diagnostics;
    }

    const arrayFields = ["palette", "layers", "frames", "cels"];
    arrayFields.forEach(function (field) {
      if (!Array.isArray(candidate[field])) {
        add(REASONS.PROJECT_STRUCTURE_INVALID, field + " must be an array.", field);
      } else if (!isDenseArray(candidate[field])) {
        add(REASONS.PROJECT_STRUCTURE_INVALID,
          field + " must be dense with an own entry at every index.", field);
      }
    });

    if (Array.isArray(candidate.layers) && candidate.layers.length > LIMITS.maxLayers) {
      add(REASONS.PROJECT_COUNTS_EXCEEDED, "Project exceeds " + LIMITS.maxLayers + " layers.", "layers");
    }
    if (Array.isArray(candidate.frames) && candidate.frames.length > LIMITS.maxFrames) {
      add(REASONS.PROJECT_COUNTS_EXCEEDED, "Project exceeds " + LIMITS.maxFrames + " frames.", "frames");
    }
    if (Array.isArray(candidate.palette) && candidate.palette.length > LIMITS.maxPaletteColors) {
      add(REASONS.PROJECT_COUNTS_EXCEEDED,
        "Project exceeds " + LIMITS.maxPaletteColors + " palette colors.", "palette");
    }
    if (Array.isArray(candidate.cels) &&
        Array.isArray(candidate.layers) && Array.isArray(candidate.frames) &&
        candidate.cels.length > candidate.layers.length * candidate.frames.length) {
      add(REASONS.PROJECT_COUNTS_EXCEEDED,
        "Project has more cels than layer/frame pairs.", "cels");
    }
    if (Array.isArray(candidate.cels) &&
        candidate.cels.length * expectedPixels > LIMITS.maxTotalCelPixels) {
      add(REASONS.PROJECT_PIXEL_BUDGET_EXCEEDED,
        "Project exceeds the total cel-pixel budget of " + LIMITS.maxTotalCelPixels + ".");
      return diagnostics;
    }

    let totalCelPixels = 0;
    if (Array.isArray(candidate.cels)) {
      candidate.cels.forEach(function (cel, celIndex) {
        if (!isRecord(cel)) {
          add(REASONS.PROJECT_STRUCTURE_INVALID, "Cel must be an object.", "cels[" + celIndex + "]");
          return;
        }
        if (!isDenseArray(cel.pixels)) {
          add(REASONS.PROJECT_STRUCTURE_INVALID,
            "Cel pixel data must be dense with an own entry at every index.",
            "cels[" + celIndex + "].pixels");
          return;
        }
        if (cel.pixels.length !== expectedPixels) {
          add(REASONS.PROJECT_STRUCTURE_INVALID,
            "Cel pixel count must equal canvas width × height.",
            "cels[" + celIndex + "].pixels");
          return;
        }
        totalCelPixels += cel.pixels.length;
        cel.pixels.forEach(function (pixel, pixelIndex) {
          if (pixel !== null && (typeof pixel !== "string" || !HEX_COLOR.test(pixel))) {
            add(REASONS.PROJECT_STRUCTURE_INVALID,
              "Cel pixels must be explicit null or #RRGGBB colors.",
              "cels[" + celIndex + "].pixels[" + pixelIndex + "]");
          }
        });
      });
    }
    if (totalCelPixels > LIMITS.maxTotalCelPixels) {
      add(REASONS.PROJECT_PIXEL_BUDGET_EXCEEDED,
        "Project exceeds the total cel-pixel budget of " + LIMITS.maxTotalCelPixels + ".");
    }
    return diagnostics;
  }

  function measureProjectBytes(input, parsedCandidate) {
    if (typeof input === "string") return utf8ByteLength(input);
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) return input.byteLength;
    try { return utf8ByteLength(JSON.stringify(parsedCandidate)); }
    catch (_) { throw new Error("Project candidate cannot be serialized for byte-limit validation."); }
  }

  function parseProjectInput(input) {
    if (typeof input === "string") {
      try { return JSON.parse(input); }
      catch (_) { throw new Error("Project file is not valid JSON."); }
    }
    if (input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
      try {
        const bytes = input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
        return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
      } catch (_) {
        throw new Error("Project byte input must contain valid UTF-8 JSON.");
      }
    }
    return input;
  }

  function stageProjectImport(input, options) {
    options = options === undefined ? {} : options;
    if (!isRecord(options)) {
      return failure("project", [makeDiagnostic(REASONS.OPTIONS_INVALID, "Import options must be an object.")]);
    }
    const maxBytes = options.maxBytes === undefined ? LIMITS.maxProjectBytes : options.maxBytes;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > LIMITS.maxProjectBytes) {
      return failure("project", [makeDiagnostic(REASONS.OPTIONS_INVALID,
        "maxBytes must be a positive integer no greater than " + LIMITS.maxProjectBytes + ".")]);
    }

    // Check string/byte inputs before parsing so oversized JSON is never fully decoded.
    let sourceBytes;
    try {
      if (typeof input === "string" || input instanceof ArrayBuffer || ArrayBuffer.isView(input)) {
        sourceBytes = measureProjectBytes(input);
        if (sourceBytes > maxBytes) {
          return failure("project", [makeDiagnostic(REASONS.PROJECT_BYTES_EXCEEDED,
            "Project source is " + sourceBytes + " bytes; maximum permitted size is " + maxBytes + ".")]);
        }
      }
    } catch (error) {
      return failure("project", [makeDiagnostic(REASONS.PROJECT_INPUT_INVALID, error.message)]);
    }

    let candidate;
    try { candidate = parseProjectInput(input); }
    catch (error) {
      return failure("project", [makeDiagnostic(REASONS.PROJECT_JSON_INVALID, error.message)]);
    }

    const diagnostics = preflightProject(candidate);
    if (diagnostics.length) return failure("project", diagnostics);

    if (sourceBytes === undefined) {
      try { sourceBytes = measureProjectBytes(input, candidate); }
      catch (error) {
        return failure("project", [makeDiagnostic(REASONS.PROJECT_INPUT_INVALID, error.message)]);
      }
    }
    if (sourceBytes > maxBytes) {
      return failure("project", [makeDiagnostic(REASONS.PROJECT_BYTES_EXCEEDED,
        "Project source is " + sourceBytes + " bytes; maximum permitted size is " + maxBytes + ".")]);
    }

    const warnings = [];
    const legacy = candidate.format === undefined &&
      (candidate.app === "One Pixel Studio" || ("w" in candidate && "h" in candidate && "pixels" in candidate));
    if (legacy) {
      warnings.push(makeDiagnostic("LEGACY_PROJECT_MIGRATED", "warning",
        "Legacy single-canvas project will be migrated to one layer and one frame."));
    }
    if (candidate.metadata === undefined) {
      warnings.push(makeDiagnostic("PROJECT_METADATA_ABSENT", "warning",
        "Project metadata is absent; the import will preserve that optional absence."));
    }

    const validation = ProjectModel.validateProject(candidate);
    if (!validation.valid) {
      return failure("project", validation.errors.map(function (message) {
        return makeDiagnostic(REASONS.PROJECT_MODEL_INVALID, "error", message);
      }), warnings);
    }

    let stagedProject;
    try { stagedProject = ProjectModel.deserializeProject(candidate); }
    catch (error) {
      return failure("project", [makeDiagnostic(REASONS.PROJECT_MODEL_INVALID, error.message)], warnings);
    }

    freezeDeep(stagedProject);
    const commit = freezeDeep({
      kind: "replace-project",
      project: stagedProject,
      sourceBytes: sourceBytes
    });
    return success("project", freezeDeep({
      sourceBytes: sourceBytes,
      migratedLegacy: Boolean(legacy),
      project: stagedProject
    }), commit, [], warnings);
  }

  function validatePalette(palette) {
    return Array.isArray(palette) && isDenseArray(palette) &&
      palette.length >= 1 && palette.length <= LIMITS.maxPaletteColors &&
      palette.every(function (color) { return typeof color === "string" && HEX_COLOR.test(color); });
  }

  function readRgbaByte(rgba, index) {
    if (Array.isArray(rgba)) {
      if (!Object.prototype.hasOwnProperty.call(rgba, index)) return null;
      const value = rgba[index];
      return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
    }
    if (!ArrayBuffer.isView(rgba) || rgba instanceof DataView ||
        rgba.BYTES_PER_ELEMENT !== 1 || rgba.length === undefined) return null;
    const value = rgba[index];
    return Number.isInteger(value) && value >= 0 && value <= 255 ? value : null;
  }

  function nearestPaletteColor(red, green, blue, palette) {
    let best = palette[0];
    let bestDistance = Infinity;
    for (let index = 0; index < palette.length; index += 1) {
      const color = palette[index];
      const cr = parseInt(color.slice(1, 3), 16);
      const cg = parseInt(color.slice(3, 5), 16);
      const cb = parseInt(color.slice(5, 7), 16);
      const dr = cr - red, dg = cg - green, db = cb - blue;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance) {
        bestDistance = distance;
        best = color.toLowerCase();
        if (distance === 0) break;
      }
    }
    return { color: best, exact: bestDistance === 0 };
  }

  function stageImageImport(input, options) {
    options = options === undefined ? {} : options;
    if (!isRecord(options) || !isRecord(input)) {
      return failure("image", [makeDiagnostic(REASONS.IMAGE_INPUT_INVALID,
        "Image import requires an image object and an options object.")]);
    }

    const width = input.width;
    const height = input.height;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 ||
        width > LIMITS.maxDimension || height > LIMITS.maxDimension) {
      return failure("image", [makeDiagnostic(REASONS.IMAGE_DIMENSIONS_EXCEEDED,
        "Image dimensions must be between 1 and " + LIMITS.maxDimension + " per side.")]);
    }
    const pixelCount = width * height;
    if (pixelCount > LIMITS.maxImagePixels) {
      return failure("image", [makeDiagnostic(REASONS.IMAGE_PIXEL_BUDGET_EXCEEDED,
        "Image exceeds the maximum " + LIMITS.maxImagePixels + " pixel budget.")]);
    }

    const palette = options.palette;
    if (!validatePalette(palette)) {
      return failure("image", [makeDiagnostic(REASONS.PALETTE_INVALID,
        "Image quantization requires a dense palette of 1–" + LIMITS.maxPaletteColors + " valid HEX colors.")]);
    }

    const targetWidth = options.targetWidth === undefined ? width : options.targetWidth;
    const targetHeight = options.targetHeight === undefined ? height : options.targetHeight;
    if (!Number.isInteger(targetWidth) || !Number.isInteger(targetHeight) ||
        targetWidth < 1 || targetHeight < 1 ||
        targetWidth > LIMITS.maxDimension || targetHeight > LIMITS.maxDimension) {
      return failure("image", [makeDiagnostic(REASONS.TARGET_DIMENSIONS_INVALID,
        "Target dimensions must be between 1 and " + LIMITS.maxDimension + " per side.")]);
    }

    const alphaThreshold = options.alphaThreshold === undefined
      ? LIMITS.defaultAlphaThreshold
      : options.alphaThreshold;
    if (!Number.isInteger(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 255) {
      return failure("image", [makeDiagnostic(REASONS.ALPHA_THRESHOLD_INVALID,
        "alphaThreshold must be an integer from 0 to 255.")]);
    }

    const rgba = input.rgba;
    const rgbaLength = rgba && typeof rgba.length === "number" ? rgba.length : -1;
    const decodedBytes = rgba && typeof rgba.byteLength === "number" ? rgba.byteLength : rgbaLength;
    const sourceBytes = input.sourceBytes === undefined ? decodedBytes : input.sourceBytes;
    const maxBytes = options.maxBytes === undefined ? LIMITS.maxImageBytes : options.maxBytes;
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > LIMITS.maxImageBytes) {
      return failure("image", [makeDiagnostic(REASONS.OPTIONS_INVALID,
        "maxBytes must be a positive integer no greater than " + LIMITS.maxImageBytes + ".")]);
    }
    if (!Number.isSafeInteger(sourceBytes) || sourceBytes < 0 ||
        !Number.isSafeInteger(decodedBytes) || decodedBytes < 0) {
      return failure("image", [makeDiagnostic(REASONS.IMAGE_INPUT_INVALID,
        "Image source and decoded byte counts must be non-negative integers.")]);
    }
    if (sourceBytes > maxBytes || decodedBytes > maxBytes) {
      return failure("image", [makeDiagnostic(REASONS.IMAGE_BYTES_EXCEEDED,
        "Image source or decoded RGBA buffer exceeds the " + maxBytes + " byte import limit.")]);
    }

    const expectedBytes = pixelCount * 4;
    if (!rgba || rgbaLength !== expectedBytes) {
      return failure("image", [makeDiagnostic(REASONS.IMAGE_RGBA_INVALID,
        "RGBA data must contain exactly width × height × 4 byte values.")]);
    }
    const bytes = new Array(expectedBytes);
    for (let index = 0; index < expectedBytes; index += 1) {
      const value = readRgbaByte(rgba, index);
      if (value === null) {
        return failure("image", [makeDiagnostic(REASONS.IMAGE_RGBA_INVALID,
          "RGBA data must be dense and contain only integer byte values.", "rgba[" + index + "]")]);
      }
      bytes[index] = value;
    }

    const scale = Math.min(targetWidth / width, targetHeight / height);
    const drawWidth = Math.max(1, Math.min(targetWidth, Math.round(width * scale)));
    const drawHeight = Math.max(1, Math.min(targetHeight, Math.round(height * scale)));
    const offsetX = Math.floor((targetWidth - drawWidth) / 2);
    const offsetY = Math.floor((targetHeight - drawHeight) / 2);
    const pixels = Array(targetWidth * targetHeight).fill(null);
    let transparentPixels = 0;
    let quantizedPixels = 0;

    for (let y = 0; y < targetHeight; y += 1) {
      for (let x = 0; x < targetWidth; x += 1) {
        if (x < offsetX || y < offsetY || x >= offsetX + drawWidth || y >= offsetY + drawHeight) {
          transparentPixels += 1;
          continue;
        }
        const sourceX = Math.min(width - 1, Math.floor(((x - offsetX) + 0.5) * width / drawWidth));
        const sourceY = Math.min(height - 1, Math.floor(((y - offsetY) + 0.5) * height / drawHeight));
        const sourceIndex = (sourceY * width + sourceX) * 4;
        const alpha = bytes[sourceIndex + 3];
        if (alpha < alphaThreshold) {
          transparentPixels += 1;
          continue;
        }
        const mapped = nearestPaletteColor(
          bytes[sourceIndex], bytes[sourceIndex + 1], bytes[sourceIndex + 2], palette
        );
        if (!mapped.exact) quantizedPixels += 1;
        pixels[y * targetWidth + x] = mapped.color;
      }
    }

    const warnings = [];
    if (transparentPixels > 0) {
      warnings.push(makeDiagnostic("TRANSPARENT_PIXELS_PRESERVED", "warning",
        transparentPixels + " output pixels are transparent, including letterbox padding."));
    }
    if (quantizedPixels > 0) {
      warnings.push(makeDiagnostic("PALETTE_QUANTIZATION", "warning",
        quantizedPixels + " pixels were mapped to the nearest supplied palette color."));
    }
    if (width !== targetWidth || height !== targetHeight) {
      warnings.push(makeDiagnostic("IMAGE_FIT_RESAMPLED", "warning",
        "Image was proportionally fitted to the target canvas using nearest-neighbor sampling."));
    }

    freezeDeep(pixels);
    const commit = freezeDeep({
      kind: "replace-active-cel",
      width: targetWidth,
      height: targetHeight,
      pixels: pixels,
      sourceWidth: width,
      sourceHeight: height,
      sourceBytes: sourceBytes
    });
    return success("image", freezeDeep({
      sourceWidth: width,
      sourceHeight: height,
      targetWidth: targetWidth,
      targetHeight: targetHeight,
      sourceBytes: sourceBytes,
      pixels: pixels
    }), commit, [], warnings);
  }

  return Object.freeze({
    LIMITS: LIMITS,
    REASONS: REASONS,
    stageProjectImport: stageProjectImport,
    stageImageImport: stageImageImport
  });
});
