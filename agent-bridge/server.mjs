#!/usr/bin/env node
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { chromium } from "playwright";
import * as z from "zod/v4";

function validateAppUrl(value) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("ARTCLUB_URL must be a valid absolute URL."); }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("ARTCLUB_URL must use HTTPS (or HTTP on localhost for development).");
  }
  if (url.username || url.password) {
    throw new Error("ARTCLUB_URL must not contain embedded credentials.");
  }

  const host = url.hostname.toLowerCase();
  const isLoopback = host === "localhost" || host === "127.0.0.1" ||
    host === "::1" || host === "[::1]";
  if (url.protocol === "http:" && !isLoopback) {
    throw new Error("Insecure HTTP is allowed only for localhost development URLs.");
  }
  return url.href;
}

const APP_URL = validateAppUrl(
  process.env.ARTCLUB_URL || "https://faiev.github.io/ArtClub/"
);
const PROFILE_DIR = process.env.ARTCLUB_PROFILE_DIR ||
  path.join(os.homedir(), ".artclub-agent-browser");
const HEADLESS = process.env.ARTCLUB_HEADLESS === "1";

const REVISION_GUARDED_METHODS = new Set([
  "draw_pixel", "draw_line", "draw_rectangle", "draw_ellipse", "fill",
  "erase_pixel", "erase_rectangle", "set_color", "execute",
  "undo", "redo",
  "add_layer", "select_layer", "set_layer_visibility", "set_layer_locked",
  "rename_layer", "move_layer", "duplicate_layer", "delete_layer",
  "set_selection", "select_all", "copy_selection", "cut_selection",
  "paste_selection", "clear_selection", "deselect", "move_selection",
  "transform_selection",
  "add_frame", "duplicate_frame", "select_frame", "delete_frame",
  "move_frame", "set_frame_duration", "rename_frame",
  "open_project", "import_project"
]);

let browserContext;
let page;
let connectionPromise;
let operationQueue = Promise.resolve();
const monitoredPages = new WeakSet();

function compactArgs(args) {
  return Object.fromEntries(
    Object.entries(args).filter(([, value]) => value !== undefined)
  );
}

async function connectToEditor() {
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    if (!browserContext) {
      const context = await chromium.launchPersistentContext(PROFILE_DIR, {
        headless: HEADLESS,
        viewport: { width: 1440, height: 1000 },
        acceptDownloads: true
      });
      browserContext = context;
      context.once("close", () => {
        if (browserContext === context) {
          browserContext = null;
          page = null;
        }
      });
    }

    const context = browserContext;
    const candidate = context.pages().find(item => !item.isClosed()) ||
      await context.newPage();
    page = candidate;

    if (!monitoredPages.has(candidate)) {
      monitoredPages.add(candidate);
      candidate.on("pageerror", error => {
        console.error("[Art Club browser]", error.message);
      });
      candidate.on("close", () => {
        if (page === candidate) page = null;
      });
      candidate.on("crash", () => {
        console.error("[Art Club browser] The editor page crashed.");
        if (page === candidate) page = null;
      });
    }

    await candidate.goto(APP_URL, { waitUntil: "domcontentloaded" });
    await candidate.waitForFunction(
      () => Boolean(window.onePixelStudio),
      null,
      { timeout: 45_000 }
    );

    const status = await candidate.evaluate(() => window.onePixelStudio.get_status());
    console.error(
      '[Art Club] Connected to "' + status.project_name + '" ' +
      '(' + status.canvas.width + "×" + status.canvas.height + ') at ' + APP_URL
    );
    return status;
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    const context = browserContext;
    browserContext = null;
    page = null;
    try { await context?.close(); } catch {}
    const message = error && error.message ? error.message : String(error);
    throw new Error("Could not connect to the Art Club editor: " + message);
  } finally {
    connectionPromise = null;
  }
}

