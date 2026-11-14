/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const GIF = require("../js/gif-export.js");
const Sprite = require("../js/sprite-sheet-export.js");

function makeProject(options = {}) {
  const width = options.width || 4;
  const height = options.height || 4;
  const frameCount = options.frameCount || 2;
  const layer = { id: "layer-1", name: "Layer", visible: true, locked: false, opacity: 1 };
  const frames = Array.from({ length: frameCount }, (_, index) => ({
    id: "f" + index,
    name: "Frame " + index,
    durationMs: [145, 155, 100, 250][index % 4]
  }));
  const pixelsFor = frameIndex => Array.from({ length: width * height }, (_, index) => {
    if ((index + frameIndex) % 7 === 0) return null;
    const colors = ["#ff0000", "#00ff00", "#0000ff", "#ffffff"];
    return colors[(index + frameIndex) % colors.length];
  });
  return {
    format: "one-pixel-studio",
    version: 2,
    id: "async-export-fixture",
    name: "Async export fixture",
    canvas: { width, height, background: null },
    palette: ["#ff0000", "#00ff00", "#0000ff", "#ffffff"],
    selectedColorIndex: 0,
    layers: [layer],
    frames: frames,
    cels: frames.map((frame, index) => ({
      layerId: layer.id,
      frameId: frame.id,
      pixels: pixelsFor(index)
    })),
    activeLayerId: layer.id,
    activeFrameId: frames[0].id,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
}

function canvasFactory(onEncode) {
  return function createCanvas(width, height) {
    let rgba = new Uint8ClampedArray(width * height * 4);
    return {
      getContext() {
        return {
          createImageData(w, h) {
            return { data: new Uint8ClampedArray(w * h * 4) };
          },
          putImageData(imageData) {
            rgba = new Uint8ClampedArray(imageData.data);
          }
        };
      },
      toBlob(callback) {
        if (onEncode) onEncode();
        callback(new Blob([rgba], { type: "image/png" }));
      }
    };
  };
}

async function blobBytes(blob) {
  return Array.from(new Uint8Array(await blob.arrayBuffer()));
}

async function expectAbort(promise, stage) {
  await assert.rejects(promise, error => {
    assert.equal(error.name, "ExportAbortError");
    assert.equal(error.code, "EXPORT_ABORTED");
    assert.equal(error.stage, stage);
    return true;
  });
}

function makeLargeSingleFrameProject(width = 512, height = 512) {
  const pixels = Array.from({ length: width * height }, (_, index) => {
    const value = (Math.imul(index + 1, 2654435761) >>> 0);
    const red = value & 255;
    const green = (value >>> 8) & 255;
    const blue = (value >>> 16) & 255;
    return "#" + [red, green, blue].map(channel => channel.toString(16).padStart(2, "0")).join("");
  });
  return {
    format: "one-pixel-studio",
    version: 2,
    id: "large-async-fixture",
    name: "Large async fixture",
    canvas: { width, height, background: null },
    palette: [],
    selectedColorIndex: 0,
    layers: [{ id: "layer-1", name: "Layer", visible: true, locked: false, opacity: 1 }],
    frames: [{ id: "f1", name: "Large frame", durationMs: 145 }],
    cels: [{ layerId: "layer-1", frameId: "f1", pixels: pixels }],
    activeLayerId: "layer-1",
    activeFrameId: "f1",
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
}

test("async GIF output bytes, metadata and diagnostics exactly match synchronous output", async () => {
  const project = makeProject({ width: 12, height: 9, frameCount: 3 });
  const before = JSON.stringify(project);
  const options = { frameIds: ["f2", "f0", "f1"], loopCount: 3 };
  const sync = GIF.encodeGIF(project, options);
  const progress = [];
  const asyncResult = await GIF.encodeGIFAsync(project, {
    ...options,
    yieldEvery: 64,
    onProgress(event) { progress.push(event); }
  });

  assert.deepEqual(Array.from(asyncResult.bytes), Array.from(sync.bytes));
  assert.deepEqual(asyncResult.metadata, sync.metadata);
  assert.deepEqual(asyncResult.diagnostics, sync.diagnostics);
  assert.equal(JSON.stringify(project), before);
  assert.ok(progress.length > 4);
  assert.deepEqual(progress.map(event => event.progress), progress.map(event => event.progress).slice().sort((a, b) => a - b));
  assert.equal(progress.at(-1).progress, 100);
  assert.ok(progress.some(event => event.phase === "validation"));
  assert.ok(progress.some(event => event.phase === "composition"));
  assert.ok(progress.some(event => event.phase === "palette"));
  assert.ok(progress.some(event => event.phase === "indexing"));
  assert.ok(progress.some(event => event.phase === "encoding"));
  assert.equal(progress.at(-1).phase, "completed");
});

test("async GIF median-cut palette overflow is byte-identical to the synchronous encoder", async () => {
  const pixels = Array.from({ length: 257 }, (_, index) => {
    const red = index & 255;
    const green = (index >>> 8) & 255;
    const blue = (index * 7) & 255;
    return "#" + [red, green, blue].map(value => value.toString(16).padStart(2, "0")).join("");
  });
  const project = {
    format: "one-pixel-studio",
    version: 2,
    id: "async-palette-overflow",
    name: "Async palette overflow",
    canvas: { width: 257, height: 1, background: null },
    palette: [],
    selectedColorIndex: 0,
    layers: [{ id: "layer-1", name: "Layer", visible: true, locked: false, opacity: 1 }],
    frames: [{ id: "f1", name: "Overflow", durationMs: 145 }],
    cels: [{ layerId: "layer-1", frameId: "f1", pixels }],
    activeLayerId: "layer-1",
    activeFrameId: "f1",
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
  const sync = GIF.encodeGIF(project);
  const asyncResult = await GIF.encodeGIFAsync(project, { yieldEvery: 32 });
  assert.equal(sync.diagnostics.paletteMode, "median-cut");
  assert.equal(asyncResult.diagnostics.paletteMode, "median-cut");
  assert.deepEqual(Array.from(asyncResult.bytes), Array.from(sync.bytes));
  assert.deepEqual(asyncResult.metadata, sync.metadata);
});

test("async GIF checks AbortSignal before starting any work", async () => {
  const controller = new AbortController();
  controller.abort();
  await expectAbort(GIF.encodeGIFAsync(makeProject(), { signal: controller.signal }), "before-start");
});

test("async GIF cooperatively aborts during cel composition", async () => {
  const project = makeLargeSingleFrameProject(128, 128);
  const controller = new AbortController();
  await expectAbort(GIF.encodeGIFAsync(project, {
    signal: controller.signal,
    yieldEvery: 256,
    onProgress(event) {
      if (event.phase === "composition" && event.progress > 5) controller.abort();
    }
  }), "composition");
});

test("async GIF cooperatively aborts during LZW encoding", async () => {
  const project = makeLargeSingleFrameProject();
  const controller = new AbortController();
  let sawEncoding = false;
  await expectAbort(GIF.encodeGIFAsync(project, {
    signal: controller.signal,
    yieldEvery: 1024,
    onProgress(event) {
      if (event.phase === "encoding") {
        sawEncoding = true;
        controller.abort();
      }
    }
  }), "encoding");
  assert.equal(sawEncoding, true);
});

test("async GIF aborts at the finalization boundary and never returns partial bytes", async () => {
  const controller = new AbortController();
  await expectAbort(GIF.encodeGIFAsync(makeProject(), {
    signal: controller.signal,
    yieldEvery: 32,
    onProgress(event) {
      if (event.phase === "finalizing") controller.abort();
    }
  }), "finalization");
});

test("async GIF rejects malformed inputs and output budgets before returning output", async () => {
  const malformed = makeProject();
  delete malformed.cels[0].pixels[0];
  await assert.rejects(GIF.encodeGIFAsync(malformed), /valid HEX/);

  const tooLarge = makeLargeSingleFrameProject();
  for (let index = 1; index < 5; index += 1) {
    const frameId = "f" + (index + 1);
    tooLarge.frames.push({ id: frameId, name: "Frame " + (index + 1), durationMs: 100 });
    tooLarge.cels.push({ layerId: "layer-1", frameId: frameId, pixels: tooLarge.cels[0].pixels });
  }
  await assert.rejects(GIF.encodeGIFAsync(tooLarge), /too large|Maximum total export pixels/i);
});

test("async sprite-sheet output pixels, PNG bytes and metadata match synchronous output", async () => {
  const project = makeProject({ width: 13, height: 7, frameCount: 3 });
  const before = JSON.stringify(project);
  const options = {
    frameIds: ["f2", "f0", "f1"],
    layout: "grid",
    columns: 2,
    margin: 1,
    spacing: 2,
    backgroundColor: "#123456",
    imageFilename: "async-sheet.png"
  };
  const sync = await Sprite.exportSpriteSheet(project, {
    ...options,
    canvasFactory: canvasFactory()
  });
  const progress = [];
  const asyncResult = await Sprite.exportSpriteSheetAsync(project, {
    ...options,
    yieldEvery: 64,
    canvasFactory: canvasFactory(),
    onProgress(event) { progress.push(event); }
  });

  assert.deepEqual(Array.from(asyncResult.sheet.rgba), Array.from(sync.sheet.rgba));
  assert.deepEqual(asyncResult.metadata, sync.metadata);
  assert.deepEqual(await blobBytes(asyncResult.blob), await blobBytes(sync.blob));

  const directProgress = [];
  const directSheet = await Sprite.buildSpriteSheetAsync(project, {
    ...options,
    yieldEvery: 32,
    onProgress(event) { directProgress.push(event); }
  });
  assert.deepEqual(Array.from(directSheet.rgba), Array.from(sync.sheet.rgba));
  assert.deepEqual(directProgress.at(-1).progress, 100);
  const directBlob = await Sprite.renderSpriteSheetPNGAsync(directSheet, {
    yieldEvery: 32,
    canvasFactory: canvasFactory()
  });
  assert.deepEqual(await blobBytes(directBlob), await blobBytes(sync.blob));
  assert.equal(JSON.stringify(project), before);
  assert.ok(progress.length > 4);
  assert.deepEqual(progress.map(event => event.progress), progress.map(event => event.progress).slice().sort((a, b) => a - b));
  assert.equal(progress.at(-1).progress, 100);
  assert.ok(progress.some(event => event.phase === "validation"));
  assert.ok(progress.some(event => event.phase === "composition"));
  assert.ok(progress.some(event => event.phase === "render"));
  assert.ok(progress.some(event => event.phase === "encoding"));
  assert.equal(progress.at(-1).phase, "completed");
});

test("async sprite-sheet checks AbortSignal before starting work", async () => {
  const controller = new AbortController();
  controller.abort();
  await expectAbort(Sprite.exportSpriteSheetAsync(makeProject(), {
    signal: controller.signal,
    canvasFactory: canvasFactory()
  }), "before-start");
});

test("async sprite-sheet cooperatively aborts during raster composition", async () => {
  const project = makeLargeSingleFrameProject(128, 128);
  const controller = new AbortController();
  await expectAbort(Sprite.exportSpriteSheetAsync(project, {
    signal: controller.signal,
    yieldEvery: 256,
    canvasFactory: canvasFactory(),
    onProgress(event) {
      if (event.phase === "composition" && event.progress > 12) controller.abort();
    }
  }), "composition");
});

test("async sprite-sheet aborts before finalization when the PNG codec resolves", async () => {
  const controller = new AbortController();
  const project = makeProject();
  await expectAbort(Sprite.exportSpriteSheetAsync(project, {
    signal: controller.signal,
    yieldEvery: 32,
    canvasFactory: canvasFactory(() => controller.abort())
  }), "finalization");
});

test("async sprite-sheet aborts during ImageData preparation before calling PNG codec", async () => {
  const controller = new AbortController();
  let codecCalled = false;
  const factory = canvasFactory(() => { codecCalled = true; });
  await expectAbort(Sprite.exportSpriteSheetAsync(makeProject({ width: 32, height: 32 }), {
    signal: controller.signal,
    yieldEvery: 32,
    canvasFactory: factory,
    onProgress(event) {
      if (event.phase === "render") controller.abort();
    }
  }), "encoding");
  assert.equal(codecCalled, false);
});

test("async sprite-sheet rejects malformed data and pixel budgets before canvas allocation", async () => {
  const malformed = makeProject();
  delete malformed.cels[0].pixels[0];
  let factoryCalled = false;
  await assert.rejects(Sprite.exportSpriteSheetAsync(malformed, {
    canvasFactory() { factoryCalled = true; throw new Error("should not allocate"); }
  }), /valid HEX/);
  assert.equal(factoryCalled, false);

  await assert.rejects(Sprite.exportSpriteSheetAsync(makeProject({ width: 128, height: 128, frameCount: 2 }), {
    layout: "grid",
    columns: 2,
    margin: 4096,
    maxPixels: 16
  }), /Maximum export pixels|too large/i);
  assert.equal(factoryCalled, false);
});

test("async export uses cooperative signal polling and does not leak abort listeners", async () => {
  let added = 0;
  let removed = 0;
  const signal = {
    aborted: false,
    addEventListener() { added += 1; },
    removeEventListener() { removed += 1; }
  };
  await GIF.encodeGIFAsync(makeProject(), { signal, yieldEvery: 16 });
  await Sprite.exportSpriteSheetAsync(makeProject(), {
    signal,
    yieldEvery: 16,
    canvasFactory: canvasFactory()
  });
  assert.equal(added, 0, "polling cancellation does not register abort listeners");
  assert.equal(removed, 0, "polling cancellation leaves no abort listeners to remove");
});


test("async GIF Blob API matches synchronous output and withholds the Blob after late abort", async () => {
  const project = makeProject({ width: 20, height: 12, frameCount: 3 });
  const sync = GIF.exportGIF(project, { loopCount: 2 });
  const events = [];
  const asyncResult = await GIF.exportGIFAsync(project, {
    loopCount: 2,
    yieldEvery: 23,
    onProgress(event) { events.push(event); }
  });
  assert.equal(asyncResult.blob.type, "image/gif");
  assert.deepEqual(await blobBytes(asyncResult.blob), await blobBytes(sync.blob));
  assert.deepEqual(asyncResult.metadata, sync.metadata);
  assert.deepEqual(asyncResult.diagnostics, sync.diagnostics);
  assert.equal(events.at(-1).phase, "completed");
  assert.equal(events.at(-1).progress, 100);

  const controller = new AbortController();
  let returned = false;
  await expectAbort(GIF.exportGIFAsync(project, {
    signal: controller.signal,
    onProgress(event) {
      // This callback runs after the local Blob has been built but before the
      // success object is returned to the caller.
      if (event.phase === "completed") controller.abort();
    }
  }).then(result => {
    returned = true;
    return result;
  }), "finalization");
  assert.equal(returned, false, "an aborted final Blob must never escape");
});

test("GIF missing-cel composition still yields and can be interrupted", async () => {
  const project = makeProject({ width: 128, height: 128, frameCount: 3 });
  project.cels = [];
  const controller = new AbortController();
  await expectAbort(GIF.encodeGIFAsync(project, {
    signal: controller.signal,
    yieldEvery: 128,
    onProgress(event) {
      if (event.phase === "composition" && event.completed > 128 * 128 + 128) controller.abort();
    }
  }), "composition");
});

test("512×512 GIF work yields to a timer during LZW encoding", async () => {
  const project = makeLargeSingleFrameProject();
  const controller = new AbortController();
  let timerScheduled = false;
  const pending = GIF.encodeGIFAsync(project, {
    signal: controller.signal,
    yieldEvery: 8192,
    onProgress(event) {
      if (event.phase === "encoding" && !timerScheduled) {
        timerScheduled = true;
        setTimeout(() => controller.abort(), 0);
      }
    }
  });
  await assert.rejects(pending, error => {
    assert.equal(error.name, "ExportAbortError");
    assert.equal(error.code, "EXPORT_ABORTED");
    assert.equal(error.stage, "encoding");
    return true;
  });
  assert.equal(timerScheduled, true, "the 512×512 export should yield during its JavaScript LZW loop");
});

test("512×512 sprite-sheet composition yields to a timer between raster chunks", async () => {
  const project = makeLargeSingleFrameProject();
  const controller = new AbortController();
  let timerScheduled = false;
  const pending = Sprite.buildSpriteSheetAsync(project, {
    signal: controller.signal,
    yieldEvery: 8192,
    onProgress(event) {
      if (event.phase === "composition" && event.progress > 12 && !timerScheduled) {
        timerScheduled = true;
        setTimeout(() => controller.abort(), 0);
      }
    }
  });
  await assert.rejects(pending, error => {
    assert.equal(error.name, "ExportAbortError");
    assert.equal(error.code, "EXPORT_ABORTED");
    assert.equal(error.stage, "composition");
    return true;
  });
  assert.equal(timerScheduled, true, "the 512×512 sheet should yield during its JavaScript raster loop");
});

test("sprite-sheet PNG finalization checks cancellation after an asynchronous codec returns", async () => {
  const controller = new AbortController();
  let returned = false;
  const factory = (width, height) => {
    let rgba = null;
    return {
      getContext() {
        return {
          createImageData(w, h) { return { data: new Uint8ClampedArray(w * h * 4) }; },
          putImageData(imageData) { rgba = imageData.data.slice(); }
        };
      },
      toBlob(callback) {
        setTimeout(() => {
          controller.abort();
          callback(new Blob([rgba], { type: "image/png" }));
        }, 0);
      }
    };
  };
  await expectAbort(Sprite.exportSpriteSheetAsync(makeProject(), {
    signal: controller.signal,
    yieldEvery: 4096,
    canvasFactory: factory
  }).then(result => {
    returned = true;
    return result;
  }), "finalization");
  assert.equal(returned, false, "the PNG and metadata must not escape after late cancellation");
});
