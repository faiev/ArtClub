/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ProjectModel = require("../js/project-model.js");
const AgentAPI = require("../js/agent-api.js");

class FakeClassList {
  constructor(owner) { this.owner = owner; this.values = new Set(); }
  add(name) { this.values.add(name); }
  remove(name) { this.values.delete(name); }
  contains(name) { return this.values.has(name); }
  toggle(name, force) {
    const shouldAdd = force === undefined ? !this.values.has(name) : Boolean(force);
    if (shouldAdd) this.values.add(name);
    else this.values.delete(name);
    return shouldAdd;
  }
}

class FakeElement {
  constructor(id = "") {
    this.id = id;
    this.style = {};
    this.listeners = {};
    this.children = [];
    this.dataset = {};
    this.attributes = {};
    this.className = "";
    this.classList = new FakeClassList(this);
    this.value = "";
    this.textContent = "";
    this.checked = false;
    this.disabled = false;
    this.tabIndex = -1;
  }
  addEventListener(type, callback) {
    (this.listeners[type] ||= []).push(callback);
  }
  emit(type, event = {}) {
    const payload = {
      target: this,
      preventDefault() {},
      ...event
    };
    for (const callback of this.listeners[type] || []) callback(payload);
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  appendChild(child) {
    if (child && child.isFragment) this.children.push(...child.children);
    else this.children.push(child);
    return child;
  }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  showModal() { this.open = true; }
  close() { this.open = false; }
  replaceChildren(...children) {
    this.children = [];
    for (const child of children) this.appendChild(child);
  }
  createTextNode() {}
  setPointerCapture() {}
  closest(selector) {
    if (selector === ".pixel-cell" && this.className.split(/\s+/).includes("pixel-cell")) return this;
    return null;
  }
  focus() { this.ownerDocument.activeElement = this; }
}

function bootEditor() {
  const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
  const match = html.match(/<script>\s*([\s\S]*?)<\/script>/);
  assert.ok(match, "the inline editor script should exist");

  const elements = new Map();
  const document = {
    activeElement: null,
    getElementById(id) {
      if (!elements.has(id)) {
        const el = new FakeElement(id);
        el.ownerDocument = document;
        if (id === "gridToggle" || id === "checkerToggle") el.checked = true;
        if (id === "gridSize") el.value = "24";
        if (id === "projectName") el.value = "Untitled artwork";
        elements.set(id, el);
      }
      return elements.get(id);
    },
    createElement() {
      const el = new FakeElement();
      el.ownerDocument = document;
      return el;
    },
    createDocumentFragment() {
      const fragment = new FakeElement();
      fragment.isFragment = true;
      return fragment;
    },
    querySelectorAll(selector) {
      if (selector !== ".tool") return [];
      return ["brush", "eraser", "fill", "eyedropper", "line", "rect", "ellipse"].map(name => {
        const el = new FakeElement();
        el.ownerDocument = document;
        el.dataset.tool = name;
        el.className = "tool" + (name === "brush" ? " active" : "");
        el.classList.toggle("active", name === "brush");
        return el;
      });
    },
    addEventListener() {},
    elementFromPoint() { return null; }
  };
  const grid = document.getElementById("pixelGrid");
  const toolButtons = ["brush", "eraser", "fill", "eyedropper", "line", "rect", "ellipse"].map(name => {
    const el = new FakeElement();
    el.ownerDocument = document;
    el.dataset.tool = name;
    el.className = "tool" + (name === "brush" ? " active" : "");
    el.classList.toggle("active", name === "brush");
    return el;
  });
  document.querySelectorAll = selector => selector === ".tool" ? toolButtons : [];
  const storage = new Map();
  const projectDb = new Map();
  const recoveryDb = new Map();
  const storageApi = {
    async listProjects() {
      return [...projectDb.values()].map(record => ({
        id: record.id, name: record.name, width: record.canvas.width,
        height: record.canvas.height, updatedAt: record.metadata.updatedAt,
        createdAt: record.metadata.createdAt
      }));
    },
    async getProject(id) { return projectDb.has(id) ? ProjectModel.cloneProject(projectDb.get(id)) : null; },
    async getRecovery(id) {
      return recoveryDb.has(id) ? { project: ProjectModel.cloneProject(recoveryDb.get(id)), savedAt: new Date().toISOString() } : null;
    },
    async saveProject(project) {
      if (projectDb.has(project.id)) recoveryDb.set(project.id, ProjectModel.cloneProject(projectDb.get(project.id)));
      const copy = ProjectModel.cloneProject(project);
      copy.metadata.updatedAt = new Date().toISOString();
      projectDb.set(copy.id, copy);
      return { id: copy.id, name: copy.name };
    },
    async deleteProject(id) { projectDb.delete(id); recoveryDb.delete(id); }
  };
  const windowObject = {
    ArtClubProject: ProjectModel,
    ArtClubStorage: { async open() { return storageApi; } },
    ArtClubAgentAPI: AgentAPI
  };
  const context = vm.createContext({
    document,
    window: windowObject,
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    confirm() { return true; },
    prompt() { return null; },
    setTimeout() { return 1; },
    clearTimeout() {},
    console
  });
  vm.runInContext(match[1], context, { filename: "index.html:inline-editor.js" });
  return windowObject.OnePixelStudioReady.then(() => ({
    document,
    grid,
    storage,
    agent: windowObject.onePixelStudio,
    tool(name) {
      return toolButtons.find(button => button.dataset.tool === name);
    },
    cell(index) { return grid.children[index]; }
  }));
}

test("editor script parses and initializes a real pixel grid", async () => {
  const editor = await bootEditor();
  assert.equal(editor.grid.children.length, 24 * 24);
  assert.equal(editor.document.getElementById("dimensionLabel").textContent, "24 × 24 PX");
});

test("brush paints on pointer down and commits the stroke", async () => {
  const editor = await bootEditor();
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");
  editor.grid.emit("pointerup", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
});

test("dragging the brush fills the cells along the stroke", async () => {
  const editor = await bootEditor();
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointermove", { target: editor.cell(5), pointerId: 1, clientX: 5, clientY: 1 });
  editor.grid.emit("pointerup", { target: editor.cell(5), pointerId: 1, clientX: 5, clientY: 1 });
  for (let index = 0; index <= 5; index += 1) {
    assert.equal(editor.cell(index).style.backgroundColor, "#e96f55", "stroke should cover pixel " + index);
  }
});

test("undo and redo restore the exact canvas pixels", async () => {
  const editor = await bootEditor();
  const original = editor.cell(0).style.backgroundColor;
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointerup", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");

  editor.document.getElementById("undoBtn").emit("click");
  assert.equal(editor.cell(0).style.backgroundColor, original);
  editor.document.getElementById("redoBtn").emit("click");
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");
});

test("eraser removes a pixel", async () => {
  const editor = await bootEditor();
  editor.tool("eraser").emit("click");
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointerup", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "transparent");
});

test("flood fill paints a connected region", async () => {
  const editor = await bootEditor();
  editor.tool("fill").emit("click");
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");
  assert.equal(editor.cell(1).style.backgroundColor, "#e96f55");
});

test("agent API can inspect and draw pixels with revision protection", async () => {
  const editor = await bootEditor();
  const status = editor.agent.get_status();
  assert.equal(status.protocol, "one-pixel-studio-agent");
  assert.equal(status.canvas.width, 24);
  const result = await editor.agent.draw_pixel({
    x: 2, y: 3, color: "#ff00ff", expected_revision: status.revision
  });
  assert.equal(result.ok, true);
  assert.equal((await editor.agent.get_pixel({ x: 2, y: 3 })).color, "#ff00ff");
  assert.ok(editor.agent.get_palette().includes("#ff00ff"));
  assert.throws(
    () => editor.agent.draw_pixel({ x: 3, y: 3, expected_revision: status.revision }),
    /canvas changed/
  );
});

test("agent batches become one undoable edit and support shapes and fill", async () => {
  const editor = await bootEditor();
  const result = await editor.agent.execute({
    label: "Small test sprite",
    commands: [
      { type: "draw_line", x1: 1, y1: 1, x2: 4, y2: 1, color: "#ffffff" },
      { type: "draw_rectangle", x1: 1, y1: 2, x2: 4, y2: 4, filled: true, color: "#ff0000" },
      { type: "fill", x: 0, y: 0, color: "#00ff00" }
    ]
  });
  assert.equal(result.commands_applied, 3);
  assert.equal((await editor.agent.get_pixel({ x: 1, y: 1 })).color, "#ffffff");
  assert.equal((await editor.agent.get_pixel({ x: 2, y: 2 })).color, "#ff0000");
  await editor.agent.undo();
  assert.equal((await editor.agent.get_pixel({ x: 1, y: 1 })).color, "#172b3a");
});

test("shape tools show a preview before committing a filled rectangle", async () => {
  const editor = await bootEditor();
  editor.tool("rect").emit("click");
  editor.document.getElementById("shapeFillToggle").checked = true;
  editor.document.getElementById("shapeFillToggle").emit("change");
  editor.grid.emit("pointerdown", { target: editor.cell(25), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointermove", { target: editor.cell(75), pointerId: 1, clientX: 2, clientY: 2 });

  // A preview is painted visually, but is not yet part of the document pixels.
  assert.equal(editor.cell(25).style.backgroundColor, "#e96f55");
  assert.equal((await editor.agent.get_pixel({ x: 1, y: 1 })).color, "#172b3a");

  editor.grid.emit("pointerup", { target: editor.cell(75), pointerId: 1, clientX: 2, clientY: 2 });
  assert.equal((await editor.agent.get_pixel({ x: 1, y: 1 })).color, "#e96f55");
  assert.equal((await editor.agent.get_pixel({ x: 2, y: 2 })).color, "#e96f55");
});

test("ellipse tool previews and commits an outlined ellipse", async () => {
  const editor = await bootEditor();
  editor.tool("ellipse").emit("click");
  editor.grid.emit("pointerdown", { target: editor.cell(2 * 24 + 3), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointermove", { target: editor.cell(7 * 24 + 9), pointerId: 1, clientX: 2, clientY: 2 });
  editor.grid.emit("pointerup", { target: editor.cell(7 * 24 + 9), pointerId: 1, clientX: 2, clientY: 2 });
  const pixels = (await editor.agent.get_canvas()).pixels;
  assert.ok(pixels.some((color, index) => color === "#e96f55" && (index % 24) >= 3 && (index % 24) <= 9));
  assert.equal((await editor.agent.get_pixel({ x: 6, y: 2 })).color, "#e96f55");
});

test("agents can draw a filled ellipse as one undoable command", async () => {
  const editor = await bootEditor();
  const status = editor.agent.get_status();
  const result = await editor.agent.draw_ellipse({
    x1: 4, y1: 4, x2: 10, y2: 10,
    color: "#33aa77", filled: true,
    expected_revision: status.revision
  });
  assert.equal(result.commands_applied, 1);
  assert.equal((await editor.agent.get_pixel({ x: 7, y: 7 })).color, "#33aa77");
  await editor.agent.undo();
  assert.equal((await editor.agent.get_pixel({ x: 7, y: 7 })).color, "#172b3a");
});
