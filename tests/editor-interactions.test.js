/* eslint-env node */
"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ProjectModel = require("../js/project-model.js");

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
      return ["brush", "eraser", "fill", "eyedropper", "line", "rect"].map(name => {
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
  const toolButtons = ["brush", "eraser", "fill", "eyedropper", "line", "rect"].map(name => {
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
  const context = vm.createContext({
    document,
    window: {
      ArtClubProject: ProjectModel,
      ArtClubStorage: { async open() { return storageApi; } }
    },
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
  return new Promise(resolve => setImmediate(() => resolve({
    document,
    grid,
    storage,
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

test("eraser removes a pixel and flood fill paints a connected area", async () => {
  const editor = await bootEditor();
  editor.tool("eraser").emit("click");
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointerup", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "transparent");

  editor.document.getElementById("newProjectBtn").emit("click");
  editor.tool("fill").emit("click");
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 2, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");
});
