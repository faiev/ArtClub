"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const SafeEdit = require("../js/safe-edit-operations.js");

const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

function makeProject() {
  const layer = { id: "layer-active", name: "Layer 1", visible: true, locked: false, opacity: 1 };
  const frame = { id: "frame-active", name: "Frame 1", durationMs: 100 };
  return {
    format: "one-pixel-studio",
    version: 2,
    id: "project-1",
    name: "Fixture",
    canvas: { width: 3, height: 2, background: null },
    palette: ["#112233"],
    selectedColorIndex: 0,
    layers: [layer],
    frames: [frame],
    cels: [{
      layerId: layer.id,
      frameId: frame.id,
      pixels: ["#112233", null, null, null, "#112233", null]
    }],
    activeLayerId: layer.id,
    activeFrameId: frame.id,
    metadata: { createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" }
  };
}

test("production editor loads the safety guard and transaction module before its inline application", () => {
  const guard = html.indexOf('<script src="./js/layer-edit-guard.js"></script>');
  const operations = html.indexOf('<script src="./js/safe-edit-operations.js"></script>');
  const app = html.indexOf("<script>\n(function(){");
  assert.ok(guard >= 0 && operations > guard && app > operations);
});

test("toolbar Clear is explicitly scoped to the active layer cel", () => {
  assert.match(html, /id="clearBtn" aria-label="Clear active cel" title="Clear active layer for this frame"/);
  assert.match(html, /Clear all pixels on the active layer for this frame\? Other layers and frames will be preserved\./);
  assert.match(html, /\$\("clearBtn"\)\.addEventListener\("click",\(\)=>\{void clearActiveCel\(\)\}\)/);
  assert.doesNotMatch(html, /Clear every pixel on this canvas\?/);
});

test("selection Clear uses the staged immutable safe-edit transaction", () => {
  assert.match(html, /async function clearSelectedPixels\(\)/);
  assert.match(html, /runSafeClear\(\{selection:/);
  assert.match(html, /window\.ArtClubSafeEditOperations\.clearActiveCel\(source,options\|\|\{\}\)/);
  assert.match(html, /async function agentClearSelection\(payload\)/);
  assert.match(html, /if\(!await clearSelectedPixels\(\)\)/);
  assert.doesNotMatch(html, /function clearSelectedPixels\(\)\{[^}]*pixels\[[^]]+\]=null/s);
});

test("zero-opacity, hidden and locked layers are not considered editable", () => {
  assert.match(html, /layer&&!layer\.locked&&layer\.visible&&Number\.isFinite\(layer\.opacity\)&&layer\.opacity>0/);
  for (const [reason, mutate] of [
    ["LAYER_LOCKED", project => { project.layers[0].locked = true; }],
    ["LAYER_HIDDEN", project => { project.layers[0].visible = false; }],
    ["LAYER_ZERO_OPACITY", project => { project.layers[0].opacity = 0; }]
  ]) {
    const project = makeProject();
    mutate(project);
    const before = JSON.stringify(project);
    const result = SafeEdit.clearActiveCel(project);
    assert.equal(result.ok, false, reason);
    assert.equal(result.reason, reason);
    assert.equal(JSON.stringify(project), before, reason + " must not mutate the source project");
  }
});

test("successful active-cel Clear returns a detached project and preserves other cels", () => {
  const project = makeProject();
  project.layers.push({ id: "layer-other", name: "Other", visible: true, locked: false, opacity: 1 });
  project.cels.push({
    layerId: "layer-other",
    frameId: "frame-active",
    pixels: ["#abcdef", null, null, null, null, null]
  });
  const before = JSON.stringify(project);
  const result = SafeEdit.clearActiveCel(project);
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.cels[0].pixels, Array(6).fill(null));
  assert.deepEqual(result.project.cels[1].pixels, ["#abcdef", null, null, null, null, null]);
  assert.equal(JSON.stringify(project), before);
});

test("selection Clear changes only pixels inside the selection on its detached result", () => {
  const project = makeProject();
  const before = JSON.stringify(project);
  const result = SafeEdit.clearActiveCel(project, {
    selection: { x: 0, y: 0, width: 1, height: 1 }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.project.cels[0].pixels, [null, null, null, null, "#112233", null]);
  assert.equal(JSON.stringify(project), before);
});
