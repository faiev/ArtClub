/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.join(__dirname, "..", "examples", "exports");
const read = name => fs.readFileSync(path.join(ROOT, name));
const json = name => JSON.parse(read(name).toString("utf8"));

function decodeRgbaPng(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  assert.deepEqual(bytes.subarray(0, 8), signature, "PNG signature");
  let offset = 8;
  let header = null;
  const idat = [];
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const type = bytes.toString("ascii", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, offset + 8 + length);
    assert.ok(offset + 12 + length <= bytes.length, "PNG chunk must be fully present");
    if (type === "IHDR") header = data;
    if (type === "IDAT") idat.push(data);
    if (type === "IEND") {
      sawEnd = true;
      break;
    }
    offset += 12 + length;
  }
  assert.ok(header, "PNG must contain IHDR");
  assert.ok(sawEnd, "PNG must contain IEND");
  const width = header.readUInt32BE(0);
  const height = header.readUInt32BE(4);
  assert.equal(header[8], 8, "sample PNG must use 8-bit channels");
  assert.equal(header[9], 6, "sample PNG must use RGBA color type");
  assert.equal(header[12], 0, "sample PNG must be non-interlaced");
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const packed = zlib.inflateSync(Buffer.concat(idat));
  assert.equal(packed.length, height * (stride + 1), "inflated PNG scanline size");

  const pixels = Buffer.alloc(height * stride);
  let inputOffset = 0;
  function paeth(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : (pb <= pc ? b : c);
  }
  for (let y = 0; y < height; y += 1) {
    const filter = packed[inputOffset++];
    const rowOffset = y * stride;
    for (let x = 0; x < stride; x += 1) {
      const raw = packed[inputOffset++];
      const left = x >= bytesPerPixel ? pixels[rowOffset + x - bytesPerPixel] : 0;
      const up = y > 0 ? pixels[rowOffset - stride + x] : 0;
      const upperLeft = y > 0 && x >= bytesPerPixel
        ? pixels[rowOffset - stride + x - bytesPerPixel]
        : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) predictor = paeth(left, up, upperLeft);
      else if (filter !== 0) throw new Error("Unsupported PNG filter " + filter);
      pixels[rowOffset + x] = (raw + predictor) & 255;
    }
  }
  return { width, height, pixels };
}

function expectedAtlas(project, metadata) {
  const width = metadata.image.width;
  const height = metadata.image.height;
  const output = Buffer.alloc(width * height * 4);
  const layerIds = project.layers.filter(layer => layer.visible).map(layer => layer.id);
  const cels = new Map(project.cels.map(cel => [cel.layerId + "::" + cel.frameId, cel]));
  const frames = new Map(project.frames.map(frame => [frame.id, frame]));
  for (const record of metadata.frames) {
    assert.ok(frames.has(record.frameId), "metadata frame exists in project");
    for (const layerId of layerIds) {
      const cel = cels.get(layerId + "::" + record.frameId);
      if (!cel) continue;
      for (let index = 0; index < cel.pixels.length; index += 1) {
        const color = cel.pixels[index];
        if (color === null) continue;
        const x = record.x + (index % project.canvas.width);
        const y = record.y + Math.floor(index / project.canvas.width);
        const offset = (y * width + x) * 4;
        output[offset] = parseInt(color.slice(1, 3), 16);
        output[offset + 1] = parseInt(color.slice(3, 5), 16);
        output[offset + 2] = parseInt(color.slice(5, 7), 16);
        output[offset + 3] = 255;
      }
    }
  }
  return output;
}

function gifGraphicControls(bytes) {
  const controls = [];
  let offset = 0;
  while (true) {
    const index = bytes.indexOf(Buffer.from([0x21, 0xf9, 0x04]), offset);
    if (index < 0) break;
    const packed = bytes[index + 3];
    controls.push({
      disposal: (packed >>> 2) & 7,
      transparent: Boolean(packed & 1),
      delayCentiseconds: bytes.readUInt16LE(index + 4),
      transparentIndex: bytes[index + 6]
    });
    offset = index + 7;
  }
  return controls;
}