async function readyPage() {
  if (page && !page.isClosed()) {
    try {
      const ready = await page.evaluate(() =>
        Boolean(window.onePixelStudio &&
          typeof window.onePixelStudio.get_status === "function")
      );
      if (ready) return page;
    } catch {
      // The page may have been closed, crashed or navigated away. Reconnect below.
    }
  }

  await connectToEditor();
  if (!page || page.isClosed()) {
    throw new Error("The Art Club browser page could not be restored.");
  }
  return page;
}

async function invokeNow(method, args) {
  const targetPage = await readyPage();
  try {
    return await targetPage.evaluate(async ({ methodName, payload, requiresRevision }) => {
      const api = window.onePixelStudio;
      if (!api) throw new Error("Art Club Agent API is not ready in this tab.");
      const fn = api[methodName];
      if (typeof fn !== "function") {
        throw new Error("Art Club does not support agent method: " + methodName);
      }

      if (requiresRevision) {
        const expected = payload && payload.expected_revision;
        if (!Number.isSafeInteger(expected) || expected < 0) {
          throw new Error("expected_revision is required. Call artclub_get_status and pass its revision before editing.");
        }
        const current = api.get_status();
        if (current.revision !== expected) {
          throw new Error("The project changed since your last read. Call artclub_get_status again, review the updated state, and retry with its revision.");
        }
      }
      return await fn(payload);
    }, {
      methodName: method,
      payload: args === undefined ? null : args,
      requiresRevision: REVISION_GUARDED_METHODS.has(method)
    });
  } catch (error) {
    const message = error && error.message ? error.message : String(error);
    if (targetPage.isClosed() || /target closed|browser has been closed|page crashed/i.test(message)) {
      throw new Error(
        'The browser disconnected during "' + method + '". The operation may have completed; ' +
        "call artclub_get_status before retrying. The next tool call will reconnect automatically. " +
        "Original error: " + message
      );
    }
    throw error;
  }
}

function invoke(method, args) {
  // MCP clients may issue tool calls concurrently. Serialize the bridge's view of
  // the editor so each revision check and operation completes before the next starts.
  const operation = () => invokeNow(method, args);
  const pending = operationQueue.then(operation, operation);
  operationQueue = pending.catch(() => {});
  return pending;
}

function textResult(value) {
  const text = typeof value === "string"
    ? value
    : JSON.stringify(value === undefined ? null : value, null, 2);
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
          text: name + " failed: " + (error && error.message ? error.message : String(error))
        }],
        isError: true
      };
    }
  });
}

