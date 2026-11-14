"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const AgentAPI = require("../js/agent-api.js");

const ADAPTER_METHODS = [
  "getStatus", "getCanvas", "getPixel", "execute",
  "undo", "redo", "save", "exportProject", "importProject",
  "listProjects", "openProject", "exportPNG",
  "listLayers", "addLayer", "selectLayer", "setLayerVisibility",
  "setLayerLocked", "renameLayer", "moveLayer", "duplicateLayer",
  "deleteLayer", "setSelection", "selectAll", "copySelection",
  "cutSelection", "pasteSelection", "clearSelection", "deselect",
  "moveSelection", "transformSelection", "listFrames", "addFrame",
  "duplicateFrame", "selectFrame", "deleteFrame", "moveFrame",
  "setFrameDuration", "renameFrame", "play", "pause",
  "stopPlayback", "setPlaybackMode", "setOnionSkin"
];

function makeAdapter() {
  const calls = [];
  const adapter = {};
  for (const method of ADAPTER_METHODS) {
    adapter[method] = (...args) => {
      calls.push({ method, args });
      if (method === "getStatus") return { revision: 17 };
      return { ok: true };
    };
  }
  return { adapter, calls };
}

test("undo and redo forward revision options to the editor adapter", () => {
  const { adapter, calls } = makeAdapter();
  const studio = AgentAPI.create(adapter);

  studio.undo({ expected_revision: 17 });
  studio.redo({ expected_revision: 18 });

  assert.deepEqual(calls, [
    { method: "undo", args: [{ expected_revision: 17 }] },
    { method: "redo", args: [{ expected_revision: 18 }] }
  ]);
});

test("drawing helpers preserve the expected revision in execute options", () => {
  const { adapter, calls } = makeAdapter();
  const studio = AgentAPI.create(adapter);

  studio.draw_pixel({
    x: 2, y: 3, color: "#123456", expected_revision: 17
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, "execute");
  assert.deepEqual(calls[0].args[0], [{
    type: "draw_pixel",
    x: 2,
    y: 3,
    color: "#123456",
    expected_revision: 17
  }]);
  assert.deepEqual(calls[0].args[1], {
    x: 2, y: 3, color: "#123456", expected_revision: 17
  });
});

test("adapter construction rejects an incomplete editor integration", () => {
  assert.throws(
    () => AgentAPI.create({ getStatus() {} }),
    /adapter is missing/
  );
});
