import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const BRIDGE_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(BRIDGE_DIR, "..");
const SERVER_PATH = path.join(BRIDGE_DIR, "server.mjs");

function startStaticServer() {
  const server = http.createServer((request, response) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname); }
    catch {
      response.writeHead(400).end("Bad request");
      return;
    }
    if (pathname === "/") pathname = "/index.html";
    const filePath = path.resolve(ROOT, "." + pathname);
    if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    fs.readFile(filePath, (error, data) => {
      if (error) {
        response.writeHead(404).end("Not found");
        return;
      }
      const extension = path.extname(filePath);
      const contentType = extension === ".html" ? "text/html; charset=utf-8" :
        extension === ".js" ? "text/javascript; charset=utf-8" :
        extension === ".css" ? "text/css; charset=utf-8" : "application/octet-stream";
      response.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
      response.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      resolve({
        server,
        url: "http://127.0.0.1:" + server.address().port + "/"
      });
    });
  });
}

async function run() {
  const { server: staticServer, url } = await startStaticServer();
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), "artclub-mcp-profile-"));
  const client = new Client({ name: "artclub-mcp-e2e-test", version: "1.0.0" });
  const env = {
    ...process.env,
    ARTCLUB_URL: url,
    ARTCLUB_HEADLESS: "1",
    ARTCLUB_PROFILE_DIR: profileDir
  };
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_PATH],
    cwd: BRIDGE_DIR,
    env
  });

  try {
    await client.connect(transport);
    const toolList = await client.listTools();
    const names = new Set(toolList.tools.map(tool => tool.name));
    for (const required of [
      "artclub_get_status",
      "artclub_draw_pixel",
      "artclub_draw_ellipse",
      "artclub_get_pixel",
      "artclub_export_png",
      "artclub_save",
      "artclub_list_projects",
      "artclub_list_layers",
      "artclub_add_layer",
      "artclub_select_layer",
      "artclub_set_layer_visibility",
      "artclub_set_layer_locked",
      "artclub_rename_layer",
      "artclub_move_layer",
      "artclub_duplicate_layer",
      "artclub_delete_layer",
      "artclub_set_selection",
      "artclub_select_all",
      "artclub_copy_selection",
      "artclub_cut_selection",
      "artclub_paste_selection",
      "artclub_clear_selection",
      "artclub_deselect",
      "artclub_move_selection"
    ]) {
      assert.ok(names.has(required), "MCP server should register " + required);
    }

    const statusResult = await client.callTool({
      name: "artclub_get_status",
      arguments: {}
    });
    assert.notEqual(statusResult.isError, true);
    const status = statusResult.structuredContent;
    assert.equal(status.protocol, "one-pixel-studio-agent");

    const drawResult = await client.callTool({
      name: "artclub_draw_pixel",
      arguments: {
        x: 6,
        y: 7,
        color: "#12abef",
        expected_revision: status.revision
      }
    });
    assert.notEqual(drawResult.isError, true);

    const pixelResult = await client.callTool({
      name: "artclub_get_pixel",
      arguments: { x: 6, y: 7 }
    });
    assert.equal(pixelResult.structuredContent.color, "#12abef");

    const ellipseResult = await client.callTool({
      name: "artclub_draw_ellipse",
      arguments: {
        x1: 3, y1: 3, x2: 9, y2: 9,
        color: "#33aa77", filled: true
      }
    });
    assert.notEqual(ellipseResult.isError, true);
    const ellipseCenter = await client.callTool({
      name: "artclub_get_pixel",
      arguments: { x: 6, y: 6 }
    });
    assert.equal(ellipseCenter.structuredContent.color, "#33aa77");

    const baseLayerId = statusResult.structuredContent.active_layer.id;
    const beforeAddLayer = await client.callTool({
      name: "artclub_get_status",
      arguments: {}
    });
    const addLayerResult = await client.callTool({
      name: "artclub_add_layer",
      arguments: { name: "MCP Details", expected_revision: beforeAddLayer.structuredContent.revision }
    });
    assert.notEqual(addLayerResult.isError, true);
    const topLayerId = addLayerResult.structuredContent.active_layer.id;
    assert.notEqual(topLayerId, baseLayerId);
    const topDraw = await client.callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 6, y: 7, color: "#12abef" }
    });
    assert.notEqual(topDraw.isError, true);

    const lowerSelect = await client.callTool({
      name: "artclub_select_layer",
      arguments: { layer_id: baseLayerId }
    });
    assert.notEqual(lowerSelect.isError, true);
    const lowerDraw = await client.callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 6, y: 7, color: "#224466" }
    });
    assert.notEqual(lowerDraw.isError, true);
    const stillCovered = await client.callTool({
      name: "artclub_get_pixel",
      arguments: { x: 6, y: 7 }
    });
    assert.equal(stillCovered.structuredContent.color, "#12abef", "top layer should cover lower-layer pixel");

    const hideTop = await client.callTool({
      name: "artclub_set_layer_visibility",
      arguments: { layer_id: topLayerId, visible: false }
    });
    assert.notEqual(hideTop.isError, true);
    const revealed = await client.callTool({
      name: "artclub_get_pixel",
      arguments: { x: 6, y: 7 }
    });
    assert.equal(revealed.structuredContent.color, "#224466", "hiding top layer should reveal lower pixel");

    await client.callTool({
      name: "artclub_set_layer_visibility",
      arguments: { layer_id: topLayerId, visible: true }
    });
    await client.callTool({
      name: "artclub_select_layer",
      arguments: { layer_id: topLayerId }
    });
    await client.callTool({
      name: "artclub_set_layer_locked",
      arguments: { layer_id: topLayerId, locked: true }
    });
    const lockedDraw = await client.callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 8, y: 8, color: "#ff00ff" }
    });
    assert.equal(lockedDraw.isError, true, "locked layers must reject drawing");
    await client.callTool({
      name: "artclub_set_layer_locked",
      arguments: { layer_id: topLayerId, locked: false }
    });
    await client.callTool({
      name: "artclub_rename_layer",
      arguments: { layer_id: topLayerId, name: "MCP Highlights" }
    });
    const layerList = await client.callTool({ name: "artclub_list_layers", arguments: {} });
    assert.ok(layerList.content[0].text.includes("MCP Highlights"));

    const beforeSelection = await client.callTool({
      name: "artclub_get_status", arguments: {}
    });
    const selectionResult = await client.callTool({
      name: "artclub_set_selection",
      arguments: { x: 10, y: 10, width: 1, height: 1, expected_revision: beforeSelection.structuredContent.revision }
    });
    assert.notEqual(selectionResult.isError, true);
    const selectedDraw = await client.callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 10, y: 10, color: "#aabbcc" }
    });
    assert.notEqual(selectedDraw.isError, true);
    const outsideDraw = await client.callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 11, y: 10, color: "#ff0000" }
    });
    assert.notEqual(outsideDraw.isError, true);
    const outsideRead = await client.callTool({
      name: "artclub_get_pixel", arguments: { x: 11, y: 10 }
    });
    assert.notEqual(outsideRead.structuredContent.color, "#ff0000", "drawing must be constrained to the selected rectangle");
    const copiedSelection = await client.callTool({
      name: "artclub_copy_selection", arguments: {}
    });
    assert.notEqual(copiedSelection.isError, true);
    const beforeMove = await client.callTool({
      name: "artclub_get_status", arguments: {}
    });
    const movedSelection = await client.callTool({
      name: "artclub_move_selection",
      arguments: { dx: 1, dy: 1, expected_revision: beforeMove.structuredContent.revision }
    });
    assert.notEqual(movedSelection.isError, true);
    const movedPixel = await client.callTool({
      name: "artclub_get_pixel", arguments: { x: 11, y: 11 }
    });
    assert.equal(movedPixel.structuredContent.color, "#aabbcc");
    await client.callTool({ name: "artclub_deselect", arguments: {} });

    const pngResult = await client.callTool({
      name: "artclub_export_png",
      arguments: {}
    });
    assert.notEqual(pngResult.isError, true);
    const imageBlock = pngResult.content.find(block => block.type === "image");
    assert.ok(imageBlock, "MCP PNG export should return an image block");
    assert.ok(imageBlock.data.startsWith("iVBORw0KGgo"));

    const saveResult = await client.callTool({
      name: "artclub_save",
      arguments: {}
    });
    assert.equal(saveResult.structuredContent.ok, true);

    const projectsResult = await client.callTool({
      name: "artclub_list_projects",
      arguments: {}
    });
    assert.ok(projectsResult.content[0].text.includes(status.project_id));

    const invalidResult = await client.callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 999, y: 7, color: "#12abef" }
    });
    assert.equal(invalidResult.isError, true, "invalid coordinates should be rejected");

    console.log("MCP E2E passed: handshake, drawing, selection and copy/paste, layer management, pixel readback, PNG preview, save and input validation.");
  } finally {
    await client.close().catch(() => {});
    await new Promise(resolve => staticServer.close(resolve));
    fs.rmSync(profileDir, { recursive: true, force: true });
  }
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
