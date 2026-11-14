#!/usr/bin/env node
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { chromium } from "playwright";
import * as z from "zod/v4";
import {
  assertJsonByteLimit,
  BridgeOperationError,
  SerialOperationQueue
} from "./operation-queue.mjs";

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

function boundedIntegerEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(name + " must be an integer from " + min + " to " + max + ".");
  }
  return value;
}

function parseTestPoint(value) {
  if (!TEST_MODE || !value) return null;
  const parts = value.split(",").map(Number);
  if (parts.length !== 2 || parts.some(number => !Number.isSafeInteger(number) || number < 0)) {
    throw new Error("Test point values must use the x,y format.");
  }
  return { x: parts[0], y: parts[1] };
}

const TEST_MODE = process.env.NODE_ENV === "test";
const MAX_TOOL_INPUT_BYTES = boundedIntegerEnv(
  "ARTCLUB_MAX_TOOL_INPUT_BYTES", 8 * 1024 * 1024, 1_024, 32 * 1024 * 1024
);
const MAX_TOOL_OUTPUT_BYTES = boundedIntegerEnv(
  "ARTCLUB_MAX_TOOL_OUTPUT_BYTES", 16 * 1024 * 1024, 1_024, 64 * 1024 * 1024
);
const MAX_PENDING_OPERATIONS = boundedIntegerEnv(
  "ARTCLUB_MAX_PENDING_OPERATIONS", 64, 1, 512
);
const DEFAULT_TOOL_DEADLINE_MS = boundedIntegerEnv(
  "ARTCLUB_DEFAULT_TOOL_DEADLINE_MS", 30_000, 100, 300_000
);
const MAX_TOOL_DEADLINE_MS = boundedIntegerEnv(
  "ARTCLUB_MAX_TOOL_DEADLINE_MS", 120_000, 100, 300_000
);
const TOOL_DEADLINES_MS = new Map([
  ["artclub_get_status", 10_000],
  ["artclub_get_pixel", 10_000],
  ["artclub_get_canvas", 30_000],
  ["artclub_execute", 45_000],
  ["artclub_save", 30_000],
  ["artclub_open_project", 60_000],
  ["artclub_export_project", 45_000],
  ["artclub_import_project", 90_000],
  ["artclub_export_png", 25_000]
]);
const TEST_HOLD_POINTS = TEST_MODE && process.env.ARTCLUB_TEST_HOLD_POINTS
  ? process.env.ARTCLUB_TEST_HOLD_POINTS.split(";").map(parseTestPoint)
  : [];
const TEST_HOLD_MS = TEST_HOLD_POINTS.length
  ? boundedIntegerEnv("ARTCLUB_TEST_HOLD_MS", 1_000, 1, 5_000)
  : 0;
const TEST_TIMEOUT_POINT = parseTestPoint(process.env.ARTCLUB_TEST_TIMEOUT_POINT);
const TEST_TIMEOUT_MS = TEST_TIMEOUT_POINT
  ? boundedIntegerEnv("ARTCLUB_TEST_TIMEOUT_MS", 100, 50, 5_000)
  : 0;

function getToolDeadlineMs(name, args) {
  if (TEST_TIMEOUT_POINT && name === "artclub_draw_pixel" &&
      args?.x === TEST_TIMEOUT_POINT.x && args?.y === TEST_TIMEOUT_POINT.y) {
    return TEST_TIMEOUT_MS;
  }
  return Math.min(TOOL_DEADLINES_MS.get(name) ?? DEFAULT_TOOL_DEADLINE_MS, MAX_TOOL_DEADLINE_MS);
}

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
let activeBrowserOperation;
let shutdownPromise;
const requestScope = new AsyncLocalStorage();
const operationQueue = new SerialOperationQueue({ maxPending: MAX_PENDING_OPERATIONS });
const monitoredPages = new WeakSet();
const crashedPages = new WeakSet();

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
    const candidate = context.pages().find(item =>
      !item.isClosed() && !crashedPages.has(item)
    ) || await context.newPage();
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
        crashedPages.add(candidate);
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

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw signal.reason instanceof Error
      ? signal.reason
      : new BridgeOperationError("OPERATION_CANCELLED", "The request was cancelled.");
  }
}

