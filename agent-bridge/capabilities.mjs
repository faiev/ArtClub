export const CAPABILITY_DOCUMENT_VERSION = 1;
export const AGENT_PROTOCOL_NAME = "one-pixel-studio-agent";
export const AGENT_PROTOCOL_VERSION = 1;
export const BRIDGE_VERSION = "0.7.0";

const READ_ONLY_TOOLS = [
  "artclub_get_status",
  "artclub_get_canvas",
  "artclub_get_pixel",
  "artclub_get_palette",
  "artclub_list_layers",
  "artclub_list_frames",
  "artclub_list_projects",
  "artclub_export_project",
  "artclub_export_png",
  "artclub_get_capabilities",
  "artclub_get_bridge_diagnostics"
];

const DOCUMENT_MUTATING_TOOLS = [
  "artclub_draw_pixel", "artclub_draw_line", "artclub_draw_rectangle",
  "artclub_draw_ellipse", "artclub_fill", "artclub_erase_pixel",
  "artclub_erase_rectangle", "artclub_set_color", "artclub_execute",
  "artclub_undo", "artclub_redo",
  "artclub_add_layer", "artclub_select_layer", "artclub_set_layer_visibility",
  "artclub_set_layer_locked", "artclub_rename_layer", "artclub_move_layer",
  "artclub_duplicate_layer", "artclub_delete_layer",
  "artclub_set_selection", "artclub_select_all", "artclub_copy_selection",
  "artclub_cut_selection", "artclub_paste_selection", "artclub_clear_selection",
  "artclub_deselect", "artclub_move_selection", "artclub_transform_selection",
  "artclub_add_frame", "artclub_duplicate_frame", "artclub_select_frame",
  "artclub_delete_frame", "artclub_move_frame", "artclub_set_frame_duration",
  "artclub_rename_frame", "artclub_open_project", "artclub_import_project"
];

const SESSION_MUTATING_TOOLS = [
  "artclub_play_animation",
  "artclub_pause_animation",
  "artclub_stop_animation_preview",
  "artclub_set_playback_mode",
  "artclub_set_onion_skin"
];

const STORAGE_MUTATING_TOOLS = ["artclub_save"];

const DEFAULT_TOOL_DEADLINES_MS = Object.freeze({
  artclub_get_status: 10_000,
  artclub_get_pixel: 10_000,
  artclub_get_canvas: 30_000,
  artclub_execute: 45_000,
  artclub_save: 30_000,
  artclub_open_project: 60_000,
  artclub_export_project: 45_000,
  artclub_import_project: 90_000,
  artclub_export_png: 25_000
});

const SUPPORTED_CLIENT_PROTOCOL_VERSIONS = Object.freeze([AGENT_PROTOCOL_VERSION]);

export class ProtocolCompatibilityError extends Error {
  constructor(clientVersion) {
    super(
      "Client protocol version " + String(clientVersion) +
      " is not supported. This bridge supports protocol version " +
      AGENT_PROTOCOL_VERSION +
      ". Update the client or use a client that negotiates protocol version " +
      AGENT_PROTOCOL_VERSION + "."
    );
    this.name = "ProtocolCompatibilityError";
    this.code = "PROTOCOL_VERSION_UNSUPPORTED";
  }
}

export function assertCompatibleClientProtocolVersion(clientVersion) {
  if (clientVersion === undefined) return;
  if (!Number.isSafeInteger(clientVersion) ||
      !SUPPORTED_CLIENT_PROTOCOL_VERSIONS.includes(clientVersion)) {
    throw new ProtocolCompatibilityError(clientVersion);
  }
}

function toolCatalog() {
  const entries = [];
  for (const name of READ_ONLY_TOOLS) {
    entries.push({ name, access: "read_only", requires_expected_revision: false });
  }
  for (const name of DOCUMENT_MUTATING_TOOLS) {
    entries.push({ name, access: "document_mutation", requires_expected_revision: true });
  }
  for (const name of SESSION_MUTATING_TOOLS) {
    entries.push({ name, access: "session_mutation", requires_expected_revision: false });
  }
  for (const name of STORAGE_MUTATING_TOOLS) {
    entries.push({ name, access: "storage_mutation", requires_expected_revision: false });
  }
  return entries;
}

