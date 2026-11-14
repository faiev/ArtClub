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
  const context = vm.createContext({
    document,
    window: { ArtClubProject: ProjectModel },
    localStorage: {
      getItem(key) { return storage.has(key) ? storage.get(key) : null; },
      setItem(key, value) { storage.set(key, String(value)); }
    },
    confirm() { return true; },
    setTimeout() { return 1; },
    clearTimeout() {},
    console
  });
  vm.runInContext(match[1], context, { filename: "index.html:inline-editor.js" });
  return {
    document,
    grid,
    storage,
    tool(name) {
      return toolButtons.find(button => button.dataset.tool === name);
    },
    cell(index) { return grid.children[index]; }
  };
}

test("editor script parses and initializes a real pixel grid", () => {
  const editor = bootEditor();
  assert.equal(editor.grid.children.length, 24 * 24);
  assert.equal(editor.document.getElementById("dimensionLabel").textContent, "24 × 24 PX");
});

test("brush paints on pointer down and commits the stroke", () => {
  const editor = bootEditor();
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");
  editor.grid.emit("pointerup", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
});

test("dragging the brush fills the cells along the stroke", () => {
  const editor = bootEditor();
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointermove", { target: editor.cell(5), pointerId: 1, clientX: 5, clientY: 1 });
  editor.grid.emit("pointerup", { target: editor.cell(5), pointerId: 1, clientX: 5, clientY: 1 });
  for (let index = 0; index <= 5; index += 1) {
    assert.equal(editor.cell(index).style.backgroundColor, "#e96f55", "stroke should cover pixel " + index);
  }
});

test("undo and redo restore the exact canvas pixels", () => {
  const editor = bootEditor();
  const original = editor.cell(0).style.backgroundColor;
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointerup", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");

  editor.document.getElementById("undoBtn").emit("click");
  assert.equal(editor.cell(0).style.backgroundColor, original);
  editor.document.getElementById("redoBtn").emit("click");
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");
});

test("eraser removes a pixel and flood fill paints a connected area", () => {
  const editor = bootEditor();
  editor.tool("eraser").emit("click");
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  editor.grid.emit("pointerup", { target: editor.cell(0), pointerId: 1, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "transparent");

  editor.document.getElementById("newProjectBtn").emit("click");
  editor.tool("fill").emit("click");
  editor.grid.emit("pointerdown", { target: editor.cell(0), pointerId: 2, clientX: 1, clientY: 1 });
  assert.equal(editor.cell(0).style.backgroundColor, "#e96f55");
});