async function interruptBrowserOperation(requestId) {
  const active = activeBrowserOperation;
  if (active && active.requestId === requestId) {
    activeBrowserOperation = null;
    if (page === active.page) page = null;
    try { await active.page.close({ runBeforeUnload: false }); } catch {}
    return;
  }

  // Cancellation during startup/reconnect must also fence the shared connection
  // promise. Wait for a late context to appear, then close it before releasing
  // the serial queue slot.
  const pendingConnection = connectionPromise;
  if (pendingConnection) {
    const context = browserContext;
    browserContext = null;
    page = null;
    try { await context?.close(); } catch {}
    try { await pendingConnection; } catch {}
    const lateContext = browserContext;
    if (lateContext) {
      browserContext = null;
      page = null;
      try { await lateContext.close(); } catch {}
    }
  }
}

async function readyPage(signal) {
  throwIfAborted(signal);
  if (page && !page.isClosed()) {
    try {
      const ready = await page.evaluate(() =>
        Boolean(window.onePixelStudio &&
          typeof window.onePixelStudio.get_status === "function")
      );
      if (ready) {
        throwIfAborted(signal);
        return page;
      }
    } catch (error) {
      if (signal?.aborted) throw signal.reason || error;
      // The page may have been closed, crashed or navigated away. Reconnect below.
    }
  }

  await connectToEditor();
  throwIfAborted(signal);
  if (!page || page.isClosed()) {
    throw new Error("The Art Club browser page could not be restored.");
  }
  return page;
}

async function invokeNow(method, args, scope = {}) {
  const { requestId = "internal", signal } = scope;
  throwIfAborted(signal);
  const targetPage = await readyPage(signal);
  throwIfAborted(signal);
  const operation = { requestId, page: targetPage };
  activeBrowserOperation = operation;
  const abortListener = () => {
    void interruptBrowserOperation(requestId).catch(error => {
      console.error("[Art Club] Could not interrupt cancelled browser operation:", error.message);
    });
  };
  signal?.addEventListener("abort", abortListener, { once: true });

  const holdPoint = method === "draw_pixel"
    ? TEST_HOLD_POINTS.find(point => args?.x === point.x && args?.y === point.y)
    : null;
  const testHoldMs = holdPoint ? TEST_HOLD_MS : 0;

  try {
    return await targetPage.evaluate(async ({
      methodName, payload, requiresRevision, holdAfterMutationMs
    }) => {
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
      const result = await fn(payload);
      // Test-only post-commit hold: it exercises cancellation after a mutation
      // may already have occurred rather than only cancelling before dispatch.
      if (holdAfterMutationMs > 0) {
        if (typeof api.save === "function") await api.save();
        await new Promise(resolve => setTimeout(resolve, holdAfterMutationMs));
      }
      return result;
    }, {
      methodName: method,
      payload: args === undefined ? null : args,
      requiresRevision: REVISION_GUARDED_METHODS.has(method),
      holdAfterMutationMs: testHoldMs
    });
  } catch (error) {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : error;
    const message = error && error.message ? error.message : String(error);
    if (targetPage.isClosed() || /target closed|browser has been closed|page crashed/i.test(message)) {
      throw new Error(
        'The browser disconnected during "' + method + '". The operation may have completed; ' +
        "call artclub_get_status before retrying. The next tool call will reconnect automatically. " +
        "Original error: " + message
      );
    }
    throw error;
  } finally {
    signal?.removeEventListener("abort", abortListener);
    if (activeBrowserOperation === operation) activeBrowserOperation = null;
  }
}

