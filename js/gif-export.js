/*!
 * One Pixel Studio — animated GIF exporter
 * Dependency-free GIF89a encoder for v2 project documents.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubGIFExporter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const FORMAT = "one-pixel-studio-gif";
  const VERSION = 1;
  const PROJECT_FORMAT = "one-pixel-studio";
  const PROJECT_VERSION = 2;
  const MAX_DIMENSION = 512;
  const MAX_FRAMES = 256;
  const MAX_LAYERS = 32;
  // The exporter retains composed RGBA-like integer pixels and indexed pixels.
  // Cap selected output to 1,048,576 pixels (four 512×512 frames) to keep
  // those core buffers near 5 MiB before palette and encoded-output buffers.
  const MAX_TOTAL_PIXELS = 1024 * 1024;
  const MAX_PROJECT_CEL_PIXELS = 16 * 1024 * 1024;
  const MAX_RGB_LOOKUP_CACHE = 65536;
  const MAX_GIF_BYTES = 16 * 1024 * 1024;
  const TRANSPARENT = 0xffffffff;
  const HEX = /^#[0-9a-fA-F]{6}$/;
  const HISTOGRAM_SIZE = 1 << 15;

  function isObject(value) {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
  }

  function assertInteger(value, name, min, max) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(name + " must be a whole number between " + min + " and " + max + ".");
    }
  }

  function readHex(color) {
    return parseInt(color.slice(1), 16);
  }

  function assertUniqueIds(items, label) {
    const ids = new Set();
    items.forEach(function (item) {
      if (!isObject(item) || typeof item.id !== "string" || !item.id || ids.has(item.id)) {
        throw new Error(label + " IDs must be present and unique.");
      }
      ids.add(item.id);
    });
    return ids;
  }

  function validateProject(project) {
    if (!isObject(project)) throw new Error("Project must be an object.");
    if (project.format !== PROJECT_FORMAT || project.version !== PROJECT_VERSION) {
      throw new Error("GIF export requires a version 2 One Pixel Studio project.");
    }
    if (!isObject(project.canvas)) throw new Error("Project canvas settings are missing.");

    const width = project.canvas.width;
    const height = project.canvas.height;
    assertInteger(width, "Canvas width", 1, MAX_DIMENSION);
    assertInteger(height, "Canvas height", 1, MAX_DIMENSION);

    if (!Array.isArray(project.frames) || project.frames.length < 1 || project.frames.length > MAX_FRAMES) {
      throw new Error("Project must contain 1–" + MAX_FRAMES + " frames.");
    }
    if (!Array.isArray(project.layers) || project.layers.length < 1 || project.layers.length > MAX_LAYERS) {
      throw new Error("Project must contain 1–" + MAX_LAYERS + " layers.");
    }
    if (!Array.isArray(project.cels)) throw new Error("Project cels must be an array.");

    const frameIds = assertUniqueIds(project.frames, "Frame");
    const layerIds = assertUniqueIds(project.layers, "Layer");
    project.frames.forEach(function (frame) {
      if (typeof frame.name !== "string" || !frame.name.trim()) throw new Error("Every frame needs a name.");
      assertInteger(frame.durationMs, "Frame duration", 10, 60000);
    });
    project.layers.forEach(function (layer) {
      if (typeof layer.visible !== "boolean") throw new Error("Layer visibility must be boolean.");
    });

    const celKeys = new Set();
    let sourceCelPixels = 0;
    project.cels.forEach(function (cel) {
      if (!isObject(cel) || !layerIds.has(cel.layerId) || !frameIds.has(cel.frameId)) {
        throw new Error("Every cel must reference an existing layer and frame.");
      }
      const key = cel.layerId + "::" + cel.frameId;
      if (celKeys.has(key)) throw new Error("A layer/frame pair cannot contain duplicate cels.");
      celKeys.add(key);
      if (!Array.isArray(cel.pixels) || cel.pixels.length !== width * height) {
        throw new Error("Each cel must contain exactly width × height pixels.");
      }
      sourceCelPixels += cel.pixels.length;
      if (sourceCelPixels > MAX_PROJECT_CEL_PIXELS) {
        throw new Error("Project exceeds the GIF export source cel-data safety limit.");
      }
      for (let i = 0; i < cel.pixels.length; i += 1) {
        const color = cel.pixels[i];
        if (color !== null && (typeof color !== "string" || !HEX.test(color))) {
          throw new Error("Cel pixels must be transparent or valid HEX colors.");
        }
      }
    });

    return { width: width, height: height, frameIds: frameIds, layerIds: layerIds };
  }

  function resolveIds(selection, available, defaults, label) {
    if (selection === undefined || selection === null) return defaults.slice();
    if (!Array.isArray(selection) || selection.length < 1) {
      throw new Error(label + " must be a non-empty array when provided.");
    }
    const seen = new Set();
    selection.forEach(function (id) {
      if (typeof id !== "string" || !available.has(id)) {
        throw new Error("Unknown " + label.replace(/ IDs$/, "").toLowerCase() + " ID: " + String(id));
      }
      if (seen.has(id)) throw new Error(label + " cannot contain duplicate IDs.");
      seen.add(id);
    });
    return selection.slice();
  }

  function composeFrames(project, dimensions, options) {
    const width = dimensions.width;
    const height = dimensions.height;
    const frameIds = resolveIds(
      options.frameIds,
      dimensions.frameIds,
      project.frames.map(function (frame) { return frame.id; }),
      "Frame IDs"
    );
    const defaultLayerIds = project.layers.filter(function (layer) { return layer.visible; })
      .map(function (layer) { return layer.id; });
    const selectedLayerIds = resolveIds(options.layerIds, dimensions.layerIds, defaultLayerIds, "Layer IDs");
    const layerOrder = project.layers.filter(function (layer) { return selectedLayerIds.includes(layer.id); });
    const framesById = new Map(project.frames.map(function (frame) { return [frame.id, frame]; }));
    const celsByKey = new Map(project.cels.map(function (cel) {
      return [cel.layerId + "::" + cel.frameId, cel];
    }));
    const framePixels = width * height;
    const totalPixels = framePixels * frameIds.length;
    const maxPixels = options.maxTotalPixels === undefined ? MAX_TOTAL_PIXELS : options.maxTotalPixels;
    assertInteger(maxPixels, "Maximum total export pixels", 1, MAX_TOTAL_PIXELS);
    if (!Number.isSafeInteger(totalPixels) || totalPixels > maxPixels) {
      throw new Error("Animated GIF is too large (" + totalPixels + " frame pixels). Reduce the selected frames or canvas size.");
    }

    const frames = frameIds.map(function (frameId) {
      const frame = framesById.get(frameId);
      const pixels = new Uint32Array(framePixels);
      pixels.fill(TRANSPARENT);
      layerOrder.forEach(function (layer) {
        const cel = celsByKey.get(layer.id + "::" + frameId);
        if (!cel) return;
        for (let i = 0; i < framePixels; i += 1) {
          const color = cel.pixels[i];
          if (color !== null) pixels[i] = readHex(color);
        }
      });
      return {
        id: frame.id,
        name: frame.name,
        durationMs: frame.durationMs,
        pixels: pixels
      };
    });

    return {
      width: width,
      height: height,
      frameIds: frameIds,
      frames: frames,
      totalPixels: totalPixels
    };
  }

  function inspectColors(frames, maxOpaqueColors) {
    const exact = new Map();
    let hasTransparency = false;
    let overflow = false;

    for (let f = 0; f < frames.length; f += 1) {
      const pixels = frames[f].pixels;
      for (let i = 0; i < pixels.length; i += 1) {
        const color = pixels[i];
        if (color === TRANSPARENT) {
          hasTransparency = true;
          continue;
        }
        if (!exact.has(color)) {
          if (exact.size < maxOpaqueColors) exact.set(color, exact.size);
          else overflow = true;
        }
      }
    }

    return { exact: exact, hasTransparency: hasTransparency, overflow: overflow };
  }

  function makeHistogram(frames) {
    const counts = new Uint32Array(HISTOGRAM_SIZE);
    const redSums = new Uint32Array(HISTOGRAM_SIZE);
    const greenSums = new Uint32Array(HISTOGRAM_SIZE);
    const blueSums = new Uint32Array(HISTOGRAM_SIZE);

    frames.forEach(function (frame) {
      const pixels = frame.pixels;
      for (let i = 0; i < pixels.length; i += 1) {
        const color = pixels[i];
        if (color === TRANSPARENT) continue;
        const red = color >>> 16;
        const green = (color >>> 8) & 255;
        const blue = color & 255;
        const index = ((red >>> 3) << 10) | ((green >>> 3) << 5) | (blue >>> 3);
        counts[index] += 1;
        redSums[index] += red;
        greenSums[index] += green;
        blueSums[index] += blue;
      }
    });

    const points = [];
    for (let index = 0; index < HISTOGRAM_SIZE; index += 1) {
      const count = counts[index];
      if (!count) continue;
      points.push({
        r: redSums[index] / count,
        g: greenSums[index] / count,
        b: blueSums[index] / count,
        weight: count
      });
    }
    return points;
  }

  function boxMetrics(points) {
    let minR = 255, minG = 255, minB = 255;
    let maxR = 0, maxG = 0, maxB = 0;
    let weight = 0;
    points.forEach(function (point) {
      minR = Math.min(minR, point.r); maxR = Math.max(maxR, point.r);
      minG = Math.min(minG, point.g); maxG = Math.max(maxG, point.g);
      minB = Math.min(minB, point.b); maxB = Math.max(maxB, point.b);
      weight += point.weight;
    });
    const ranges = [maxR - minR, maxG - minG, maxB - minB];
    let axis = 0;
    if (ranges[1] > ranges[axis]) axis = 1;
    if (ranges[2] > ranges[axis]) axis = 2;
    return { axis: axis, range: ranges[axis], weight: weight, score: ranges[axis] * weight };
  }

  function medianCut(points, limit) {
    if (points.length <= limit) {
      return points.map(function (point) { return colorFromPoint(point); });
    }
    const boxes = [{ points: points, metrics: boxMetrics(points) }];

    while (boxes.length < limit) {
      let selected = -1;
      let bestScore = -1;
      for (let i = 0; i < boxes.length; i += 1) {
        const box = boxes[i];
        if (box.points.length < 2 || box.metrics.range <= 0) continue;
        if (box.metrics.score > bestScore) {
          bestScore = box.metrics.score;
          selected = i;
        }
      }
      if (selected < 0) break;

      const box = boxes[selected];
      const axisName = ["r", "g", "b"][box.metrics.axis];
      box.points.sort(function (a, b) { return a[axisName] - b[axisName]; });
      const halfway = box.metrics.weight / 2;
      let accumulated = 0;
      let split = 0;
      for (; split < box.points.length - 1; split += 1) {
        accumulated += box.points[split].weight;
        if (accumulated >= halfway) {
          split += 1;
          break;
        }
      }
      split = Math.max(1, Math.min(box.points.length - 1, split));
      const left = box.points.slice(0, split);
      const right = box.points.slice(split);
      boxes.splice(selected, 1,
        { points: left, metrics: boxMetrics(left) },
        { points: right, metrics: boxMetrics(right) }
      );
    }

    return boxes.map(function (box) {
      let red = 0, green = 0, blue = 0, weight = 0;
      box.points.forEach(function (point) {
        red += point.r * point.weight;
        green += point.g * point.weight;
        blue += point.b * point.weight;
        weight += point.weight;
      });
      return {
        r: Math.round(red / weight),
        g: Math.round(green / weight),
        b: Math.round(blue / weight)
      };
    });
  }

  function colorFromPoint(point) {
    return { r: Math.round(point.r), g: Math.round(point.g), b: Math.round(point.b) };
  }

  function buildPaletteSearchTree(palette) {
    const entries = palette.map(function (color, index) {
      return { color: color, index: index };
    });

    function build(items) {
      if (!items.length) return null;
      let minR = 255, minG = 255, minB = 255;
      let maxR = 0, maxG = 0, maxB = 0;
      items.forEach(function (item) {
        minR = Math.min(minR, item.color.r); maxR = Math.max(maxR, item.color.r);
        minG = Math.min(minG, item.color.g); maxG = Math.max(maxG, item.color.g);
        minB = Math.min(minB, item.color.b); maxB = Math.max(maxB, item.color.b);
      });
      const ranges = [maxR - minR, maxG - minG, maxB - minB];
      let axis = 0;
      if (ranges[1] > ranges[axis]) axis = 1;
      if (ranges[2] > ranges[axis]) axis = 2;
      const channel = ["r", "g", "b"][axis];
      items.sort(function (a, b) {
        return a.color[channel] - b.color[channel] || a.index - b.index;
      });
      const middle = Math.floor(items.length / 2);
      return {
        entry: items[middle],
        axis: axis,
        left: build(items.slice(0, middle)),
        right: build(items.slice(middle + 1))
      };
    }

    return build(entries);
  }

  function nearestPaletteIndex(color, tree) {
    const red = color >>> 16;
    const green = (color >>> 8) & 255;
    const blue = color & 255;
    const channels = [red, green, blue];
    let bestIndex = 0;
    let bestDistance = Infinity;

    function visit(node) {
      if (!node) return;
      const candidate = node.entry.color;
      const dr = red - candidate.r;
      const dg = green - candidate.g;
      const db = blue - candidate.b;
      const distance = dr * dr + dg * dg + db * db;
      if (distance < bestDistance || (distance === bestDistance && node.entry.index < bestIndex)) {
        bestDistance = distance;
        bestIndex = node.entry.index;
      }

      const axisName = ["r", "g", "b"][node.axis];
      const delta = channels[node.axis] - candidate[axisName];
      const near = delta <= 0 ? node.left : node.right;
      const far = delta <= 0 ? node.right : node.left;
      visit(near);
      if (delta * delta <= bestDistance) visit(far);
    }

    visit(tree);
    return bestIndex;
  }

  function buildPalette(frames, colorInfo) {
    const maximum = colorInfo.hasTransparency ? 255 : 256;
    let palette;
    let exactMap = null;
    let searchTree = null;
    let quantized = false;

    if (!colorInfo.overflow) {
      exactMap = colorInfo.exact;
      palette = Array.from(exactMap.keys()).map(function (color) {
        return { r: color >>> 16, g: (color >>> 8) & 255, b: color & 255 };
      });
    } else {
      quantized = true;
      palette = medianCut(makeHistogram(frames), maximum);
      searchTree = buildPaletteSearchTree(palette);
    }

    const transparentIndex = colorInfo.hasTransparency ? palette.length : null;
    const colorTableEntries = nextPowerOfTwo(Math.max(2, palette.length + (colorInfo.hasTransparency ? 1 : 0)));
    return {
      colors: palette,
      exactMap: exactMap,
      searchTree: searchTree,
      quantized: quantized,
      transparentIndex: transparentIndex,
      colorTableEntries: colorTableEntries,
      colorTableBits: Math.round(Math.log2(colorTableEntries))
    };
  }

  function nextPowerOfTwo(value) {
    let result = 2;
    while (result < value) result *= 2;
    return result;
  }

  function toIndexedFrames(frames, palette) {
    const output = [];
    const colorCache = palette.searchTree ? new Map() : null;
    let transparentPixelCount = 0;
    frames.forEach(function (frame) {
      const indexes = new Uint8Array(frame.pixels.length);
      for (let i = 0; i < frame.pixels.length; i += 1) {
        const color = frame.pixels[i];
        if (color === TRANSPARENT) {
          indexes[i] = palette.transparentIndex;
          transparentPixelCount += 1;
        } else if (palette.exactMap) {
          indexes[i] = palette.exactMap.get(color);
        } else {
          let paletteIndex = colorCache.get(color);
          if (paletteIndex === undefined) {
            paletteIndex = nearestPaletteIndex(color, palette.searchTree);
            if (colorCache.size < MAX_RGB_LOOKUP_CACHE) colorCache.set(color, paletteIndex);
          }
          indexes[i] = paletteIndex;
        }
      }
      output.push({
        id: frame.id,
        name: frame.name,
        durationMs: frame.durationMs,
        delayCentiseconds: Math.max(1, Math.round(frame.durationMs / 10)),
        effectiveDurationMs: Math.max(1, Math.round(frame.durationMs / 10)) * 10,
        indexes: indexes
      });
    });
    return { frames: output, transparentPixelCount: transparentPixelCount };
  }

  function ByteWriter(maxBytes) {
    this.buffer = new Uint8Array(1024);
    this.length = 0;
    this.maxBytes = maxBytes;
  }
  ByteWriter.prototype.ensure = function (extra) {
    const needed = this.length + extra;
    if (needed > this.maxBytes) throw new Error("Encoded GIF exceeds the " + this.maxBytes + " byte safety limit.");
    if (needed <= this.buffer.length) return;
    let capacity = this.buffer.length;
    while (capacity < needed) capacity = Math.min(this.maxBytes, capacity * 2);
    const next = new Uint8Array(capacity);
    next.set(this.buffer.subarray(0, this.length));
    this.buffer = next;
  };
  ByteWriter.prototype.byte = function (value) {
    this.ensure(1);
    this.buffer[this.length++] = value & 255;
  };
  ByteWriter.prototype.bytes = function (values) {
    this.ensure(values.length);
    this.buffer.set(values, this.length);
    this.length += values.length;
  };
  ByteWriter.prototype.word = function (value) {
    this.byte(value & 255);
    this.byte((value >>> 8) & 255);
  };
  ByteWriter.prototype.asUint8Array = function () {
    return this.buffer.slice(0, this.length);
  };

  function writeAscii(writer, value) {
    for (let i = 0; i < value.length; i += 1) writer.byte(value.charCodeAt(i));
  }

  function lzwCompress(indexes, minimumCodeSize) {
    const clearCode = 1 << minimumCodeSize;
    const endCode = clearCode + 1;
    const dictionary = new Map();
    const bytes = new ByteWriter(Math.max(1024, indexes.length * 2 + 1024));
    let bitBuffer = 0;
    let bitCount = 0;
    let codeSize = minimumCodeSize + 1;
    let nextCode = endCode + 1;

    function writeCode(code) {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        bytes.byte(bitBuffer & 255);
        bitBuffer >>>= 8;
        bitCount -= 8;
      }
    }

    writeCode(clearCode);
    if (!indexes.length) {
      writeCode(endCode);
    } else {
      let prefix = indexes[0];
      for (let i = 1; i < indexes.length; i += 1) {
        const symbol = indexes[i];
        const key = prefix * 256 + symbol;
        const existing = dictionary.get(key);
        if (existing !== undefined) {
          prefix = existing;
          continue;
        }

        writeCode(prefix);
        if (nextCode < 4096) {
          dictionary.set(key, nextCode);
          nextCode += 1;
          // The encoder is one dictionary entry ahead of the decoder at this point.
          if (nextCode > (1 << codeSize) && codeSize < 12) codeSize += 1;
        } else {
          writeCode(clearCode);
          dictionary.clear();
          codeSize = minimumCodeSize + 1;
          nextCode = endCode + 1;
        }
        prefix = symbol;
      }
      writeCode(prefix);
      writeCode(endCode);
    }

    if (bitCount > 0) bytes.byte(bitBuffer & 255);
    return bytes.asUint8Array();
  }

  function appendSubBlocks(writer, compressed) {
    let offset = 0;
    while (offset < compressed.length) {
      const length = Math.min(255, compressed.length - offset);
      writer.byte(length);
      writer.bytes(compressed.subarray(offset, offset + length));
      offset += length;
    }
    writer.byte(0);
  }

  function encodeGIF(project, options) {
    options = options || {};
    const dimensions = validateProject(project);
    const composed = composeFrames(project, dimensions, options);
    const colorProbe = inspectColors(composed.frames, 256);
    const maxOpaqueColors = colorProbe.hasTransparency ? 255 : 256;
    const colorInfo = inspectColors(composed.frames, maxOpaqueColors);
    const palette = buildPalette(composed.frames, colorInfo);
    const indexed = toIndexedFrames(composed.frames, palette);

    const loopCount = options.loopCount === undefined ? 0 : options.loopCount;
    if (loopCount !== null) assertInteger(loopCount, "Loop count", 0, 65535);
    const maxBytes = options.maxBytes === undefined ? MAX_GIF_BYTES : options.maxBytes;
    assertInteger(maxBytes, "Maximum GIF bytes", 1024, MAX_GIF_BYTES);

    const writer = new ByteWriter(maxBytes);
    writeAscii(writer, "GIF89a");
    writer.word(dimensions.width);
    writer.word(dimensions.height);
    writer.byte(0x80 | 0x70 | (palette.colorTableBits - 1));
    writer.byte(palette.transparentIndex === null ? 0 : palette.transparentIndex);
    writer.byte(0);

    for (let i = 0; i < palette.colorTableEntries; i += 1) {
      const color = palette.colors[i];
      writer.byte(color ? color.r : 0);
      writer.byte(color ? color.g : 0);
      writer.byte(color ? color.b : 0);
    }

    if (loopCount !== null) {
      writer.bytes([0x21, 0xff, 0x0b]);
      writeAscii(writer, "NETSCAPE2.0");
      writer.bytes([0x03, 0x01, loopCount & 255, (loopCount >>> 8) & 255, 0x00]);
    }

    const minimumCodeSize = Math.max(2, palette.colorTableBits);
    const frameMetadata = [];
    indexed.frames.forEach(function (frame, index) {
      const hasTransparency = palette.transparentIndex !== null;
      const disposal = hasTransparency ? 2 : 1;
      const packedControl = (disposal << 2) | (hasTransparency ? 1 : 0);
      writer.bytes([0x21, 0xf9, 0x04, packedControl]);
      writer.word(frame.delayCentiseconds);
      writer.byte(hasTransparency ? palette.transparentIndex : 0);
      writer.byte(0);

      writer.byte(0x2c);
      writer.word(0);
      writer.word(0);
      writer.word(dimensions.width);
      writer.word(dimensions.height);
      writer.byte(0);
      writer.byte(minimumCodeSize);
      const compressed = lzwCompress(frame.indexes, minimumCodeSize);
      appendSubBlocks(writer, compressed);

      frameMetadata.push({
        index: index,
        frameId: frame.id,
        name: frame.name,
        width: dimensions.width,
        height: dimensions.height,
        durationMs: frame.durationMs,
        encodedDelayCentiseconds: frame.delayCentiseconds,
        effectiveDurationMs: frame.effectiveDurationMs
      });
    });
    writer.byte(0x3b);

    const bytes = writer.asUint8Array();
    const diagnostics = {
      paletteMode: palette.quantized ? "median-cut" : "exact",
      opaquePaletteColors: palette.colors.length,
      colorTableEntries: palette.colorTableEntries,
      quantization: palette.quantized
        ? "5-bit-per-channel RGB histogram followed by weighted median-cut; each source RGB maps to its exact nearest palette entry by squared RGB distance (bounded cache + k-d tree), without dithering"
        : "Exact RGB palette; no color quantization",
      transparency: palette.transparentIndex === null
        ? "No transparent pixels in selected frames"
        : "One reserved fully-transparent palette index; GIF transparency is binary and cannot preserve partial alpha",
      transparentPixelCount: indexed.transparentPixelCount,
      loopCount: loopCount,
      loopBehavior: loopCount === null ? "No looping extension; play once" : (loopCount === 0 ? "Infinite loop" : loopCount + " repeat(s)"),
      totalFramePixels: composed.totalPixels,
      encodedBytes: bytes.length
    };
    const metadata = {
      format: FORMAT,
      version: VERSION,
      image: { mimeType: "image/gif", width: dimensions.width, height: dimensions.height },
      frameCount: frameMetadata.length,
      frames: frameMetadata,
      diagnostics: diagnostics
    };

    return { bytes: bytes, metadata: metadata, diagnostics: diagnostics };
  }

  function exportGIF(project, options) {
    const result = encodeGIF(project, options);
    const blob = new Blob([result.bytes], { type: "image/gif" });
    return { blob: blob, metadata: result.metadata, diagnostics: result.diagnostics };
  }

  return Object.freeze({
    FORMAT: FORMAT,
    VERSION: VERSION,
    MAX_TOTAL_PIXELS: MAX_TOTAL_PIXELS,
    MAX_GIF_BYTES: MAX_GIF_BYTES,
    validateProject: validateProject,
    encodeGIF: encodeGIF,
    exportGIF: exportGIF
  });
});