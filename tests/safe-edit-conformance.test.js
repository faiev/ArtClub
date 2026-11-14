"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const Guard = require("../js/layer-edit-guard.js");
const SafeEdit = require("../js/safe-edit-operations.js");
const Staging = require("../js/import-staging.js");

const DEFAULT_SEEDS = [0x00c0ffee, 0x00005eed, 0x0bad5eed, 0x000a11ce, 0x0000d00d];
const ITERATIONS = 16;
const COLORS = ["#102030", "#abcdef", "#ffffff", "#000000"];

function selectedSeeds() {
  if (process.env.SAFE_EDIT_SEED === undefined) return DEFAULT_SEEDS;
  const parsed = Number(process.env.SAFE_EDIT_SEED);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 0xffffffff) {
    throw new Error("SAFE_EDIT_SEED must be an unsigned 32-bit integer.");
  }
  return [parsed >>> 0];
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function integer(random, minimum, maximum) {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function pick(random, values) {
  return values[integer(random, 0, values.length - 1)];
}

function compactReplay(seed, iteration, operation, width, height, mutation) {
  const minimized = {
    width: 1,
    height: 1,
    layers: 1,
    frames: 1,
    operation: operation,
    mutation: mutation
  };
  return [
    "seed=" + (seed >>> 0),
    "iteration=" + iteration,
    "case=" + operation,
    "generatedCanvas=" + width + "x" + height,
    "minimal=" + JSON.stringify(minimized),
    "replay=SAFE_EDIT_SEED=" + (seed >>> 0) +
      " node --test tests/safe-edit-conformance.test.js"
  ].join(" | ");
}

function makeProject(seed, fixed) {
  const random = mulberry32(seed);
  const width = fixed && fixed.width ? fixed.width : integer(random, 1, 8);
  const height = fixed && fixed.height ? fixed.height : integer(random, 1, 8);
  const layerCount = fixed && fixed.layers ? fixed.layers : integer(random, 2, 3);
  const frameCount = fixed && fixed.frames ? fixed.frames : integer(random, 2, 3);
  const layers = [];
  const frames = [];
  const cels = [];

  for (let layerIndex = 0; layerIndex < layerCount; layerIndex += 1) {
    layers.push({
      id: "layer-" + layerIndex,
      name: "Layer " + layerIndex,
      visible: true,
      locked: false,
      opacity: 1
    });
  }
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    frames.push({
      id: "frame-" + frameIndex,
      name: "Frame " + frameIndex,
      durationMs: 100 + frameIndex * 10
    });
  }
  for (const layer of layers) {
    for (const frame of frames) {
      const pixels = [];
      for (let index = 0; index < width * height; index += 1) {
        pixels.push(random() < 0.45 ? null : pick(random, COLORS));
      }
      cels.push({ layerId: layer.id, frameId: frame.id, pixels });
    }
  }

  return {
    format: "one-pixel-studio",
    version: 2,
    id: "generated-" + (seed >>> 0),
    name: "Seeded conformance fixture",
    canvas: { width, height, background: null },
    palette: COLORS.slice(),
    selectedColorIndex: 0,
    layers: layers,
    frames: frames,
    cels: cels,
    activeLayerId: layers[0].id,
    activeFrameId: frames[0].id,
    metadata: {
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z"
    }
  };
}

function stableValue(value, active) {
  if (value === null) return null;
  if (value === undefined) return { $undefined: true };
  if (typeof value === "number") {
    if (Number.isNaN(value)) return { $number: "NaN" };
    if (!Number.isFinite(value)) return { $number: String(value) };
    return value;
  }
  if (typeof value !== "object") return value;
  active = active || new Set();
  if (active.has(value)) return { $cycle: true };
  active.add(value);

  let result;
  if (Array.isArray(value)) {
    const slots = [];
    for (let index = 0; index < value.length; index += 1) {
      slots.push(Object.prototype.hasOwnProperty.call(value, index)
        ? { present: true, value: stableValue(value[index], active) }
        : { present: false });
    }
    const extra = {};
    Object.keys(value).filter(key => !/^(0|[1-9]\d*)$/.test(key)).sort()
      .forEach(key => { extra[key] = stableValue(value[key], active); });
    result = { $array: true, length: value.length, slots: slots, extra: extra };
  } else {
    result = {};
    Object.keys(value).sort().forEach(key => {
      result[key] = stableValue(value[key], active);
    });
  }
  active.delete(value);
  return result;
}

function stableString(value) {
  return JSON.stringify(stableValue(value));
}

