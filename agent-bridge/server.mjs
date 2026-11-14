#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { chromium } from "playwright";
import * as z from "zod/v4";

const APP_URL = process.env.ARTCLUB_URL || "https://faiev.github.io/ArtClub/";
const PROFILE_DIR = process.env.ARTCLUB_PROFILE_DIR ||
  path.join(os.homedir(), ".artclub-agent-browser");
const HEADLESS = process.env.ARTCLUB_HEADLESS === "1";

let browserContext;
let page;

function compactArgs(args) {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => value !== undefined)
  );
}

async function connectToEditor() {
  browserContext = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: HEADLESS,
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true
  });

  page = browserContext.pages()[0] || await browserContext.newPage();
  page.on("pageerror", error => {
    console.error("[Art Club browser]", error.message);
  });

  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () => Boolean(window.onePixelStudio),
    null,
    { timeout: 45_000 }
  );

  const status = await invoke("get_status");
  console.error(
    '[Art Club] Connected to "' + status.project_name + '" ' +
    '(' + status.canvas.width + "×" + status.canvas.height + ') at ' + APP_URL
  );
}

async function invoke(method, args) {
  if (!page || page.isClosed()) {
    throw new Error("The Art Club browser window is not available.");
  }
  return page.evaluate(async ({ methodName, payload }) => {
    const api = window.onePixelStudio;
    if (!api) throw new Error("Art Club Agent API is not ready in this tab.");
    const fn = api[methodName];
    if (typeof fn !== "function") {
      throw new Error("Art Club does not support agent method: " + methodName);
    }
    return await fn(payload);
  }, { methodName: method, payload: args === undefined ? null : args });
}

function textResult(value) {
  const text = typeof value === "string"
    ? value
    : JSON.stringify(value, null, 2);
  const result = { content: [{ type: "text", text }] };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    result.structuredContent = value;
  }
  return result;
}

function registerTool(server, name, description, inputSchema, handler) {
  server.registerTool(name, { description, inputSchema }, async args => {
    try {
      return await handler(args || {});
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: error && error.message ? error.message : String(error)
        }],
        isError: true
      };
    }
  });
}

async function main() {
  await connectToEditor();

  const server = new McpServer(
    { name: "art-club-pixel-studio", version: "0.1.0" },
    { maxToolInputElements: 12_000 }
  );

  const coordinate = z.number().int().min(0).max(511);
  const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
  const revision = z.number().int().nonnegative().optional();

  registerTool(
    server,
    "artclub_get_status",
    "Read the active Art Club project, canvas dimensions, palette, selected color, undo/redo availability and revision. Always call this before drawing.",
    z.object({}),
    async () => textResult(await invoke("get_status"))
  );

  registerTool(
    server,
    "artclub_get_canvas",
    "Read the active canvas as a row-major array. Coordinates start at top-left; x increases right and y increases down. Transparent pixels are null.",
    z.object({ include_pixels: z.boolean().optional() }),
    async args => textResult(await invoke("get_canvas", args))
  );

  registerTool(
    server,
    "artclub_get_pixel",
    "Read one pixel at integer grid coordinates.",
    z.object({ x: coordinate, y: coordinate }),
    async args => textResult(await invoke("get_pixel", args))
  );

  registerTool(
    server,
    "artclub_get_palette",
    "Read the active project's palette.",
    z.object({}),
    async () => textResult(await invoke("get_palette"))
  );

  registerTool(
    server,
    "artclub_draw_pixel",
    "Draw exactly one pixel. Coordinates are grid cells, not screen positions. Color is optional and must be #RRGGBB.",
    z.object({
      x: coordinate,
      y: coordinate,
      color: color.optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("draw_pixel", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_draw_line",
    "Draw a hard-edged straight line between two canvas pixels.",
    z.object({
      x1: coordinate, y1: coordinate,
      x2: coordinate, y2: coordinate,
      color: color.optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("draw_line", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_draw_rectangle",
    "Draw an outlined or filled pixel rectangle. Both corners are inclusive.",
    z.object({
      x1: coordinate, y1: coordinate,
      x2: coordinate, y2: coordinate,
      color: color.optional(),
      filled: z.boolean().optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("draw_rectangle", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_fill",
    "Flood-fill the contiguous region containing the selected coordinate.",
    z.object({
      x: coordinate, y: coordinate,
      color: color.optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("fill", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_erase_pixel",
    "Erase one pixel to transparency.",
    z.object({
      x: coordinate, y: coordinate,
      expected_revision: revision
    }),
    async args => textResult(await invoke("erase_pixel", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_erase_rectangle",
    "Erase an inclusive rectangular region to transparency.",
    z.object({
      x1: coordinate, y1: coordinate,
      x2: coordinate, y2: coordinate,
      expected_revision: revision
    }),
    async args => textResult(await invoke("erase_rectangle", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_set_color",
    "Set the active palette color, adding it to the palette if necessary.",
    z.object({ color, expected_revision: revision }),
    async args => textResult(await invoke("set_color", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_execute",
    "Execute up to 1,000 validated drawing commands as one undoable transaction. Supported types: draw_pixel, erase_pixel, draw_line, draw_rectangle, erase_rectangle, fill, clear_canvas and set_color. Use expected_revision to avoid overwriting newer edits.",
    z.object({
      commands: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
      label: z.string().max(80).optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("execute", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_undo",
    "Undo one editing transaction.",
    z.object({}),
    async () => textResult(await invoke("undo"))
  );

  registerTool(
    server,
    "artclub_redo",
    "Redo the last undone transaction.",
    z.object({}),
    async () => textResult(await invoke("redo"))
  );

  registerTool(
    server,
    "artclub_save",
    "Immediately save the active project to the local project library and backup.",
    z.object({}),
    async () => textResult(await invoke("save"))
  );

  registerTool(
    server,
    "artclub_list_projects",
    "List projects saved in this browser's local Art Club library.",
    z.object({}),
    async () => textResult(await invoke("list_projects"))
  );

  registerTool(
    server,
    "artclub_open_project",
    "Open a project by project_id from artclub_list_projects.",
    z.object({ project_id: z.string().min(1) }),
    async args => textResult(await invoke("open_project", args))
  );

  registerTool(
    server,
    "artclub_export_project",
    "Export the active editable project as versioned project JSON.",
    z.object({}),
    async () => textResult(await invoke("export_project"))
  );

  registerTool(
    server,
    "artclub_import_project",
    "Import a versioned Art Club project from a JSON string. This replaces the active editor document after preserving the current project.",
    z.object({ project_json: z.string().min(2).max(20_000_000) }),
    async args => {
      let project;
      try { project = JSON.parse(args.project_json); }
      catch { throw new Error("project_json is not valid JSON."); }
      return textResult(await invoke("import_project", { project }));
    }
  );

  registerTool(
    server,
    "artclub_export_png",
    "Render the current artwork to a native-size transparent PNG preview. Returns an image to the agent.",
    z.object({}),
    async () => {
      const png = await invoke("export_png");
      return {
        content: [
          {
            type: "image",
            data: png.data_base64,
            mimeType: png.mime_type
          },
          {
            type: "text",
            text: "PNG preview: " + png.width + "×" + png.height + " pixels"
          }
        ]
      };
    }
  );

  const shutdown = async () => {
    try { await browserContext?.close(); } catch (error) {
      console.error("[Art Club] Browser shutdown:", error.message);
    }
  };
  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown(); });

  await serveStdio(() => server);
}

main().catch(error => {
  console.error("[Art Club MCP] Startup failed:", error);
  process.exitCode = 1;
});