export function createCapabilities(options = {}) {
  const bridgeVersion = options.bridgeVersion || BRIDGE_VERSION;
  const maxToolInputBytes = options.maxToolInputBytes ?? 8 * 1024 * 1024;
  const maxToolOutputBytes = options.maxToolOutputBytes ?? 16 * 1024 * 1024;
  const maxPendingOperations = options.maxPendingOperations ?? 64;
  const defaultToolDeadlineMs = options.defaultToolDeadlineMs ?? 30_000;
  const maxToolDeadlineMs = options.maxToolDeadlineMs ?? 120_000;
  const configuredDeadlines = options.toolDeadlinesMs ?? DEFAULT_TOOL_DEADLINES_MS;
  const perToolDeadlines = Object.fromEntries(
    Object.entries(configuredDeadlines).map(([name, milliseconds]) => [
      name,
      Math.min(milliseconds, maxToolDeadlineMs)
    ])
  );
  const catalog = toolCatalog();

  return {
    document_version: CAPABILITY_DOCUMENT_VERSION,
    protocol: {
      name: AGENT_PROTOCOL_NAME,
      version: AGENT_PROTOCOL_VERSION,
      supported_client_versions: SUPPORTED_CLIENT_PROTOCOL_VERSIONS.slice(),
      minimum_client_version: AGENT_PROTOCOL_VERSION,
      maximum_client_version: AGENT_PROTOCOL_VERSION
    },
    bridge: {
      name: "art-club-mcp-bridge",
      version: bridgeVersion,
      transport: "stdio",
      local_only: true
    },
    tools: {
      total: catalog.length,
      read_only: READ_ONLY_TOOLS.slice(),
      document_mutating: DOCUMENT_MUTATING_TOOLS.slice(),
      session_mutating: SESSION_MUTATING_TOOLS.slice(),
      storage_mutating: STORAGE_MUTATING_TOOLS.slice(),
      revision_required: DOCUMENT_MUTATING_TOOLS.slice(),
      catalog
    },
    revision_policy: {
      field: "expected_revision",
      required_for: "document_mutating",
      conflict: {
        behavior: "reject_without_replay",
        error_code: "STALE_REVISION",
        recovery: "Call artclub_get_status, inspect the current document, then decide whether to submit a new operation with the latest revision."
      },
      concurrency: {
        within_one_bridge_process: "serialized",
        across_bridge_processes: "exclusive_profile_lock",
        automatic_retry: false
      }
    },
    limits: {
      max_canvas_width: 512,
      max_canvas_height: 512,
      max_layers: 32,
      max_frames: 256,
      max_palette_colors: 256,
      max_total_cel_pixels: 16_777_216,
      max_batch_commands: 1_000,
      max_tool_input_bytes: maxToolInputBytes,
      max_tool_output_bytes: maxToolOutputBytes,
      max_pending_operations: maxPendingOperations
    },
    execution: {
      default_deadline_ms: Math.min(defaultToolDeadlineMs, maxToolDeadlineMs),
      maximum_deadline_ms: maxToolDeadlineMs,
      per_tool_deadline_ms: perToolDeadlines,
      cancellation: {
        supported: true,
        queued_request: "removed_before_execution",
        active_request: "page_interrupted_and_queue_slot_held_until_evaluation_unwinds",
        outcome_may_be_uncertain: true,
        error_codes: ["OPERATION_CANCELLED", "OPERATION_TIMEOUT", "QUEUE_FULL"]
      }
    },
    exports: {
      editable_project_json: { import: true, export: true },
      png_preview: true,
      sprite_sheet: false,
      gif: false,
      palette_formats: false
    },
    diagnostics: {
      available: true,
      bridge_runtime: true,
      bridge_doctor: false,
      read_only_project_inspection: false
    },
    features: {
      layers: true,
      selections: true,
      animation_timeline: true,
      animation_preview: true,
      project_library: true,
      onion_skin: true,
      cross_process_profile_lock: true,
      operation_deadlines: true,
      request_cancellation: true,
      reconnect_state_reporting: true,
      queue_metrics: true,
      redacted_diagnostics: true
    }
  };
}