async function main() {
  await connectToEditor();

  const server = new McpServer(
    { name: "art-club-pixel-studio", version: "0.2.0" },
    { maxToolInputElements: 12_000 }
  );

  const coordinate = z.number().int().min(0).max(511);
  const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
  const revision = z.number().int().nonnegative();

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
    async () => textResult({ palette: await invoke("get_palette") })
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
    "artclub_draw_ellipse",
    "Draw a pixel ellipse within the inclusive bounding box. Choose outlined or filled mode.",
    z.object({
      x1: coordinate, y1: coordinate,
      x2: coordinate, y2: coordinate,
      color: color.optional(),
      filled: z.boolean().optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("draw_ellipse", compactArgs(args)))
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
    "Execute up to 1,000 validated drawing commands as one undoable transaction. Supported types: draw_pixel, erase_pixel, draw_line, draw_rectangle, draw_ellipse, erase_rectangle, fill, clear_canvas and set_color. Use expected_revision to avoid overwriting newer edits.",
    z.object({
      commands: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
      label: z.string().max(80).optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("execute", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_list_layers",
    "List layers in bottom-to-top order. Each layer reports its id, name, visibility, lock and active state.",
    z.object({}),
    async () => textResult({ layers: await invoke("list_layers") })
  );

  registerTool(
    server,
    "artclub_add_layer",
    "Add a new transparent layer above the current stack and make it active.",
    z.object({ name: z.string().min(1).max(60).optional(), expected_revision: revision }),
    async args => textResult(await invoke("add_layer", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_select_layer",
    "Select a layer by its id. Subsequent drawing commands target this layer.",
    z.object({ layer_id: z.string().min(1), expected_revision: revision }),
    async args => textResult(await invoke("select_layer", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_set_layer_visibility",
    "Show or hide a layer in the canvas composite.",
    z.object({ layer_id: z.string().min(1), visible: z.boolean(), expected_revision: revision }),
    async args => textResult(await invoke("set_layer_visibility", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_set_layer_locked",
    "Lock or unlock a layer to prevent accidental editing.",
    z.object({ layer_id: z.string().min(1), locked: z.boolean(), expected_revision: revision }),
    async args => textResult(await invoke("set_layer_locked", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_rename_layer",
    "Rename a layer without changing its pixels.",
    z.object({ layer_id: z.string().min(1), name: z.string().min(1).max(60), expected_revision: revision }),
    async args => textResult(await invoke("rename_layer", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_move_layer",
    'Move a layer one position "up" (toward the front) or "down" (toward the back).',
    z.object({ layer_id: z.string().min(1), direction: z.enum(["up", "down"]), expected_revision: revision }),
    async args => textResult(await invoke("move_layer", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_duplicate_layer",
    "Duplicate the active layer and its pixels as a new layer.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("duplicate_layer", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_delete_layer",
    "Delete a layer by id. A project must retain at least one layer.",
    z.object({ layer_id: z.string().min(1), expected_revision: revision }),
    async args => textResult(await invoke("delete_layer", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_set_selection",
    "Set a rectangular pixel selection. Coordinates are zero-based and the rectangle must fit inside the canvas.",
    z.object({
      x: z.number().int().nonnegative(),
      y: z.number().int().nonnegative(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("set_selection", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_select_all",
    "Select the entire active canvas.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("select_all", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_copy_selection",
    "Copy the selected rectangle from the active layer into the local clipboard.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("copy_selection", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_cut_selection",
    "Copy and clear the selected rectangle on the active layer.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("cut_selection", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_paste_selection",
    "Paste the local clipboard at the current selection origin, or at the canvas origin when nothing is selected.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("paste_selection", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_clear_selection",
    "Clear pixels inside the selected rectangle on the active layer.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("clear_selection", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_deselect",
    "Remove the active marquee selection without changing artwork.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("deselect", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_move_selection",
    "Move the selected pixels by integer dx/dy offsets. The move is constrained to the canvas and is one undoable edit.",
    z.object({ dx: z.number().int(), dy: z.number().int(), expected_revision: revision }),
    async args => textResult(await invoke("move_selection", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_transform_selection",
    'Transform the selected active-layer pixels. operation is "flip_h", "flip_v", "rotate_cw" or "rotate_ccw". A 90-degree rotation swaps selection width and height; the result must fit inside the canvas.',
    z.object({
      operation: z.enum(["flip_h", "flip_v", "rotate_cw", "rotate_ccw"]),
      expected_revision: revision
    }),
    async args => textResult(await invoke("transform_selection", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_list_frames",
    "List animation frames in timeline order, including frame names, durations and active state.",
    z.object({}),
    async () => textResult({ frames: await invoke("list_frames") })
  );

  registerTool(
    server,
    "artclub_add_frame",
    "Add a blank animation frame after the active frame and make it active.",
    z.object({
      name: z.string().min(1).max(60).optional(),
      duration_ms: z.number().int().min(10).max(60000).optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("add_frame", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_duplicate_frame",
    "Duplicate a frame and all its layer cels, then make the duplicate active.",
    z.object({
      frame_id: z.string().min(1).optional(),
      name: z.string().min(1).max(60).optional(),
      expected_revision: revision
    }),
    async args => textResult(await invoke("duplicate_frame", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_select_frame",
    "Switch the active animation frame. Drawing commands then target that frame's active-layer cel.",
    z.object({ frame_id: z.string().min(1), expected_revision: revision }),
    async args => textResult(await invoke("select_frame", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_delete_frame",
    "Delete a frame and its cels. The final remaining frame cannot be deleted.",
    z.object({ frame_id: z.string().min(1).optional(), expected_revision: revision }),
    async args => textResult(await invoke("delete_frame", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_move_frame",
    'Move a frame one position "up" (earlier) or "down" (later) in the timeline.',
    z.object({
      frame_id: z.string().min(1).optional(),
      direction: z.enum(["up", "down"]),
      expected_revision: revision
    }),
    async args => textResult(await invoke("move_frame", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_set_frame_duration",
    "Set a frame's playback duration in milliseconds (10–60000).",
    z.object({
      frame_id: z.string().min(1).optional(),
      duration_ms: z.number().int().min(10).max(60000),
      expected_revision: revision
    }),
    async args => textResult(await invoke("set_frame_duration", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_rename_frame",
    "Rename a frame in the timeline.",
    z.object({
      frame_id: z.string().min(1).optional(),
      name: z.string().min(1).max(60),
      expected_revision: revision
    }),
    async args => textResult(await invoke("rename_frame", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_play_animation",
    "Start the active sprite animation preview using the selected playback mode.",
    z.object({}),
    async () => textResult(await invoke("play"))
  );

  registerTool(
    server,
    "artclub_pause_animation",
    "Pause the animation preview without changing the selected editing frame.",
    z.object({}),
    async () => textResult(await invoke("pause"))
  );

  registerTool(
    server,
    "artclub_stop_animation_preview",
    "Stop the preview and return the canvas to the selected editing frame.",
    z.object({}),
    async () => textResult(await invoke("stop_playback"))
  );

  registerTool(
    server,
    "artclub_set_playback_mode",
    'Choose "loop", "once" or "pingpong" animation preview mode.',
    z.object({ mode: z.enum(["loop", "once", "pingpong"]) }),
    async args => textResult(await invoke("set_playback_mode", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_set_onion_skin",
    "Toggle tinted previous/next frame overlays while editing. Onion skin never changes artwork pixels or exports.",
    z.object({ enabled: z.boolean() }),
    async args => textResult(await invoke("set_onion_skin", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_undo",
    "Undo one editing transaction.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("undo", compactArgs(args)))
  );

  registerTool(
    server,
    "artclub_redo",
    "Redo the last undone transaction.",
    z.object({ expected_revision: revision }),
    async args => textResult(await invoke("redo", compactArgs(args)))
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
    async () => textResult({ projects: await invoke("list_projects") })
  );

  registerTool(
    server,
    "artclub_open_project",
    "Open a project by project_id from artclub_list_projects.",
    z.object({ project_id: z.string().min(1), expected_revision: revision }),
    async args => textResult(await invoke("open_project", args))
  );

  registerTool(
    server,
    "artclub_export_project",
    "Export the active editable project as versioned project JSON.",
    z.object({}),
    async () => textResult({ project_json: await invoke("export_project") })
  );

  registerTool(
    server,
    "artclub_import_project",
    "Import a versioned Art Club project from a JSON string. This replaces the active editor document after preserving the current project.",
    z.object({ project_json: z.string().min(2).max(20_000_000), expected_revision: revision }),
    async args => {
      let project;
      try { project = JSON.parse(args.project_json); }
      catch { throw new Error("project_json is not valid JSON."); }
      return textResult(await invoke("import_project", {
        project,
        expected_revision: args.expected_revision
      }));
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
        ],
        structuredContent: {
          mime_type: png.mime_type,
          width: png.width,
          height: png.height
        }
      };
    }
  );

  const shutdown = async () => {
    const context = browserContext;
    browserContext = null;
    page = null;
    try { await context?.close(); } catch (error) {
      console.error("[Art Club] Browser shutdown:", error.message);
    }
  };
  process.once("SIGINT", () => { void shutdown(); });
  process.once("SIGTERM", () => { void shutdown(); });

  await serveStdio(() => server);
}

export { main };

const invokedDirectly = process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch(error => {
    console.error("[Art Club MCP] Startup failed:", error);
    process.exitCode = 1;
  });
}