function derivedRaster(project, frameId) {
  const targetFrame = frameId || project.activeFrameId;
  const raster = Array(project.canvas.width * project.canvas.height).fill(null);
  project.layers.forEach(layer => {
    if (!layer.visible || layer.opacity === 0) return;
    const cel = project.cels.find(item =>
      item.layerId === layer.id && item.frameId === targetFrame
    );
    if (!cel || !Array.isArray(cel.pixels)) return;
    for (let index = 0; index < raster.length; index += 1) {
      if (cel.pixels[index] !== null && cel.pixels[index] !== undefined) {
        raster[index] = cel.pixels[index];
      }
    }
  });
  return raster;
}

function stateSnapshot(project) {
  return stableString({
    project: project,
    allCelOwnSlots: project.cels.map(cel => ({
      layerId: cel.layerId,
      frameId: cel.frameId,
      pixels: cel.pixels
    })),
    composedRaster: derivedRaster(project)
  });
}

function matchingActiveCel(project) {
  return project.cels.find(cel =>
    cel.layerId === project.activeLayerId && cel.frameId === project.activeFrameId
  );
}

function sameUnrelatedCels(before, after) {
  const targetLayer = before.activeLayerId;
  const targetFrame = before.activeFrameId;
  const beforeOthers = before.cels.filter(cel =>
    cel.layerId !== targetLayer || cel.frameId !== targetFrame
  );
  const afterOthers = after.cels.filter(cel =>
    cel.layerId !== targetLayer || cel.frameId !== targetFrame
  );
  return stableString(beforeOthers) === stableString(afterOthers);
}

function randomRevisionContext(random) {
  const values = {
    project: integer(random, 0, 100000),
    frame: integer(random, 0, 100000),
    composite: integer(random, 0, 100000)
  };
  return {
    expectedRevisions: values,
    currentRevisions: { ...values }
  };
}

function projectForImport(seed) {
  return makeProject(seed, { width: integer(mulberry32(seed ^ 0x5a5a), 1, 6), height: 3, layers: 1, frames: 1 });
}

test("seeded guard properties: valid targets pass and adversarial target mutations fail closed", () => {
  const mutations = [
    { name: "hidden layer", reason: Guard.REASONS.LAYER_HIDDEN, apply: p => { p.layers[0].visible = false; } },
    { name: "locked layer", reason: Guard.REASONS.LAYER_LOCKED, apply: p => { p.layers[0].locked = true; } },
    { name: "zero opacity", reason: Guard.REASONS.LAYER_ZERO_OPACITY, apply: p => { p.layers[0].opacity = 0; } },
    { name: "missing layer", reason: Guard.REASONS.LAYER_NOT_FOUND, apply: p => { p.activeLayerId = "missing-layer"; } },
    { name: "missing frame", reason: Guard.REASONS.FRAME_NOT_FOUND, apply: p => { p.activeFrameId = "missing-frame"; } },
    { name: "missing cel", reason: Guard.REASONS.CEL_NOT_FOUND, apply: p => { p.cels = p.cels.filter(c => c.layerId !== p.activeLayerId || c.frameId !== p.activeFrameId); } },
    { name: "sparse pixel hole", reason: Guard.REASONS.CEL_INVALID, apply: p => { delete matchingActiveCel(p).pixels[0]; } },
    { name: "undefined pixel", reason: Guard.REASONS.CEL_INVALID, apply: p => { matchingActiveCel(p).pixels[0] = undefined; } },
    { name: "malformed HEX pixel", reason: Guard.REASONS.CEL_INVALID, apply: p => { matchingActiveCel(p).pixels[0] = "#12xx56"; } },
    { name: "duplicate cel", reason: Guard.REASONS.CEL_AMBIGUOUS, apply: p => { p.cels.push({ ...matchingActiveCel(p), pixels: matchingActiveCel(p).pixels.slice() }); } },
    { name: "duplicate layer ID", reason: Guard.REASONS.LAYER_AMBIGUOUS, apply: p => { p.layers.push({ ...p.layers[0] }); } },
    { name: "duplicate frame ID", reason: Guard.REASONS.FRAME_AMBIGUOUS, apply: p => { p.frames.push({ ...p.frames[0] }); } },
    { name: "malformed opacity", reason: Guard.REASONS.LAYER_METADATA_INVALID, apply: p => { p.layers[0].opacity = 1.5; } }
  ];

  for (const seed of selectedSeeds()) {
    const random = mulberry32(seed ^ 0x13579bdf);
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const project = makeProject((seed + iteration * 7919) >>> 0);
      const validBefore = stateSnapshot(project);
      const valid = Guard.resolveEditableTarget(project, randomRevisionContext(random));
      const validContext = compactReplay(seed, iteration, "valid-target", project.canvas.width, project.canvas.height, "no mutation");
      assert.equal(valid.ok, true, validContext);
      assert.equal(stateSnapshot(project), validBefore, validContext);

      const mutation = mutations[(iteration + integer(random, 0, mutations.length - 1)) % mutations.length];
      const badProject = makeProject((seed ^ (iteration * 104729 + 17)) >>> 0);
      let options = {};
      let expected;
      let operation;
      let mutationDescription;

      // Forced freshness/selection cases are isolated from structural corruptions
      // so one denial cannot mask the specific reason under test.
      if (iteration % 5 === 0) {
        options = {
          expectedRevisions: { project: 4, frame: 5, composite: 6 },
          currentRevisions: { project: 5, frame: 5, composite: 6 }
        };
        expected = Guard.REASONS.PROJECT_REVISION_STALE;
        operation = "stale-project-revision";
        mutationDescription = "expected project revision 4, current project revision 5";
      } else if (iteration % 7 === 0) {
        options = { selection: { x: badProject.canvas.width, y: 0, width: 1, height: 1 } };
        expected = Guard.REASONS.SELECTION_INVALID;
        operation = "out-of-canvas-selection";
        mutationDescription = "selection begins at canvas width";
      } else {
        mutation.apply(badProject);
        expected = mutation.reason;
        operation = mutation.name;
        mutationDescription = mutation.name;
      }

      const before = stateSnapshot(badProject);
      const denied = Guard.resolveEditableTarget(badProject, options);
      const context = compactReplay(seed, iteration, "guard-" + operation,
        badProject.canvas.width, badProject.canvas.height, mutationDescription);
      assert.equal(denied.ok, false, context);
      assert.equal(denied.reason, expected, context);
      assert.equal(stateSnapshot(badProject), before, context);
    }
  }
});

