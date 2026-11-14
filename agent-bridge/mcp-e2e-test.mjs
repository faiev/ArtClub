import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
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
    ARTCLUB_PROFILE_DIR: profileDir,
    NODE_ENV: "test",
    ARTCLUB_TEST_RECOVERY_FAULTS: "1",
    ARTCLUB_TEST_HOLD_POINTS: "23,22;22,21",
    ARTCLUB_TEST_HOLD_MS: "1000",
    ARTCLUB_TEST_TIMEOUT_POINT: "22,21",
    ARTCLUB_TEST_TIMEOUT_MS: "100",
    ARTCLUB_MAX_TOOL_INPUT_BYTES: "65536"
  };

  // Invalid editor URLs must fail before Chromium launches.
  for (const [invalidUrl, expectedMessage] of [
    ["http://example.com/", /localhost development URLs/],
    ["http://127.0.0.1.evil.example/", /localhost development URLs/],
    ["http://localhost.example/", /localhost development URLs/],
    ["ftp://example.com/", /must use HTTPS/],
    ["file:///etc/passwd", /must use HTTPS/],
    ["data:text/html,hello", /must use HTTPS/],
    ["javascript:alert(1)", /must use HTTPS/],
    ["https://user:pass@example.com/", /embedded credentials/]
  ]) {
    const result = spawnSync(process.execPath, [SERVER_PATH], {
      cwd: BRIDGE_DIR,
      env: { ...env, ARTCLUB_URL: invalidUrl },
      encoding: "utf8",
      timeout: 10_000
    });
    assert.notEqual(result.status, 0, "invalid URL should prevent bridge startup");
    assert.match(result.stderr, expectedMessage);
  }

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_PATH],
    cwd: BRIDGE_DIR,
    env
  });

  try {
    await client.connect(transport);
    const rawCallTool = client.callTool.bind(client);
    const revisionRequiredTools = new Set([
      "artclub_draw_pixel", "artclub_draw_line", "artclub_draw_rectangle",
      "artclub_draw_ellipse", "artclub_fill", "artclub_erase_pixel",
      "artclub_erase_rectangle", "artclub_set_color", "artclub_execute",
      "artclub_undo", "artclub_redo",
      "artclub_add_layer", "artclub_select_layer",
      "artclub_set_layer_visibility", "artclub_set_layer_locked",
      "artclub_rename_layer", "artclub_move_layer",
      "artclub_duplicate_layer", "artclub_delete_layer",
      "artclub_set_selection", "artclub_select_all",
      "artclub_copy_selection", "artclub_cut_selection",
      "artclub_paste_selection", "artclub_clear_selection",
      "artclub_deselect", "artclub_move_selection",
      "artclub_transform_selection",
      "artclub_add_frame", "artclub_duplicate_frame",
      "artclub_select_frame", "artclub_delete_frame",
      "artclub_move_frame", "artclub_set_frame_duration",
      "artclub_rename_frame",
      "artclub_open_project", "artclub_import_project"
    ]);
    async function callTool(request) {
      if (revisionRequiredTools.has(request.name) &&
          (!request.arguments || request.arguments.expected_revision === undefined)) {
        const statusResult = await rawCallTool({
          name: "artclub_get_status",
          arguments: {}
        });
        if (statusResult.isError) {
          throw new Error("Could not read the current project revision before " + request.name);
        }
        request = {
          ...request,
          arguments: {
            ...(request.arguments || {}),
            expected_revision: statusResult.structuredContent.revision
          }
        };
      }
      return rawCallTool(request);
    }

    const toolList = await client.listTools();
    const names = new Set(toolList.tools.map(tool => tool.name));
    for (const required of [
      "artclub_get_capabilities",
      "artclub_get_bridge_diagnostics",
      "artclub_get_status",
      "artclub_get_canvas",
      "artclub_get_palette",
      "artclub_draw_pixel",
      "artclub_draw_line",
      "artclub_draw_rectangle",
      "artclub_draw_ellipse",
      "artclub_fill",
      "artclub_erase_pixel",
      "artclub_erase_rectangle",
      "artclub_set_color",
      "artclub_execute",
      "artclub_undo",
      "artclub_redo",
      "artclub_export_project",
      "artclub_import_project",
      "artclub_get_pixel",
      "artclub_export_png",
      "artclub_save",
      "artclub_list_projects",
      "artclub_open_project",
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
      "artclub_move_selection",
      "artclub_transform_selection",
      "artclub_list_frames",
      "artclub_add_frame",
      "artclub_duplicate_frame",
      "artclub_select_frame",
      "artclub_delete_frame",
      "artclub_move_frame",
      "artclub_set_frame_duration",
      "artclub_rename_frame",
      "artclub_play_animation",
      "artclub_pause_animation",
      "artclub_stop_animation_preview",
      "artclub_set_playback_mode",
      "artclub_set_onion_skin"
    ]) {
      assert.ok(names.has(required), "MCP server should register " + required);
    }
    for (const name of revisionRequiredTools) {
      const tool = toolList.tools.find(item => item.name === name);
      assert.ok(
        tool.inputSchema.required?.includes("expected_revision"),
        name + " must require expected_revision in its MCP input schema"
      );
    }

    const statusResult = await callTool({
      name: "artclub_get_status",
      arguments: {}
    });
    assert.notEqual(statusResult.isError, true);
    const status = statusResult.structuredContent;
    assert.equal(status.protocol, "one-pixel-studio-agent");
    assert.equal(status.protocol_version, 1);

    const initialDiagnostics = await callTool({ name: "artclub_get_bridge_diagnostics", arguments: {} });
    assert.equal(initialDiagnostics.structuredContent.connection.state, "connected");
    assert.equal(initialDiagnostics.structuredContent.queue.active, 1);
    assert.match(initialDiagnostics.structuredContent.queue.active_request_id, /^[0-9a-f-]{36}$/i);

    const capabilitiesResult = await callTool({
      name: "artclub_get_capabilities",
      arguments: { client_protocol_version: 1 }
    });
    assert.notEqual(capabilitiesResult.isError, true);
    const capabilities = capabilitiesResult.structuredContent;
    assert.equal(capabilities.document_version, 1);
    assert.equal(capabilities.protocol.name, status.protocol);
    assert.equal(capabilities.protocol.version, status.protocol_version);
    assert.equal(capabilities.bridge.version, "0.7.0");
    assert.equal(capabilities.tools.total, toolList.tools.length);
    assert.equal(capabilities.tools.catalog.length, toolList.tools.length);
    assert.ok(capabilities.tools.catalog.every(tool => names.has(tool.name)));
    assert.ok(capabilities.tools.revision_required.includes("artclub_draw_pixel"));
    assert.equal(capabilities.revision_policy.conflict.error_code, "STALE_REVISION");

    const incompatibleClient = await rawCallTool({
      name: "artclub_get_capabilities",
      arguments: { client_protocol_version: 99 }
    });
    assert.equal(incompatibleClient.isError, true);
    assert.equal(
      incompatibleClient.structuredContent.error.code,
      "PROTOCOL_VERSION_UNSUPPORTED"
    );
    assert.match(
      incompatibleClient.structuredContent.error.message,
      /supports protocol version 1.*Update the client/
    );

    // Strict root schemas and discriminated command schemas reject unexpected
    // object shapes before any editor operation can start.
    const validationRevision = status.revision;
    const schemaRejections = [
      ["artclub_get_status", { unexpected: true }],
      ["artclub_draw_pixel", {
        x: 1, y: 1, color: "#112233",
        expected_revision: validationRevision, unexpected: true
      }],
      ["artclub_execute", {
        expected_revision: validationRevision,
        commands: [{ type: "draw_pixel", x: 1, y: 1, color: "#112233", unexpected: true }]
      }],
      ["artclub_execute", {
        expected_revision: validationRevision,
        commands: [{ type: "delete_project", project_id: "some-project" }]
      }],
      ["artclub_execute", {
        expected_revision: validationRevision,
        commands: Array.from({ length: 1001 }, () => ({ type: "clear_canvas" }))
      }],
      ["artclub_set_selection", {
        x: 0, y: 0, width: 513, height: 1, expected_revision: validationRevision
      }],
      ["artclub_move_selection", {
        dx: 513, dy: 0, expected_revision: validationRevision
      }]
    ];
    for (const [name, args] of schemaRejections) {
      const rejected = await rawCallTool({ name, arguments: args });
      assert.equal(rejected.isError, true, name + " must reject malformed or out-of-bounds input");
    }
    const afterSchemaRejections = await rawCallTool({
      name: "artclub_get_status", arguments: {}
    });
    assert.equal(
      afterSchemaRejections.structuredContent.revision,
      validationRevision,
      "schema rejection must not mutate the project"
    );

    // IDs are untrusted identifiers; unknown layer/frame IDs are rejected
    // without advancing the document revision.
    for (const [name, args] of [
      ["artclub_select_layer", { layer_id: "missing-layer-id", expected_revision: validationRevision }],
      ["artclub_select_frame", { frame_id: "missing-frame-id", expected_revision: validationRevision }]
    ]) {
      const rejected = await rawCallTool({ name, arguments: args });
      assert.equal(rejected.isError, true, name + " must reject unknown IDs");
    }

    // Malformed JSON, scalar/array roots and invalid project documents all
    // fail before the editor persists or replaces the active project.
    for (const [project_json, expectedCode] of [
      ["{not-json", "INVALID_PROJECT_JSON"],
      ["null", "INVALID_PROJECT_SHAPE"],
      ["[]", "INVALID_PROJECT_SHAPE"],
      [JSON.stringify({ format: "not-an-artclub-project" }), "TOOL_FAILED"]
    ]) {
      const rejected = await rawCallTool({
        name: "artclub_import_project",
        arguments: { project_json, expected_revision: validationRevision }
      });
      assert.equal(rejected.isError, true, "invalid project payload must be rejected");
      assert.equal(rejected.structuredContent.error.code, expectedCode);
    }

    // JSON string length is not byte length: emoji are multi-byte UTF-8.
    // This payload passes the schema character cap but exceeds the serialized
    // request byte cap and must be rejected by the bridge before browser use.
    const oversizedUtf8 = await rawCallTool({
      name: "artclub_import_project",
      arguments: {
        project_json: "🧵".repeat(20_000),
        expected_revision: validationRevision
      }
    });
    assert.equal(oversizedUtf8.isError, true);
    assert.equal(oversizedUtf8.structuredContent.error.code, "INPUT_TOO_LARGE");

    const afterInvalidImports = await rawCallTool({
      name: "artclub_get_status", arguments: {}
    });
    assert.equal(
      afterInvalidImports.structuredContent.revision,
      validationRevision,
      "rejected project imports and oversized inputs must leave the active document unchanged"
    );

    const missingRevision = await rawCallTool({
      name: "artclub_draw_pixel",
      arguments: { x: 18, y: 18, color: "#adadad" }
    });
    assert.equal(missingRevision.isError, true, "MCP mutations must require expected_revision");

    const paletteResult = await callTool({
      name: "artclub_get_palette",
      arguments: {}
    });
    assert.ok(Array.isArray(paletteResult.structuredContent.palette));
    const canvasMeta = await callTool({
      name: "artclub_get_canvas",
      arguments: { include_pixels: false }
    });
    assert.equal(canvasMeta.structuredContent.width, 24);

    const drawResult = await callTool({
      name: "artclub_draw_pixel",
      arguments: {
        x: 6,
        y: 7,
        color: "#12abef",
        expected_revision: status.revision
      }
    });
    assert.notEqual(drawResult.isError, true);

    const pixelResult = await callTool({
      name: "artclub_get_pixel",
      arguments: { x: 6, y: 7 }
    });
    assert.equal(pixelResult.structuredContent.color, "#12abef");

    const ellipseResult = await callTool({
      name: "artclub_draw_ellipse",
      arguments: {
        x1: 3, y1: 3, x2: 9, y2: 9,
        color: "#33aa77", filled: true
      }
    });
    assert.notEqual(ellipseResult.isError, true);
    const ellipseCenter = await callTool({
      name: "artclub_get_pixel",
      arguments: { x: 6, y: 6 }
    });
    assert.equal(ellipseCenter.structuredContent.color, "#33aa77");

    const baseLayerId = statusResult.structuredContent.active_layer.id;
    const beforeAddLayer = await callTool({
      name: "artclub_get_status",
      arguments: {}
    });
    const addLayerResult = await callTool({
      name: "artclub_add_layer",
      arguments: { name: "MCP Details", expected_revision: beforeAddLayer.structuredContent.revision }
    });
    assert.notEqual(addLayerResult.isError, true);
    const topLayerId = addLayerResult.structuredContent.active_layer.id;
    assert.notEqual(topLayerId, baseLayerId);
    const topDraw = await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 6, y: 7, color: "#12abef" }
    });
    assert.notEqual(topDraw.isError, true);

    const lowerSelect = await callTool({
      name: "artclub_select_layer",
      arguments: { layer_id: baseLayerId }
    });
    assert.notEqual(lowerSelect.isError, true);
    const lowerDraw = await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 6, y: 7, color: "#224466" }
    });
    assert.notEqual(lowerDraw.isError, true);
    const stillCovered = await callTool({
      name: "artclub_get_pixel",
      arguments: { x: 6, y: 7 }
    });
    assert.equal(stillCovered.structuredContent.color, "#12abef", "top layer should cover lower-layer pixel");

    const hideTop = await callTool({
      name: "artclub_set_layer_visibility",
      arguments: { layer_id: topLayerId, visible: false }
    });
    assert.notEqual(hideTop.isError, true);
    const revealed = await callTool({
      name: "artclub_get_pixel",
      arguments: { x: 6, y: 7 }
    });
    assert.equal(revealed.structuredContent.color, "#224466", "hiding top layer should reveal lower pixel");

    await callTool({
      name: "artclub_set_layer_visibility",
      arguments: { layer_id: topLayerId, visible: true }
    });
    await callTool({
      name: "artclub_select_layer",
      arguments: { layer_id: topLayerId }
    });
    await callTool({
      name: "artclub_set_layer_locked",
      arguments: { layer_id: topLayerId, locked: true }
    });
    const lockedDraw = await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 8, y: 8, color: "#ff00ff" }
    });
    assert.equal(lockedDraw.isError, true, "locked layers must reject drawing");
    assert.equal(lockedDraw.structuredContent.ok, false);
    assert.equal(lockedDraw.structuredContent.error.tool, "artclub_draw_pixel");
    assert.match(lockedDraw.structuredContent.error.message, /locked/i);
    await callTool({
      name: "artclub_set_layer_locked",
      arguments: { layer_id: topLayerId, locked: false }
    });
    await callTool({
      name: "artclub_rename_layer",
      arguments: { layer_id: topLayerId, name: "MCP Highlights" }
    });
    const layerList = await callTool({ name: "artclub_list_layers", arguments: {} });
    assert.ok(layerList.content[0].text.includes("MCP Highlights"));

    const beforeSelection = await callTool({
      name: "artclub_get_status", arguments: {}
    });
    const selectionResult = await callTool({
      name: "artclub_set_selection",
      arguments: { x: 10, y: 10, width: 1, height: 1, expected_revision: beforeSelection.structuredContent.revision }
    });
    assert.notEqual(selectionResult.isError, true);
    const selectedDraw = await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 10, y: 10, color: "#aabbcc" }
    });
    assert.notEqual(selectedDraw.isError, true);
    const outsideDraw = await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 11, y: 10, color: "#ff0000" }
    });
    assert.notEqual(outsideDraw.isError, true);
    const outsideRead = await callTool({
      name: "artclub_get_pixel", arguments: { x: 11, y: 10 }
    });
    assert.notEqual(outsideRead.structuredContent.color, "#ff0000", "drawing must be constrained to the selected rectangle");
    const copiedSelection = await callTool({
      name: "artclub_copy_selection", arguments: {}
    });
    assert.notEqual(copiedSelection.isError, true);
    const beforeMove = await callTool({
      name: "artclub_get_status", arguments: {}
    });
    const movedSelection = await callTool({
      name: "artclub_move_selection",
      arguments: { dx: 1, dy: 1, expected_revision: beforeMove.structuredContent.revision }
    });
    assert.notEqual(movedSelection.isError, true);
    const movedPixel = await callTool({
      name: "artclub_get_pixel", arguments: { x: 11, y: 11 }
    });
    assert.equal(movedPixel.structuredContent.color, "#aabbcc");
    await callTool({ name: "artclub_deselect", arguments: {} });

    const beforeRotateSelection = await callTool({
      name: "artclub_get_status", arguments: {}
    });
    const rotateBounds = await callTool({
      name: "artclub_set_selection",
      arguments: { x: 12, y: 12, width: 2, height: 1, expected_revision: beforeRotateSelection.structuredContent.revision }
    });
    assert.notEqual(rotateBounds.isError, true);
    await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 12, y: 12, color: "#aa0000" }
    });
    await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 13, y: 12, color: "#00aa00" }
    });
    const beforeRotate = await callTool({
      name: "artclub_get_status", arguments: {}
    });
    const rotateResult = await callTool({
      name: "artclub_transform_selection",
      arguments: { operation: "rotate_cw", expected_revision: beforeRotate.structuredContent.revision }
    });
    assert.notEqual(rotateResult.isError, true);
    assert.equal(rotateResult.structuredContent.selection.width, 1);
    assert.equal(rotateResult.structuredContent.selection.height, 2);
    const rotatedA = await callTool({
      name: "artclub_get_pixel", arguments: { x: 12, y: 12 }
    });
    const rotatedB = await callTool({
      name: "artclub_get_pixel", arguments: { x: 12, y: 13 }
    });
    assert.equal(rotatedA.structuredContent.color, "#aa0000");
    assert.equal(rotatedB.structuredContent.color, "#00aa00");

    const initialFrames = await callTool({
      name: "artclub_list_frames", arguments: {}
    });
    assert.equal(initialFrames.structuredContent.frames[0].active, true);
    const firstFrameId = initialFrames.structuredContent.frames[0].id;
    const frameAdded = await callTool({
      name: "artclub_add_frame",
      arguments: { name: "MCP Walk 2", duration_ms: 140 }
    });
    assert.notEqual(frameAdded.isError, true);
    const secondFrameId = frameAdded.structuredContent.active_frame.id;
    await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 14, y: 14, color: "#12fe34" }
    });
    const backToFirst = await callTool({
      name: "artclub_select_frame",
      arguments: { frame_id: firstFrameId }
    });
    assert.notEqual(backToFirst.isError, true);
    const firstFramePixel = await callTool({
      name: "artclub_get_pixel", arguments: { x: 14, y: 14 }
    });
    assert.notEqual(firstFramePixel.structuredContent.color, "#12fe34");
    await callTool({
      name: "artclub_select_frame",
      arguments: { frame_id: secondFrameId }
    });
    const secondFramePixel = await callTool({
      name: "artclub_get_pixel", arguments: { x: 14, y: 14 }
    });
    assert.equal(secondFramePixel.structuredContent.color, "#12fe34");

    const duplicateFrame = await callTool({
      name: "artclub_duplicate_frame",
      arguments: { frame_id: secondFrameId, name: "MCP Walk 2 Copy" }
    });
    assert.notEqual(duplicateFrame.isError, true);
    const duplicateFrameId = duplicateFrame.structuredContent.active_frame.id;
    await callTool({
      name: "artclub_set_frame_duration",
      arguments: { frame_id: duplicateFrameId, duration_ms: 210 }
    });
    await callTool({
      name: "artclub_move_frame",
      arguments: { frame_id: duplicateFrameId, direction: "up" }
    });
    await callTool({
      name: "artclub_rename_frame",
      arguments: { frame_id: duplicateFrameId, name: "MCP Final Pose" }
    });
    const orderedFrames = await callTool({
      name: "artclub_list_frames", arguments: {}
    });
    const activeFrameRecord = orderedFrames.structuredContent.frames.find(frame => frame.id === duplicateFrameId);
    assert.equal(activeFrameRecord.order, 1);
    assert.equal(activeFrameRecord.duration_ms, 210);
    assert.equal(activeFrameRecord.name, "MCP Final Pose");
    await callTool({
      name: "artclub_delete_frame",
      arguments: { frame_id: duplicateFrameId }
    });
    const frameCountAfterDelete = await callTool({
      name: "artclub_list_frames", arguments: {}
    });
    assert.equal(frameCountAfterDelete.structuredContent.frames.length, 2);
    await callTool({
      name: "artclub_set_playback_mode",
      arguments: { mode: "pingpong" }
    });
    const onionEnabled = await callTool({
      name: "artclub_set_onion_skin",
      arguments: { enabled: true }
    });
    assert.equal(onionEnabled.structuredContent.playback.onion_skin, true);
    const playing = await callTool({
      name: "artclub_play_animation",
      arguments: {}
    });
    assert.equal(playing.structuredContent.playback.playing, true);
    const rejectedDuringPlayback = await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 17, y: 17, color: "#ff00ff" }
    });
    assert.equal(rejectedDuringPlayback.isError, true, "agents must not draw while playback is running");
    const paused = await callTool({
      name: "artclub_pause_animation",
      arguments: {}
    });
    assert.equal(paused.structuredContent.playback.playing, false);
    assert.equal(paused.structuredContent.playback.previewing, true);
    const stopped = await callTool({
      name: "artclub_stop_animation_preview",
      arguments: {}
    });
    assert.equal(stopped.structuredContent.playback.previewing, false);
    assert.equal(stopped.structuredContent.playback.onion_skin, true);

    await callTool({
      name: "artclub_delete_frame",
      arguments: { frame_id: secondFrameId }
    });
    const cannotDeleteLastFrame = await callTool({
      name: "artclub_delete_frame",
      arguments: { frame_id: firstFrameId }
    });
    assert.equal(cannotDeleteLastFrame.isError, true, "the final animation frame must be retained");

    const pngResult = await callTool({
      name: "artclub_export_png",
      arguments: {}
    });
    assert.notEqual(pngResult.isError, true);
    const imageBlock = pngResult.content.find(block => block.type === "image");
    assert.ok(imageBlock, "MCP PNG export should return an image block");
    assert.ok(imageBlock.data.startsWith("iVBORw0KGgo"));

    const exportResult = await callTool({
      name: "artclub_export_project",
      arguments: {}
    });
    assert.equal(typeof exportResult.structuredContent.project_json, "string");
    assert.equal(JSON.parse(exportResult.structuredContent.project_json).format, "one-pixel-studio");
    const importResult = await callTool({
      name: "artclub_import_project",
      arguments: { project_json: exportResult.structuredContent.project_json }
    });
    assert.notEqual(importResult.isError, true);

    const saveResult = await callTool({
      name: "artclub_save",
      arguments: {}
    });
    assert.equal(saveResult.structuredContent.ok, true);

    const projectsResult = await callTool({
      name: "artclub_list_projects",
      arguments: {}
    });
    assert.ok(projectsResult.content[0].text.includes(status.project_id));
    assert.ok(Array.isArray(projectsResult.structuredContent.projects));

    const openResult = await callTool({
      name: "artclub_open_project",
      arguments: { project_id: status.project_id }
    });
    assert.notEqual(openResult.isError, true);

    const invalidResult = await callTool({
      name: "artclub_draw_pixel",
      arguments: { x: 999, y: 7, color: "#12abef" }
    });
    assert.equal(invalidResult.isError, true, "invalid coordinates should be rejected");

    const sharedRevision = await callTool({
      name: "artclub_get_status",
      arguments: {}
    });
    const sameRevision = sharedRevision.structuredContent.revision;
    const concurrentWrites = await Promise.all([
      rawCallTool({
        name: "artclub_draw_pixel",
        arguments: { x: 20, y: 20, color: "#aa2211", expected_revision: sameRevision }
      }),
      rawCallTool({
        name: "artclub_draw_pixel",
        arguments: { x: 21, y: 20, color: "#11aa22", expected_revision: sameRevision }
      })
    ]);
    assert.equal(
      concurrentWrites.filter(result => result.isError !== true).length,
      1,
      "only one concurrent write may succeed against the same revision"
    );
    const staleWrite = concurrentWrites.find(result => result.isError === true);
    assert.match(staleWrite.content[0].text, /changed since your last read|revision/i);
    assert.equal(staleWrite.structuredContent.ok, false);
    assert.equal(staleWrite.structuredContent.error.tool, "artclub_draw_pixel");
    assert.equal(staleWrite.structuredContent.error.code, "STALE_REVISION");
    assert.match(staleWrite.structuredContent.error.message, /changed since your last read/i);

    // Client cancellation during a post-mutation hold must cancel the caller
    // promptly, close the in-flight page, and keep the serial lane fenced until
    // Playwright reports the evaluation has unwound.
    const beforeCancel = await callTool({ name: "artclub_get_status", arguments: {} });
    const cancelRevision = beforeCancel.structuredContent.revision;
    const cancelController = new AbortController();
    const cancelledMutation = rawCallTool({
      name: "artclub_draw_pixel",
      arguments: {
        x: 23, y: 22, color: "#c0ffee",
        expected_revision: cancelRevision
      }
    }, { signal: cancelController.signal });
    const queuedAfterCancel = rawCallTool({
      name: "artclub_draw_pixel",
      arguments: {
        x: 22, y: 22, color: "#2211aa",
        expected_revision: cancelRevision
      }
    });
    await new Promise(resolve => setTimeout(resolve, 125));
    cancelController.abort(new Error("AC-043 cancellation test"));
    await assert.rejects(cancelledMutation);
    const afterCancelQueued = await queuedAfterCancel;
    if (afterCancelQueued.isError) {
      assert.match(afterCancelQueued.structuredContent.error.message, /changed since your last read|revision/i);
    } else {
      const queuedPixel = await callTool({ name: "artclub_get_pixel", arguments: { x: 22, y: 22 } });
      assert.equal(queuedPixel.structuredContent.color, "#2211aa");
    }
    const afterCancelStatus = await callTool({ name: "artclub_get_status", arguments: {} });
    assert.ok(Number.isSafeInteger(afterCancelStatus.structuredContent.revision));
    const cancelledPixel = await callTool({ name: "artclub_get_pixel", arguments: { x: 23, y: 22 } });
    assert.equal(cancelledPixel.structuredContent.color, "#c0ffee", "the test hold commits and saves before cancellation");
    
    // An active operation deadline returns an uncertain-outcome error with a
    // request ID. A later queued request must wait for browser teardown and can
    // only run against the state observed after the in-flight evaluation ends.
    const beforeTimeout = await callTool({ name: "artclub_get_status", arguments: {} });
    const timeoutRevision = beforeTimeout.structuredContent.revision;
    const timedMutation = rawCallTool({
      name: "artclub_draw_pixel",
      arguments: {
        x: 22, y: 21, color: "#deadbe",
        expected_revision: timeoutRevision
      }
    });
    const queuedAfterTimeout = rawCallTool({
      name: "artclub_draw_pixel",
      arguments: {
        x: 21, y: 21, color: "#bb22cc",
        expected_revision: timeoutRevision
      }
    });
    const timeoutResult = await timedMutation;
    assert.equal(timeoutResult.isError, true);
    assert.equal(timeoutResult.structuredContent.error.code, "OPERATION_TIMEOUT");
    assert.equal(timeoutResult.structuredContent.error.outcome_uncertain, true);
    assert.ok(timeoutResult.structuredContent.error.request_id);
    const afterTimeoutQueued = await queuedAfterTimeout;
    if (afterTimeoutQueued.isError) {
      assert.match(afterTimeoutQueued.structuredContent.error.message, /changed since your last read|revision/i);
    } else {
      const queuedPixel = await callTool({ name: "artclub_get_pixel", arguments: { x: 21, y: 21 } });
      assert.equal(queuedPixel.structuredContent.color, "#bb22cc");
    }
    const afterTimeoutStatus = await callTool({ name: "artclub_get_status", arguments: {} });
    assert.ok(Number.isSafeInteger(afterTimeoutStatus.structuredContent.revision));
    const timedPixel = await callTool({ name: "artclub_get_pixel", arguments: { x: 22, y: 21 } });
    assert.equal(timedPixel.structuredContent.color, "#deadbe", "the timed mutation may already have committed before the deadline");

    // Exercise the actual reconnect path for a closed tab, navigated tab and
    // disconnected Chromium context; the following read must reconnect.
    const faultKinds = ["page_close", "page_navigation", "browser_disconnect"];
    for (let index = 0; index < faultKinds.length; index += 1) {
      const kind = faultKinds[index];
      const injected = await callTool({
        name: "artclub_test_inject_browser_fault",
        arguments: { kind }
      });
      assert.equal(injected.structuredContent.injected, kind);

      const recovered = await callTool({ name: "artclub_get_status", arguments: {} });
      assert.notEqual(recovered.isError, true, kind + " must recover on the next bridge read");
      assert.ok(Number.isSafeInteger(recovered.structuredContent.revision));

      const diagnostics = await callTool({ name: "artclub_get_bridge_diagnostics", arguments: {} });
      const snapshot = diagnostics.structuredContent;
      assert.equal(snapshot.connection.state, "connected", kind + " should restore connection state");
      assert.ok(snapshot.connection.reconnect_attempts >= index + 1);
      assert.ok(snapshot.connection.reconnect_successes >= index + 1);
      if (kind === "page_close") assert.ok(snapshot.browser.page_closes >= 1);
      if (kind === "page_navigation") assert.ok(snapshot.browser.page_navigations >= 1);
      if (kind === "browser_disconnect") assert.ok(snapshot.browser.context_closes >= 1);
    }

    console.log("MCP E2E passed: structured reads/errors, revision checks, queue metrics, cancellation, deadlines, browser close/navigation/disconnect recovery, layers, selections and exports.");
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
