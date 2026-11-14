/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const GIF = require("../js/gif-export.js");

function makeProject(options = {}) {
  const width = options.width || 3;
  const height = options.height || 2;
  const layer = { id: "layer-1", name: "Layer 1", visible: true, locked: false, opacity: 1 };
  const first = { id: "frame-1", name: "First", durationMs: options.firstDuration || 100 };
  const project = {
    format: "one-pixel-studio",
    version: 2,
    id: "project-gif-test",
    name: "GIF test",
    canvas: { width: width, height: height, background: null },
    palette: ["#ff0000", "#00ff00", "#0000ff", "#ffffff"],
    selectedColorIndex: 0,
    layers: [layer],
    frames: [first],
    cels: [{
      layerId: layer.id,
      frameId: first.id,
      pixels: options.firstPixels || ["#ff0000", null, "#00ff00", "#0000ff", "#ffffff", null]
    }],
    activeLayerId: layer.id,
    activeFrameId: first.id,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
  if (options.second !== false) {
    const second = { id: "frame-2", name: "Second", durationMs: options.secondDuration || 145 };
    project.frames.push(second);
    project.cels.push({
      layerId: layer.id,
      frameId: second.id,
      pixels: options.secondPixels || ["#0000ff", "#00ff00", null, "#ff0000", null, "#ffffff"]
    });
  }
  return project;
}

function makeSingleFrame(width, height, pixels) {
  return {
    format: "one-pixel-studio", version: 2, id: "large-color-test", name: "Color test",
    canvas: { width, height, background: null },
    palette: ["#000000"], selectedColorIndex: 0,
    layers: [{ id: "layer-1", name: "Layer 1", visible: true, locked: false, opacity: 1 }],
    frames: [{ id: "frame-1", name: "Frame 1", durationMs: 100 }],
    cels: [{ layerId: "layer-1", frameId: "frame-1", pixels: pixels }],
    activeLayerId: "layer-1", activeFrameId: "frame-1",
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
}

function readWord(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function decodeLzw(data, minimumCodeSize, expectedPixels) {
  const clearCode = 1 << minimumCodeSize;
  const endCode = clearCode + 1;
  let codeSize;
  let nextCode;
  let dictionary;
  let bitOffset = 0;
  const output = [];

  function reset() {
    codeSize = minimumCodeSize + 1;
    nextCode = endCode + 1;
    dictionary = Array.from({ length: clearCode }, (_, index) => [index]);
    dictionary[clearCode] = null;
    dictionary[endCode] = null;
  }
  function readCode() {
    if (bitOffset + codeSize > data.length * 8) return null;
    let value = 0;
    for (let bit = 0; bit < codeSize; bit += 1) {
      const absolute = bitOffset + bit;
      value |= ((data[absolute >>> 3] >>> (absolute & 7)) & 1) << bit;
    }
    bitOffset += codeSize;
    return value;
  }

  reset();
  let previous = null;
  let sawEnd = false;
  for (let guard = 0; guard < expectedPixels * 4 + 100; guard += 1) {
    const code = readCode();
    if (code === null) break;
    if (code === clearCode) {
      reset();
      previous = null;
      continue;
    }
    if (code === endCode) {
      sawEnd = true;
      break;
    }

    let entry;
    if (code < nextCode && dictionary[code]) entry = dictionary[code];
    else if (code === nextCode && previous) entry = previous.concat(previous[0]);
    else throw new Error("Invalid LZW code " + code + " at dictionary size " + nextCode);

    output.push(...entry);
    if (previous && nextCode < 4096) {
      dictionary[nextCode] = previous.concat(entry[0]);
      nextCode += 1;
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
    }
    previous = entry;
  }

  assert.equal(sawEnd, true, "LZW stream should contain an end code");
  assert.equal(output.length, expectedPixels, "decoded frame should contain exactly width × height indexes");
  return Uint8Array.from(output);
}

function parseGif(bytes) {
  assert.equal(String.fromCharCode(...bytes.slice(0, 6)), "GIF89a");
  const width = readWord(bytes, 6);
  const height = readWord(bytes, 8);
  const packed = bytes[10];
  assert.ok(packed & 0x80, "GIF should contain a global color table");
  const tableSize = 1 << ((packed & 0x07) + 1);
  let offset = 13;
  const globalPalette = [];
  for (let i = 0; i < tableSize; i += 1) {
    globalPalette.push([bytes[offset], bytes[offset + 1], bytes[offset + 2]]);
    offset += 3;
  }

  const frames = [];
  let loopCount = null;
  let pendingControl = null;
  while (offset < bytes.length) {
    const marker = bytes[offset++];
    if (marker === 0x3b) break;
    if (marker === 0x21) {
      const label = bytes[offset++];
      if (label === 0xf9) {
        assert.equal(bytes[offset++], 4);
        const control = bytes[offset++];
        const delay = readWord(bytes, offset); offset += 2;
        const transparentIndex = bytes[offset++];
        assert.equal(bytes[offset++], 0);
        pendingControl = {
          delayCentiseconds: delay,
          transparent: Boolean(control & 1),
          transparentIndex: transparentIndex,
          disposal: (control >>> 2) & 7
        };
      } else if (label === 0xff) {
        const blockLength = bytes[offset++];
        const app = String.fromCharCode(...bytes.slice(offset, offset + blockLength));
        offset += blockLength;
        const chunks = [];
        while (true) {
          const length = bytes[offset++];
          if (!length) break;
          chunks.push(...bytes.slice(offset, offset + length));
          offset += length;
        }
        if (app === "NETSCAPE2.0" && chunks.length >= 3 && chunks[0] === 1) {
          loopCount = chunks[1] | (chunks[2] << 8);
        }
      } else {
        while (true) {
          const length = bytes[offset++];
          if (!length) break;
          offset += length;
        }
      }
      continue;
    }
    if (marker !== 0x2c) throw new Error("Unexpected GIF block marker 0x" + marker.toString(16));

    const left = readWord(bytes, offset); offset += 2;
    const top = readWord(bytes, offset); offset += 2;
    const frameWidth = readWord(bytes, offset); offset += 2;
    const frameHeight = readWord(bytes, offset); offset += 2;
    const imagePacked = bytes[offset++];
    assert.equal(imagePacked & 0x80, 0, "frames should reuse the global palette");
    const minimumCodeSize = bytes[offset++];
    const chunks = [];
    while (true) {
      const length = bytes[offset++];
      if (!length) break;
      chunks.push(...bytes.slice(offset, offset + length));
      offset += length;
    }
    const indexes = decodeLzw(Uint8Array.from(chunks), minimumCodeSize, frameWidth * frameHeight);
    frames.push({
      left, top, width: frameWidth, height: frameHeight,
      indexes, control: pendingControl, palette: globalPalette
    });
    pendingControl = null;
  }

  assert.equal(bytes[bytes.length - 1], 0x3b, "GIF should end with trailer");
  return { width, height, globalPalette, loopCount, frames };
}

function colorAt(frame, x, y) {
  const index = frame.indexes[y * frame.width + x];
  if (frame.control && frame.control.transparent && index === frame.control.transparentIndex) return null;
  return "#" + frame.palette[index].map(value => value.toString(16).padStart(2, "0")).join("");
}

test("encodes a one-frame GIF89a with native dimensions and exact pixels", () => {
  const project = makeProject({ second: false });
  const result = GIF.encodeGIF(project, { loopCount: null });
  const parsed = parseGif(result.bytes);

  assert.deepEqual([parsed.width, parsed.height], [3, 2]);
  assert.equal(parsed.frames.length, 1);
  assert.equal(parsed.loopCount, null);
  assert.equal(colorAt(parsed.frames[0], 0, 0), "#ff0000");
  assert.equal(colorAt(parsed.frames[0], 2, 0), "#00ff00");
  assert.equal(colorAt(parsed.frames[0], 1, 0), null);
  assert.equal(result.metadata.frameCount, 1);
  assert.equal(result.diagnostics.paletteMode, "exact");
});

test("encodes ordered animation frames, rounded delays and infinite looping", () => {
  const project = makeProject();
  const result = GIF.encodeGIF(project, { loopCount: 0 });
  const parsed = parseGif(result.bytes);

  assert.equal(parsed.frames.length, 2);
  assert.equal(parsed.loopCount, 0);
  assert.deepEqual(parsed.frames.map(frame => frame.control.delayCentiseconds), [10, 15]);
  assert.equal(colorAt(parsed.frames[0], 0, 0), "#ff0000");
  assert.equal(colorAt(parsed.frames[1], 0, 0), "#0000ff");
  assert.deepEqual(result.metadata.frames.map(frame => frame.frameId), project.frames.map(frame => frame.id));
  assert.deepEqual(result.metadata.frames.map(frame => frame.effectiveDurationMs), [100, 150]);
});

test("supports explicit frame ordering and finite repeat counts", () => {
  const project = makeProject();
  const [first, second] = project.frames;
  const result = GIF.encodeGIF(project, { frameIds: [second.id, first.id], loopCount: 3 });
  const parsed = parseGif(result.bytes);
  assert.equal(parsed.loopCount, 3);
  assert.equal(parsed.frames.length, 2);
  assert.equal(colorAt(parsed.frames[0], 0, 0), "#0000ff");
  assert.deepEqual(result.metadata.frames.map(frame => frame.frameId), [second.id, first.id]);
});

test("uses a reserved binary transparency index and clears between transparent frames", () => {
  const project = makeProject();
  const result = GIF.encodeGIF(project);
  const parsed = parseGif(result.bytes);
  assert.equal(parsed.frames[0].control.transparent, true);
  assert.equal(parsed.frames[0].control.disposal, 2);
  assert.equal(colorAt(parsed.frames[0], 1, 0), null);
  assert.equal(result.diagnostics.transparentPixelCount, 4);
  assert.match(result.diagnostics.transparency, /binary/);
});

test("quantizes more than 256 source colors into a valid GIF palette", () => {
  const width = 20;
  const height = 15;
  const pixels = Array.from({ length: width * height }, (_, index) => {
    const red = index & 255;
    const green = (index >>> 8) & 255;
    const blue = (index * 17) & 255;
    return "#" + [red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("");
  });
  const project = makeSingleFrame(width, height, pixels);
  const result = GIF.encodeGIF(project);
  const parsed = parseGif(result.bytes);

  assert.equal(parsed.frames.length, 1);
  assert.equal(result.diagnostics.paletteMode, "median-cut");
  assert.ok(result.diagnostics.opaquePaletteColors <= 256);
  assert.ok(new Set(parsed.frames[0].indexes).size <= 256);
  assert.equal(parsed.frames[0].indexes.length, width * height);
});

test("maps actual RGB values to their nearest palette entry, not the 5-bit bucket midpoint", () => {
  const pixels = ["#222799"];
  const seenBuckets = new Set([((0x22 >>> 3) << 10) | ((0x27 >>> 3) << 5) | (0x99 >>> 3)]);
  let state = 13;
  while (pixels.length < 257) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const red = (state >>> 24) & 255;
    const green = (state >>> 16) & 255;
    const blue = (state >>> 8) & 255;
    const bucket = ((red >>> 3) << 10) | ((green >>> 3) << 5) | (blue >>> 3);
    if (seenBuckets.has(bucket)) continue;
    seenBuckets.add(bucket);
    pixels.push("#" + [red, green, blue].map(value => value.toString(16).padStart(2, "0")).join(""));
  }

  const source = "#d2384e";
  assert.equal(pixels[58], source, "the seeded reproduction must retain Agent 2's pixel-58 fixture");
  const parsed = parseGif(GIF.encodeGIF(makeSingleFrame(257, 1, pixels)).bytes);
  const exactPaletteEntryExists = parsed.globalPalette.some(rgb => rgb.join(",") === "210,56,78");
  assert.equal(exactPaletteEntryExists, true, "the exact source RGB should be retained in the median-cut palette");
  assert.equal(colorAt(parsed.frames[0], 58, 0), source,
    "the pixel must select its exact RGB palette entry rather than the bucket-midpoint neighbour");
});

test("keeps transparency when palette overflow requires median-cut quantization", () => {
  const width = 20;
  const height = 15;
  const pixels = Array.from({ length: width * height }, (_, index) => {
    if (index === width * height - 1) return null;
    const red = index & 255;
    const green = (index >>> 8) & 255;
    const blue = (index * 19) & 255;
    return "#" + [red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("");
  });
  const project = makeSingleFrame(width, height, pixels);
  const result = GIF.encodeGIF(project);
  const parsed = parseGif(result.bytes);
  const frame = parsed.frames[0];

  assert.equal(result.diagnostics.paletteMode, "median-cut");
  assert.ok(result.diagnostics.opaquePaletteColors <= 255);
  assert.equal(frame.control.transparent, true);
  assert.equal(colorAt(frame, width - 1, height - 1), null);
});

test("resets a full LZW dictionary without corrupting subsequent pixels", () => {
  const width = 128;
  const height = 128;
  let state = 0x12345678;
  const pixels = Array.from({ length: width * height }, () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const index = (state >>> 24) & 255;
    return "#" + index.toString(16).padStart(2, "0") + "0000";
  });
  const project = makeSingleFrame(width, height, pixels);
  const parsed = parseGif(GIF.encodeGIF(project).bytes);
  assert.equal(parsed.frames.length, 1);
  assert.equal(parsed.frames[0].indexes.length, width * height);
  assert.equal(colorAt(parsed.frames[0], 0, 0), pixels[0]);
  assert.equal(colorAt(parsed.frames[0], width - 1, height - 1), pixels[pixels.length - 1]);
});

test("composites visible layers and supports a requested hidden layer", () => {
  const project = makeProject({ second: false });
  const hidden = { id: "layer-hidden", name: "Hidden details", visible: false, locked: false, opacity: 1 };
  project.layers.push(hidden);
  project.cels.push({
    layerId: hidden.id,
    frameId: project.frames[0].id,
    pixels: ["#123456", null, null, null, null, null]
  });

  const defaultGif = parseGif(GIF.encodeGIF(project).bytes);
  assert.equal(colorAt(defaultGif.frames[0], 0, 0), "#ff0000");
  const selectedGif = parseGif(GIF.encodeGIF(project, { layerIds: [project.layers[0].id, hidden.id] }).bytes);
  assert.equal(colorAt(selectedGif.frames[0], 0, 0), "#123456");
});

test("returns a browser-compatible image/gif Blob", async () => {
  const project = makeProject({ second: false });
  const result = GIF.exportGIF(project);
  assert.equal(result.blob.type, "image/gif");
  assert.ok(result.blob.size > 30);
  const signature = new Uint8Array(await result.blob.slice(0, 6).arrayBuffer());
  assert.equal(String.fromCharCode(...signature), "GIF89a");
  assert.equal(result.metadata.image.mimeType, "image/gif");
});

test("encodes the bounded 1,048,576-pixel work budget and rejects larger selections", () => {
  const width = 512;
  const height = 512;
  const framePixels = width * height;
  const pixels = new Array(framePixels).fill("#123456");
  const project = makeSingleFrame(width, height, pixels);
  for (let index = 1; index < 4; index += 1) {
    const frameId = "frame-" + (index + 1);
    project.frames.push({ id: frameId, name: "Frame " + (index + 1), durationMs: 100 });
    project.cels.push({ layerId: "layer-1", frameId: frameId, pixels: pixels });
  }

  assert.equal(GIF.MAX_TOTAL_PIXELS, 1024 * 1024);
  const result = GIF.encodeGIF(project);
  assert.equal(result.diagnostics.totalFramePixels, 1024 * 1024);
  assert.equal(result.metadata.frameCount, 4);
  assert.equal(result.metadata.image.width, 512);
  assert.equal(result.metadata.image.height, 512);
  assert.ok(result.bytes.length > 30);

  const fifthFrameId = "frame-5";
  project.frames.push({ id: fifthFrameId, name: "Frame 5", durationMs: 100 });
  project.cels.push({ layerId: "layer-1", frameId: fifthFrameId, pixels: pixels });
  assert.throws(() => GIF.encodeGIF(project), /too large|Maximum total export pixels/i);
});

test("rejects malformed projects, invalid options and excessive output sizes", () => {
  const project = makeProject();
  const badDimensions = structuredClone(project);
  badDimensions.canvas.width = 513;
  assert.throws(() => GIF.encodeGIF(badDimensions), /Canvas width/);

  const badDuration = structuredClone(project);
  badDuration.frames[0].durationMs = 5;
  assert.throws(() => GIF.encodeGIF(badDuration), /Frame duration/);

  assert.throws(() => GIF.encodeGIF(project, { frameIds: ["missing"] }), /Unknown frame ID/);
  assert.throws(() => GIF.encodeGIF(project, { loopCount: 65536 }), /Loop count/);
  assert.throws(() => GIF.encodeGIF(project, { maxTotalPixels: 1 }), /Maximum total export pixels|too large/);
  assert.throws(() => GIF.encodeGIF({}), /version 2/);
});