test("seeded transaction properties: accepted patches are detached, deterministic and frame/layer preserving", () => {
  for (const seed of selectedSeeds()) {
    const random = mulberry32(seed ^ 0x2468ace0);
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const project = makeProject((seed + iteration * 104729) >>> 0);
      const width = project.canvas.width;
      const height = project.canvas.height;
      const x = integer(random, 0, width - 1);
      const y = integer(random, 0, height - 1);
      const color = pick(random, COLORS);
      const before = stateSnapshot(project);
      const context = randomRevisionContext(random);
      const options = {
        ...context,
        selection: { x, y, width: 1, height: 1 }
      };
      const patches = [{ x, y, color }];
      const result = SafeEdit.applyPixelPatches(project, patches, options);
      const replay = compactReplay(seed, iteration, "apply-pixel-patch",
        width, height, JSON.stringify({ x, y, color }));

      assert.equal(result.ok, true, replay);
      assert.notEqual(result.project, project, replay);
      assert.notEqual(result.project.cels, project.cels, replay);
      assert.notEqual(result.project.layers[0], project.layers[0], replay);
      assert.equal(stateSnapshot(project), before, replay);
      assert.equal(sameUnrelatedCels(project, result.project), true, replay);
      assert.equal(matchingActiveCel(result.project).pixels[y * width + x], color, replay);
      assert.equal(Guard.resolveEditableTarget(result.project).ok, true, replay);

      const repeated = SafeEdit.applyPixelPatches(project, patches, options);
      assert.equal(repeated.ok, true, replay);
      assert.equal(stateSnapshot(repeated.project), stateSnapshot(result.project), replay);
    }
  }
});