function invoke(method, args) {
  const scope = requestScope.getStore();
  if (!scope) return invokeNow(method, args);
  throwIfAborted(scope.signal);
  return invokeNow(method, args, scope);
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

function attachRequestId(result, requestId) {
  if (!result || typeof result !== "object" || Array.isArray(result)) {
    throw new Error("MCP tool handlers must return a result object.");
  }
  const response = {
    ...result,
    _meta: { ...(result._meta || {}), request_id: requestId }
  };
  if (response.structuredContent && typeof response.structuredContent === "object" &&
      !Array.isArray(response.structuredContent)) {
    response.structuredContent = {
      ...response.structuredContent,
      request_id: requestId
    };
  }
  return response;
}

function structuredToolError(name, error, requestId) {
  const message = error && error.message ? error.message : String(error);
  return {
    content: [{
      type: "text",
      text: name + " failed [" + requestId + "]: " + message
    }],
    structuredContent: {
      ok: false,
      error: {
        tool: name,
        name: error && error.name ? error.name : "Error",
        code: error && typeof error.code === "string" ? error.code : "TOOL_FAILED",
        request_id: requestId,
        outcome_uncertain: Boolean(error && error.outcomeUncertain),
        message
      }
    },
    _meta: { request_id: requestId },
    isError: true
  };
}

function registerTool(server, name, description, inputSchema, handler) {
  server.registerTool(name, { description, inputSchema }, async (args, context) => {
    const requestId = randomUUID();
    const input = args || {};
    try {
      assertJsonByteLimit(input, MAX_TOOL_INPUT_BYTES, {
        code: "INPUT_TOO_LARGE",
        label: "Tool input",
        toolName: name,
        requestId
      });
      const result = await operationQueue.run(
        ({ signal }) => requestScope.run(
          { requestId, toolName: name, signal },
          async () => {
            const value = await handler(input);
            assertJsonByteLimit(value, MAX_TOOL_OUTPUT_BYTES, {
              code: "OUTPUT_TOO_LARGE",
              label: "Tool output",
              toolName: name,
              requestId
            });
            return value;
          }
        ),
        {
          requestId,
          toolName: name,
          timeoutMs: getToolDeadlineMs(name, input),
          signal: context?.mcpReq?.signal,
          onAbort: () => interruptBrowserOperation(requestId)
        }
      );
      return attachRequestId(result, requestId);
    } catch (error) {
      if (context?.mcpReq?.signal?.aborted) {
        console.error("[Art Club] MCP request cancelled:", name, requestId);
      }
      return structuredToolError(name, error, requestId);
    }
  });
}

async function main() {
  await connectToEditor();

  const server = new McpServer(
    { name: "art-club-pixel-studio", version: "0.3.0" },
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
    z.object({ project_json: z.string().min(2).max(MAX_TOOL_INPUT_BYTES), expected_revision: revision }),
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

  let stdioHandle;
  const shutdown = async ({ closeTransport = true, reason = "The MCP server is shutting down; pending tool requests were cancelled." } = {}) => {
    if (shutdownPromise) return shutdownPromise;
    shutdownPromise = (async () => {
      await operationQueue.close({ reason });
      const context = browserContext;
      browserContext = null;
      page = null;
      activeBrowserOperation = null;
      try { await context?.close(); } catch (error) {
        console.error("[Art Club] Browser shutdown:", error.message);
      }
      if (closeTransport) {
        try { await stdioHandle?.close(); } catch (error) {
          console.error("[Art Club] MCP transport shutdown:", error.message);
        }
      }
    })();
    return shutdownPromise;
  };
  const reportShutdownError = error => {
    console.error("[Art Club] Shutdown failed:", error && error.message ? error.message : error);
  };
  process.once("SIGINT", () => { void shutdown().catch(reportShutdownError); });
  process.once("SIGTERM", () => { void shutdown().catch(reportShutdownError); });
  process.stdin.once("end", () => {
    void shutdown({
      closeTransport: false,
      reason: "The MCP client closed its stdio input; pending requests were cancelled."
    }).catch(reportShutdownError);
  });
  process.stdin.once("close", () => {
    void shutdown({
      closeTransport: false,
      reason: "The MCP client closed its stdio input; pending requests were cancelled."
    }).catch(reportShutdownError);
  });

  // serveStdio returns a handle immediately; the open stdio transport keeps
  // the process alive while the client is connected. Do not await the handle.
  stdioHandle = serveStdio(() => server);
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
