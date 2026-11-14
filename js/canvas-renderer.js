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

  function rgba(color) {
    if (color == null || color === "" || color === "transparent") return [0, 0, 0, 0];
    if (typeof color !== "string") throw new TypeError("Pixel colors must be #RRGGBB strings or null.");
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
    const a = second[3] + first[3] * (1 - second[3]);
    return [
      Math.round((second[0] * second[3] + first[0] * first[3] * (1 - second[3])) / a),
      Math.round((second[1] * second[3] + first[1] * first[3] * (1 - second[3])) / a),
      Math.round((second[2] * second[3] + first[2] * first[3] * (1 - second[3])) / a),
      a
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
      throw new RangeError("Dirty region must contain positive integer dimensions.");
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
      this.destroyed = false;
      if (canvas.style && this.options.pixelated !== false) canvas.style.imageRendering = "pixelated";
    }

    _live() {
      if (this.destroyed) throw new Error("CanvasPixelRenderer has been destroyed.");
    }

    _resize(width, height) {
      const rect = this.canvas.getBoundingClientRect ? this.canvas.getBoundingClientRect() : null;
      const displayWidth = Number(this.options.displayWidth) || this.canvas.clientWidth ||
        (rect && rect.width) || width;
      const displayHeight = Number(this.options.displayHeight) || this.canvas.clientHeight ||
        (rect && rect.height) || height;
      const configuredDpr = typeof this.options.devicePixelRatio === "function"
        ? this.options.devicePixelRatio()
        : this.options.devicePixelRatio;
      const dpr = Math.max(1, Number(configuredDpr) || Number(globalThis.devicePixelRatio) || 1);
      const backingWidth = Math.max(1, Math.round(displayWidth * dpr));
      const backingHeight = Math.max(1, Math.round(displayHeight * dpr));
      const changed = width !== this.width || height !== this.height ||
        displayWidth !== this.displayWidth || displayHeight !== this.displayHeight ||
        dpr !== this.dpr || this.canvas.width !== backingWidth || this.canvas.height !== backingHeight;

      if (width !== this.width || height !== this.height) {
        this.surface.width = width;
        this.surface.height = height;
        this.overlay.width = width;
        this.overlay.height = height;
        this.imageData = this.surfaceContext.createImageData(width, height);
        this.width = width;
        this.height = height;
      }
      this.canvas.width = backingWidth;
      this.canvas.height = backingHeight;
      this.displayWidth = displayWidth;
      this.displayHeight = displayHeight;
      this.dpr = dpr;
      this.context.imageSmoothingEnabled = false;
      this.surfaceContext.imageSmoothingEnabled = false;
      this.overlayContext.imageSmoothingEnabled = false;
      return changed;
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

    _drawOverlay(state) {
      const ctx = this.overlayContext;
      const sx = this.displayWidth / this.width;
      const sy = this.displayHeight / this.height;
      ctx.save();
      ctx.setTransform(sx, 0, 0, sy, 0, 0);
      ctx.clearRect(0, 0, this.width, this.height);
      if (state.grid !== false) {
        ctx.beginPath();
        ctx.strokeStyle = state.gridColor || "rgba(37, 53, 49, 0.18)";
        ctx.lineWidth = Number(state.gridLineWidth) > 0 ? Number(state.gridLineWidth) : 1;
        for (let x = 1; x < this.width; x++) {
          ctx.moveTo(x + 0.5, 0);
          ctx.lineTo(x + 0.5, this.height);
        }
        for (let y = 1; y < this.height; y++) {
          ctx.moveTo(0, y + 0.5);
          ctx.lineTo(this.width, y + 0.5);
        }
        ctx.stroke();
      }
      const selection = state.selectionPreview || state.selection;
      if (selection) {
        const valid = [selection.x, selection.y, selection.width, selection.height].every(Number.isInteger);
        if (!valid || selection.x < 0 || selection.y < 0 || selection.width < 1 ||
            selection.height < 1 || selection.x + selection.width > this.width ||
            selection.y + selection.height > this.height) {
          ctx.restore();
          throw new RangeError("Selection must be a non-empty integer rectangle inside the canvas.");
        }
        ctx.strokeStyle = state.selectionColor || "#e97960";
        ctx.lineWidth = Number(state.selectionLineWidth) > 0 ? Number(state.selectionLineWidth) : 1;
        if (ctx.setLineDash) ctx.setLineDash([3, 2]);
        ctx.strokeRect(selection.x + 0.5, selection.y + 0.5,
          Math.max(0, selection.width - 1), Math.max(0, selection.height - 1));
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
      ctx.drawImage(this.overlay, rect.x, rect.y, rect.width, rect.height, dx, dy, dw, dh);
      ctx.restore();
    }

    render(state, dirtyRect) {
      this._live();
      if (!state || !Number.isInteger(state.width) || !Number.isInteger(state.height) ||
          state.width < 1 || state.height < 1) {
        throw new RangeError("Canvas width and height must be positive integers.");
      }
      const count = state.width * state.height;
      if (!Array.isArray(state.pixels) || state.pixels.length !== count) {
        throw new RangeError("Pixel array length must equal width × height.");
      }
      if (state.onionBefore && state.onionBefore.length !== count) {
        throw new RangeError("Previous-frame pixel array length must equal width × height.");
      }
      if (state.onionAfter && state.onionAfter.length !== count) {
        throw new RangeError("Next-frame pixel array length must equal width × height.");
      }
      const resized = this._resize(state.width, state.height);
      const requested = clippedRect(dirtyRect, state.width, state.height);
      const rect = resized ? { x: 0, y: 0, width: state.width, height: state.height } : requested;
      if (!rect) return this.getStats();
      this._writePixels(state, rect);
      this._drawOverlay(state);
      this._blit(rect);
      this.renderCount++;
      this.lastRenderMode = rect.width === state.width && rect.height === state.height ? "full" : "dirty";
      this.lastDirtyRect = Object.assign({}, rect);
      return this.getStats();
    }

    mapClientToPixel(clientX, clientY, bounds) {
      this._live();
      const rect = bounds || this.canvas.getBoundingClientRect();
      if (!rect || rect.width <= 0 || rect.height <= 0) return null;
      const xIn = clientX - rect.left;
      const yIn = clientY - rect.top;
      if (xIn < 0 || yIn < 0 || xIn >= rect.width || yIn >= rect.height) return null;
      const x = Math.floor(xIn / rect.width * this.width);
      const y = Math.floor(yIn / rect.height * this.height);
      return { x, y, i: y * this.width + x };
    }

    getStats() {
      return {
        width: this.width,
        height: this.height,
        pixelCount: this.width * this.height,
        renderCount: this.renderCount,
        lastRenderMode: this.lastRenderMode,
        lastDirtyRect: this.lastDirtyRect && Object.assign({}, this.lastDirtyRect),
        displayWidth: this.displayWidth,
        displayHeight: this.displayHeight,
        devicePixelRatio: this.dpr
      };
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      this.surface.width = this.surface.height = 1;
      this.overlay.width = this.overlay.height = 1;
      this.width = this.height = 0;
      this.imageData = null;
    }
  }

  return { CanvasPixelRenderer, parseColor: rgba };
});
