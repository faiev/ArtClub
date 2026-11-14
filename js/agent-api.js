/*!
 * One Pixel Studio — Agent API
 * Stable browser API for local automation and AI-agent integrations.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ArtClubAgentAPI = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const PROTOCOL_VERSION = 1;

  function requireAdapter(adapter) {
    const required = [
      "getStatus", "getCanvas", "getPixel", "execute",
      "undo", "redo", "save", "exportProject", "importProject", "listProjects", "openProject", "exportPNG",
      "listLayers", "addLayer", "selectLayer", "setLayerVisibility", "setLayerLocked",
      "renameLayer", "moveLayer", "duplicateLayer", "deleteLayer",
      "setSelection", "selectAll", "copySelection", "cutSelection",
      "pasteSelection", "clearSelection", "deselect", "moveSelection", "transformSelection",
      "listFrames", "addFrame", "duplicateFrame", "selectFrame", "deleteFrame",
      "moveFrame", "setFrameDuration", "renameFrame"
    ];
    const missing = required.filter(function (name) {
      return !adapter || typeof adapter[name] !== "function";
    });
    if (missing.length) {
      throw new Error("Agent API adapter is missing: " + missing.join(", "));
    }
  }

  function create(adapter) {
    requireAdapter(adapter);

    function executeOne(command, options) {
      return adapter.execute([command], options || {});
    }

    return Object.freeze({
      protocol: "one-pixel-studio-agent",
      protocol_version: PROTOCOL_VERSION,
      get_status: function () {
        return adapter.getStatus();
      },
      get_canvas: function (options) {
        return adapter.getCanvas(options || {});
      },
      get_palette: function () {
        return adapter.getStatus().palette;
      },
      get_pixel: function (coordinates) {
        return adapter.getPixel(coordinates || {});
      },
      execute: function (request) {
        request = request || {};
        return adapter.execute(request.commands, request);
      },
      draw_pixel: function (args) {
        return executeOne(Object.assign({ type: "draw_pixel" }, args || {}), args || {});
      },
      draw_line: function (args) {
        return executeOne(Object.assign({ type: "draw_line" }, args || {}), args || {});
      },
      draw_rectangle: function (args) {
        return executeOne(Object.assign({ type: "draw_rectangle" }, args || {}), args || {});
      },
      draw_ellipse: function (args) {
        return executeOne(Object.assign({ type: "draw_ellipse" }, args || {}), args || {});
      },
      fill: function (args) {
        return executeOne(Object.assign({ type: "fill" }, args || {}), args || {});
      },
      erase_pixel: function (args) {
        return executeOne(Object.assign({ type: "erase_pixel" }, args || {}), args || {});
      },
      erase_rectangle: function (args) {
        return executeOne(Object.assign({ type: "erase_rectangle" }, args || {}), args || {});
      },
      clear_canvas: function (options) {
        return executeOne({ type: "clear_canvas" }, options || {});
      },
      set_color: function (args) {
        return executeOne(Object.assign({ type: "set_color" }, args || {}), args || {});
      },
      undo: function () {
        return adapter.undo();
      },
      redo: function () {
        return adapter.redo();
      },
      save: function () {
        return adapter.save();
      },
      export_project: function () {
        return adapter.exportProject();
      },
      import_project: function (payload) {
        return adapter.importProject(payload);
      },
      list_projects: function () {
        return adapter.listProjects();
      },
      open_project: function (payload) {
        return adapter.openProject(payload || {});
      },
      export_png: function () {
        return adapter.exportPNG();
      },
      list_layers: function () {
        return adapter.listLayers().layers;
      },
      add_layer: function (args) {
        return adapter.addLayer(args || {});
      },
      select_layer: function (args) {
        return adapter.selectLayer(args || {});
      },
      set_layer_visibility: function (args) {
        return adapter.setLayerVisibility(args || {});
      },
      set_layer_locked: function (args) {
        return adapter.setLayerLocked(args || {});
      },
      rename_layer: function (args) {
        return adapter.renameLayer(args || {});
      },
      move_layer: function (args) {
        return adapter.moveLayer(args || {});
      },
      duplicate_layer: function (args) {
        return adapter.duplicateLayer(args || {});
      },
      delete_layer: function (args) {
        return adapter.deleteLayer(args || {});
      },
      set_selection: function (args) {
        return adapter.setSelection(args || {});
      },
      select_all: function (args) {
        return adapter.selectAll(args || {});
      },
      copy_selection: function (args) {
        return adapter.copySelection(args || {});
      },
      cut_selection: function (args) {
        return adapter.cutSelection(args || {});
      },
      paste_selection: function (args) {
        return adapter.pasteSelection(args || {});
      },
      clear_selection: function (args) {
        return adapter.clearSelection(args || {});
      },
      deselect: function (args) {
        return adapter.deselect(args || {});
      },
      move_selection: function (args) {
        return adapter.moveSelection(args || {});
      },
      transform_selection: function (args) {
        return adapter.transformSelection(args || {});
      },
      list_frames: function () {
        return adapter.listFrames();
      },
      add_frame: function (args) {
        return adapter.addFrame(args || {});
      },
      duplicate_frame: function (args) {
        return adapter.duplicateFrame(args || {});
      },
      select_frame: function (args) {
        return adapter.selectFrame(args || {});
      },
      delete_frame: function (args) {
        return adapter.deleteFrame(args || {});
      },
      move_frame: function (args) {
        return adapter.moveFrame(args || {});
      },
      set_frame_duration: function (args) {
        return adapter.setFrameDuration(args || {});
      },
      rename_frame: function (args) {
        return adapter.renameFrame(args || {});
      }
    });
  }

  return Object.freeze({
    PROTOCOL_VERSION: PROTOCOL_VERSION,
    create: create
  });
});
