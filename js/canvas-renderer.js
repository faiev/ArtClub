/*
 * Isolated Canvas 2D renderer prototype for Art Club.
 * Project data remains an array of #RRGGBB strings and null values.
 * Browser: new ArtClubCanvasRenderer.CanvasPixelRenderer(canvas)
 * CommonJS: require("./canvas-renderer.js")
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubCanvasRenderer = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const COLORS = new Map();
  const BEFORE = [232, 95, 100, 0.35];
  const AFTER = [76, 144, 210, 0.35];
  const DEFAULT_GRID_COLOR = "rgba(37, 53, 49, 0.18)";
  const DEFAULT_SELECTION_COLOR = "#e97960";
  const MAX_DIMENSION = 512;
  const MAX_PIXELS = MAX_DIMENSION * MAX_DIMENSION;
  const TRANSPARENT_KEY = 0x1000000;

  function rgba(color) {
    if (color === null) return [0, 0, 0, 0];
    if (typeof color !== "string") throw new TypeError("Pixel colors must be #RRGGBB strings or explicit null.");
    const value = color.toLowerCase();
    if (!/^#[0-9a-f]{6}$/.test(value)) throw new TypeError("Pixel colors must use #RRGGBB hex format.");
    if (!COLORS.has(value)) {
      COLORS.set(value, [
        parseInt(value.slice(1, 3), 16),
        parseInt(value.slice(3, 5), 16),
        parseInt(value.slice(5, 7), 16),
        255
      ]);
    }
    return COLORS.get(value);
  }

  function blend(first, second) {
    if (!first) return second;
    if (!second) return first;
    const alpha = second[3] + first[3] * (1 - second[3]);
    return [
      Math.round((second[0] * second[3] + first[0] * first[3] * (1 - second[3])) / alpha),
      Math.round((second[1] * second[3] + first[1] * first[3] * (1 - second[3])) / alpha),
      Math.round((second[2] * second[3] + first[2] * first[3] * (1 - second[3])) / alpha),
      alpha
    ];
  }

  function surfaceFor(canvas, options) {
    if (options.createSurface) return options.createSurface();
    if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(1, 1);
    const doc = canvas.ownerDocument || (typeof document !== "undefined" ? document : null);
    if (!doc) throw new Error("CanvasPixelRenderer needs OffscreenCanvas or a document.");
    return doc.createElement("canvas");
  }

  function clippedRect(rect, width, height) {
    if (!rect) return { x: 0, y: 0, width, height };
    if (![rect.x, rect.y, rect.width, rect.height].every(Number.isInteger) ||
        rect.width < 1 || rect.height < 1) {
      throw new RangeError("Dirty region must contain integer coordinates and positive dimensions.");
    }
    const x = Math.max(0, rect.x);
    const y = Math.max(0, rect.y);
    const right = Math.min(width, rect.x + rect.width);
    const bottom = Math.min(height, rect.y + rect.height);
    if (right <= x || bottom <= y) return null;
    return { x, y, width: right - x, height: bottom - y };
  }

  class CanvasPixelRenderer {
    constructor(canvas, options) {
      if (!canvas || typeof canvas.getContext !== "function") throw new TypeError("Pass a canvas element.");
      this.canvas = canvas;
      this.options = options || {};
      this.context = canvas.getContext("2d", { alpha: true });
      if (!this.context) throw new Error("A Canvas 2D context is unavailable.");
      this.surface = surfaceFor(canvas, this.options);
      this.surfaceContext = this.surface.getContext("2d");
      this.overlay = surfaceFor(canvas, this.options);
      this.overlayContext = this.overlay.getContext("2d");
      if (!this.surfaceContext || !this.overlayContext) throw new Error("Unable to create renderer surfaces.");
      this.width = 0;
      this.height = 0;
      this.displayWidth = 0;
      this.displayHeight = 0;
      this.dpr = 1;
      this.imageData = null;
      this.renderCount = 0;
      this.lastRenderMode = "none";
      this.lastDirtyRect = null;
      this.overlaySignature = null;
      this.onionBeforeSnapshot = null;
      this.onionAfterSnapshot = null;
      this.lastFrameId = undefined;
      this.lastCompositeRevision = undefined;
      this.hasRendered = false;
      this.destroyed = false;
      if (canvas.style && this.options.pixelated !== false) canvas.style.imageRendering = "pixelated";
    }

    _live() {
      if (this.destroyed) throw new Error("CanvasPixelRenderer has been destroyed.");
    }

    _resize(width, height) {
      const bounds = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
      const displayWidthCandidate = Number(this.options.displayWidth) || this.canvas.clientWidth ||
        (bounds && bounds.width) || width;
      const displayHeightCandidate = Number(this.options.displayHeight) || this.canvas.clientHeight ||
        (bounds && bounds.height) || height;
      const displayWidth = Number.isFinite(displayWidthCandidate) && displayWidthCandidate > 0
        ? displayWidthCandidate : width;
      const displayHeight = Number.isFinite(displayHeightCandidate) && displayHeightCandidate > 0
        ? displayHeightCandidate : height;
      const configuredDpr = typeof this.options.devicePixelRatio === "function"
        ? this.options.devicePixelRatio()
        : this.options.devicePixelRatio;
      const globalDpr = typeof globalThis !== "undefined" ? Number(globalThis.devicePixelRatio) : 1;
      const dprCandidate = Number(configuredDpr) || globalDpr || 1;
      const dpr = Number.isFinite(dprCandidate) && dprCandidate > 0 ? Math.max(1, dprCandidate) : 1;
      const backingWidth = Math.max(1, Math.round(displayWidth * dpr));
      const backingHeight = Math.max(1, Math.round(displayHeight * dpr));
      const changed = width !== this.width || height !== this.height ||
        displayWidth !== this.displayWidth || displayHeight !== this.displayHeight || dpr !== this.dpr ||
        this.canvas.width !== backingWidth || this.canvas.height !== backingHeight ||
        this.overlay.width !== backingWidth || this.overlay.height !== backingHeight;

      if (width !== this.width || height !== this.height ||
          this.surface.width !== width || this.surface.height !== height) {
        this.surface.width = width;
        this.surface.height = height;
        this.imageData = this.surfaceContext.createImageData(width, height);
        this.width = width;
        this.height = height;
      }
      if (this.canvas.width !== backingWidth) this.canvas.width = backingWidth;
      if (this.canvas.height !== backingHeight) this.canvas.height = backingHeight;
      if (this.overlay.width !== backingWidth) this.overlay.width = backingWidth;
      if (this.overlay.height !== backingHeight) this.overlay.height = backingHeight;
      this.displayWidth = displayWidth;
      this.displayHeight = displayHeight;
      this.dpr = dpr;
      this.context.imageSmoothingEnabled = false;
      this.surfaceContext.imageSmoothingEnabled = false;
      this.overlayContext.imageSmoothingEnabled = false;
      return changed;
    }

    _validateColorArray(values, count, label) {
      if (!Array.isArray(values) || values.length !== count) {
        throw new RangeError(label + " length must equal width × height.");
      }
      for (let i = 0; i < count; i++) {
        if (!(i in values)) {
          throw new TypeError(label + " must not contain sparse or undefined pixel entries (index " + i + ").");
        }
        rgba(values[i]);
      }
    }

    _snapshotMask(values, count) {
      if (values === undefined || values === null) return null;
      const snapshot = new Uint32Array(count);
      for (let i = 0; i < count; i++) {
        snapshot[i] = values[i] === null ? TRANSPARENT_KEY : parseInt(values[i].slice(1), 16);
      }
      return snapshot;
    }

    _maskChanged(next, previous) {
      if (next === null || previous === null) return next !== previous;
      if (next.length !== previous.length) return true;
      for (let i = 0; i < next.length; i++) {
        if (next[i] !== previous[i]) return true;
      }
      return false;
    }

    _selectionFor(state) {
      const selection = state.selectionPreview || state.selection;
      if (!selection) return null;
      const valid = [selection.x, selection.y, selection.width, selection.height].every(Number.isInteger);
      if (!valid || selection.x < 0 || selection.y < 0 || selection.width < 1 ||
          selection.height < 1 || selection.x + selection.width > state.width ||
          selection.y + selection.height > state.height) {
        throw new RangeError("Selection must be a non-empty integer rectangle inside the canvas.");
      }
      return {
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height
      };
    }

    _overlaySignature(state, selection) {
      return JSON.stringify([
        state.grid !== false,
        state.gridColor || DEFAULT_GRID_COLOR,
        state.selectionColor || DEFAULT_SELECTION_COLOR,
        selection ? [selection.x, selection.y, selection.width, selection.height] : null
      ]);
    }

    _writePixels(state, rect) {
      const data = this.imageData.data;
      for (let y = rect.y; y < rect.y + rect.height; y++) {
        let index = y * this.width + rect.x;
        let offset = index * 4;
        for (let x = 0; x < rect.width; x++, index++, offset += 4) {
          let color = rgba(state.pixels[index]);
          if (color[3] === 0) {
            let tint = state.onionBefore && state.onionBefore[index] ? BEFORE : null;
            if (state.onionAfter && state.onionAfter[index]) tint = blend(tint, AFTER);
            if (tint) color = [tint[0], tint[1], tint[2], Math.round(tint[3] * 255)];
          }
          data[offset] = color[0];
          data[offset + 1] = color[1];
          data[offset + 2] = color[2];
          data[offset + 3] = color[3];
        }
      }
      this.surfaceContext.putImageData(this.imageData, 0, 0, rect.x, rect.y, rect.width, rect.height);
    }

    _drawOverlay(state, selection) {
      const ctx = this.overlayContext;
      const sx = this.displayWidth / this.width;
      const sy = this.displayHeight / this.height;
      const dpr = this.dpr;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, this.displayWidth, this.displayHeight);
      if (state.grid !== false) {
        ctx.beginPath();
        ctx.strokeStyle = state.gridColor || DEFAULT_GRID_COLOR;
        ctx.lineWidth = 1 / dpr;
        for (let x = 1; x < this.width; x++) {
          const px = Math.round(x * sx * dpr) / dpr + 0.5 / dpr;
          ctx.moveTo(px, 0);
          ctx.lineTo(px, this.displayHeight);
        }
        for (let y = 1; y < this.height; y++) {
          const py = Math.round(y * sy * dpr) / dpr + 0.5 / dpr;
          ctx.moveTo(0, py);
          ctx.lineTo(this.displayWidth, py);
        }
        ctx.stroke();
      }
      if (selection) {
        ctx.strokeStyle = state.selectionColor || DEFAULT_SELECTION_COLOR;
        ctx.lineWidth = 1 / dpr;
        if (ctx.setLineDash) ctx.setLineDash([3 / dpr, 2 / dpr]);
        const x = selection.x * sx;
        const y = selection.y * sy;
        const w = selection.width * sx;
        const h = selection.height * sy;
        ctx.strokeRect(x + 0.5 / dpr, y + 0.5 / dpr,
          Math.max(0, w - 1 / dpr), Math.max(0, h - 1 / dpr));
      }
      ctx.restore();
    }

    _blit(rect) {
      const dx = rect.x * this.displayWidth / this.width;
      const dy = rect.y * this.displayHeight / this.height;
      const dw = rect.width * this.displayWidth / this.width;
      const dh = rect.height * this.displayHeight / this.height;
      const ctx = this.context;
      ctx.save();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.clearRect(dx, dy, dw, dh);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.surface, rect.x, rect.y, rect.width, rect.height, dx, dy, dw, dh);
      const sx = Math.floor(dx * this.dpr);
      const sy = Math.floor(dy * this.dpr);
      const right = Math.min(this.overlay.width, Math.ceil((dx + dw) * this.dpr));
      const bottom = Math.min(this.overlay.height, Math.ceil((dy + dh) * this.dpr));
      const sw = Math.max(1, right - sx);
      const sh = Math.max(1, bottom - sy);
      ctx.drawImage(this.overlay, sx, sy, sw, sh, dx, dy, dw, dh);
      ctx.restore();
    }

    render(state, dirtyRect) {
      this._live();
      if (!state || !Number.isInteger(state.width) || !Number.isInteger(state.height) ||
          state.width < 1 || state.height < 1 ||
          state.width > MAX_DIMENSION || state.height > MAX_DIMENSION) {
        throw new RangeError("Canvas width and height must be positive integers no larger than " +
          MAX_DIMENSION + " pixels.");
      }
      const count = state.width * state.height;
      if (count > MAX_PIXELS) {
        throw new RangeError("Canvas area exceeds the " + MAX_PIXELS + " pixel renderer limit.");
      }

      // Validate every source entry before resizing or mutating any render buffer. This
      // rejects sparse arrays and undefined values even when they lie outside dirtyRect.
      this._validateColorArray(state.pixels, count, "Pixel array");
      if (state.onionBefore !== undefined && state.onionBefore !== null) {
        this._validateColorArray(state.onionBefore, count, "Previous-frame pixel array");
      }
      if (state.onionAfter !== undefined && state.onionAfter !== null) {
        this._validateColorArray(state.onionAfter, count, "Next-frame pixel array");
      }
      if (state.frameId !== undefined && typeof state.frameId !== "string") {
        throw new TypeError("frameId must be a string when provided.");
      }
      if (state.compositeRevision !== undefined &&
          typeof state.compositeRevision !== "string" && typeof state.compositeRevision !== "number") {
        throw new TypeError("compositeRevision must be a string or number when provided.");
      }

      const selection = this._selectionFor(state);
      const requested = clippedRect(dirtyRect, state.width, state.height);
      const overlaySignature = this._overlaySignature(state, selection);
      const nextBeforeSnapshot = this._snapshotMask(state.onionBefore, count);
      const nextAfterSnapshot = this._snapshotMask(state.onionAfter, count);
      const onionChanged = this._maskChanged(nextBeforeSnapshot, this.onionBeforeSnapshot) ||
        this._maskChanged(nextAfterSnapshot, this.onionAfterSnapshot);
      const compositeChanged = this.hasRendered &&
        (state.frameId !== this.lastFrameId ||
          state.compositeRevision !== this.lastCompositeRevision);
      const resized = this._resize(state.width, state.height);
      const overlayChanged = overlaySignature !== this.overlaySignature;
      const fullRedraw = resized || overlayChanged || onionChanged || compositeChanged;
      const rect = fullRedraw
        ? { x: 0, y: 0, width: state.width, height: state.height }
        : requested;
      if (!rect) return this.getStats();

      this._writePixels(state, rect);
      this._drawOverlay(state, selection);
      this._blit(rect);
      this.overlaySignature = overlaySignature;
      this.onionBeforeSnapshot = nextBeforeSnapshot;
      this.onionAfterSnapshot = nextAfterSnapshot;
      this.lastFrameId = state.frameId;
      this.lastCompositeRevision = state.compositeRevision;
      this.hasRendered = true;
      this.renderCount++;
      this.lastRenderMode = rect.width === state.width && rect.height === state.height ? "full" : "dirty";
      this.lastDirtyRect = Object.assign({}, rect);
      return this.getStats();
    }

    mapClientToPixel(clientX, clientY, bounds) {
      this._live();
      if (!this.width || !this.height || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return null;
      const rect = bounds || this.canvas.getBoundingClientRect();
      if (!rect || !Number.isFinite(rect.left) || !Number.isFinite(rect.top) ||
          !Number.isFinite(rect.width) || !Number.isFinite(rect.height) ||
          rect.width <= 0 || rect.height <= 0) return null;
      const xIn = clientX - rect.left;
      const yIn = clientY - rect.top;
      if (xIn < 0 || yIn < 0 || xIn >= rect.width || yIn >= rect.height) return null;
      const x = Math.floor(xIn / rect.width * this.width);
      const y = Math.floor(yIn / rect.height * this.height);
      return { x, y, i: y * this.width + x };
    }

    getStats() {
      return {
        width: this.width, height: this.height, pixelCount: this.width * this.height,
        renderCount: this.renderCount, lastRenderMode: this.lastRenderMode,
        lastDirtyRect: this.lastDirtyRect && Object.assign({}, this.lastDirtyRect),
        displayWidth: this.displayWidth, displayHeight: this.displayHeight, devicePixelRatio: this.dpr
      };
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.surface.width = this.surface.height = 1;
      this.overlay.width = this.overlay.height = 1;
      this.width = this.height = 0;
      this.imageData = null;
      this.overlaySignature = null;
      this.onionBeforeSnapshot = null;
      this.onionAfterSnapshot = null;
      this.hasRendered = false;
    }
  }

  return { CanvasPixelRenderer, parseColor: rgba };
});