test("seeded transaction denial properties: every rejected edit preserves the full source shape and raster", () => {
  const cases = [
    {
      name: "hidden-layer-clear",
      reason: Guard.REASONS.LAYER_HIDDEN,
      make: p => { p.layers[0].visible = false; },
      run: p => SafeEdit.clearActiveCel(p)
    },
    {
      name: "locked-layer-patch",
      reason: Guard.REASONS.LAYER_LOCKED,
      make: p => { p.layers[0].locked = true; },
      run: p => SafeEdit.applyPixelPatches(p, [{ x: 0, y: 0, color: "#abcdef" }])
    },
    {
      name: "zero-opacity-clear",
      reason: Guard.REASONS.LAYER_ZERO_OPACITY,
      make: p => { p.layers[0].opacity = 0; },
      run: p => SafeEdit.clearActiveCel(p)
    },
    {
      name: "stale-frame-revision",
      reason: Guard.REASONS.FRAME_REVISION_STALE,
      make: p => {},
      run: p => SafeEdit.clearActiveCel(p, {
        expectedRevisions: { project: 1, frame: 2, composite: 3 },
        currentRevisions: { project: 1, frame: 9, composite: 3 }
      })
    },
    {
      name: "invalid-patch",
      reason: SafeEdit.REASONS.PATCHES_INVALID,
      make: p => {},
      run: p => SafeEdit.applyPixelPatches(p, [{ x: 0, y: 0, color: "not-hex" }])
    },
    {
      name: "missing-active-cel",
      reason: Guard.REASONS.CEL_NOT_FOUND,
      make: p => { p.cels = p.cels.filter(c => c.layerId !== p.activeLayerId || c.frameId !== p.activeFrameId); },
      run: p => SafeEdit.clearActiveCel(p)
    }
  ];

  for (const seed of selectedSeeds()) {
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const random = mulberry32((seed ^ (iteration * 65537)) >>> 0);
      const item = cases[integer(random, 0, cases.length - 1)];
      const project = makeProject((seed + iteration * 8191) >>> 0);
      item.make(project);
      const before = stateSnapshot(project);
      const result = item.run(project);
      const replay = compactReplay(seed, iteration, item.name,
        project.canvas.width, project.canvas.height, item.name);
      assert.equal(result.ok, false, replay);
      assert.equal(result.reason, item.reason, replay);
      assert.equal(Object.prototype.hasOwnProperty.call(result, "project"), false, replay);
      assert.equal(stateSnapshot(project), before, replay);
    }
  }
});

test("seeded sequence: stage project, validate target, then apply one immutable transaction", () => {
  for (const seed of selectedSeeds()) {
    const random = mulberry32(seed ^ 0x55aa55aa);
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const project = projectForImport((seed + iteration * 31337) >>> 0);
      const original = stateSnapshot(project);
      const staged = Staging.stageProjectImport(project);
      const replay = compactReplay(seed, iteration, "stage-validate-patch",
        project.canvas.width, project.canvas.height, "project-import -> target-guard -> pixel-patch");

      assert.equal(staged.ok, true, replay);
      assert.equal(staged.commit.kind, "replace-project", replay);
      assert.equal(Guard.resolveEditableTarget(staged.commit.project).ok, true, replay);
      const patch = [{
        x: integer(random, 0, project.canvas.width - 1),
        y: integer(random, 0, project.canvas.height - 1),
        color: pick(random, COLORS)
      }];
      const transaction = SafeEdit.applyPixelPatches(staged.commit.project, patch);
      assert.equal(transaction.ok, true, replay);
      assert.equal(stateSnapshot(project), original, replay);
      assert.equal(stateSnapshot(staged.commit.project), stateSnapshot(staged.staged.project), replay);
      assert.notEqual(transaction.project, staged.commit.project, replay);
      assert.equal(Guard.resolveEditableTarget(transaction.project).ok, true, replay);
    }
  }
});

test("seeded sequence: clear a selection, patch within it, and preserve every prior state", () => {
  for (const seed of selectedSeeds()) {
    const random = mulberry32(seed ^ 0xdeadbeef);
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const project = makeProject((seed + iteration * 12347) >>> 0);
      const original = stateSnapshot(project);
      const selectedX = integer(random, 0, project.canvas.width - 1);
      const selectedY = integer(random, 0, project.canvas.height - 1);
      const selection = { x: selectedX, y: selectedY, width: 1, height: 1 };
      const cleared = SafeEdit.clearActiveCel(project, { selection });
      const replay = compactReplay(seed, iteration, "clear-selection-then-patch",
        project.canvas.width, project.canvas.height, "selection=" + JSON.stringify(selection));

      assert.equal(cleared.ok, true, replay);
      assert.equal(stateSnapshot(project), original, replay);
      const clearedSnapshot = stateSnapshot(cleared.project);
      assert.equal(matchingActiveCel(cleared.project).pixels[selectedY * project.canvas.width + selectedX], null, replay);

      const patched = SafeEdit.applyPixelPatches(cleared.project, [{
        x: selectedX, y: selectedY, color: pick(random, COLORS)
      }], { selection });
      assert.equal(patched.ok, true, replay);
      assert.equal(stateSnapshot(cleared.project), clearedSnapshot, replay);
      assert.equal(stateSnapshot(project), original, replay);
      assert.equal(sameUnrelatedCels(project, patched.project), true, replay);
    }
  }
});

