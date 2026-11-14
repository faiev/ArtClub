/*
 * Pure viewport math for Art Club's pixel canvas.
 *
 * Coordinate contract:
 * - canvas coordinates are logical pixel-space units.
 * - screen coordinates are CSS pixels local to the viewport element.
 * - offsetX/offsetY are CSS-pixel translations; scale is CSS pixels per canvas unit.
 * - devicePixelRatio is used only for backing-store conversions, never pointer mapping.
 *
 * Browser: window.ArtClubCanvasViewport.createViewport(...)
 * CommonJS: require("./canvas-viewport.js")
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubCanvasViewport = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SERIAL_VERSION = 1;
  const DEFAULT_MIN_SCALE = 0.1;
  const DEFAULT_MAX_SCALE = 16;

  function finite(value, label) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new TypeError(label + " must be a finite number.");
    }
    return value;
  }

  function positive(value, label) {
    finite(value, label);
    if (value <= 0) throw new RangeError(label + " must be greater than zero.");
    return value;
  }

  function positiveInteger(value, label) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new RangeError(label + " must be a positive integer.");
    }
    return value;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function normalizedLimits(options) {
    const minScale = options.minScale === undefined
      ? DEFAULT_MIN_SCALE : positive(options.minScale, "minScale");
    const maxScale = options.maxScale === undefined
      ? DEFAULT_MAX_SCALE : positive(options.maxScale, "maxScale");
    if (minScale > maxScale) throw new RangeError("minScale must not exceed maxScale.");
    return { minScale, maxScale };
  }

  function centeredOffset(viewSize, contentSize) {
    return (viewSize - contentSize) / 2;
  }

  function clampOffset(viewSize, contentSize, desiredOffset) {
    if (contentSize <= viewSize) return centeredOffset(viewSize, contentSize);
    return clamp(desiredOffset, viewSize - contentSize, 0);
  }

  function assertViewport(viewport) {
    if (!viewport || typeof viewport !== "object" || Array.isArray(viewport)) {
      throw new TypeError("viewport must be an object created by createViewport().");
    }
    positiveInteger(viewport.canvasWidth, "canvasWidth");
    positiveInteger(viewport.canvasHeight, "canvasHeight");
    positive(viewport.viewWidth, "viewWidth");
    positive(viewport.viewHeight, "viewHeight");
    positive(viewport.scale, "scale");
    positive(viewport.devicePixelRatio, "devicePixelRatio");
    positive(viewport.minScale, "minScale");
    positive(viewport.maxScale, "maxScale");
    finite(viewport.offsetX, "offsetX");
    finite(viewport.offsetY, "offsetY");
    if (viewport.minScale > viewport.maxScale) {
      throw new RangeError("viewport minScale must not exceed maxScale.");
    }
    if (viewport.scale < viewport.minScale || viewport.scale > viewport.maxScale) {
      throw new RangeError("viewport scale must be within its configured bounds.");
    }
    return viewport;
  }

  function makeViewport(values) {
    const result = {
      canvasWidth: values.canvasWidth,
      canvasHeight: values.canvasHeight,
      viewWidth: values.viewWidth,
      viewHeight: values.viewHeight,
      scale: values.scale,
      offsetX: values.offsetX,
      offsetY: values.offsetY,
      devicePixelRatio: values.devicePixelRatio,
      minScale: values.minScale,
      maxScale: values.maxScale
    };
    return result;
  }

  function withClampedOffsets(values) {
    const contentWidth = values.canvasWidth * values.scale;
    const contentHeight = values.canvasHeight * values.scale;
    return makeViewport({
      ...values,
      offsetX: clampOffset(values.viewWidth, contentWidth, values.offsetX),
      offsetY: clampOffset(values.viewHeight, contentHeight, values.offsetY)
    });
  }

  function createViewport(options) {
    if (!options || typeof options !== "object" || Array.isArray(options)) {
      throw new TypeError("createViewport expects an options object.");
    }
    const canvasWidth = positiveInteger(options.canvasWidth, "canvasWidth");
    const canvasHeight = positiveInteger(options.canvasHeight, "canvasHeight");
    const viewWidth = positive(options.viewWidth, "viewWidth");
    const viewHeight = positive(options.viewHeight, "viewHeight");
    const devicePixelRatio = options.devicePixelRatio === undefined
      ? 1 : positive(options.devicePixelRatio, "devicePixelRatio");
    const limits = normalizedLimits(options);
    const fitScale = Math.min(viewWidth / canvasWidth, viewHeight / canvasHeight);
    const requestedScale = options.scale === undefined ? fitScale : positive(options.scale, "scale");
    const scale = clamp(requestedScale, limits.minScale, limits.maxScale);
    const initial = {
      canvasWidth,
      canvasHeight,
      viewWidth,
      viewHeight,
      scale,
      offsetX: options.offsetX === undefined
        ? centeredOffset(viewWidth, canvasWidth * scale) : finite(options.offsetX, "offsetX"),
      offsetY: options.offsetY === undefined
        ? centeredOffset(viewHeight, canvasHeight * scale) : finite(options.offsetY, "offsetY"),
      devicePixelRatio,
      minScale: limits.minScale,
      maxScale: limits.maxScale
    };
    return withClampedOffsets(initial);
  }

  function clampViewport(viewport) {
    assertViewport(viewport);
    return withClampedOffsets(viewport);
  }

  function fitToCanvas(viewport, padding) {
    assertViewport(viewport);
    const inset = padding === undefined ? 0 : finite(padding, "padding");
    if (inset < 0) throw new RangeError("padding must not be negative.");
    const availableWidth = viewport.viewWidth - 2 * inset;
    const availableHeight = viewport.viewHeight - 2 * inset;
    if (availableWidth <= 0 || availableHeight <= 0) {
      throw new RangeError("padding must leave a positive viewport area.");
    }
    const scale = clamp(
      Math.min(
        availableWidth / viewport.canvasWidth,
        availableHeight / viewport.canvasHeight
      ),
      viewport.minScale,
      viewport.maxScale
    );
    return withClampedOffsets({
      ...viewport,
      scale,
      offsetX: centeredOffset(viewport.viewWidth, viewport.canvasWidth * scale),
      offsetY: centeredOffset(viewport.viewHeight, viewport.canvasHeight * scale)
    });
  }

  function resetViewport(viewport) {
    assertViewport(viewport);
    const scale = clamp(1, viewport.minScale, viewport.maxScale);
    return withClampedOffsets({
      ...viewport,
      scale,
      offsetX: 0,
      offsetY: 0
    });
  }

  function panBy(viewport, deltaX, deltaY) {
    assertViewport(viewport);
    finite(deltaX, "deltaX");
    finite(deltaY, "deltaY");
    return withClampedOffsets({
      ...viewport,
      offsetX: viewport.offsetX + deltaX,
      offsetY: viewport.offsetY + deltaY
    });
  }

  function zoomAt(viewport, nextScale, screenX, screenY) {
    assertViewport(viewport);
    positive(nextScale, "nextScale");
    finite(screenX, "screenX");
    finite(screenY, "screenY");
    const scale = clamp(nextScale, viewport.minScale, viewport.maxScale);
    const anchorX = (screenX - viewport.offsetX) / viewport.scale;
    const anchorY = (screenY - viewport.offsetY) / viewport.scale;
    return withClampedOffsets({
      ...viewport,
      scale,
      offsetX: screenX - anchorX * scale,
      offsetY: screenY - anchorY * scale
    });
  }

  function zoomBy(viewport, factor, screenX, screenY) {
    assertViewport(viewport);
    positive(factor, "factor");
    return zoomAt(viewport, viewport.scale * factor, screenX, screenY);
  }

  function resizeViewport(viewport, viewWidth, viewHeight, devicePixelRatio) {
    assertViewport(viewport);
    const nextWidth = positive(viewWidth, "viewWidth");
    const nextHeight = positive(viewHeight, "viewHeight");
    const nextDpr = devicePixelRatio === undefined
      ? viewport.devicePixelRatio : positive(devicePixelRatio, "devicePixelRatio");
    const centerCanvasX = (viewport.viewWidth / 2 - viewport.offsetX) / viewport.scale;
    const centerCanvasY = (viewport.viewHeight / 2 - viewport.offsetY) / viewport.scale;
    return withClampedOffsets({
      ...viewport,
      viewWidth: nextWidth,
      viewHeight: nextHeight,
      devicePixelRatio: nextDpr,
      offsetX: nextWidth / 2 - centerCanvasX * viewport.scale,
      offsetY: nextHeight / 2 - centerCanvasY * viewport.scale
    });
  }

  function canvasToScreen(viewport, canvasX, canvasY) {
    assertViewport(viewport);
    finite(canvasX, "canvasX");
    finite(canvasY, "canvasY");
    return {
      x: viewport.offsetX + canvasX * viewport.scale,
      y: viewport.offsetY + canvasY * viewport.scale
    };
  }

  function screenToCanvas(viewport, screenX, screenY) {
    assertViewport(viewport);
    finite(screenX, "screenX");
    finite(screenY, "screenY");
    return {
      x: (screenX - viewport.offsetX) / viewport.scale,
      y: (screenY - viewport.offsetY) / viewport.scale
    };
  }

  function clientToCanvas(viewport, clientX, clientY, bounds) {
    assertViewport(viewport);
    finite(clientX, "clientX");
    finite(clientY, "clientY");
    if (!bounds || typeof bounds !== "object") {
      throw new TypeError("clientToCanvas requires an element bounds object.");
    }
    const left = finite(bounds.left, "bounds.left");
    const top = finite(bounds.top, "bounds.top");
    const width = positive(bounds.width, "bounds.width");
    const height = positive(bounds.height, "bounds.height");
    const localX = (clientX - left) * viewport.viewWidth / width;
    const localY = (clientY - top) * viewport.viewHeight / height;
    return screenToCanvas(viewport, localX, localY);
  }

  function screenToBacking(viewport, screenX, screenY) {
    assertViewport(viewport);
    finite(screenX, "screenX");
    finite(screenY, "screenY");
    return {
      x: screenX * viewport.devicePixelRatio,
      y: screenY * viewport.devicePixelRatio
    };
  }

  function backingToScreen(viewport, backingX, backingY) {
    assertViewport(viewport);
    finite(backingX, "backingX");
    finite(backingY, "backingY");
    return {
      x: backingX / viewport.devicePixelRatio,
      y: backingY / viewport.devicePixelRatio
    };
  }

  function getBackingSize(viewport) {
    assertViewport(viewport);
    return {
      width: Math.max(1, Math.round(viewport.viewWidth * viewport.devicePixelRatio)),
      height: Math.max(1, Math.round(viewport.viewHeight * viewport.devicePixelRatio))
    };
  }

  function serializeViewport(viewport) {
    assertViewport(viewport);
    return JSON.stringify({
      version: SERIAL_VERSION,
      canvasWidth: viewport.canvasWidth,
      canvasHeight: viewport.canvasHeight,
      viewWidth: viewport.viewWidth,
      viewHeight: viewport.viewHeight,
      scale: viewport.scale,
      offsetX: viewport.offsetX,
      offsetY: viewport.offsetY,
      devicePixelRatio: viewport.devicePixelRatio,
      minScale: viewport.minScale,
      maxScale: viewport.maxScale
    });
  }

  function deserializeViewport(serialized) {
    let parsed;
    if (typeof serialized !== "string") {
      throw new TypeError("serialized viewport must be a JSON string.");
    }
    try {
      parsed = JSON.parse(serialized);
    } catch (error) {
      throw new TypeError("serialized viewport is not valid JSON.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new TypeError("serialized viewport must contain an object.");
    }
    if (parsed.version !== SERIAL_VERSION) {
      throw new RangeError("unsupported viewport serialization version.");
    }
    return createViewport(parsed);
  }

  return {
    SERIAL_VERSION,
    DEFAULT_MIN_SCALE,
    DEFAULT_MAX_SCALE,
    createViewport,
    clampViewport,
    fitToCanvas,
    resetViewport,
    panBy,
    zoomAt,
    zoomBy,
    resizeViewport,
    canvasToScreen,
    screenToCanvas,
    clientToCanvas,
    screenToBacking,
    backingToScreen,
    getBackingSize,
    serializeViewport,
    deserializeViewport
  };
});
