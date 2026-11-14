"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const editorSource = fs.readFileSync(
  path.resolve(__dirname, "../../../index.html"),
  "utf8"
);

function loadProjectFunction() {
  const match = editorSource.match(
    /function loadProjectIntoEditor\(source,resetHistory=true\)\{([\s\S]*?)\n\}/
  );
  assert.ok(match, "editor should define loadProjectIntoEditor");
  return match[1];
}

test("project switching rebinds pixels and clears transient selection state", () => {
  const body = loadProjectFunction();

  assert.match(body, /projectDoc=doc/,
    "the target project must replace the previous editor document");
  assert.match(body, /pixels=activeCel\.pixels\.slice\(\)/,
    "the active cel must be rebound from the target project, not reused from the previous project");
  assert.match(body, /if\(resetHistory\)\{[\s\S]*selection=null;selectionPreview=null/,
    "a normal project load must clear the previous project's selection");
  assert.match(editorSource, /loadProjectIntoEditor\(doc\)/,
    "opening a library project should use the normal selection-resetting load path");
});