test("seeded sequence: replacement succeeds, then a stale follow-up is denied without partial commit", () => {
  for (const seed of selectedSeeds()) {
    const random = mulberry32(seed ^ 0xabcdef01);
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const project = makeProject((seed + iteration * 7777) >>> 0);
      const beforeOriginal = stateSnapshot(project);
      const revisions = {
        project: integer(random, 1, 1000),
        frame: integer(random, 1, 1000),
        composite: integer(random, 1, 1000)
      };
      const replacement = Array(project.canvas.width * project.canvas.height)
        .fill(null).map(() => random() < 0.5 ? null : pick(random, COLORS));
      const replaced = SafeEdit.replaceActiveCel(project, replacement, {
        expectedRevisions: revisions,
        currentRevisions: { ...revisions }
      });
      const replay = compactReplay(seed, iteration, "replace-then-stale-follow-up",
        project.canvas.width, project.canvas.height, "replace-cel -> stale-project-revision");

      assert.equal(replaced.ok, true, replay);
      assert.equal(stateSnapshot(project), beforeOriginal, replay);
      const replacementSnapshot = stateSnapshot(replaced.project);
      const stale = SafeEdit.applyPixelPatches(replaced.project, [{
        x: 0, y: 0, color: "#abcdef"
      }], {
        expectedRevisions: revisions,
        currentRevisions: { ...revisions, project: revisions.project + 1 }
      });
      assert.equal(stale.ok, false, replay);
      assert.equal(stale.reason, Guard.REASONS.PROJECT_REVISION_STALE, replay);
      assert.equal(stale.commit, undefined, replay);
      assert.equal(stateSnapshot(replaced.project), replacementSnapshot, replay);
      assert.equal(stateSnapshot(project), beforeOriginal, replay);
    }
  }
});

test("seeded image staging is deterministic and leaves decoded bytes untouched", () => {
  for (const seed of selectedSeeds()) {
    const random = mulberry32(seed ^ 0x10293847);
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const width = integer(random, 1, 8);
      const height = integer(random, 1, 8);
      const rgba = new Uint8Array(width * height * 4);
      for (let index = 0; index < rgba.length; index += 4) {
        rgba[index] = integer(random, 0, 255);
        rgba[index + 1] = integer(random, 0, 255);
        rgba[index + 2] = integer(random, 0, 255);
        rgba[index + 3] = random() < 0.2 ? 0 : 255;
      }
      const before = Array.from(rgba);
      const input = { width, height, rgba: rgba, sourceBytes: rgba.byteLength };
      const options = { palette: COLORS, targetWidth: width, targetHeight: height };
      const first = Staging.stageImageImport(input, options);
      const second = Staging.stageImageImport(input, options);
      const replay = compactReplay(seed, iteration, "stage-image", width, height, "RGBA typed-array -> palette map");

      assert.equal(first.ok, true, replay);
      assert.equal(second.ok, true, replay);
      assert.equal(stableString(first.commit), stableString(second.commit), replay);
      assert.equal(Object.isFrozen(first.commit.pixels), true, replay);
      assert.deepEqual(Array.from(rgba), before, replay);
      assert.equal(first.commit.pixels.length, width * height, replay);
      first.commit.pixels.forEach(pixel => {
        assert.ok(pixel === null || COLORS.includes(pixel), replay);
      });
    }
  }
});

test("seeded invalid import candidates never create partial commits or mutate source buffers", () => {
  for (const seed of selectedSeeds()) {
    const random = mulberry32(seed ^ 0x31415926);
    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      const project = projectForImport((seed + iteration * 99991) >>> 0);
      const mutation = integer(random, 0, 4);
      let caseName;
      if (mutation === 0) {
        delete project.cels[0].pixels[0];
        caseName = "sparse-project-cel";
      } else if (mutation === 1) {
        project.cels[0].pixels[0] = undefined;
        caseName = "undefined-project-cel";
      } else if (mutation === 2) {
        project.cels[0].pixels[0] = "#gggggg";
        caseName = "malformed-project-hex";
      } else if (mutation === 3) {
        project.canvas.width = Staging.LIMITS.maxDimension + 1;
        caseName = "oversized-project-dimension";
      } else {
        project.layers.push({ ...project.layers[0] });
        caseName = "duplicate-project-layer-id";
      }
      const before = stateSnapshot(project);
      const staged = Staging.stageProjectImport(project);
      const replay = compactReplay(seed, iteration, "reject-import-" + caseName,
        project.canvas.width, project.canvas.height, caseName);

      assert.equal(staged.ok, false, replay);
      assert.equal(staged.commit, null, replay);
      assert.ok(staged.diagnostics.length > 0, replay);
      assert.equal(stateSnapshot(project), before, replay);
    }
  }
});
