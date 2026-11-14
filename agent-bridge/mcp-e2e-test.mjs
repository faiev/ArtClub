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
      "artclub_get_pixel",
      "artclub_export_png",
      "artclub_save",
      "artclub_list_projects"
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

    console.log("MCP E2E passed: handshake, tool discovery, drawing, pixel readback, PNG image, save and input validation.");
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