test("Tiny Robot source fixture is a complete small v2 animation", () => {
  const project = json("walk-cycle.project.json");
  assert.equal(project.format, "one-pixel-studio");
  assert.equal(project.version, 2);
  assert.deepEqual([project.canvas.width, project.canvas.height], [8, 8]);
  assert.equal(project.layers.length, 1);
  assert.deepEqual(project.frames.map(frame => frame.id), ["idle", "left", "contact", "right"]);
  assert.deepEqual(project.frames.map(frame => frame.durationMs), [100, 145, 155, 250]);
  assert.equal(project.cels.length, 4);
  for (const cel of project.cels) {
    assert.equal(cel.pixels.length, 64);
    assert.ok(project.frames.some(frame => frame.id === cel.frameId));
    assert.ok(project.layers.some(layer => layer.id === cel.layerId));
  }
});

test("PNG atlas dimensions, layout metadata and every RGBA pixel match the project fixture", () => {
  const project = json("walk-cycle.project.json");
  const metadata = json("walk-cycle.metadata.json");
  const png = decodeRgbaPng(read("walk-cycle.png"));
  assert.equal(metadata.format, "one-pixel-studio-sprite-sheet");
  assert.equal(metadata.version, 1);
  assert.deepEqual([png.width, png.height], [19, 19]);
  assert.deepEqual([metadata.image.width, metadata.image.height], [19, 19]);
  assert.deepEqual(metadata.layout, {
    type: "grid", columns: 2, rows: 2, margin: 1, spacing: 1
  });
  assert.deepEqual(metadata.frames.map(frame => [
    frame.frameId, frame.x, frame.y, frame.width, frame.height, frame.durationMs
  ]), [
    ["idle", 1, 1, 8, 8, 100],
    ["left", 10, 1, 8, 8, 145],
    ["contact", 1, 10, 8, 8, 155],
    ["right", 10, 10, 8, 8, 250]
  ]);
  assert.deepEqual(png.pixels, expectedAtlas(project, metadata),
    "decoded PNG pixels must match source cels, including transparent margins and gutters");
});

test("GIF illustration records actual centisecond delays, transparency and loop policy", () => {
  const project = json("walk-cycle.project.json");
  const metadata = json("walk-cycle.gif.metadata.json");
  const gif = read("walk-cycle.gif");
  assert.equal(gif.toString("ascii", 0, 6), "GIF89a");
  assert.deepEqual([gif.readUInt16LE(6), gif.readUInt16LE(8)], [8, 8]);
  assert.equal(gif[gif.length - 1], 0x3b, "GIF trailer");
  assert.equal(metadata.format, "one-pixel-studio-gif");
  assert.equal(metadata.version, 1);
  assert.equal(metadata.frameCount, project.frames.length);
  assert.equal(metadata.diagnostics.sampleBinary.includes("not byte-for-byte"), true);
  assert.deepEqual(metadata.frames.map(frame => [
    frame.frameId, frame.durationMs, frame.encodedDelayCentiseconds, frame.effectiveDurationMs
  ]), [
    ["idle", 100, 10, 100],
    ["left", 145, 15, 150],
    ["contact", 155, 16, 160],
    ["right", 250, 25, 250]
  ]);
  assert.equal(metadata.diagnostics.opaquePaletteColors, 4);
  assert.equal(metadata.diagnostics.transparentIndex, 0);
  assert.equal(metadata.diagnostics.loopCount, 0);
  assert.deepEqual(gifGraphicControls(gif).map(control => [
    control.disposal, control.transparent, control.delayCentiseconds, control.transparentIndex
  ]), [
    [2, true, 10, 0],
    [2, true, 15, 0],
    [2, true, 16, 0],
    [2, true, 25, 0]
  ]);
});

test("gallery links resolve to checked-in examples and the guide documents exact inspection commands", () => {
  const html = read("index.html").toString("utf8");
  const docs = fs.readFileSync(path.join(__dirname, "..", "docs", "EXPORT_FORMATS.md"), "utf8");
  for (const asset of [
    "walk-cycle.png",
    "walk-cycle.gif",
    "walk-cycle.metadata.json",
    "walk-cycle.gif.metadata.json",
    "walk-cycle.project.json"
  ]) {
    assert.ok(fs.existsSync(path.join(ROOT, asset)), asset + " must exist");
    assert.ok(html.includes(asset), "gallery must link " + asset);
  }
  assert.match(docs, /identify -format/);
  assert.match(docs, /ffprobe/);
  assert.match(docs, /tests\/gif-export\.browser\.mjs/);
  assert.match(docs, /tests\/sprite-sheet-export\.browser\.mjs/);
});
